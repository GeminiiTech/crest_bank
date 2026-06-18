import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AvatarUploader } from "@/components/dashboard/avatar-uploader";
import { PasswordForm } from "@/components/dashboard/password-form";
import { NotificationsForm } from "@/components/dashboard/notifications-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/dashboard/settings");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>

      <Card data-tour="settings-profile">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUploader avatarUrl={profile.avatar_url} name={profile.full_name ?? ""} />
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card data-tour="settings-security">
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card data-tour="settings-notifications">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsForm prefs={profile.notification_prefs} />
        </CardContent>
      </Card>
    </div>
  );
}
