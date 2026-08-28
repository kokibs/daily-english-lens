import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import LoginClient from "./login-client";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect("/");
  }

  return <LoginClient configured={configured} />;
}
