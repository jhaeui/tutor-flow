import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    month?: string;
  }>;
};

type SavedTask = {
  progress_id?: string;
  subject?: string;
  unit_name?: string;
  task_name?: string;
  before_status?: string;
  publisher?: string | null;
  material_name?: string | null;
};

type SubjectRecord = {
  subject?: string;
  progress?: string;
  homework?: string;
  progress_items?: SavedTask[];
  homework_items?: SavedTask[];
};

type LessonRecord = {
  id: string;
  student_id: string;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_text?: string | null;
  content: string | null;
  memo: string | null;
  subject_records?: SubjectRecord[] | null;
  checked_homework_items?: SavedTask[] | null;
  created_at?: string;
};

type MakeupLesson = {
  id: string;
  student_id: string;
  absent_date: string;
  makeup_date: string | null;
  makeup_time: string | null;
  is_done: boolean;
  memo: string | null;
  created_at: string;
};

type ScoreRecord = {
  id: string;
  student_id: string;
  subject: string;
  previous_score: string | null;
  target_score: string | null;
  memo: string | null;
  created_at: string;
};

type LessonTime = {
  id: string;
  student_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  memo: string | null;
  created_at: string;
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

type StudentEvent = {
  id: string;
  student_id: string;
  event_date: string;
  event_time: string | null;
  subject: string | null;
  title: string;
  event_type: string | null;
  memo: string | null;
  is_auto: boolean | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
};

type ExamProgress = {
  id: string;
  student_id: string;
  subject: string;
  unit_name: string;
  statuses: Record<string, string> | string | null;
  sort_order: number | null;
  publisher?: string | null;
  material_name?: string | null;
};

type HomeworkTask = {
  id: string;
  progressId: string;
  subject: string;
  unitName: string;
  taskName: string;
  publisher?: string | null;
  materialName?: string | null;
};

type CalendarEvent = {
  id: string;
  event_date: string;
  event_time: string | null;
  subject: string | null;
  title: string;
  event_type: string;
  memo: string | null;
  is_auto: boolean;
  source_type: string | null;
  source_id: string | null;
  link_url?: string | null;
  deletable?: boolean;
};

const SUBJECTS = ["국어", "영어", "수학", "사회", "과학", "한국사"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PERFORMANCE_STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완성",
};

const PERFORMANCE_STATUS_STYLES: Record<string, string> = {
  not_started: "border-[#ead9de] bg-white text-[#8b767c]",
  in_progress: "border-[#ead6af] bg-[#fff8e8] text-[#8a6630]",
  done: "border-[#cce6d6] bg-[#eef8f2] text-[#47735b]",
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  수업: "border-[#efcbd4] bg-[#fff1f4] text-[#9f5264]",
  추가수업: "border-[#c9dff0] bg-[#eef7ff] text-[#3f6f91]",
  보강수업: "border-[#cce6d6] bg-[#eef8f2] text-[#47735b]",
  수행평가: "border-[#d8d0f2] bg-[#f4f1ff] text-[#6656a6]",
  시험: "border-[#ead6af] bg-[#fff8e8] text-[#8a6630]",
  기타: "border-[#ead9de] bg-white text-[#8b767c]",
};

function parseStatuses(statuses: Record<string, string> | string | null | undefined) {
  if (!statuses) return {};

  if (typeof statuses === "string") {
    try {
      return JSON.parse(statuses) as Record<string, string>;
    } catch {
      return {};
    }
  }

  return statuses;
}

function normalizeTime(time?: string | null) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

function formatDate(dateText?: string | null) {
  if (!dateText) return "-";

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
  });
}

function formatTime(start?: string | null, end?: string | null) {
  const cleanStart = normalizeTime(start);
  const cleanEnd = normalizeTime(end);

  if (!cleanStart && !cleanEnd) return "시간 미입력";
  if (cleanStart && cleanEnd) return `${cleanStart} - ${cleanEnd}`;
  if (cleanStart) return `${cleanStart} 시작`;
  return `${cleanEnd} 종료`;
}

function taskText(item: SavedTask) {
  const publisher = item.publisher ? `[${item.publisher}] ` : "";
  const material = item.material_name ? `${item.material_name} ` : "";
  const unit = item.unit_name || "";
  const task = item.task_name || "";

  if (!unit && !task) return "항목명 없음";
  if (!task) return `${publisher}${material}${unit}`;
  return `${publisher}${material}${unit} - ${task}`;
}

function homeworkText(item: HomeworkTask) {
  const publisher = item.publisher ? `[${item.publisher}] ` : "";
  const material = item.materialName ? `${item.materialName} ` : "";
  return `${publisher}${material}${item.unitName} - ${item.taskName}`;
}

function expPercent(exp?: number | null) {
  const value = exp || 0;
  return value % 100;
}

function levelFromExp(exp?: number | null, level?: number | null) {
  if (level && level > 0) return level;
  return Math.floor((exp || 0) / 100) + 1;
}

function getMonthInfo(monthParam?: string) {
  const today = new Date();

  const [yearText, monthText] =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam.split("-")
      : [
          String(today.getFullYear()),
          String(today.getMonth() + 1).padStart(2, "0"),
        ];

  const year = Number(yearText);
  const month = Number(monthText);

  const current = new Date(year, month - 1, 1);
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  const prevMonthText = `${prev.getFullYear()}-${String(
    prev.getMonth() + 1
  ).padStart(2, "0")}`;

  const nextMonthText = `${next.getFullYear()}-${String(
    next.getMonth() + 1
  ).padStart(2, "0")}`;

  return {
    year: current.getFullYear(),
    month: current.getMonth() + 1,
    prevMonthText,
    nextMonthText,
  };
}

function makeDateText(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function makeCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startBlankCount = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: Array<{
    dateText: string | null;
    day: number | null;
  }> = [];

  for (let i = 0; i < startBlankCount; i++) {
    cells.push({
      dateText: null,
      day: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateText: makeDateText(year, month, day),
      day,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      dateText: null,
      day: null,
    });
  }

  return cells;
}

