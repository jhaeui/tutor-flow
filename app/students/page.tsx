import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  name: string;
  subject: string;
  book: string | null;
  main_range: string | null;
  progress: number | null;
  memo: string | null;
  performance_tasks: string[] | null;
};

export default async function StudentsPage() {
  const { data: students, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold">학생 목록을 불러오지 못했어요</h1>
          <p className="mt-4 text-sm leading-6 text-[#7d7065]">
            Supabase 연결이나 RLS 정책을 확인해야 해요.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#fffaf5] p-4 text-sm">
            {error.message}
          </pre>
        </div>
      </main>
    );
  }

  const studentList = (students ?? []) as Student[];

  return (
    <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[#525252]">Student Management</p>
            <h1 className="mt-1 text-3xl font-bold">학생 목록</h1>
            <p className="mt-2 text-sm text-[#525252]">
              Supabase DB에서 불러온 학생 정보
            </p>
          </div>

          <a
            href="/"
            className="rounded-full border border-[#d7c8bb] px-5 py-3 text-sm font-semibold"
          >
            대시보드로 돌아가기
          </a>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryBox title="관리 학생" value={`${studentList.length}명`} />
          <SummaryBox
            title="수행평가 있음"
            value={`${
              studentList.filter(
                (student) => (student.performance_tasks ?? []).length > 0
              ).length
            }명`}
          />
          <SummaryBox title="주요 과목" value="영어" />
          <SummaryBox title="데이터 기준" value="Supabase" />
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {studentList.map((student) => {
            const performanceTasks = student.performance_tasks ?? [];
            const progress = student.progress ?? 0;

            return (
              <article
                key={student.id}
                className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{student.name}</h2>
                    <p className="mt-1 text-sm text-[#525252]">
                      {student.subject} ? {student.book || " ?"}
                    </p>
                  </div>

                  <span className="rounded-full bg-[#f0dfcf] px-3 py-1 text-xs font-bold">
                    {performanceTasks.length > 0
                      ? `수행 ${performanceTasks.length}`
                      : "수행 없음"}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl bg-[#fffaf5] p-4">
                  <p className="text-xs font-semibold text-[#525252]">
                    시험 범위
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    {student.main_range || " ?"}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">진도 정리 진행도</p>
                    <p className="text-sm font-bold">{progress}%</p>
                  </div>

                  <div className="h-3 rounded-full bg-[#eee5dc]">
                    <div
                      className="h-3 rounded-full bg-[#b99375]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {performanceTasks.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-semibold">수행평가 / 공지</p>
                    <div className="flex flex-wrap gap-2">
                      {performanceTasks.map((task) => (
                        <span
                          key={task}
                          className="rounded-full bg-[#171717] px-3 py-1 text-xs font-semibold text-white"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-5 min-h-16 text-sm leading-6 text-[#7d7065]">
                  {student.memo || " "}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <a
                        href={`/students/${student.id}`}
                        className="rounded-2xl bg-[#171717] px-4 py-3 text-center text-sm font-semibold text-white"
                    >
                        상세 보기
                    </a>

                    <a
                        href={`/students/${student.id}/records/new`}
                        className="rounded-2xl border border-[#d7c8bb] px-4 py-3 text-center text-sm font-semibold"
                    >
                        기록 추가
                    </a>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function SummaryBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#525252]">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}