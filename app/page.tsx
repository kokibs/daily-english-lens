import { redirect } from "next/navigation";
import DashboardClient, { type AppUser } from "./dashboard-client";
import { isSupabaseConfigured } from "../lib/supabase/config";
import { createClient } from "../lib/supabase/server";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="configuration-page">
        <div className="configuration-card">
          <span className="brand-mark">D</span>
          <p className="kicker">Daily English Lens</p>
          <h1>Cloud setup is almost ready.</h1>
          <p>Supabaseの接続情報を設定すると、Googleログインと端末をまたいだ保存が有効になります。</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const metadata = user.user_metadata as Record<string, unknown>;
  const appUser: AppUser = {
    id: user.id,
    email: user.email ?? "",
    displayName: typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email?.split("@")[0] ?? "Learner",
    avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
  };

  return <DashboardClient user={appUser} />;
}
