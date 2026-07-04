import { AppShell } from "@/components/app-shell";
import { SettingsManager } from "@/components/settings/settings-manager";

export default function SettingsPage() {
  return (
    <AppShell
      eyebrow="Settings"
      title="Email account setup"
      description="Connect Gmail or Outlook so Trigger Mail AI can send, search, read replies, and power future email assistants."
      primaryActionHidden
    >
      <SettingsManager />
    </AppShell>
  );
}
