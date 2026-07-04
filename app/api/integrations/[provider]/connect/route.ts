import { NextResponse } from "next/server";
import { signOAuthState } from "@/lib/email/oauth-crypto";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

type RouteContext = {
  params: {
    provider: string;
  };
};

const googleScopes = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const microsoftScopes = [
  "offline_access",
  "User.Read",
  "Mail.Send",
  "Mail.Read",
].join(" ");

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    const provider = context.params.provider.toLowerCase();
    const baseUrl = getBaseUrl(request);

    if (provider === "gmail") {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
        return NextResponse.json({ error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting Gmail." }, { status: 400 });
      }

      const state = signOAuthState({ provider: "gmail", workspaceId, userId: user.id, createdAt: Date.now() });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", `${baseUrl}/api/integrations/gmail/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("scope", googleScopes);
      url.searchParams.set("state", state);
      return NextResponse.json({ url: url.toString() });
    }

    if (provider === "outlook") {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      if (!clientId || !process.env.MICROSOFT_CLIENT_SECRET) {
        return NextResponse.json({ error: "Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET before connecting Outlook." }, { status: 400 });
      }

      const state = signOAuthState({ provider: "outlook", workspaceId, userId: user.id, createdAt: Date.now() });
      const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", `${baseUrl}/api/integrations/outlook/callback`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("scope", microsoftScopes);
      url.searchParams.set("state", state);
      return NextResponse.json({ url: url.toString() });
    }

    return NextResponse.json({ error: "Choose Gmail or Outlook." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Email account connection could not be started.") }, { status: 500 });
  }
}
