import { NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Add a valid email address." }, { status: 400 });
    }

    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({ error: "The waiting list is not connected yet." }, { status: 503 });
    }

    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("waitlist_signups")
      .upsert({ email, source: "sign-up-page" }, { onConflict: "email" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "You're on the waiting list. We'll email you when access opens." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "We could not add you to the waiting list." },
      { status: 500 },
    );
  }
}
