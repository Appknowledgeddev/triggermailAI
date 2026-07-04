import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in to manage your email automation workspace."
      footerText="Don't have an account?"
      footerHref="/sign-up"
      footerLink="Create account"
    >
      <SignInForm />
    </AuthShell>
  );
}
