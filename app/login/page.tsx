import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in to manage your email automation workspace."
      footerText="Need access?"
      footerHref="/sign-up"
      footerLink="Join waitlist"
    >
      <SignInForm />
    </AuthShell>
  );
}
