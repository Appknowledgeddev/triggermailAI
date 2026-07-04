import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Reset password"
      title="Get a reset link"
      description="Enter your email and we'll send instructions to reset your password."
      footerText="Remembered your password?"
      footerHref="/login"
      footerLink="Back to sign in"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
