import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headersToSet).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // Supabase recommends getClaims() here because it validates the signed JWT.
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims);
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth");
  const isLoginRoute = pathname.startsWith("/login");
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicRoute = pathname === "/privacy" || pathname === "/manifest.webmanifest" || pathname === "/sw.js";

  if (!hasSession && !isAuthRoute && !isLoginRoute && !isApiRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    const album = pathname === "/" ? request.nextUrl.searchParams.get("album") : null;
    const play = request.nextUrl.searchParams.get("play") === "1";
    url.pathname = "/login";
    url.search = "";
    if (album && /^\d{4}-(0[1-9]|1[0-2])$/.test(album) && play) {
      url.searchParams.set("album", album);
      url.searchParams.set("play", "1");
    }
    return NextResponse.redirect(url);
  }

  if (hasSession && isLoginRoute) {
    const url = request.nextUrl.clone();
    const album = request.nextUrl.searchParams.get("album");
    const play = request.nextUrl.searchParams.get("play") === "1";
    url.pathname = "/";
    url.search = "";
    if (album && /^\d{4}-(0[1-9]|1[0-2])$/.test(album) && play) {
      url.searchParams.set("album", album);
      url.searchParams.set("play", "1");
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
