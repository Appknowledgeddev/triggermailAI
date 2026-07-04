import { NextResponse } from "next/server";
import { encryptToken, verifyOAuthState } from "@/lib/email/oauth-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    provider: string;
  };
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfile = {
  email?: string;
  name?: string;
  picture?: string;
};

type MicrosoftProfile = {
  mail?: string | null;
  userPrincipalName?: string;
  displayName?: string;
};

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function redirectToSettings(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", getBaseUrl(request));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

async function exchangeGoogleCode(request: Request, code: string) {
  const baseUrl = getBaseUrl(request);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${baseUrl}/api/integrations/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  const token = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Gmail connection could not be completed.");
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleProfile;

  if (!profileResponse.ok || !profile.email) {
    throw new Error("Gmail account details could not be loaded.");
  }

  return {
    email: profile.email.toLowerCase(),
    displayName: profile.name || profile.email,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresIn: token.expires_in || 3600,
    scopes: token.scope?.split(/\s+/).filter(Boolean) || [],
    metadata: { picture: profile.picture || null },
  };
}

async function exchangeMicrosoftCode(request: Request, code: string) {
  const baseUrl = getBaseUrl(request);
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: `${baseUrl}/api/integrations/outlook/callback`,
      grant_type: "authorization_code",
    }),
  });
  const token = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Outlook connection could not be completed.");
  }

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as MicrosoftProfile;
  const email = (profile.mail || profile.userPrincipalName || "").toLowerCase();

  if (!profileResponse.ok || !email) {
    throw new Error("Outlook account details could not be loaded.");
  }

  return {
    email,
    displayName: profile.displayName || email,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresIn: token.expires_in || 3600,
    scopes: token.scope?.split(/\s+/).filter(Boolean) || [],
    metadata: {},
  };
}

export async function GET(request: Request, context: RouteContext) {
  const provider = context.params.provider.toLowerCase();

  try {
    if (provider !== "gmail" && provider !== "outlook") {
      return redirectToSettings(request, { connected_error: "provider" });
    }

    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (error) {
      return redirectToSettings(request, { connected_error: error });
    }

    if (!code || !state) {
      throw new Error("The connection response was incomplete. Please start again.");
    }

    const statePayload = verifyOAuthState(state);
    if (statePayload.provider !== provider) {
      throw new Error("The connection provider did not match. Please start again.");
    }

    const account = provider === "gmail"
      ? await exchangeGoogleCode(request, code)
      : await exchangeMicrosoftCode(request, code);
    const supabase = createSupabaseAdminClient();
    const expiresAt = new Date(Date.now() + account.expiresIn * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("connected_email_accounts")
      .upsert({
        workspace_id: statePayload.workspaceId,
        provider,
        email: account.email,
        display_name: account.displayName,
        status: "connected",
        access_token_encrypted: encryptToken(account.accessToken),
        refresh_token_encrypted: account.refreshToken ? encryptToken(account.refreshToken) : null,
        token_expires_at: expiresAt,
        scopes: account.scopes,
        metadata: account.metadata,
        created_by: statePayload.userId,
      }, { onConflict: "workspace_id,provider,email" });

    if (upsertError) {
      throw upsertError;
    }

    return redirectToSettings(request, { connected: provider });
  } catch (error) {
    console.error("Email account callback failed", getErrorMessage(error));
    return redirectToSettings(request, { connected_error: "account" });
  }
}
