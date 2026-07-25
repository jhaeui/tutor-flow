import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const redirectTo = resolvedSearchParams.redirect || "/";

  async function login(formData: FormData) {
    "use server";

    const rawEmail = String(formData.get("email") || "").trim();
    const rawPassword = String(formData.get("password") || "");
    const teacherCode = String(formData.get("teacherCode") || "").trim();
    const loginMode = String(formData.get("loginMode") || "email");
    const nextPath = String(formData.get("redirectTo") || "/");
    const teacherPin = process.env.TEACHER_LOGIN_PIN || "5084";
    const teacherEmail = process.env.TEACHER_LOGIN_EMAIL || "";
    const teacherPassword = process.env.TEACHER_LOGIN_PASSWORD || "";
    const isTeacherCodeLogin = loginMode === "teacherCode";
    const email = isTeacherCodeLogin ? teacherEmail : rawEmail;
    const password = isTeacherCodeLogin ? teacherPassword : rawPassword;

    if (isTeacherCodeLogin && !/^\d{4}$/.test(teacherCode)) {
      redirect(
        `/login?error=${encodeURIComponent("선생님 코드는 숫자 4자리로 입력해줘")}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    if (isTeacherCodeLogin && teacherCode !== teacherPin) {
      redirect(
        `/login?error=${encodeURIComponent("선생님 코드가 맞지 않아")}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    if (isTeacherCodeLogin && (!teacherEmail || !teacherPassword)) {
      redirect(
        `/login?error=${encodeURIComponent("선생님 빠른 로그인 계정 설정이 필요해")}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    if (!email || !password) {
      redirect(
        `/login?error=${encodeURIComponent("이메일과 비밀번호를 입력해줘")}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const message = error?.message
        ? `로그인 실패: ${error.message}`
        : "로그인 정보를 다시 확인해줘";
      redirect(
        `/login?error=${encodeURIComponent(message)}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", data.user.id)
      .single();

    if ((profileError || !profile) && process.env.NODE_ENV === "development") {
      redirect("/");
    }

    if (profileError || !profile) {
      const message = profileError?.message
        ? `계정 권한 확인 실패: ${profileError.message}`
        : "계정 권한 정보가 없어. app_users 설정을 확인해줘";
      redirect(`/login?error=${encodeURIComponent(message)}&redirect=/`);
    }

    if (profile.role === "student") {
      redirect("/student");
    }

    if (profile.role === "teacher") {
      redirect("/");
    }

    redirect(
      `/login?error=${encodeURIComponent("계정 역할(role)이 올바르지 않아")}&redirect=/`,
    );
  }

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-[#171717]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#f2cdda] bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden bg-[#e8e2da] p-8 md:block">
            <div className="absolute left-8 top-8 rounded-full bg-white/70 px-4 py-2 text-xs font-black text-[#171717]">
              Tutor Flow
            </div>

            <div className="flex h-full flex-col justify-end">
              <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 backdrop-blur">
                <p className="text-sm font-black text-[#171717]">오늘의 기록</p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-[#171717]">
                  선생님 대시보드로
                  <br />
                  바로 들어가기
                </h2>
                <p className="mt-4 text-sm font-semibold leading-6 text-[#525252]">
                  수업기록, 시험범위, 수행평가, 공지계획을 한곳에서 확인해요.
                </p>
              </div>
            </div>
          </section>

          <section className="p-7 sm:p-10">
            <div className="mb-8">
              <p className="mb-2 text-sm font-black text-[#171717]">
                Welcome back
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#171717]">
                로그인
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#525252]">
                선생님 코드를 쓰거나 이메일 계정으로 로그인해 주세요.
              </p>
            </div>

            {resolvedSearchParams.error && (
              <div className="mb-5 rounded-2xl border border-[#f3b7c8] bg-[#f0ece6] px-4 py-3 text-sm font-bold text-[#171717]">
                {resolvedSearchParams.error}
              </div>
            )}

            <form action={login} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="loginMode" value="teacherCode" />

              <div>
                <label className="mb-2 block text-sm font-black text-[#5c5751]">
                  선생님 코드
                </label>
                <input
                  name="teacherCode"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="one-time-code"
                  placeholder="숫자 4자리"
                  className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#7f736a] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#4a4641]"
              >
                선생님 코드로 로그인
              </button>
            </form>

            <form
              action={login}
              className="mt-6 space-y-4 border-t border-[#e5e5e5] pt-6"
            >
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="loginMode" value="email" />

              <div>
                <label className="mb-2 block text-sm font-black text-[#5c5751]">
                  이메일
                </label>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#7f736a] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-[#5c5751]">
                  비밀번호
                </label>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#7f736a] focus:bg-white"
                />
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 text-xs font-semibold leading-5 text-[#525252]">
                로그인 상태는 브라우저 쿠키로 유지돼요.
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#7f736a] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#171717]"
              >
                이메일로 로그인
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
