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

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return response;
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("role, student_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const isTeacher = profile.role === "teacher";

  if (isTeacher) {
    return response;
  }

  // 학생 계정이면 대시보드, 월별정산, 학생목록 차단
  if (isTeacherOnlyPath(pathname)) {
    const studentHomeUrl = request.nextUrl.clone();
    studentHomeUrl.pathname = "/student";
    return NextResponse.redirect(studentHomeUrl);
  }

  return response;
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
