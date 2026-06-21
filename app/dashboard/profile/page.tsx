import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data/profile";
import { formatTxnDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/dashboard/profile");

  const initial = (profile.full_name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Your profile photo"
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span
                className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
                aria-hidden
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">{profile.full_name || "—"}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email ?? "—"}</p>
            </div>
          </div>

          <dl className="mt-6 divide-y">
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile.phone || "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Country</dt>
              <dd className="font-medium">{profile.country || "—"}</dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">KYC status</dt>
              <dd>
                <Badge variant={profile.kyc_status === "verified" ? "success" : "secondary"}>
                  {profile.kyc_status}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatTxnDate(profile.created_at)}</dd>
            </div>
          </dl>

          <Button asChild className="mt-6">
            <Link href="/dashboard/settings">Edit in settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
