import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/data/notifications";
import { getProfile } from "@/lib/data/profile";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { TourProvider } from "@/components/dashboard/tour/tour-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";
  const notifications = await getNotifications();
  const profile = await getProfile();

  return (
    <TourProvider>
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden bg-navy-900 lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarNav />
          </div>
        </aside>
        <div className="flex min-h-screen flex-col">
          <Topbar name={name} email={user.email ?? ""} notifications={notifications} avatarUrl={profile?.avatar_url ?? null} isAdmin={profile?.role === "admin"} />
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TourProvider>
  );
}
