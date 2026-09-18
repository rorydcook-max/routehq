import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { AuthCard } from "@/components/auth-card";

export default function ForgotPasswordPage() {
  return (
    <AuthCard eyebrow="RouteHQ" title="Reset your password">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
