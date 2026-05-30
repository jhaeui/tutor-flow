"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError("");
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setIsLoading(false);
      setLoginError("이메일 또는 비밀번호를 다시 확인해줘.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", data.user.id)
      .maybeSingle();

    setIsLoading(false);

    if (profileError || !profile) {
      setLoginError("로그인은 되었는데 권한 정보를 찾지 못했어. app_users 연결을 확인해야 해.");
      return;
    }

    if (profile.role === "student" && profile.student_id) {
      router.replace(`/students/${profile.student_id}`);
      router.refresh();
      return;
    }

    router.replace("/students");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f8f1ea] px-4 py-10 text-[#4a372f]">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <section className="w-full rounded-[2rem] border border-[#eadfd5] bg-white/90 p-7 shadow-sm">
          <div className="mb-7 text-center">
            <p className="mb-2 text-sm font-bold text-[#b18b7f]">
              과외관리 웹사이트
            </p>
            <h1 className="text-3xl font-black text-[#4a372f]">
              로그인
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#8a6f64]">
              선생님과 학생 계정으로 접속할 수 있어요.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#6f564d]">
                이메일
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-2xl border border-[#eadfd5] bg-[#fffaf6] px-4 py-3 text-sm outline-none focus:border-[#d6a99a]"
                placeholder="email@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#6f564d]">
                비밀번호
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-2xl border border-[#eadfd5] bg-[#fffaf6] px-4 py-3 text-sm outline-none focus:border-[#d6a99a]"
                placeholder="비밀번호"
              />
            </label>

            {loginError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-[#4a372f] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#352720] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}