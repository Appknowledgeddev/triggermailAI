import { AuthShell } from "@/components/auth-shell";
import { WaitlistForm } from "@/components/auth/waitlist-form";

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Under development"
      title="Access is opening soon"
      description="Trigger Mail AI is not accepting new accounts yet. Join the waiting list and we'll let you know when access opens."
      footerText="Already have access?"
      footerHref="/login"
      footerLink="Sign in"
    >
      <WaitlistForm />
    </AuthShell>
  );
}
