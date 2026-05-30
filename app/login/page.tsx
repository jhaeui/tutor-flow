import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      redirect(
        `/login?error=${encodeURIComponent("이메일과 비밀번호를 입력해줘")}`,
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      redirect(
        `/login?error=${encodeURIComponent("이메일 또는 비밀번호를 다시 확인해줘")}`,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      redirect(
        `/login?error=${encodeURIComponent(
          `권한 확인 중 오류가 났어: ${profileError.message}`,
        )}`,
      );
    }

    if (!profile) {
      redirect(
        `/login?error=${encodeURIComponent(
          "로그인은 됐는데 app_users에 계정 권한이 연결되어 있지 않아.",
        )}`,
      );
    }

    revalidatePath("/", "layout");

    if (profile.role === "teacher") {
      redirect("/");
    }

    if (profile.role === "student") {
      if (!profile.student_id) {
        redirect(
          `/login?error=${encodeURIComponent(
            "학생 계정에 student_id가 연결되어 있지 않아.",
          )}`,
        );
      }

      redirect(`/students/${profile.student_id}`);
    }

    redirect(
      `/login?error=${encodeURIComponent(
        "app_users의 role 값이 teacher 또는 student가 아니야.",
      )}`,
    );
  }

  return (
    <main className="min-h-screen bg-[#fff1f7] px-5 py-10 text-[#3f3437]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#f2cdda] bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden bg-[#ffe4ef] p-8 md:block">
            <div className="absolute left-8 top-8 rounded-full bg-white/70 px-4 py-2 text-xs font-black text-[#d93675]">
              Tutor Flow
            </div>

            <div className="flex h-full flex-col justify-end">
              <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 backdrop-blur">
                <p className="text-sm font-black text-[#d93675]">
                  오늘의 작은 기록이
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-[#4a3c40]">
                  다음 등급으로 가는
                  <br />
                  제일 확실한 길
                </h2>
                <p className="mt-4 text-sm font-semibold leading-6 text-[#8b767c]">
                  수업기록, 시험범위, 수행평가, 공부계획을 한곳에서 확인해요.
                </p>
              </div>
            </div>
          </section>

          <section className="p-7 sm:p-10">
            <div className="mb-8">
              <p className="mb-2 text-sm font-black text-[#d93675]">
                Welcome back
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#3f3437]">
                1등급으로 가는 길
              </h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#8b767c]">
                선생님 또는 학생 계정으로 로그인해주세요.
              </p>
            </div>

            {resolvedSearchParams.error && (
              <div className="mb-5 rounded-2xl border border-[#f3b7c8] bg-[#fff0f6] px-4 py-3 text-sm font-bold text-[#d93675]">
                {resolvedSearchParams.error}
              </div>
            )}

            <form action={login} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-black text-[#6f5a61]">
                  이메일
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="email@example.com"
                  className="w-full rounded-2xl border border-[#ead9de] bg-[#fffafb] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#e86f9d] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-[#6f5a61]">
                  비밀번호
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  className="w-full rounded-2xl border border-[#ead9de] bg-[#fffafb] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#e86f9d] focus:bg-white"
                />
              </div>

              <div className="rounded-2xl border border-[#ead9de] bg-[#fdf9fa] px-4 py-3 text-xs font-semibold leading-5 text-[#8b767c]">
                브라우저 쿠키로 로그인 상태가 유지돼요. 공용 기기에서는 사용 후 로그아웃해주세요.
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#e86f9d] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d93675]"
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