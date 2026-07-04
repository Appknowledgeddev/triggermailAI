import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="Start your workspace"
      description="Create an account for your Trigger Mail AI workspace."
      footerText="Already have an account?"
      footerHref="/login"
      footerLink="Sign in"
    >
      <SignUpForm />
    </AuthShell>
  );
}
