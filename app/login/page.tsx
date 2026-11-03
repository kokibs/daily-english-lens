import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";
import LoginClient from "./login-client";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ album?: string; play?: string }> }) {
  const params = await searchParams;
  const album = typeof params.album === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.album) && params.play === "1"
    ? params.album
    : null;
  const nextPath = album ? `/?album=${album}&play=1` : "/";
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect(nextPath);
  }

  return <LoginClient configured={configured} nextPath={nextPath} />;
}
