import { decryptToken, encryptToken } from "@/lib/email/oauth-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type DeliveryProvider = "resend" | "gmail" | "outlook" | "smtp";

export type SendEmailInput = {
  provider: DeliveryProvider;
  from: string;
  to: string;
  subject: string;
  html: string;
  connectedAccountId?: string | null;
};

export type SendEmailResult = {
  ok: boolean;
  provider: DeliveryProvider;
  id?: string;
  reason?: string;
};

type ConnectedEmailAccount = {
  id: string;
  provider: DeliveryProvider;
  email: string;
  status: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
};

type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    return {
      ok: false,
      provider: "resend",
      reason: "RESEND_API_KEY is not configured, so the email was not sent.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok) {
    return {
      ok: false,
      provider: "resend",
      reason: payload.message || payload.error || "Email provider rejected the message.",
    };
  }

  return {
    ok: true,
    provider: "resend",
    id: payload.id,
  };
}

function encodeSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage(input: SendEmailInput, accountEmail: string) {
  const from = accountEmail || input.from;
  return [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.html,
  ].join("\r\n");
}

async function loadConnectedAccount(input: SendEmailInput) {
  if (!input.connectedAccountId) {
    throw new Error("Choose a connected sending account before sending with Gmail or Outlook.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: account, error } = await supabase
    .from("connected_email_accounts")
    .select("id, provider, email, status, access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("id", input.connectedAccountId)
    .eq("provider", input.provider)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!account) {
    throw new Error("The selected sending account could not be found.");
  }

  if (account.status !== "connected" || !account.access_token_encrypted) {
    throw new Error("The selected sending account is not connected yet.");
  }

  return account as ConnectedEmailAccount;
}

async function refreshConnectedAccount(account: ConnectedEmailAccount) {
  if (!account.refresh_token_encrypted) {
    throw new Error("This connected account needs to be reconnected before it can send.");
  }

  const refreshToken = decryptToken(account.refresh_token_encrypted);
  const endpoint = account.provider === "gmail"
    ? "https://oauth2.googleapis.com/token"
    : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const clientId = account.provider === "gmail" ? process.env.GOOGLE_CLIENT_ID : process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = account.provider === "gmail" ? process.env.GOOGLE_CLIENT_SECRET : process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(`${account.provider === "gmail" ? "Google" : "Microsoft"} app credentials are missing on the server.`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as RefreshResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "The connected sending account needs to be reconnected.");
  }

  const expiresAt = new Date(Date.now() + (payload.expires_in || 3600) * 1000).toISOString();
  const supabase = createSupabaseAdminClient();
  const nextRefreshToken = payload.refresh_token ? encryptToken(payload.refresh_token) : account.refresh_token_encrypted;

  const { error } = await supabase
    .from("connected_email_accounts")
    .update({
      access_token_encrypted: encryptToken(payload.access_token),
      refresh_token_encrypted: nextRefreshToken,
      token_expires_at: expiresAt,
      status: "connected",
    })
    .eq("id", account.id);

  if (error) {
    throw error;
  }

  return payload.access_token;
}

async function updateLastUsed(accountId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("connected_email_accounts")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", accountId);
}

async function sendWithGmail(input: SendEmailInput, accessToken: string, account: ConnectedEmailAccount) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodeBase64Url(buildMimeMessage(input, account.email)),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

  if (!response.ok) {
    return {
      ok: false,
      provider: "gmail" as const,
      reason: payload.error?.message || "Gmail rejected the message.",
      status: response.status,
    };
  }

  return {
    ok: true,
    provider: "gmail" as const,
    id: payload.id,
    status: response.status,
  };
}

async function sendWithOutlook(input: SendEmailInput, accessToken: string, account: ConnectedEmailAccount) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: input.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };

  if (!response.ok) {
    return {
      ok: false,
      provider: "outlook" as const,
      reason: payload.error?.message || "Outlook rejected the message.",
      status: response.status,
    };
  }

  return {
    ok: true,
    provider: "outlook" as const,
    id: "accepted",
    status: response.status,
  };
}

async function sendWithConnectedAccount(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const account = await loadConnectedAccount(input);
    let accessToken = decryptToken(account.access_token_encrypted || "");
    let result = input.provider === "gmail"
      ? await sendWithGmail(input, accessToken, account)
      : await sendWithOutlook(input, accessToken, account);

    if (!result.ok && result.status === 401) {
      accessToken = await refreshConnectedAccount(account);
      result = input.provider === "gmail"
        ? await sendWithGmail(input, accessToken, account)
        : await sendWithOutlook(input, accessToken, account);
    }

    if (result.ok) {
      await updateLastUsed(account.id);
      return { ok: true, provider: input.provider, id: result.id };
    }

    return { ok: false, provider: input.provider, reason: result.reason };
  } catch (error) {
    return {
      ok: false,
      provider: input.provider,
      reason: error instanceof Error && error.message ? error.message : "The connected sending account could not send this email.",
    };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (input.provider === "resend") {
    return sendWithResend(input);
  }

  if (input.provider === "gmail" || input.provider === "outlook") {
    return sendWithConnectedAccount(input);
  }

  return {
    ok: false,
    provider: "smtp",
    reason: "SMTP sending is not connected yet.",
  };
}
