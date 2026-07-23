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

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const nextPath = String(formData.get("redirectTo") || "/");

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
      redirect(
        `/login?error=${encodeURIComponent("이메일 또는 비밀번호를 다시 확인해줘")}&redirect=${encodeURIComponent(nextPath)}`,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      redirect(
        `/login?error=${encodeURIComponent("계정 권한 정보가 없어. app_users 설정을 확인해줘")}&redirect=/`,
      );
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
    <main className="min-h-screen bg-[#ffffff] px-5 py-10 text-[#171717]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#f2cdda] bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden bg-[#e8e2da] p-8 md:block">
            <div className="absolute left-8 top-8 rounded-full bg-white/70 px-4 py-2 text-xs font-black text-[#171717]">
              Tutor Flow
            </div>

            <div className="flex h-full flex-col justify-end">
              <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 backdrop-blur">
                <p className="text-sm font-black text-[#171717]">
                  오늘의 작은 기록이
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-[#171717]">
                  다음 등급으로 가는
                  <br />
                  제일 확실한 길
                </h2>
                <p className="mt-4 text-sm font-semibold leading-6 text-[#525252]">
                  수업기록, 시험범위, 수행평가, 공부계획을 한곳에서 확인해요.
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
                1등급으로 가는 길
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#525252]">
                선생님 또는 학생 계정으로 로그인해주세요.
              </p>
            </div>

            {resolvedSearchParams.error && (
              <div className="mb-5 rounded-2xl border border-[#f3b7c8] bg-[#f0ece6] px-4 py-3 text-sm font-bold text-[#171717]">
                {resolvedSearchParams.error}
              </div>
            )}

            <form action={login} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div>
                <label className="mb-2 block text-sm font-black text-[#5c5751]">
                  이메일
                </label>
                <input
                  name="email"
                  type="email"
                  required
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
                  required
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#7f736a] focus:bg-white"
                />
              </div>

              <div className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 text-xs font-semibold leading-5 text-[#525252]">
                브라우저 쿠키로 로그인 상태가 유지돼요. 공용 기기에서는 사용 후 로그아웃해주세요.
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#7f736a] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#171717]"
              >
                로그인
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
