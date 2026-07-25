import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Student = {
  id: string;
  name: string;
  subject?: string | null;
  book?: string | null;
  main_range?: string | null;
  progress?: number | null;
  memo?: string | null;
  performance_tasks?: string[] | null;
  exp_points?: number | null;
  level?: number | null;
};

function levelFromExp(exp?: number | null, level?: number | null) {
  if (level && level > 0) return level;
  return Math.floor((exp || 0) / 100) + 1;
}

export default async function StudentsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: students, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-[#171717]">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#e5e5e5] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">학생 목록을 불러오지 못했어요</h1>
          <p className="mt-3 text-sm font-semibold text-[#525252]">
            로그인 세션이나 Supabase 권한 설정을 확인해야 해요.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#f7f7f7] p-4 text-sm">
            {error.message}
          </pre>
        </div>
      </main>
    );
  }

  const studentList = (students ?? []) as Student[];

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#525252]">Student Management</p>
            <h1 className="mt-1 text-3xl font-black">학생 목록</h1>
            <p className="mt-2 text-sm font-semibold text-[#525252]">
              총 {studentList.length}명
            </p>
          </div>

          <Link
            href="/"
            className="w-fit rounded-full border border-[#d7c8bb] px-5 py-3 text-sm font-bold"
          >
            대시보드로 돌아가기
          </Link>
        </header>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {studentList.map((student) => {
            const performanceTasks = student.performance_tasks ?? [];
            const progress = student.progress ?? 0;

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="rounded-3xl border border-[#e5e5e5] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">{student.name}</h2>
                    <p className="mt-1 text-sm font-semibold text-[#525252]">
                      {student.subject || "과목 미입력"}
                      {student.book ? ` · ${student.book}` : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-black">
                    Lv. {levelFromExp(student.exp_points, student.level)}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f7f7f7] p-4">
                  <p className="text-xs font-black text-[#525252]">시험 범위</p>
                  <p className="mt-2 text-sm font-semibold leading-6">
                    {student.main_range || "입력된 범위 없음"}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">진도 정리</p>
                    <p className="text-sm font-black">{progress}%</p>
                  </div>

                  <div className="h-3 rounded-full bg-[#eee5dc]">
                    <div
                      className="h-3 rounded-full bg-[#8d8177]"
                      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  </div>
                </div>

                <p className="mt-5 text-xs font-bold text-[#525252]">
                  수행평가 {performanceTasks.length}개
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
