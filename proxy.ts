import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const teacherOnlyPaths = [
  "/dashboard",
  "/monthly-settlement",
  "/payments",
  "/settlement",
  "/students",
];

function isTeacherOnlyPath(pathname: string) {
  if (pathname === "/") return true;

  return teacherOnlyPaths.some((path) => pathname.startsWith(path));
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });

            response = NextResponse.next({
              request,
            });

            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin(request, pathname);
    }

    const { data: profile } = await supabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", user.id)
      .single();

    if (!profile && process.env.NODE_ENV === "development") {
      return response;
    }

    if (!profile) {
      return redirectToLogin(request, pathname);
    }

    if (profile.role === "teacher") {
      return response;
    }

    if (isTeacherOnlyPath(pathname)) {
      const studentHomeUrl = request.nextUrl.clone();
      studentHomeUrl.pathname = "/student";
      return NextResponse.redirect(studentHomeUrl);
    }

    return response;
  } catch {
    return redirectToLogin(request, pathname);
  }
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/monthly-settlement/:path*",
    "/settlement/:path*",
    "/students/:path*",
  ],
};