function findLessonRecordByDate(lessonRecords: LessonRecord[], dateText: string) {
  return lessonRecords.find((record) => record.lesson_date === dateText);
}

function makeAutoLessonEventsForMonth(
  lessonTimes: LessonTime[],
  year: number,
  month: number,
  lessonRecords: LessonRecord[],
  studentId: string
): CalendarEvent[] {
  const dayIndexMap: Record<string, number> = {
    일: 0,
    월: 1,
    화: 2,
    수: 3,
    목: 4,
    금: 5,
    토: 6,
  };

  const lastDay = new Date(year, month, 0).getDate();
  const events: CalendarEvent[] = [];

  lessonTimes.forEach((lessonTime) => {
    const targetDay = dayIndexMap[lessonTime.day_of_week];

    if (targetDay === undefined) return;

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month - 1, day);

      if (date.getDay() === targetDay) {
        const dateText = makeDateText(year, month, day);
        const matchedRecord = findLessonRecordByDate(lessonRecords, dateText);

        events.push({
          id: `auto-lesson-${lessonTime.id}-${dateText}`,
          event_date: dateText,
          event_time: normalizeTime(lessonTime.start_time),
          subject: "수업",
          title: "수업",
          event_type: "수업",
          memo:
            lessonTime.memo ||
            `${normalizeTime(lessonTime.start_time)} - ${normalizeTime(
              lessonTime.end_time
            )}`,
          is_auto: true,
          source_type: matchedRecord ? "lesson_record" : "fixed_lesson_time",
          source_id: matchedRecord?.id || lessonTime.id,
          link_url: matchedRecord
            ? `/students/${studentId}/records/${matchedRecord.id}/edit`
            : null,
          deletable: false,
        });
      }
    }
  });

  return events;
}

function makeLessonRecordEvents(
  lessonRecords: LessonRecord[],
  fixedLessonEvents: CalendarEvent[],
  year: number,
  month: number,
  studentId: string
): CalendarEvent[] {
  const fixedDates = new Set(fixedLessonEvents.map((event) => event.event_date));

  return lessonRecords
    .filter((record) => {
      if (!record.lesson_date) return false;
      if (fixedDates.has(record.lesson_date)) return false;

      const date = new Date(record.lesson_date);
      if (Number.isNaN(date.getTime())) return false;

      return date.getFullYear() === year && date.getMonth() + 1 === month;
    })
    .map((record) => ({
      id: `record-lesson-${record.id}`,
      event_date: record.lesson_date,
      event_time: normalizeTime(record.start_time),
      subject: "수업",
      title: "수업",
      event_type: "수업",
      memo: record.memo,
      is_auto: true,
      source_type: "lesson_record",
      source_id: record.id,
      link_url: `/students/${studentId}/records/${record.id}/edit`,
      deletable: false,
    }));
}

function makeMakeupEvents(makeupLessons: MakeupLesson[]): CalendarEvent[] {
  return makeupLessons
    .filter((lesson) => lesson.makeup_date)
    .map((lesson) => ({
      id: `makeup-${lesson.id}`,
      event_date: lesson.makeup_date as string,
      event_time: normalizeTime(lesson.makeup_time),
      subject: "보강",
      title: "보강수업",
      event_type: "보강수업",
      memo: lesson.memo,
      is_auto: true,
      source_type: "makeup_lesson",
      source_id: lesson.id,
      link_url: null,
      deletable: false,
    }));
}

function getEventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    if (!acc[event.event_date]) {
      acc[event.event_date] = [];
    }

    acc[event.event_date].push(event);
    return acc;
  }, {});
}

function calendarEventTitle(event: CalendarEvent) {
  const type = event.event_type;
  const time = event.event_time ? `${normalizeTime(event.event_time)} ` : "";

  if (type === "수업") return `${time}수업`;
  if (type === "보강수업") return `${time}보강수업`;
  if (type === "추가수업") return `${time}추가수업`;

  if (type === "수행평가") {
    return event.subject ? `${event.subject} ${event.title}` : event.title;
  }

  return event.title;
}

function getGradeNumber(score?: string | null) {
  if (!score) return null;

  const match = score.match(/[1-9]/);
  if (!match) return null;

  return Number(match[0]);
}

function gradeLabel(score?: string | null) {
  const grade = getGradeNumber(score);

  if (!grade) return score || "미입력";
  return `${grade}등급`;
}

function gradeStyle(score?: string | null) {
  const grade = getGradeNumber(score);

  const styles: Record<number, string> = {
    1: "border-[#f5c2d0] bg-[#fff0f5] text-[#b94f70]",
    2: "border-[#f4c7a1] bg-[#fff5eb] text-[#a85f24]",
    3: "border-[#eadb8f] bg-[#fffbe6] text-[#8a7420]",
    4: "border-[#cfe3a5] bg-[#f7fbec] text-[#5f7c2b]",
    5: "border-[#a9dfc5] bg-[#eefaf4] text-[#3f7a5b]",
    6: "border-[#a9d7e8] bg-[#eef8fc] text-[#3e7187]",
    7: "border-[#bfc7ef] bg-[#f2f4ff] text-[#5863a3]",
    8: "border-[#d5c1ef] bg-[#f8f1ff] text-[#7556a5]",
    9: "border-[#e2c5d2] bg-[#fcf2f6] text-[#8f5b70]",
  };

  if (!grade) return "border-[#ead9de] bg-white text-[#8b767c]";
  return styles[grade] || "border-[#ead9de] bg-white text-[#8b767c]";
}

