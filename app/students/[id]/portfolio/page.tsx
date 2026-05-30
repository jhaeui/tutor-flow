import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PerformanceTask = {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  status: string;
  memo: string | null;
  created_at: string;
};

type PortfolioRecord = {
  id: string;
  student_id: string;
  source_task_id: string | null;
  category: string;
  subject: string | null;
  title: string;
  record_date: string | null;
  record_time: string | null;
  memo: string | null;
  career_keywords: string | null;
  grade_label?: string | null;
  semester_label?: string | null;
  result?: string | null;
  activity_summary: string | null;
  meaning: string | null;
  deepening_topic: string | null;
  next_plan: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

const SUBJECTS = ["국어", "영어", "수학", "사회", "과학", "한국사", "중국어", "일본어", "프랑스어", "기타"];

const SUBJECT_EMOJIS: Record<string, string> = {
  국어: "📖",
  영어: "🗽",
  수학: "🧮",
  사회: "🌏",
  과학: "🔬",
  한국사: "🏺",
  중국어: "🐼",
  일본어: "🌸",
  프랑스어: "🥐",
  기타: "✨",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-[#ead6af] bg-[#fff8e8] text-[#8a6630]",
  saved: "border-[#cce6d6] bg-[#eef8f2] text-[#47735b]",
};

const GRADE_OPTIONS = ["1학년", "2학년", "3학년"];
const SEMESTER_OPTIONS = ["1학기", "2학기"];
const RESULT_SUGGESTIONS = ["", "상", "중", "하", "A", "B", "C", "만점", "제출완료", "발표완료", "보고서 제출", "미제출"];

function normalizeTime(time?: string | null) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

function formatDate(dateText?: string | null) {
  if (!dateText) return "날짜 미입력";

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatShortDate(dateText?: string | null) {
  if (!dateText) return "-";

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;

  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function subjectEmoji(subject?: string | null) {
  if (!subject) return "✨";
  return SUBJECT_EMOJIS[subject] || "✨";
}

function getDefaultGradeLabel(age?: string | number | null) {
  if (age === null || age === undefined || age === "") return "1학년";

  const match = String(age).match(/\d+/);
  if (!match) return "1학년";

  const currentAge = Number(match[0]);
  if (!currentAge || Number.isNaN(currentAge)) return "1학년";

  const grade = Math.min(Math.max(currentAge - 16, 1), 3);
  return `${grade}학년`;
}

function getSemesterLabelFromDate(dateText?: string | null) {
  const baseDate = dateText ? new Date(`${dateText}T00:00:00+09:00`) : new Date();
  const month = Number.isNaN(baseDate.getTime()) ? new Date().getMonth() + 1 : baseDate.getMonth() + 1;

  if (month >= 3 && month <= 7) return "1학기";
  return "2학기";
}

function termKey(record: PortfolioRecord) {
  const grade = record.grade_label || "학년 미정";
  const semester = record.semester_label || "학기 미정";
  return `${grade} ${semester}`;
}

function termSortValue(term: string) {
  const gradeMatch = term.match(/(\d+)학년/);
  const semesterMatch = term.match(/(\d+)학기/);
  const grade = gradeMatch ? Number(gradeMatch[1]) : 0;
  const semester = semesterMatch ? Number(semesterMatch[1]) : 0;
  return grade * 10 + semester;
}

export default async function StudentPortfolioPage({ params }: PageProps) {
  const { id } = await params;

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  const { data: performanceRows } = await supabase
    .from("student_performance_tasks")
    .select("*")
    .eq("student_id", id)
    .eq("status", "done")
    .order("due_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: portfolioRows } = await supabase
    .from("student_portfolio_records")
    .select("*")
    .eq("student_id", id)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !student) {
    return (
      <main className="min-h-screen bg-[#fbf7f8] px-6 py-10 text-[#3f3437]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#ead9de] bg-white p-8">
          <h1 className="text-2xl font-black">학생을 찾을 수 없어요.</h1>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const performanceTasks = (performanceRows || []) as PerformanceTask[];
  const portfolioRecords = (portfolioRows || []) as PortfolioRecord[];
  const defaultGradeLabel = getDefaultGradeLabel(student.age);
  const defaultSemesterLabel = getSemesterLabelFromDate();
  const archivedTaskIds = new Set(
    portfolioRecords
      .map((record) => record.source_task_id)
      .filter(Boolean) as string[]
  );
  const waitingTasks = performanceTasks.filter((task) => !archivedTaskIds.has(task.id));
  const savedRecords = portfolioRecords.filter((record) => record.status === "saved");
  const draftRecords = portfolioRecords.filter((record) => record.status !== "saved");
  const recordsByTerm = portfolioRecords.reduce<Record<string, PortfolioRecord[]>>(
    (acc, record) => {
      const key = termKey(record);
      if (!acc[key]) acc[key] = [];
      acc[key].push(record);
      return acc;
    },
    {}
  );
  const termGroups = Object.entries(recordsByTerm).sort(
    ([a], [b]) => termSortValue(b) - termSortValue(a)
  );

  async function savePortfolioRecord(formData: FormData) {
    "use server";

    const sourceTaskId = String(formData.get("source_task_id") || "").trim();
    const category = String(formData.get("category") || "수행평가").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const recordDate = String(formData.get("record_date") || "").trim();
    const recordTime = String(formData.get("record_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();
    const careerKeywords = String(formData.get("career_keywords") || "").trim();
    const gradeLabel = String(formData.get("grade_label") || defaultGradeLabel).trim();
    const semesterLabel = String(formData.get("semester_label") || getSemesterLabelFromDate(recordDate)).trim();
    const result = String(formData.get("result") || "").trim();
    const activitySummary = String(formData.get("activity_summary") || "").trim();
    const meaning = String(formData.get("meaning") || "").trim();
    const deepeningTopic = String(formData.get("deepening_topic") || "").trim();
    const nextPlan = String(formData.get("next_plan") || "").trim();
    const status = String(formData.get("status") || "saved").trim();

    if (!title) {
      throw new Error("기록 제목은 꼭 필요해.");
    }

    const { error: insertError } = await supabase.from("student_portfolio_records").insert({
      student_id: id,
      source_task_id: sourceTaskId || null,
      category: category || "기록",
      subject: subject || null,
      title,
      record_date: recordDate || null,
      record_time: recordTime || null,
      memo: memo || null,
      career_keywords: careerKeywords || null,
      grade_label: gradeLabel || null,
      semester_label: semesterLabel || null,
      result: result || null,
      activity_summary: activitySummary || null,
      meaning: meaning || null,
      deepening_topic: deepeningTopic || null,
      next_plan: nextPlan || null,
      status: status || "saved",
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}/portfolio`);
  }

  async function updatePortfolioRecord(formData: FormData) {
    "use server";

    const recordId = String(formData.get("record_id") || "").trim();
    const category = String(formData.get("category") || "수행평가").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const recordDate = String(formData.get("record_date") || "").trim();
    const recordTime = String(formData.get("record_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();
    const careerKeywords = String(formData.get("career_keywords") || "").trim();
    const gradeLabel = String(formData.get("grade_label") || defaultGradeLabel).trim();
    const semesterLabel = String(formData.get("semester_label") || getSemesterLabelFromDate(recordDate)).trim();
    const result = String(formData.get("result") || "").trim();
    const activitySummary = String(formData.get("activity_summary") || "").trim();
    const meaning = String(formData.get("meaning") || "").trim();
    const deepeningTopic = String(formData.get("deepening_topic") || "").trim();
    const nextPlan = String(formData.get("next_plan") || "").trim();
    const status = String(formData.get("status") || "saved").trim();

    if (!recordId || !title) return;

    const { error: updateError } = await supabase
      .from("student_portfolio_records")
      .update({
        category: category || "기록",
        subject: subject || null,
        title,
        record_date: recordDate || null,
        record_time: recordTime || null,
        memo: memo || null,
        career_keywords: careerKeywords || null,
        grade_label: gradeLabel || null,
        semester_label: semesterLabel || null,
        result: result || null,
        activity_summary: activitySummary || null,
        meaning: meaning || null,
        deepening_topic: deepeningTopic || null,
        next_plan: nextPlan || null,
        status: status || "saved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}/portfolio`);
  }

  async function deletePortfolioRecord(formData: FormData) {
    "use server";

    const recordId = String(formData.get("record_id") || "").trim();
    if (!recordId) return;

    const { error: deleteError } = await supabase
      .from("student_portfolio_records")
      .delete()
      .eq("id", recordId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}/portfolio`);
  }

  function RecordEditor({ record }: { record: PortfolioRecord }) {
    return (
      <details className="rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#8f6270]">
                  {subjectEmoji(record.subject)} {record.subject || "기록"}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${
                    STATUS_STYLES[record.status] || STATUS_STYLES.draft
                  }`}
                >
                  {record.status === "saved" ? "저장완료" : "정리중"}
                </span>
                {(record.grade_label || record.semester_label) && (
                  <span className="rounded-full border border-[#f0c8d5] bg-[#fff7fa] px-3 py-1 text-xs font-black text-[#b64270]">
                    {record.grade_label || "학년 미정"} {record.semester_label || "학기 미정"}
                  </span>
                )}
                {record.result && (
                  <span className="rounded-full border border-[#c9dff0] bg-[#eef7ff] px-3 py-1 text-xs font-black text-[#3f6f91]">
                    결과 {record.result}
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-black text-[#3f3437]">
                {record.title}
              </p>
              <p className="mt-1 text-xs font-black text-[#d93675]">
                {formatShortDate(record.record_date)} {normalizeTime(record.record_time)}
              </p>
              {record.career_keywords && (
                <p className="mt-2 inline-flex rounded-full bg-[#fff1f5] px-3 py-1 text-xs font-black text-[#c73370]">
                  # {record.career_keywords}
                </p>
              )}
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#9f5264]">
              수정 열기
            </span>
          </div>
        </summary>

        <form action={updatePortfolioRecord} className="mt-4 grid gap-3 md:grid-cols-6">
          <input type="hidden" name="record_id" value={record.id} />

          <select
            name="category"
            defaultValue={record.category || "수행평가"}
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="수행평가">수행평가</option>
            <option value="발표">발표</option>
            <option value="탐구활동">탐구활동</option>
            <option value="독서연계">독서연계</option>
            <option value="상담메모">상담메모</option>
            <option value="기타">기타</option>
          </select>

          <select
            name="subject"
            defaultValue={record.subject || ""}
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="">과목 없음</option>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>

          <input
            name="title"
            defaultValue={record.title}
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
          />

          <input
            type="date"
            name="record_date"
            defaultValue={record.record_date || ""}
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
          />

          <input
            name="record_time"
            defaultValue={normalizeTime(record.record_time)}
            placeholder="시간"
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
          />

          <select
            name="grade_label"
            defaultValue={record.grade_label || defaultGradeLabel}
            className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
          >
            {GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>

          <select
            name="semester_label"
            defaultValue={record.semester_label || getSemesterLabelFromDate(record.record_date)}
            className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
          >
            {SEMESTER_OPTIONS.map((semester) => (
              <option key={semester} value={semester}>
                {semester}
              </option>
            ))}
          </select>

          <input
            name="result"
            defaultValue={record.result || ""}
            list="portfolio-result-options"
            placeholder="결과 입력(선택)"
            className="rounded-xl border border-[#c9dff0] bg-[#eef7ff] px-3 py-2 text-sm font-bold text-[#3f6f91] outline-none md:col-span-2"
          />

          <input
            name="memo"
            defaultValue={record.memo || ""}
            placeholder="기존 메모"
            className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
          />

          <input
            name="career_keywords"
            defaultValue={record.career_keywords || ""}
            placeholder="진로연계 키워드  예: 마케팅, 소비자심리, 미디어"
            className="rounded-xl border-2 border-[#f0a8c2] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#c73370] outline-none md:col-span-3"
          />

          <textarea
            name="activity_summary"
            defaultValue={record.activity_summary || ""}
            placeholder="활동 내용 정리: 무엇을 했는지, 결과물이 무엇인지"
            className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
          />

          <textarea
            name="meaning"
            defaultValue={record.meaning || ""}
            placeholder="의미/역량: 어떤 점을 배웠는지, 어떤 역량이 드러나는지"
            className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
          />

          <textarea
            name="deepening_topic"
            defaultValue={record.deepening_topic || ""}
            placeholder="심화 가능 주제: 나중에 보고서/발표로 확장할 만한 주제"
            className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
          />

          <textarea
            name="next_plan"
            defaultValue={record.next_plan || ""}
            placeholder="다음 활동/보완점: 다음에 이어갈 방향"
            className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
          />

          <div className="flex flex-wrap gap-2 md:col-span-6">
            <button
              name="status"
              value="saved"
              type="submit"
              className="rounded-2xl bg-[#4a3c40] px-4 py-2 text-xs font-black text-white"
            >
              저장완료
            </button>
            <button
              name="status"
              value="draft"
              type="submit"
              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
            >
              정리중 저장
            </button>
            <button
              formAction={deletePortfolioRecord}
              className="rounded-2xl border border-[#e8d4da] bg-[#fff7fa] px-4 py-2 text-xs font-black text-[#9f5264]"
            >
              삭제
            </button>
          </div>
        </form>
      </details>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf7f8] px-5 py-8 text-[#3f3437]">
      <datalist id="portfolio-result-options">
        {RESULT_SUGGESTIONS.map((result) => (
          <option key={result || "empty"} value={result} />
        ))}
      </datalist>

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <Link
            href={`/students/${id}`}
            className="inline-flex rounded-full bg-[#fdf4f6] px-3 py-1 text-xs font-black text-[#9f5264]"
          >
            ← 학생상세로 돌아가기
          </Link>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black text-[#a87583]">학생별 누적 기록장</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">
                {student.name} 생기부/학종 기록
              </h1>
              <p className="mt-2 text-sm font-semibold text-[#8b767c]">
                완료된 수행평가는 여기로 넘어와서 정리 대기 상태로 남고, 따로 기록도 추가할 수 있어요.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-[#8f6270]">
              <div className="rounded-2xl bg-[#fdf4f6] px-4 py-3">
                <p className="text-lg text-[#3f3437]">{waitingTasks.length}</p>
                <p>정리대기</p>
              </div>
              <div className="rounded-2xl bg-[#fdf4f6] px-4 py-3">
                <p className="text-lg text-[#3f3437]">{draftRecords.length}</p>
                <p>정리중</p>
              </div>
              <div className="rounded-2xl bg-[#fdf4f6] px-4 py-3">
                <p className="text-lg text-[#3f3437]">{savedRecords.length}</p>
                <p>저장완료</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">정리 대기 수행평가</h2>
              <p className="mt-1 text-sm text-[#8b767c]">
                학생상세페이지 수행평가 관리에서 완성 처리한 항목들이 자동으로 보여요.
              </p>
            </div>
          </div>

          {waitingTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-7 text-sm font-semibold text-[#9a838b]">
              정리 대기 중인 수행평가가 없어요.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {waitingTasks.map((task) => (
                <details
                  key={task.id}
                  className="rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#8f6270]">
                            {subjectEmoji(task.subject)} {task.subject}
                          </span>
                          <span className="rounded-full border border-[#ead6af] bg-[#fff8e8] px-3 py-1 text-xs font-black text-[#8a6630]">
                            정리 대기
                          </span>
                        </div>
                        <p className="mt-3 text-base font-black text-[#3f3437]">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs font-black text-[#d93675]">
                          {formatShortDate(task.due_date)} {normalizeTime(task.due_time)}
                        </p>
                        {task.memo && (
                          <p className="mt-2 line-clamp-2 text-sm text-[#8b767c]">
                            {task.memo}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#9f5264]">
                        정리하기
                      </span>
                    </div>
                  </summary>

                  <form action={savePortfolioRecord} className="mt-4 grid gap-3 md:grid-cols-6">
                    <input type="hidden" name="source_task_id" value={task.id} />
                    <input type="hidden" name="category" value="수행평가" />

                    <select
                      name="subject"
                      defaultValue={task.subject}
                      className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                    >
                      {SUBJECTS.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>

                    <input
                      name="title"
                      defaultValue={task.title}
                      className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                    />

                    <input
                      type="date"
                      name="record_date"
                      defaultValue={task.due_date || ""}
                      className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                    />

                    <input
                      name="record_time"
                      defaultValue={normalizeTime(task.due_time)}
                      placeholder="시간"
                      className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                    />

                    <select
                      name="grade_label"
                      defaultValue={defaultGradeLabel}
                      className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
                    >
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>

                    <select
                      name="semester_label"
                      defaultValue={getSemesterLabelFromDate(task.due_date)}
                      className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
                    >
                      {SEMESTER_OPTIONS.map((semester) => (
                        <option key={semester} value={semester}>
                          {semester}
                        </option>
                      ))}
                    </select>

                    <input
                      name="result"
                      list="portfolio-result-options"
                      placeholder="결과 입력(선택)"
                      className="rounded-xl border border-[#c9dff0] bg-[#eef7ff] px-3 py-2 text-sm font-bold text-[#3f6f91] outline-none md:col-span-2"
                    />

                    <input
                      name="memo"
                      defaultValue={task.memo || ""}
                      placeholder="기존 메모"
                      className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
                    />

                    <input
                      name="career_keywords"
                      placeholder="진로연계 키워드  예: 마케팅, 심리, 환경, 보건"
                      className="rounded-xl border-2 border-[#f0a8c2] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#c73370] outline-none md:col-span-3"
                    />

                    <textarea
                      name="activity_summary"
                      placeholder="활동 내용 정리: 무엇을 했는지, 결과물이 무엇인지"
                      className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
                    />

                    <textarea
                      name="meaning"
                      placeholder="의미/역량: 어떤 점을 배웠는지, 어떤 역량이 드러나는지"
                      className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
                    />

                    <textarea
                      name="deepening_topic"
                      placeholder="심화 가능 주제: 나중에 보고서/발표로 확장할 만한 주제"
                      className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
                    />

                    <textarea
                      name="next_plan"
                      placeholder="다음 활동/보완점: 다음에 이어갈 방향"
                      className="min-h-24 rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
                    />

                    <div className="flex flex-wrap gap-2 md:col-span-6">
                      <button
                        name="status"
                        value="saved"
                        type="submit"
                        className="rounded-2xl bg-[#4a3c40] px-4 py-2 text-xs font-black text-white"
                      >
                        저장완료
                      </button>
                      <button
                        name="status"
                        value="draft"
                        type="submit"
                        className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                      >
                        정리중 저장
                      </button>
                    </div>
                  </form>
                </details>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <details>
            <summary className="inline-flex cursor-pointer rounded-full border border-[#e8d4da] bg-[#fff7fa] px-4 py-2 text-sm font-black text-[#9f5264]">
              + 기록 직접 추가
            </summary>

            <form action={savePortfolioRecord} className="mt-5 grid gap-3 md:grid-cols-6">
              <select
                name="category"
                defaultValue="기록"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none"
              >
                <option value="수행평가">수행평가</option>
                <option value="발표">발표</option>
                <option value="탐구활동">탐구활동</option>
                <option value="독서연계">독서연계</option>
                <option value="상담메모">상담메모</option>
                <option value="기타">기타</option>
              </select>

              <select
                name="subject"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none"
              >
                <option value="">과목 없음</option>
                {SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              <input
                name="title"
                placeholder="기록 제목"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-2"
              />

              <input
                type="date"
                name="record_date"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none"
              />

              <input
                name="record_time"
                placeholder="시간"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none"
              />

              <select
                name="grade_label"
                defaultValue={defaultGradeLabel}
                className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
              >
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>

              <select
                name="semester_label"
                defaultValue={defaultSemesterLabel}
                className="rounded-xl border border-[#f0c8d5] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#b64270] outline-none"
              >
                {SEMESTER_OPTIONS.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>

              <input
                name="result"
                list="portfolio-result-options"
                placeholder="결과 입력(선택)"
                className="rounded-xl border border-[#c9dff0] bg-[#eef7ff] px-3 py-2 text-sm font-bold text-[#3f6f91] outline-none md:col-span-2"
              />

              <input
                name="memo"
                placeholder="메모"
                className="rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-3"
              />

              <input
                name="career_keywords"
                placeholder="진로연계 키워드  예: 마케팅, 소비자심리, 미디어"
                className="rounded-xl border-2 border-[#f0a8c2] bg-[#fff7fa] px-3 py-2 text-sm font-bold text-[#c73370] outline-none md:col-span-3"
              />

              <textarea
                name="activity_summary"
                placeholder="활동 내용 정리"
                className="min-h-24 rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-3"
              />

              <textarea
                name="meaning"
                placeholder="의미/역량"
                className="min-h-24 rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-3"
              />

              <textarea
                name="deepening_topic"
                placeholder="심화 가능 주제"
                className="min-h-24 rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-3"
              />

              <textarea
                name="next_plan"
                placeholder="다음 활동/보완점"
                className="min-h-24 rounded-xl border border-[#e8d4da] bg-[#fdf9fa] px-3 py-2 text-sm outline-none md:col-span-3"
              />

              <div className="flex flex-wrap gap-2 md:col-span-6">
                <button
                  name="status"
                  value="saved"
                  type="submit"
                  className="rounded-2xl bg-[#4a3c40] px-4 py-2 text-xs font-black text-white"
                >
                  저장완료
                </button>
                <button
                  name="status"
                  value="draft"
                  type="submit"
                  className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                >
                  정리중 저장
                </button>
              </div>
            </form>
          </details>
        </section>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-black">누적 기록</h2>
            <p className="mt-1 text-sm text-[#8b767c]">
              저장한 기록은 여기서 계속 수정하고 보완할 수 있어요.
            </p>
          </div>

          {portfolioRecords.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-7 text-sm font-semibold text-[#9a838b]">
              아직 저장된 생기부/학종 기록이 없어요.
            </div>
          ) : (
            <div className="space-y-5">
              {termGroups.map(([term, records]) => (
                <div
                  key={term}
                  className="rounded-[1.75rem] border border-[#ead9de] bg-[#fffafb] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-black text-[#3f3437]">
                      🎒 {term}
                    </h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#9f5264]">
                      {records.length}개
                    </span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {records.map((record) => (
                      <RecordEditor key={record.id} record={record} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