function AvatarBox({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-[#ead9de] bg-gradient-to-br from-[#fff7fa] via-[#fdf4f6] to-[#f7eef3] shadow-sm">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${name} 아바타`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="relative h-full w-full">
          <div className="absolute bottom-3 left-3 h-8 w-14 rounded-xl border border-[#ead9de] bg-white" />
          <div className="absolute bottom-9 left-6 h-4 w-5 rotate-[-15deg] rounded-md border border-[#ead9de] bg-[#f9e9ef]" />
          <div className="absolute bottom-7 right-5 h-8 w-9 rounded-b-2xl rounded-t-md border border-[#ead9de] bg-[#fffaf6]" />
          <div className="absolute bottom-8 right-3 h-5 w-3 rounded-r-lg border border-[#ead9de] bg-[#fffaf6]" />
          <div className="absolute bottom-7 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-[#5a4248]" />
          <div className="absolute bottom-5 left-1/2 h-16 w-20 -translate-x-1/2 rounded-[45%] border border-[#e7c9d2] bg-[#ffe8f0]" />
          <div className="absolute bottom-[54px] left-[54px] h-1.5 w-1.5 rounded-full bg-[#4a3c40]" />
          <div className="absolute bottom-[54px] right-[54px] h-1.5 w-1.5 rounded-full bg-[#4a3c40]" />
          <div className="absolute bottom-[43px] left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-full bg-[#d4879b]" />
          <div className="absolute bottom-[40px] left-[43px] h-2.5 w-4 rounded-full bg-[#f4bac8]" />
          <div className="absolute bottom-[40px] right-[43px] h-2.5 w-4 rounded-full bg-[#f4bac8]" />
          <div className="absolute bottom-0 left-1/2 h-12 w-24 -translate-x-1/2 rounded-t-[2rem] border border-[#ead9de] bg-[#fffaf6]" />
        </div>
      )}
    </div>
  );
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { year, month, prevMonthText, nextMonthText } = getMonthInfo(
    resolvedSearchParams?.month
  );

  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  const { data: records } = await supabase
    .from("lesson_records")
    .select("*")
    .eq("student_id", id)
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: makeupLessonRows } = await supabase
    .from("makeup_lessons")
    .select("*")
    .eq("student_id", id)
    .order("is_done", { ascending: true })
    .order("absent_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: scoreRows } = await supabase
    .from("student_score_records")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  const { data: lessonTimeRows } = await supabase
    .from("student_lesson_times")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: true });

  const { data: performanceRows } = await supabase
    .from("student_performance_tasks")
    .select("*")
    .eq("student_id", id)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: eventRows } = await supabase
    .from("student_events")
    .select("*")
    .eq("student_id", id)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true })
    .order("created_at", { ascending: false });

  const { data: examProgressRows } = await supabase
    .from("exam_progress")
    .select("*")
    .eq("student_id", id)
    .order("subject", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !student) {
    return (
      <main className="min-h-screen bg-[#fbf7f8] px-6 py-10 text-[#3f3437]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#ead9de] bg-white p-8">
          <h1 className="text-2xl font-black">학생을 찾을 수 없어요.</h1>
          <p className="mt-3 text-sm text-[#8b767c]">
            Supabase에서 해당 학생 정보를 불러오지 못했어요.
          </p>
          <Link
            href="/students"
            className="mt-6 inline-flex rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white"
          >
            학생 목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const lessonRecords = (records || []) as LessonRecord[];
  const makeupLessons = (makeupLessonRows || []) as MakeupLesson[];
  const scoreRecords = (scoreRows || []) as ScoreRecord[];
  const lessonTimes = (lessonTimeRows || []) as LessonTime[];
  const performanceTasks = (performanceRows || []) as PerformanceTask[];
  const visiblePerformanceTasks = performanceTasks.filter(
    (task) => task.status !== "done"
  );
  const events = (eventRows || []) as StudentEvent[];
  const examRows = (examProgressRows || []) as ExamProgress[];

  const remainingMakeupCount = makeupLessons.filter((lesson) => !lesson.is_done).length;
  const currentExp = student.exp_points || 0;
  const currentLevel = levelFromExp(student.exp_points, student.level);
  const currentExpPercent = expPercent(student.exp_points);

  const homeworkTasks: HomeworkTask[] = examRows.flatMap((row) => {
    const statuses = parseStatuses(row.statuses);

    return Object.entries(statuses)
      .filter(([, status]) => status === "homework")
      .map(([taskName]) => ({
        id: `${row.id}:::${taskName}`,
        progressId: row.id,
        subject: row.subject,
        unitName: row.unit_name,
        taskName,
        publisher: row.publisher,
        materialName: row.material_name,
      }));
  });

  const autoLessonEvents = makeAutoLessonEventsForMonth(
    lessonTimes,
    year,
    month,
    lessonRecords,
    id
  );

  const lessonRecordEvents = makeLessonRecordEvents(
    lessonRecords,
    autoLessonEvents,
    year,
    month,
    id
  );

  const makeupEvents = makeMakeupEvents(makeupLessons);

  const dbEvents: CalendarEvent[] = events.map((event) => {
    const eventType = event.event_type || "기타";
    const matchedRecord =
      eventType === "수업" || eventType === "추가수업"
        ? findLessonRecordByDate(lessonRecords, event.event_date)
        : null;

    return {
      id: event.id,
      event_date: event.event_date,
      event_time: normalizeTime(event.event_time),
      subject: event.subject,
      title: event.title,
      event_type: eventType,
      memo: event.memo,
      is_auto: Boolean(event.is_auto),
      source_type: event.source_type,
      source_id: event.source_id,
      link_url: matchedRecord
        ? `/students/${id}/records/${matchedRecord.id}/edit`
        : null,
      deletable: true,
    };
  });

  const combinedEvents = [
    ...autoLessonEvents,
    ...lessonRecordEvents,
    ...makeupEvents,
    ...dbEvents,
  ].sort((a, b) => {
    const dateCompare = String(a.event_date).localeCompare(String(b.event_date));
    if (dateCompare !== 0) return dateCompare;
    return String(a.event_time || "").localeCompare(String(b.event_time || ""));
  });

  const eventsByDate = getEventsByDate(combinedEvents);
  const calendarDays = makeCalendarDays(year, month);

  async function updateStudentInfo(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const age = String(formData.get("age") || "").trim();
    const school = String(formData.get("school") || "").trim();
    const avatarUrl = String(formData.get("avatar_url") || "").trim();
    const avatarMemo = String(formData.get("avatar_memo") || "").trim();

    if (!name) {
      throw new Error("이름은 비워둘 수 없어요.");
    }

    const { error: updateError } = await supabase
      .from("students")
      .update({
        name,
        age: age || null,
        school: school || null,
        avatar_url: avatarUrl || null,
        avatar_memo: avatarMemo || null,
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addLessonTime(formData: FormData) {
    "use server";

    const dayOfWeek = String(formData.get("day_of_week") || "").trim();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!dayOfWeek || !startTime || !endTime) {
      throw new Error("요일, 시작시간, 종료시간은 꼭 입력해야 해.");
    }

    const { error: insertError } = await supabase.from("student_lesson_times").insert({
      student_id: id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      memo: memo || null,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function updateLessonTime(formData: FormData) {
    "use server";

    const lessonTimeId = String(formData.get("lesson_time_id") || "");
    const dayOfWeek = String(formData.get("day_of_week") || "").trim();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!lessonTimeId || !dayOfWeek || !startTime || !endTime) {
      throw new Error("고정수업 수정값이 부족해.");
    }

    const { error: updateError } = await supabase
      .from("student_lesson_times")
      .update({
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        memo: memo || null,
      })
      .eq("id", lessonTimeId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteLessonTime(formData: FormData) {
    "use server";

    const lessonTimeId = String(formData.get("lesson_time_id") || "");

    if (!lessonTimeId) return;

    const { error: deleteError } = await supabase
      .from("student_lesson_times")
      .delete()
      .eq("id", lessonTimeId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addScoreRecord(formData: FormData) {
    "use server";

    const subject = String(formData.get("subject") || "").trim();
    const previousScore = String(formData.get("previous_score") || "").trim();
    const targetScore = String(formData.get("target_score") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!subject) return;

    const { error: insertError } = await supabase.from("student_score_records").insert({
      student_id: id,
      subject,
      previous_score: previousScore || null,
      target_score: targetScore || null,
      memo: memo || null,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteScoreRecord(formData: FormData) {
    "use server";

    const scoreId = String(formData.get("score_id") || "");

    if (!scoreId) return;

    const { error: deleteError } = await supabase
      .from("student_score_records")
      .delete()
      .eq("id", scoreId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addMakeupLesson(formData: FormData) {
    "use server";

    const absentDate = String(formData.get("absent_date") || "").trim();
    const makeupDate = String(formData.get("makeup_date") || "").trim();
    const makeupTime = String(formData.get("makeup_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!absentDate) return;

    const { error: insertError } = await supabase.from("makeup_lessons").insert({
      student_id: id,
      absent_date: absentDate,
      makeup_date: makeupDate || null,
      makeup_time: makeupTime || null,
      memo: memo || null,
      is_done: false,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function toggleMakeupDone(formData: FormData) {
    "use server";

    const makeupId = String(formData.get("makeup_id") || "");
    const isDone = String(formData.get("is_done") || "") === "true";

    if (!makeupId) return;

    const { error: updateError } = await supabase
      .from("makeup_lessons")
      .update({ is_done: !isDone })
      .eq("id", makeupId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteMakeupLesson(formData: FormData) {
    "use server";

    const makeupId = String(formData.get("makeup_id") || "");

    if (!makeupId) return;

    const { error: deleteError } = await supabase
      .from("makeup_lessons")
      .delete()
      .eq("id", makeupId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addPerformanceTask(formData: FormData) {
    "use server";

    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const dueTime = String(formData.get("due_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!subject || !title) {
      throw new Error("수행평가는 과목과 이름이 꼭 필요해.");
    }

    const { data: performance, error: insertPerformanceError } = await supabase
      .from("student_performance_tasks")
      .insert({
        student_id: id,
        subject,
        title,
        due_date: dueDate || null,
        due_time: dueTime || null,
        status: "not_started",
        memo: memo || null,
      })
      .select("id")
      .single();

    if (insertPerformanceError) {
      throw new Error(insertPerformanceError.message);
    }

    if (performance && dueDate) {
      const { error: insertEventError } = await supabase.from("student_events").insert({
        student_id: id,
        event_date: dueDate,
        event_time: dueTime || null,
        subject,
        title,
        event_type: "수행평가",
        memo: memo || null,
        is_auto: true,
        source_type: "performance_task",
        source_id: performance.id,
      });

      if (insertEventError) {
        throw new Error(insertEventError.message);
      }
    }

    revalidatePath(`/students/${id}`);
  }

  async function updatePerformanceStatus(formData: FormData) {
    "use server";

    const taskId = String(formData.get("task_id") || "");
    const status = String(formData.get("status") || "not_started");

    if (!taskId) return;

    const { error: updateError } = await supabase
      .from("student_performance_tasks")
      .update({ status })
      .eq("id", taskId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deletePerformanceTask(formData: FormData) {
    "use server";

    const taskId = String(formData.get("task_id") || "");

    if (!taskId) return;

    const { error: deletePerformanceError } = await supabase
      .from("student_performance_tasks")
      .delete()
      .eq("id", taskId)
      .eq("student_id", id);

    if (deletePerformanceError) {
      throw new Error(deletePerformanceError.message);
    }

    const { error: deleteEventError } = await supabase
      .from("student_events")
      .delete()
      .eq("student_id", id)
      .eq("source_type", "performance_task")
      .eq("source_id", taskId);

    if (deleteEventError) {
      throw new Error(deleteEventError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteCalendarEvent(formData: FormData) {
    "use server";

    const eventId = String(formData.get("event_id") || "");

    if (!eventId) return;

    const { error: deleteError } = await supabase
      .from("student_events")
      .delete()
      .eq("id", eventId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function completeHomeworkTask(formData: FormData) {
    "use server";

    const progressId = String(formData.get("progress_id") || "");
    const taskName = String(formData.get("task_name") || "");

    if (!progressId || !taskName) return;

    const { data: row, error: fetchError } = await supabase
      .from("exam_progress")
      .select("statuses")
      .eq("id", progressId)
      .eq("student_id", id)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const statuses = parseStatuses(row?.statuses);
    statuses[taskName] = "done";

    const { error: updateError } = await supabase
      .from("exam_progress")
      .update({ statuses })
      .eq("id", progressId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addCalendarEvent(formData: FormData) {
    "use server";

    const eventDate = String(formData.get("event_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const eventType = String(formData.get("event_type") || "기타").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!eventDate || !title) {
      throw new Error("일정 날짜와 이름은 꼭 입력해야 해.");
    }

    const { error: insertError } = await supabase.from("student_events").insert({
      student_id: id,
      event_date: eventDate,
      event_time: eventTime || null,
      subject: subject || null,
      title,
      event_type: eventType || "기타",
      memo: memo || null,
      is_auto: false,
      source_type: "manual",
      source_id: null,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteLessonRecord(formData: FormData) {
    "use server";

    const recordId = String(formData.get("record_id") || "");

    if (!recordId) return;

    const { error: deleteError } = await supabase
      .from("lesson_records")
      .delete()
      .eq("id", recordId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  return (
    <main className="min-h-screen bg-[#fbf7f8] px-5 py-8 text-[#3f3437]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-[#a87583]">학생 상세보기</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              {student.name}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/students"
              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 text-sm font-bold text-[#8f6270]"
            >
              학생 목록
            </Link>

            <Link
              href={`/students/${id}/exam-scope`}
              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 text-sm font-bold text-[#8f6270]"
            >
              시험범위 진도표
            </Link>

            <a
              href="#performance-section"
              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 text-sm font-bold text-[#8f6270]"
            >
              수행평가 관리
            </a>

            <Link
              href={`/students/${id}/records/new`}
              className="rounded-2xl bg-[#b98594] px-4 py-3 text-sm font-black text-white"
            >
              수업기록 추가
            </Link>
          </div>
        </div>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <AvatarBox name={student.name} avatarUrl={student.avatar_url} />

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-black">{student.name}</h2>
                <span className="rounded-full border border-[#efcbd4] bg-[#fff1f4] px-3 py-1 text-xs font-black text-[#9f5264]">
                  Lv. {currentLevel}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-[#6f5a61]">
                {student.age && (
                  <span className="rounded-full bg-[#fdf4f6] px-3 py-1">
                    {student.age}세
                  </span>
                )}
                {student.school && (
                  <span className="rounded-full bg-[#fdf4f6] px-3 py-1">
                    {student.school}
                  </span>
                )}
                {student.avatar_memo && (
                  <span className="rounded-full bg-[#fdf4f6] px-3 py-1">
                    {student.avatar_memo}
                  </span>
                )}
              </div>

              <div className="mt-5 max-w-xl">
                <div className="mb-2 flex items-center justify-between text-xs font-black text-[#8b767c]">
                  <span>성장 EXP</span>
                  <span>{currentExp} EXP</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#f2e4e9]">
                  <div
                    className="h-full rounded-full bg-[#b98594]"
                    style={{ width: `${currentExpPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <details className="mt-5 rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-5">
            <summary className="cursor-pointer text-sm font-black text-[#8f6270]">
              기본정보 수정
            </summary>

            <form action={updateStudentInfo} className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                  이름
                </label>
                <input
                  name="name"
                  defaultValue={student.name || ""}
                  className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                  나이
                </label>
                <input
                  name="age"
                  defaultValue={student.age || ""}
                  placeholder="예: 16"
                  className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                  학교
                </label>
                <input
                  name="school"
                  defaultValue={student.school || ""}
                  className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                  아바타 이미지 URL
                </label>
                <input
                  name="avatar_url"
                  defaultValue={student.avatar_url || ""}
                  placeholder="이미지 주소를 붙여넣으면 왼쪽 아바타에 표시돼요"
                  className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                  아바타 메모
                </label>
                <input
                  name="avatar_memo"
                  defaultValue={student.avatar_memo || ""}
                  placeholder="예: 단발 / 리본 / 분홍 가디건"
                  className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                />
              </div>

              <button
                type="submit"
                className="md:col-span-2 rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white"
              >
                기본정보 저장
              </button>
            </form>

            <div className="mt-6 rounded-3xl border border-[#ead9de] bg-white p-4">
              <h3 className="text-sm font-black text-[#3f3437]">
                고정 수업시간
              </h3>
              <p className="mt-1 text-xs font-semibold text-[#8b767c]">
                등록한 요일/시간은 아래 달력에 매주 반복으로 자동 표시돼요.
              </p>

              <form action={addLessonTime} className="mt-4 grid gap-3 md:grid-cols-5">
                <select
                  name="day_of_week"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}요일
                    </option>
                  ))}
                </select>

                <input
                  name="start_time"
                  placeholder="시작 18:00"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />

                <input
                  name="end_time"
                  placeholder="종료 20:00"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />

                <input
                  name="memo"
                  placeholder="메모"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />

                <button
                  type="submit"
                  className="rounded-2xl bg-[#b98594] px-4 py-3 text-sm font-black text-white"
                >
                  추가
                </button>
              </form>

              <div className="mt-4 space-y-3">
                {lessonTimes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#ead9de] bg-[#fdf9fa] px-4 py-4 text-sm font-semibold text-[#9a838b]">
                    등록된 고정 수업시간이 없어요.
                  </div>
                ) : (
                  lessonTimes.map((lessonTime) => (
                    <form
                      key={lessonTime.id}
                      action={updateLessonTime}
                      className="grid gap-2 rounded-2xl border border-[#ead9de] bg-[#fdf9fa] p-3 md:grid-cols-6"
                    >
                      <input
                        type="hidden"
                        name="lesson_time_id"
                        value={lessonTime.id}
                      />

                      <select
                        name="day_of_week"
                        defaultValue={lessonTime.day_of_week}
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                      >
                        {DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}요일
                          </option>
                        ))}
                      </select>

                      <input
                        name="start_time"
                        defaultValue={normalizeTime(lessonTime.start_time)}
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                      />

                      <input
                        name="end_time"
                        defaultValue={normalizeTime(lessonTime.end_time)}
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
                      />

                      <input
                        name="memo"
                        defaultValue={lessonTime.memo || ""}
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                      />

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-xl bg-[#4a3c40] px-3 py-2 text-xs font-black text-white"
                        >
                          수정
                        </button>

                        <button
                          formAction={deleteLessonTime}
                          className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-xs font-black text-[#8f6270]"
                        >
                          삭제
                        </button>
                      </div>
                    </form>
                  ))
                )}
              </div>
            </div>
          </details>
        </section>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">학생별 캘린더</h2>
              <p className="mt-1 text-sm text-[#8b767c]">
                일정 카드를 누르면 삭제 버튼이나 수업기록 연결이 열려요.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/students/${id}?month=${prevMonthText}`}
                className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-sm font-black text-[#8f6270]"
              >
                이전달
              </Link>

              <div className="rounded-2xl bg-[#fdf4f6] px-4 py-2 text-sm font-black text-[#3f3437]">
                {year}년 {month}월
              </div>

              <Link
                href={`/students/${id}?month=${nextMonthText}`}
                className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-sm font-black text-[#8f6270]"
              >
                다음달
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-[#ead9de]">
            <div className="grid grid-cols-7 bg-[#fdf4f6]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-[#ead9de] px-3 py-3 text-center text-xs font-black text-[#8f6270] last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-white">
              {calendarDays.map((cell, index) => {
                const dateEvents = cell.dateText ? eventsByDate[cell.dateText] || [] : [];

                return (
                  <div
                    key={`${cell.dateText || "blank"}-${index}`}
                    className={`min-h-[140px] border-r border-t border-[#ead9de] p-2 last:border-r-0 ${
                      cell.dateText ? "bg-white" : "bg-[#fbf7f8]"
                    }`}
                  >
                    {cell.dateText && (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-black text-[#3f3437]">
                            {cell.day}
                          </span>
                          {dateEvents.length > 0 && (
                            <span className="rounded-full bg-[#fff1f4] px-2 py-0.5 text-[10px] font-black text-[#9f5264]">
                              {dateEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {dateEvents.map((event) => {
                            const type = event.event_type || "기타";

                            const eventCard = (
                              <div
                                className={`rounded-xl border px-2 py-1 text-[11px] font-bold leading-snug ${
                                  EVENT_TYPE_STYLES[type] || EVENT_TYPE_STYLES.기타
                                }`}
                              >
                                <div className="truncate">{calendarEventTitle(event)}</div>
                              </div>
                            );

                            if (event.deletable || event.link_url) {
                              return (
                                <details key={event.id} className="group">
                                  <summary className="list-none cursor-pointer">
                                    {eventCard}
                                  </summary>

                                  <div className="mt-1 flex flex-wrap gap-1 rounded-xl border border-[#ead9de] bg-white p-1">
                                    {event.link_url && (
                                      <Link
                                        href={event.link_url}
                                        className="rounded-lg bg-[#4a3c40] px-2 py-1 text-[10px] font-black text-white"
                                      >
                                        기록 열기
                                      </Link>
                                    )}

                                    {event.deletable && (
                                      <form action={deleteCalendarEvent}>
                                        <input
                                          type="hidden"
                                          name="event_id"
                                          value={event.id}
                                        />
                                        <button
                                          type="submit"
                                          className="rounded-lg border border-[#e8d4da] bg-[#fff7fa] px-2 py-1 text-[10px] font-black text-[#9f5264]"
                                        >
                                          삭제
                                        </button>
                                      </form>
                                    )}
                                  </div>
                                </details>
                              );
                            }

                            return <div key={event.id}>{eventCard}</div>;
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <details className="mt-5 rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4">
            <summary className="cursor-pointer text-sm font-black text-[#8f6270]">
              일정 직접 추가
            </summary>

            <form action={addCalendarEvent} className="mt-4 grid gap-2 md:grid-cols-6">
              <input
                type="date"
                name="event_date"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              />

              <input
                name="event_time"
                placeholder="시간"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              />

              <select
                name="event_type"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="시험">시험</option>
                <option value="기타">기타</option>
                <option value="수업">수업</option>
                <option value="추가수업">추가수업</option>
                <option value="보강수업">보강수업</option>
                <option value="수행평가">수행평가</option>
              </select>

              <select
                name="subject"
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
                placeholder="일정 이름"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              />

              <button
                type="submit"
                className="rounded-xl bg-[#b98594] px-3 py-2 text-sm font-black text-white"
              >
                추가
              </button>

              <input
                name="memo"
                placeholder="메모"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-6"
              />
            </form>
          </details>
        </section>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-black">과목별 성적 기록</h2>
            <p className="mt-1 text-sm text-[#8b767c]">
              지난 등급과 목표 등급을 과목별로 기록해요.
            </p>
          </div>

          <form action={addScoreRecord} className="grid gap-3 md:grid-cols-5">
            <select
              name="subject"
              className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>

            <input
              name="previous_score"
              placeholder="지난 등급"
              className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            />

            <input
              name="target_score"
              placeholder="목표 등급"
              className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            />

            <input
              name="memo"
              placeholder="메모"
              className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            />

            <button
              type="submit"
              className="rounded-2xl bg-[#b98594] px-4 py-3 text-sm font-black text-white"
            >
              추가
            </button>
          </form>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scoreRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-6 text-sm font-semibold text-[#9a838b] md:col-span-2 xl:col-span-3">
                아직 성적 기록이 없어요.
              </div>
            ) : (
              scoreRecords.map((score) => (
                <div
                  key={score.id}
                  className="rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#9f6c7a]">
                        {score.subject}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${gradeStyle(
                            score.previous_score
                          )}`}
                        >
                          지난 {gradeLabel(score.previous_score)}
                        </span>

                        <span className="text-sm font-black text-[#b98594]">
                          →
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${gradeStyle(
                            score.target_score
                          )}`}
                        >
                          목표 {gradeLabel(score.target_score)}
                        </span>
                      </div>

                      {score.memo && (
                        <p className="mt-2 text-sm text-[#8b767c]">
                          {score.memo}
                        </p>
                      )}
                    </div>

                    <form action={deleteScoreRecord}>
                      <input type="hidden" name="score_id" value={score.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-xs font-bold text-[#8f6270]"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section
          id="performance-section"
          className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-xl font-black">수행평가 관리</h2>
            <p className="mt-1 text-sm text-[#8b767c]">
              완성 처리한 수행평가는 여기서는 사라지고, 캘린더에는 남아요.
            </p>
          </div>

          <details className="mb-5 rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4">
            <summary className="cursor-pointer text-sm font-black text-[#8f6270]">
              수행평가 추가
            </summary>

            <form action={addPerformanceTask} className="mt-4 grid gap-2 md:grid-cols-6">
              <select
                name="subject"
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
                placeholder="수행평가 이름"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
              />

              <input
                type="date"
                name="due_date"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              />

              <input
                name="due_time"
                placeholder="시간"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none"
              />

              <button
                type="submit"
                className="rounded-xl bg-[#b98594] px-3 py-2 text-sm font-black text-white"
              >
                추가
              </button>

              <input
                name="memo"
                placeholder="메모"
                className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-sm outline-none md:col-span-6"
              />
            </form>
          </details>

          <div className="grid gap-3 lg:grid-cols-2">
            {visiblePerformanceTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-6 text-sm font-semibold text-[#9a838b] lg:col-span-2">
                진행 중인 수행평가가 없어요.
              </div>
            ) : (
              visiblePerformanceTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#8f6270]">
                          {task.subject}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            PERFORMANCE_STATUS_STYLES[task.status] ||
                            PERFORMANCE_STATUS_STYLES.not_started
                          }`}
                        >
                          {PERFORMANCE_STATUS_LABELS[task.status] || task.status}
                        </span>
                      </div>

                      <p className="mt-3 text-base font-black text-[#3f3437]">
                        {task.title}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[#8b767c]">
                        {formatShortDate(task.due_date)} {normalizeTime(task.due_time)}
                      </p>

                      {task.memo && (
                        <p className="mt-2 text-sm text-[#8b767c]">{task.memo}</p>
                      )}
                    </div>

                    <form action={deletePerformanceTask}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-[#e8d4da] bg-white px-3 py-2 text-xs font-bold text-[#8f6270]"
                      >
                        삭제
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(PERFORMANCE_STATUS_LABELS).map(([value, label]) => (
                      <form key={value} action={updatePerformanceStatus}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="status" value={value} />
                        <button
                          type="submit"
                          className={`rounded-2xl border px-3 py-2 text-xs font-black ${
                            task.status === value
                              ? "border-[#b98594] bg-[#fff1f4] text-[#8f6270]"
                              : "border-[#ead9de] bg-white text-[#8b767c]"
                          }`}
                        >
                          {label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
            <details>
              <summary className="cursor-pointer text-xl font-black">
                보강수업{" "}
                <span className="ml-2 rounded-full bg-[#fff1f4] px-3 py-1 text-sm text-[#9f5264]">
                  미완료 {remainingMakeupCount}회
                </span>
              </summary>

              <form action={addMakeupLesson} className="mt-5 grid gap-3 md:grid-cols-5">
                <input
                  type="date"
                  name="absent_date"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />
                <input
                  type="date"
                  name="makeup_date"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />
                <input
                  name="makeup_time"
                  placeholder="보강 시간"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />
                <input
                  name="memo"
                  placeholder="메모"
                  className="rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-[#b98594] px-4 py-3 text-sm font-black text-white"
                >
                  보강 추가
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {makeupLessons.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-6 text-sm font-semibold text-[#9a838b]">
                    등록된 보강수업이 없어요.
                  </div>
                ) : (
                  makeupLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`rounded-3xl border p-4 ${
                        lesson.is_done
                          ? "border-[#d7e7dc] bg-[#f4fbf7]"
                          : "border-[#ead9de] bg-[#fdf9fa]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black text-[#3f3437]">
                            결석일 {formatShortDate(lesson.absent_date)}
                          </p>
                          <p className="mt-1 text-sm text-[#8b767c]">
                            보강일 {formatShortDate(lesson.makeup_date)}{" "}
                            {normalizeTime(lesson.makeup_time)}
                          </p>
                          {lesson.memo && (
                            <p className="mt-1 text-sm text-[#8b767c]">
                              {lesson.memo}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <form action={toggleMakeupDone}>
                            <input type="hidden" name="makeup_id" value={lesson.id} />
                            <input
                              type="hidden"
                              name="is_done"
                              value={String(lesson.is_done)}
                            />
                            <button
                              type="submit"
                              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                            >
                              {lesson.is_done ? "미완료로" : "완료"}
                            </button>
                          </form>

                          <form action={deleteMakeupLesson}>
                            <input type="hidden" name="makeup_id" value={lesson.id} />
                            <button
                              type="submit"
                              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                            >
                              삭제
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          </section>

          <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-black">숙제 정리</h2>
              <p className="mt-1 text-sm text-[#8b767c]">
                시험범위 진도표에서 숙제로 표시된 항목들이에요.
              </p>
            </div>

            {homeworkTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-6 text-sm font-semibold text-[#9a838b]">
                현재 시험범위 진도표에 숙제로 표시된 항목이 없어요.
              </div>
            ) : (
              <div className="grid gap-3">
                {homeworkTasks.map((homework) => (
                  <div
                    key={homework.id}
                    className="rounded-3xl border border-[#ead9de] bg-[#fdf9fa] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#9f6c7a]">
                          {homework.subject}
                        </p>
                        <p className="mt-2 text-sm font-bold text-[#3f3437]">
                          {homeworkText(homework)}
                        </p>
                      </div>

                      <form action={completeHomeworkTask}>
                        <input
                          type="hidden"
                          name="progress_id"
                          value={homework.progressId}
                        />
                        <input
                          type="hidden"
                          name="task_name"
                          value={homework.taskName}
                        />
                        <button
                          type="submit"
                          className="rounded-2xl bg-[#4a3c40] px-4 py-2 text-xs font-black text-white"
                        >
                          완료
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">수업기록</h2>
              <p className="mt-1 text-sm text-[#8b767c]">
                최근 수업 진도와 숙제를 확인해요.
              </p>
            </div>

            <Link
              href={`/students/${id}/records/new`}
              className="rounded-2xl bg-[#b98594] px-4 py-3 text-sm font-black text-white"
            >
              기록 추가
            </Link>
          </div>

          {lessonRecords.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-[#fdf9fa] px-5 py-8 text-center text-sm font-semibold text-[#9a838b]">
              아직 수업기록이 없어요.
            </div>
          ) : (
            <div className="space-y-5">
              {lessonRecords.map((record) => {
                const subjectRecords = Array.isArray(record.subject_records)
                  ? record.subject_records
                  : [];

                const checkedHomeworkItems = Array.isArray(record.checked_homework_items)
                  ? record.checked_homework_items
                  : [];

                return (
                  <article
                    key={record.id}
                    className="rounded-[2rem] border border-[#ead9de] bg-[#fdf9fa] p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-[#3f3437]">
                          {formatDate(record.lesson_date)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#8b767c]">
                          {formatTime(record.start_time, record.end_time)}
                          {record.duration_text ? ` · ${record.duration_text}` : ""}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/students/${id}/records/${record.id}/edit`}
                          className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                        >
                          수정
                        </Link>

                        <form action={deleteLessonRecord}>
                          <input type="hidden" name="record_id" value={record.id} />
                          <button
                            type="submit"
                            className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-xs font-black text-[#8f6270]"
                          >
                            삭제
                          </button>
                        </form>
                      </div>
                    </div>

                    {checkedHomeworkItems.length > 0 && (
                      <div className="mb-4 rounded-3xl border border-[#d8eadf] bg-[#f4fbf7] p-4">
                        <p className="mb-2 text-xs font-black text-[#47735b]">
                          저번 숙제 완료 확인
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {checkedHomeworkItems.map((item, index) => (
                            <span
                              key={`${item.progress_id}-${item.task_name}-${index}`}
                              className="rounded-full border border-[#cce6d6] bg-white px-3 py-1 text-xs font-bold text-[#47735b]"
                            >
                              {taskText(item)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {subjectRecords.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-white px-5 py-6 text-sm font-semibold text-[#9a838b]">
                        과목별 기록이 없어요.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {subjectRecords.map((subjectRecord, index) => {
                          const progressItems = Array.isArray(subjectRecord.progress_items)
                            ? subjectRecord.progress_items
                            : [];
                          const homeworkItems = Array.isArray(subjectRecord.homework_items)
                            ? subjectRecord.homework_items
                            : [];

                          const oldProgress = subjectRecord.progress || "";
                          const oldHomework = subjectRecord.homework || "";

                          return (
                            <div
                              key={`${subjectRecord.subject}-${index}`}
                              className="rounded-3xl border border-[#ead9de] bg-white p-4"
                            >
                              <p className="mb-3 text-sm font-black text-[#9f6c7a]">
                                {subjectRecord.subject || "과목 미입력"}
                              </p>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-2xl bg-[#fbf7f8] p-4">
                                  <p className="mb-2 text-xs font-black text-[#8f6270]">
                                    오늘 한 진도
                                  </p>

                                  {progressItems.length > 0 ? (
                                    <div className="space-y-2">
                                      {progressItems.map((item, itemIndex) => (
                                        <p
                                          key={`${item.progress_id}-${item.task_name}-${itemIndex}`}
                                          className="rounded-xl border border-[#ead9de] bg-white px-3 py-2 text-sm font-semibold text-[#3f3437]"
                                        >
                                          {taskText(item)}
                                        </p>
                                      ))}
                                    </div>
                                  ) : oldProgress ? (
                                    <p className="text-sm font-semibold text-[#3f3437]">
                                      {oldProgress}
                                    </p>
                                  ) : (
                                    <p className="text-sm font-semibold text-[#9a838b]">
                                      미입력
                                    </p>
                                  )}
                                </div>

                                <div className="rounded-2xl bg-[#fbf7f8] p-4">
                                  <p className="mb-2 text-xs font-black text-[#8f6270]">
                                    새로 낸 숙제
                                  </p>

                                  {homeworkItems.length > 0 ? (
                                    <div className="space-y-2">
                                      {homeworkItems.map((item, itemIndex) => (
                                        <p
                                          key={`${item.progress_id}-${item.task_name}-${itemIndex}`}
                                          className="rounded-xl border border-[#ead9de] bg-white px-3 py-2 text-sm font-semibold text-[#3f3437]"
                                        >
                                          {taskText(item)}
                                        </p>
                                      ))}
                                    </div>
                                  ) : oldHomework ? (
                                    <p className="text-sm font-semibold text-[#3f3437]">
                                      {oldHomework}
                                    </p>
                                  ) : (
                                    <p className="text-sm font-semibold text-[#9a838b]">
                                      미입력
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(record.content || record.memo) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {record.content && (
                          <div className="rounded-3xl border border-[#ead9de] bg-white p-4">
                            <p className="mb-2 text-xs font-black text-[#8f6270]">
                              수업 내용
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-[#3f3437]">
                              {record.content}
                            </p>
                          </div>
                        )}

                        {record.memo && (
                          <div className="rounded-3xl border border-[#ead9de] bg-white p-4">
                            <p className="mb-2 text-xs font-black text-[#8f6270]">
                              메모
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-[#3f3437]">
                              {record.memo}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}