import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    month?: string;
    showPlans?: string;
    weeklyEdit?: string;
  }>;
};

const WEEKLY_PLAN_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKLY_PLAN_START_HOUR = 10;
const WEEKLY_PLAN_END_HOUR = 24;
const WEEKLY_PLAN_ROW_HEIGHT = 86;
const WEEKLY_PLAN_HOURS = Array.from(
  { length: WEEKLY_PLAN_END_HOUR - WEEKLY_PLAN_START_HOUR },
  (_, index) => index + WEEKLY_PLAN_START_HOUR,
);

const WEEKLY_PLAN_TIME_OPTIONS = Array.from(
  { length: (WEEKLY_PLAN_END_HOUR - WEEKLY_PLAN_START_HOUR) * 2 + 1 },
  (_, index) => {
    const totalMinutes = WEEKLY_PLAN_START_HOUR * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    if (hour === 24) return "24:00";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  },
);

function formatWeeklyPlanTimeOption(time: string) {
  if (time === "24:00") return "24:00 밤 12시";
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const ampm = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${time} ${ampm} ${displayHour}:${minute}`;
}
const WEEKLY_PLAN_CATEGORIES = [
  "학교",
  "학원",
  "과외",
  "자습",
  "이동",
  "휴식",
  "기타",
];
const WEEKLY_PLAN_SUBJECTS = [
  "",
  "국어",
  "영어",
  "수학",
  "사회",
  "과학",
  "한국사",
  "도보",
  "지하철",
  "버스",
  "직접입력",
];

type WeeklyPlanBlock = {
  id: string;
  day: string;
  start: string;
  end: string;
  category: string;
  subject?: string | null;
  customSubject?: string | null;
  memo?: string | null;
};

function weeklyPlanKey(day: string, hour: number) {
  return `${day}_${hour}`;
}

function parseWeeklyPlan(value: unknown): { blocks: WeeklyPlanBlock[] } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { blocks: [] };
  const raw = value as Record<string, any>;

  if (Array.isArray(raw.blocks)) {
    return {
      blocks: raw.blocks
        .filter(
          (block) =>
            block && block.day && block.start && block.end && block.category,
        )
        .map((block) => ({
          id: String(
            block.id ||
              `${block.day}-${block.start}-${block.end}-${Math.random()}`,
          ),
          day: String(block.day),
          start: normalizeTime(block.start) || String(block.start),
          end: normalizeTime(block.end) || String(block.end),
          category:
            String(block.category) === "개인공부"
              ? "자습"
              : String(block.category),
          subject: block.subject ? String(block.subject) : null,
          customSubject: block.customSubject
            ? String(block.customSubject)
            : null,
          memo: block.memo ? String(block.memo) : null,
        })),
    };
  }

  // 예전 시간칸 직접입력 방식으로 저장된 값도 사라지지 않게 블록으로 변환해요.
  const blocks: WeeklyPlanBlock[] = [];
  Object.entries(raw).forEach(([key, text]) => {
    const [day, hourText] = key.split("_");
    const hour = Number(hourText);
    const memo = String(text || "").trim();
    if (!day || !hour || !memo) return;
    blocks.push({
      id: `${key}-${memo}`,
      day,
      start: `${String(hour).padStart(2, "0")}:00`,
      end: `${String(hour + 1).padStart(2, "0")}:00`,
      category: "기타",
      subject: null,
      memo,
    });
  });

  return { blocks };
}

function timeToMinutes(
  time?: string | null,
  options?: { midnightAsEnd?: boolean },
) {
  const normalized = normalizeTime(time);
  if (!normalized) return 0;
  const [hour, minute] = normalized.split(":").map(Number);

  // input type="time"에서 밤 12시는 00:00으로 들어와요.
  // 주간 시간표는 10:00~24:00 범위라서, 끝시간으로 들어온 00:00은 24:00으로 처리합니다.
  if (options?.midnightAsEnd && hour === 0 && minute === 0) {
    return 24 * 60;
  }

  return hour * 60 + minute;
}

function formatDurationLabel(start: string, end: string) {
  const minutes = Math.max(
    timeToMinutes(end, { midnightAsEnd: true }) - timeToMinutes(start),
    0,
  );
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}시간 ${rest}분`;
  if (hours) return `${hours}시간`;
  return `${rest}분`;
}

function weeklyBlockSubjectLabel(block: WeeklyPlanBlock) {
  if (block.subject === "직접입력") return block.customSubject || "직접입력";
  return block.subject || block.customSubject || "";
}

function weeklyCategoryLabel(category?: string | null) {
  return category === "개인공부" ? "자습" : category || "";
}

function weeklyMoveEmoji(block: WeeklyPlanBlock) {
  const subject = weeklyBlockSubjectLabel(block);
  if (block.category === "휴식") return "☕";
  if (subject === "도보") return "🚶";
  if (subject === "지하철") return "🚇";
  if (subject === "버스") return "🚌";
  return "↔️";
}

function sameScopeText(a?: string | null, b?: string | null) {
  return (
    String(a || "").trim() && String(a || "").trim() === String(b || "").trim()
  );
}

function weeklyBlockClass(block: WeeklyPlanBlock) {
  if (block.category === "이동" || block.category === "휴식")
    return "border-transparent bg-transparent text-[#525252] shadow-none";
  if (block.category === "학교")
    return "border-[#d4d4d4] bg-[#f7f7f7] text-[#171717]";
  if (block.category === "학원")
    return "border-[#c9ddf2] bg-[#f7f7f7] text-[#4b6f96]";
  if (block.category === "과외")
    return "border-[#e8d1a8] bg-[#f7f7f7] text-[#404040]";
  if (block.category === "자습" || block.category === "개인공부") {
    const subject = weeklyBlockSubjectLabel(block);
    if (subject === "국어")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    if (subject === "영어")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    if (subject === "수학")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    if (subject === "사회")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    if (subject === "과학")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    if (subject === "한국사")
      return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
    return "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]";
  }
  return "border-[#e5e5e5] bg-[#ffffff] text-[#5c5751]";
}

type SavedTask = {
  progress_id?: string;
  subject?: string;
  unit_name?: string;
  task_name?: string;
  before_status?: string;
  publisher?: string | null;
  material_name?: string | null;
  major_unit?: string | null;
  checked_status?: "done" | "deferred" | string | null;
  deferred?: boolean | null;
};

type SubjectRecord = {
  subject?: string;
  progress?: string;
  homework?: string;
  progress_items?: SavedTask[];
  homework_items?: SavedTask[];
  plan_items?: SavedTask[];
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
  is_extra?: boolean | null;
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

type GradeTrendRecord = {
  id: string;
  student_id: string;
  semester_label: string;
  subject: string;
  subject_area?: string | null;
  subject_name?: string | null;
  lesson_hours: number | null;
  grade: number | null;
  percentile: number | null;
  rank?: number | null;
  total_students?: number | null;
  memo: string | null;
  created_at: string;
};

type SettlementRow = {
  id?: string;
  expected_lesson_count: number | null;
  previous_carryover_count?: number | null;
  actual_lesson_count_override?: number | null;
  feedback_date?: string | null;
  feedback_done?: boolean | null;
  start_date: string;
  end_date: string;
};

type EditableSettlementRow = SettlementRow & {
  lesson_hours?: number | null;
  hourly_rate?: number | null;
  payment_status?: string | null;
  payment_type?: string | null;
  payment_completed_date?: string | null;
  feedback_note?: string | null;
  total_fee_override?: number | null;
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
  photo_url?: string | null;
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
  original_event_date?: string | null;
  original_lesson_time_id?: string | null;
  created_at: string;
};

type StudyPlan = {
  id: string;
  student_id: string;
  plan_type: string;
  due_date: string | null;
  week_number: number | null;
  subject: string | null;
  title: string;
  unit_name: string | null;
  task_name: string | null;
  progress_id: string | null;
  memo: string | null;
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
  major_unit?: string | null;
};

type HomeworkTask = {
  id: string;
  progressId: string;
  subject: string;
  unitName: string;
  taskName: string;
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
  source?: "exam" | "manual";
  lessonDate?: string | null;
  recordId?: string | null;
};

type SummaryRow = {
  id: string;
  subject: string;
  text: string;
  unitName?: string | null;
  taskName?: string | null;
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
  progressId?: string | null;
  source?: "exam" | "manual" | "old";
  deferred?: boolean | null;
  recordId?: string | null;
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
  original_event_date?: string | null;
  original_lesson_time_id?: string | null;
  link_url?: string | null;
  deletable?: boolean;
  groupedSubjects?: string[];
};

const SUBJECTS = ["국어", "영어", "수학", "사회", "과학", "한국사"];
const GRADE_SUBJECT_AREAS = [
  "국어과",
  "영어과",
  "수학과",
  "사회과",
  "과학과",
  "기타과",
];
const CORE_GRADE_SUBJECT_AREAS = [
  "국어과",
  "영어과",
  "수학과",
  "사회과",
  "과학과",
];
const PERFORMANCE_SUBJECTS = [
  "선택안함",
  ...SUBJECTS,
  "자율",
  "진로",
  "동아리",
  "직접입력",
];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKDAYS_BY_DATE = ["일", "월", "화", "수", "목", "금", "토"];

const PERFORMANCE_STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완성",
};

const PERFORMANCE_STATUS_STYLES: Record<string, string> = {
  not_started: "border-[#e5e5e5] bg-white text-[#525252]",
  in_progress: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  done: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
};

const STUDY_PLAN_SELECTABLE_STATUSES = [
  "not_started",
  "in_progress",
  "planned",
];

const STUDY_PLAN_STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "다시보기",
  homework: "숙제",
  planned: "예정",
};

const STUDY_PLAN_STATUS_STYLES: Record<string, string> = {
  not_started: "border-[#e5e5e5] bg-white text-[#525252]",
  in_progress: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  done: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  review: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  homework: "border-[#d4d4d4] bg-[#f5f5f5] text-[#171717]",
  planned: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
};

const EXAM_STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "done",
  "review",
  "homework",
  "paused",
  "planned",
];

const EXAM_STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "복습",
  homework: "숙제",
  paused: "보류",
  planned: "계획",
};

const EXAM_STATUS_STYLES: Record<string, string> = {
  not_started: "border-[#e5e5e5] bg-white text-[#171717]",
  in_progress: "border-[#fb923c] bg-[#ffedd5] text-[#c2410c]",
  done: "border-[#22c55e] bg-[#dcfce7] text-[#166534]",
  review: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  homework: "border-[#d4d4d4] bg-[#f7f7f7] text-[#171717]",
  paused: "border-[#d8d8d8] bg-[#f1f1f1] text-[#777]",
  planned: "border-[#c084fc] bg-[#f3e8ff] text-[#7e22ce]",
};

const EVENT_TYPE_STYLES: Record<string, string> = {
  수업: "border-[#d4d4d4] bg-[#f5f5f5] text-[#171717]",
  추가수업: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  보강수업: "border-[#d4d4d4] bg-[#f5f5f5] text-[#171717]",
  직전보강: "border-[#d4d4d4] bg-[#ffffff] text-[#171717]",
  수행평가: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  시험: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  중간고사: "border-[#d4d4d4] bg-[#ffffff] text-[#171717]",
  기말고사: "border-[#d4d4d4] bg-[#ffffff] text-[#171717]",
  피드백: "border-[#d4d4d4] bg-[#ffffff] text-[#404040]",
  공부계획: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  기타: "border-[#e5e5e5] bg-white text-[#525252]",
};

function parseStatuses(
  statuses: Record<string, string> | string | null | undefined,
) {
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

function studyPlanStatusLabel(status?: string | null) {
  if (!status) return "-";
  return STUDY_PLAN_STATUS_LABELS[status] || status;
}

function studyPlanStatusStyle(status?: string | null) {
  if (!status) return "border-[#e5e5e5] bg-[#f7f7f7] text-[#525252]";
  return (
    STUDY_PLAN_STATUS_STYLES[status] ||
    "border-[#e5e5e5] bg-[#f7f7f7] text-[#525252]"
  );
}

function getVisibleStatusEntries(
  statuses: Record<string, string>,
): [string, string][] {
  return Object.entries(statuses).filter(
    ([taskName]) => taskName && !taskName.startsWith("__"),
  );
}

const EXAM_SCOPE_TASK_ORDER = [
  "단어",
  "어휘",
  "본문",
  "본문해석",
  "해석",
  "내용정리",
  "문법",
  "구문",
  "영작",
  "암기",
  "문제",
  "문제풀이",
  "오답",
  "복습",
  "서술형",
  "프린트",
  "숙제",
];

function examScopeTaskOrderIndex(taskName: string) {
  const exactIndex = EXAM_SCOPE_TASK_ORDER.indexOf(taskName);
  if (exactIndex >= 0) return exactIndex;

  const partialIndex = EXAM_SCOPE_TASK_ORDER.findIndex((keyword) =>
    taskName.includes(keyword),
  );

  return partialIndex >= 0 ? partialIndex : 999;
}

function collectTaskNamesInExamScopeOrder(rows: ExamProgress[]) {
  const firstSeenIndex = new Map<string, number>();
  const names: string[] = [];

  rows.forEach((row) => {
    getVisibleStatusEntries(parseStatuses(row.statuses)).forEach(
      ([taskName]) => {
        if (firstSeenIndex.has(taskName)) return;
        firstSeenIndex.set(taskName, names.length);
        names.push(taskName);
      },
    );
  });

  return names.sort((a, b) => {
    const orderDiff = examScopeTaskOrderIndex(a) - examScopeTaskOrderIndex(b);
    if (orderDiff !== 0) return orderDiff;
    return (firstSeenIndex.get(a) || 0) - (firstSeenIndex.get(b) || 0);
  });
}

function makeStudyPlanTaskValue(
  progressId: string,
  subject: string,
  unitName: string,
  taskName: string,
) {
  return `${progressId}|||${subject}|||${unitName}|||${taskName}`;
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

function getTodayText() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDueDate(dateText?: string | null) {
  if (!dateText) return "날짜 미정";

  const date = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return dateText;

  return date.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function daysUntilDue(dateText?: string | null) {
  if (!dateText) return null;

  const today = new Date(`${getTodayText()}T00:00:00+09:00`);
  const due = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(due.getTime())) return null;

  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function urgentDueLabel(dateText?: string | null) {
  const diff = daysUntilDue(dateText);

  if (diff === 0) return "🚨 오늘";
  if (diff === 1) return "🚨 1일 남음";
  if (diff !== null && diff < 0) return "⚠️ 지남";
  return "";
}

function examDdayLabel(dateText?: string | null) {
  const diff = daysUntilDue(dateText);

  if (diff === null) return "";
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function chunkCalendarRows<T>(items: T[], size = 7) {
  const rows: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }

  return rows;
}

function studyPlanCalendarTitle(plan: StudyPlan) {
  const subject = plan.subject ? `${plan.subject} ` : "";
  const unit = plan.unit_name ? `${plan.unit_name} ` : "";
  const task = plan.task_name ? `${plan.task_name} ` : "";
  return `${subject}${unit}${task || plan.title}`.trim();
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
  const majorUnit = item.major_unit || "";
  const unit = item.unit_name || "";
  const major =
    majorUnit && !sameScopeText(majorUnit, unit) ? `${majorUnit} ` : "";
  const task = item.task_name || "";

  if (!unit && !task) return "항목명 없음";
  if (unit === "직접입력" || unit === "기타" || item.before_status === "manual")
    return task || "기타 숙제";
  if (!task) return `${publisher}${material}${major}${unit}`.trim();
  return `${publisher}${material}${major}${unit} - ${task}`.trim();
}

function homeworkText(item: HomeworkTask) {
  const publisher = item.publisher ? `[${item.publisher}] ` : "";
  const material = item.materialName ? `${item.materialName} ` : "";
  const major =
    item.majorUnit && !sameScopeText(item.majorUnit, item.unitName)
      ? `${item.majorUnit} `
      : "";

  if (
    item.unitName === "직접입력" ||
    item.unitName === "기타" ||
    item.source === "manual"
  ) {
    return item.taskName || "기타 숙제";
  }

  return `${publisher}${material}${major}${item.unitName} - ${item.taskName}`.trim();
}

function summaryUnitLabel(row: SummaryRow) {
  const publisher = row.publisher ? `[${row.publisher}] ` : "";
  const material = row.materialName ? `${row.materialName} ` : "";
  const major =
    row.majorUnit && !sameScopeText(row.majorUnit, row.unitName)
      ? `${row.majorUnit} `
      : "";

  if (row.unitName && row.unitName !== "직접입력" && row.unitName !== "기타") {
    return `${publisher}${material}${major}${row.unitName}`.trim();
  }

  if (row.unitName === "직접입력" || row.unitName === "기타") return "기타";

  if (row.text.includes(" - ")) {
    return row.text.split(" - ")[0] || "기타";
  }

  return "기타";
}

function summaryTaskLabel(row: SummaryRow) {
  if (row.taskName) return row.taskName;

  if (row.text.includes(" - ")) {
    return row.text.split(" - ").slice(1).join(" - ") || row.text;
  }

  return row.text;
}

function groupBySubject<T extends { subject: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  items.forEach((item) => {
    const subject = item.subject || "과목 미입력";
    grouped.set(subject, [...(grouped.get(subject) || []), item]);
  });

  return Array.from(grouped.entries()).map(([subject, rows]) => ({
    subject,
    rows,
  }));
}

function unitGroupKey(item: {
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
  unitName?: string | null;
}) {
  return [
    item.publisher || "",
    item.materialName || "",
    item.majorUnit || "",
    item.unitName || "기타",
  ].join("::");
}

function groupBySubjectAndUnit<
  T extends {
    subject: string;
    publisher?: string | null;
    materialName?: string | null;
    unitName?: string | null;
    majorUnit?: string | null;
    taskName?: string | null;
  },
>(items: T[]) {
  const subjectMap = new Map<
    string,
    Map<
      string,
      {
        publisher?: string | null;
        materialName?: string | null;
        unitName?: string | null;
        majorUnit?: string | null;
        rows: T[];
      }
    >
  >();

  items.forEach((item) => {
    const subject = item.subject || "과목 미입력";
    const key = unitGroupKey(item);
    if (!subjectMap.has(subject)) subjectMap.set(subject, new Map());
    const unitMap = subjectMap.get(subject)!;

    if (!unitMap.has(key)) {
      unitMap.set(key, {
        publisher: item.publisher,
        materialName: item.materialName,
        majorUnit: item.majorUnit,
        unitName: item.unitName || "기타",
        rows: [],
      });
    }

    const unit = unitMap.get(key)!;
    if (!unit.rows.some((row) => row.taskName === item.taskName)) {
      unit.rows.push(item);
    }
  });

  return Array.from(subjectMap.entries()).map(([subject, unitMap]) => ({
    subject,
    units: Array.from(unitMap.values()),
  }));
}

function unitTitle(unit: {
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
  unitName?: string | null;
}) {
  if (unit.unitName === "직접입력" || unit.unitName === "기타") return "기타";

  const chunks = [
    unit.publisher,
    unit.materialName,
    unit.majorUnit,
    unit.unitName && !sameScopeText(unit.majorUnit, unit.unitName)
      ? unit.unitName
      : null,
  ].filter((value) => value && value !== "직접입력" && value !== "기타");

  return chunks.length ? chunks.join(" · ") : "기타";
}

function examProgressFullTitle(row: ExamProgress) {
  const chunks = [
    row.publisher ? `[${row.publisher}]` : null,
    row.material_name || null,
    row.major_unit || null,
    row.unit_name && !sameScopeText(row.major_unit, row.unit_name)
      ? row.unit_name
      : null,
  ].filter(Boolean);

  return chunks.length ? chunks.join(" · ") : row.unit_name || "범위명 없음";
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
    prev.getMonth() + 1,
  ).padStart(2, "0")}`;

  const nextMonthText = `${next.getFullYear()}-${String(
    next.getMonth() + 1,
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
    "0",
  )}`;
}

function addDaysToDateText(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return makeDateText(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function makeDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    dates.push(
      makeDateText(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate(),
      ),
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function makeMonthRangeFromStartDate(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);

  return {
    startDate: makeDateText(
      start.getFullYear(),
      start.getMonth() + 1,
      start.getDate(),
    ),
    endDate: makeDateText(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
}

function pickCurrentSettlement(
  settlements: SettlementRow[],
  monthStartText: string,
  monthEndText: string,
) {
  const overlapping = settlements
    .filter(
      (settlement) =>
        settlement.start_date <= monthEndText &&
        settlement.end_date >= monthStartText,
    )
    .sort((a, b) => {
      const monthStartContainDiff =
        Number(b.start_date <= monthStartText && b.end_date >= monthStartText) -
        Number(a.start_date <= monthStartText && a.end_date >= monthStartText);
      if (monthStartContainDiff !== 0) return monthStartContainDiff;

      const startDiff = String(a.start_date || "").localeCompare(
        String(b.start_date || ""),
      );
      if (startDiff !== 0) return startDiff;

      return String(a.end_date || "").localeCompare(String(b.end_date || ""));
    });

  return overlapping[0] || settlements[0];
}

function formatMonthDay(dateText: string) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatLessonMonthLabel(monthNumber: number) {
  return `${monthNumber}월 수업`;
}

function nextMonthNumber(monthNumber: number) {
  return monthNumber === 12 ? 1 : monthNumber + 1;
}

function addMonthsToYearMonth(year: number, month: number, amount: number) {
  const date = new Date(year, month - 1 + amount, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function makeMonthBoundary(year: number, month: number) {
  return {
    startDate: makeDateText(year, month, 1),
    endDate: makeDateText(year, month, new Date(year, month, 0).getDate()),
  };
}

function pickSettlementForLessonMonth(
  settlements: SettlementRow[],
  boundary: { startDate: string; endDate: string },
  usedSettlementIds: Set<string>,
) {
  const unusedSettlements = settlements.filter(
    (row) => !row.id || !usedSettlementIds.has(row.id),
  );
  const startingInMonth = unusedSettlements
    .filter(
      (row) =>
        row.start_date >= boundary.startDate && row.start_date <= boundary.endDate,
    )
    .sort((a, b) =>
      String(a.start_date || "").localeCompare(String(b.start_date || "")),
    );

  if (startingInMonth[0]) return startingInMonth[0];

  return (
    unusedSettlements
      .filter(
        (row) =>
          row.start_date <= boundary.endDate && row.end_date >= boundary.startDate,
      )
      .sort((a, b) => {
        const startDiff = String(a.start_date || "").localeCompare(
          String(b.start_date || ""),
        );
        if (startDiff !== 0) return startDiff;
        return String(a.end_date || "").localeCompare(String(b.end_date || ""));
      })[0] || null
  );
}

function makeCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startBlankCount = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: Array<{
    dateText: string;
    day: number;
    isCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < startBlankCount; i++) {
    const date = new Date(year, month - 1, 1 - startBlankCount + i);
    cells.push({
      dateText: makeDateText(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ),
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateText: makeDateText(year, month, day),
      day,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const offset = cells.length - startBlankCount - daysInMonth + 1;
    const date = new Date(year, month, offset);
    cells.push({
      dateText: makeDateText(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ),
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  return cells;
}

function findLessonRecordByDate(
  lessonRecords: LessonRecord[],
  dateText: string,
) {
  return lessonRecords.find((record) => record.lesson_date === dateText);
}

function makeAutoLessonEventsForDates(
  lessonTimes: LessonTime[],
  dateTexts: string[],
  lessonRecords: LessonRecord[],
  studentId: string,
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

  const events: CalendarEvent[] = [];

  lessonTimes.forEach((lessonTime) => {
    const targetDay = dayIndexMap[lessonTime.day_of_week];

    if (targetDay === undefined) return;

    dateTexts.forEach((dateText) => {
      const date = new Date(`${dateText}T00:00:00+09:00`);
      if (Number.isNaN(date.getTime())) return;

      if (date.getDay() === targetDay) {
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
              lessonTime.end_time,
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
    });
  });

  return events;
}

function makeLessonRecordEvents(
  lessonRecords: LessonRecord[],
  fixedLessonEvents: CalendarEvent[],
  makeupLessons: MakeupLesson[],
  visibleDateTexts: string[],
  studentId: string,
): CalendarEvent[] {
  const fixedDates = new Set(
    fixedLessonEvents.map((event) => event.event_date),
  );
  const visibleDates = new Set(visibleDateTexts);
  const makeupExactKeys = new Set(
    makeupLessons
      .filter((lesson) => lesson.makeup_date && lesson.makeup_time)
      .map(
        (lesson) =>
          `${lesson.makeup_date}::${normalizeTime(lesson.makeup_time)}`,
      ),
  );
  const makeupDateOnlyKeys = new Set(
    makeupLessons
      .filter((lesson) => lesson.makeup_date && !lesson.makeup_time)
      .map((lesson) => String(lesson.makeup_date)),
  );

  return lessonRecords
    .filter((record) => {
      if (!record.lesson_date) return false;
      if (fixedDates.has(record.lesson_date)) return false;

      const recordTime = normalizeTime(record.start_time);
      if (makeupExactKeys.has(`${record.lesson_date}::${recordTime}`))
        return false;
      if (!recordTime && makeupDateOnlyKeys.has(record.lesson_date))
        return false;

      return visibleDates.has(record.lesson_date);
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

function makeMakeupEvents(
  makeupLessons: MakeupLesson[],
  lessonRecords: LessonRecord[],
  studentId: string,
): CalendarEvent[] {
  return makeupLessons
    .filter((lesson) => lesson.makeup_date)
    .map((lesson) => {
      const matchedRecord = lesson.makeup_date
        ? findLessonRecordByDate(lessonRecords, lesson.makeup_date)
        : null;

      return {
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
        link_url: matchedRecord
          ? `/students/${studentId}/records/${matchedRecord.id}/edit`
          : null,
        deletable: false,
      };
    });
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

function groupCalendarEventsForDisplay(events: CalendarEvent[]) {
  const examEventTypes = new Set(["시험", "중간고사", "기말고사"]);
  const grouped = new Map<string, CalendarEvent>();

  events.forEach((event) => {
    if (!examEventTypes.has(event.event_type)) {
      grouped.set(event.id, event);
      return;
    }

    const subject = event.subject || "";
    const titleWithoutSubject =
      subject && event.title.includes(subject)
        ? event.title.replace(subject, "").replace(/\s+/g, " ").trim()
        : event.title;
    const key = [
      event.event_date,
      event.event_time || "",
      event.event_type,
      titleWithoutSubject,
    ].join("::");
    const previous = grouped.get(key);

    if (!previous) {
      grouped.set(key, {
        ...event,
        title: titleWithoutSubject || event.title,
        groupedSubjects: subject ? [subject] : [],
      });
      return;
    }

    const subjects = Array.from(
      new Set([...(previous.groupedSubjects || []), subject]),
    ).filter(Boolean);

    grouped.set(key, {
      ...previous,
      id: `${previous.id}-${event.id}`,
      title: titleWithoutSubject || previous.title || event.title,
      memo: [previous.memo, event.memo].filter(Boolean).join("\n") || null,
      groupedSubjects: subjects,
    });
  });

  return Array.from(grouped.values());
}

function calendarEventTitle(event: CalendarEvent) {
  const type = event.event_type;
  const time = event.event_time ? `${normalizeTime(event.event_time)} ` : "";

  if (type === "수업") return `${time}수업`;
  if (type === "보강수업") return `${time}보강수업`;
  if (type === "직전보강") return `${time}직전보강`;
  if (type === "추가수업") return `${time}추가수업`;
  if (
    (type === "시험" || type === "중간고사" || type === "기말고사") &&
    event.groupedSubjects?.length
  ) {
    return `${time}${event.title} · ${event.groupedSubjects.join("/")}`;
  }
  if (type === "중간고사") return `${time}중간고사`;
  if (type === "기말고사") return `${time}기말고사`;
  if (type === "피드백") {
    return event.title || `${type}일 - ${formatDueDate(event.event_date)}`;
  }
  if (type === "공부계획") return `${time}${event.title || "공부계획"}`.trim();

  if (type === "수행평가") {
    return event.subject && event.subject !== "선택안함"
      ? `${event.subject} ${event.title}`
      : event.title;
  }

  return event.title;
}

function isLessonCalendarEvent(event: CalendarEvent) {
  return (
    event.event_type === "수업" ||
    event.event_type === "보강수업" ||
    event.event_type === "직전보강" ||
    event.event_type === "추가수업"
  );
}

function makeLessonRoundMap(
  events: CalendarEvent[],
  basisRanges: { startDate: string; endDate: string }[],
  fallbackStartDate: string,
) {
  const roundMap = new Map<string, number>();
  const roundGroups = new Map<string, CalendarEvent[]>();
  const sortedRanges = [...basisRanges].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  events
    .filter((event) => isLessonCalendarEvent(event))
    .forEach((event) => {
      const matchedRange = sortedRanges.find(
        (range) =>
          range.startDate <= event.event_date &&
          range.endDate >= event.event_date,
      );
      const basisDate = matchedRange?.startDate || fallbackStartDate;

      if (event.event_date < basisDate) return;
      roundGroups.set(basisDate, [...(roundGroups.get(basisDate) || []), event]);
    });

  roundGroups.forEach((groupEvents) => {
    groupEvents.sort((a, b) => {
      const dateCompare = a.event_date.localeCompare(b.event_date);
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = String(a.event_time || "").localeCompare(
        String(b.event_time || ""),
      );
      if (timeCompare !== 0) return timeCompare;
      return a.id.localeCompare(b.id);
    })
    .forEach((event, index) => {
      roundMap.set(event.id, index + 1);
    });
  });

  return roundMap;
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
    1: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    2: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    3: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    4: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    5: "border-[#d4d4d4] bg-[#eefaf4] text-[#404040]",
    6: "border-[#d4d4d4] bg-[#eef8fc] text-[#404040]",
    7: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    8: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
    9: "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]",
  };

  if (!grade) return "border-[#e5e5e5] bg-white text-[#525252]";
  return styles[grade] || "border-[#e5e5e5] bg-white text-[#525252]";
}

function subjectEmoji(subject?: string | null) {
  const emojis: Record<string, string> = {
    국어: "📖",
    영어: "🧸",
    수학: "🧮",
    사회: "🌏",
    과학: "🔬",
    한국사: "🏛️",
  };

  if (!subject) return "🌷";
  return emojis[subject] || "🌷";
}

function careerEmoji(career?: string | null) {
  if (!career) return "🌱";

  const text = career.toLowerCase();

  if (text.includes("체육") || text.includes("스포츠")) return "🏃";
  if (text.includes("교육") || text.includes("교사") || text.includes("선생"))
    return "📚";
  if (
    text.includes("간호") ||
    text.includes("보건") ||
    text.includes("의학") ||
    text.includes("의료")
  )
    return "🩺";
  if (
    text.includes("마케팅") ||
    text.includes("광고") ||
    text.includes("홍보") ||
    text.includes("소비자")
  )
    return "💡";
  if (text.includes("경영") || text.includes("경제") || text.includes("회계"))
    return "💼";
  if (text.includes("디자인") || text.includes("미술") || text.includes("예술"))
    return "🎨";
  if (text.includes("패션") || text.includes("의류")) return "👗";
  if (text.includes("심리")) return "🧠";
  if (text.includes("사회") || text.includes("정치") || text.includes("행정"))
    return "🌏";
  if (text.includes("법") || text.includes("변호") || text.includes("검사"))
    return "⚖️";
  if (
    text.includes("항공") ||
    text.includes("승무원") ||
    text.includes("파일럿")
  )
    return "✈️";
  if (
    text.includes("개발") ||
    text.includes("컴퓨터") ||
    text.includes("소프트웨어") ||
    text.includes("ai")
  )
    return "💻";
  if (text.includes("생명") || text.includes("과학") || text.includes("화학"))
    return "🔬";
  if (text.includes("문학") || text.includes("언어") || text.includes("번역"))
    return "📖";

  return "🌱";
}

function getCareerCountdownLabel(age?: string | number | null) {
  if (age === null || age === undefined || age === "") return "20살까지";

  const match = String(age).match(/\d+/);
  if (!match) return "20살까지";

  const currentAge = Number(match[0]);
  if (!currentAge || Number.isNaN(currentAge)) return "20살까지";

  const currentMonth = Number(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
    })
      .format(new Date())
      .replace(/\D/g, ""),
  );

  const remainingMonths = (20 - currentAge) * 12 - currentMonth;

  if (remainingMonths <= 0) return "지금";

  const years = Math.floor(remainingMonths / 12);
  const months = remainingMonths % 12;

  if (years > 0 && months > 0) return `${years}년 ${months}개월 뒤`;
  if (years > 0) return `${years}년 뒤`;
  return `${months}개월 뒤`;
}

function getRemainingMonthsUntilTwenty(age?: string | number | null) {
  if (age === null || age === undefined || age === "") return null;

  const match = String(age).match(/\d+/);
  if (!match) return null;

  const currentAge = Number(match[0]);
  if (!currentAge || Number.isNaN(currentAge)) return null;

  const currentMonth = Number(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
    })
      .format(new Date())
      .replace(/\D/g, ""),
  );

  return Math.max((20 - currentAge) * 12 - currentMonth, 0);
}

function getGraduationGaugePercent(age?: string | number | null) {
  const remainingMonths = getRemainingMonthsUntilTwenty(age);
  if (remainingMonths === null) return 0;

  const totalMonths = 36;
  const elapsedMonths = Math.min(
    Math.max(totalMonths - remainingMonths, 0),
    totalMonths,
  );

  return Math.round((elapsedMonths / totalMonths) * 100);
}

function getAdmissionClassLabel(age?: string | number | null) {
  if (age === null || age === undefined || age === "") return "학번 미정";

  const match = String(age).match(/\d+/);
  if (!match) return "학번 미정";

  const currentAge = Number(match[0]);
  if (!currentAge || Number.isNaN(currentAge)) return "학번 미정";

  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date()),
  );

  const admissionYear = currentYear + Math.max(20 - currentAge, 0);
  return `${String(admissionYear).slice(-2)}학번`;
}

function universityEmoji(
  targetUniversity?: string | null,
  targetMajor?: string | null,
  career?: string | null,
) {
  const text =
    `${targetUniversity || ""} ${targetMajor || ""} ${career || ""}`.toLowerCase();

  if (text.includes("체육") || text.includes("스포츠")) return "🏃";
  if (text.includes("교육") || text.includes("교대") || text.includes("사범"))
    return "📚";
  if (
    text.includes("간호") ||
    text.includes("보건") ||
    text.includes("의학") ||
    text.includes("의대")
  )
    return "🩺";
  if (
    text.includes("마케팅") ||
    text.includes("광고") ||
    text.includes("홍보") ||
    text.includes("미디어")
  )
    return "💡";
  if (text.includes("경영") || text.includes("경제") || text.includes("회계"))
    return "💼";
  if (text.includes("디자인") || text.includes("미술") || text.includes("예술"))
    return "🎨";
  if (text.includes("패션") || text.includes("의류")) return "👗";
  if (text.includes("심리")) return "🧠";
  if (text.includes("사회") || text.includes("정치") || text.includes("행정"))
    return "🌏";
  if (text.includes("법") || text.includes("로스쿨")) return "⚖️";
  if (text.includes("항공") || text.includes("승무원")) return "✈️";
  if (
    text.includes("컴퓨터") ||
    text.includes("소프트웨어") ||
    text.includes("ai") ||
    text.includes("인공지능")
  )
    return "💻";
  if (text.includes("생명") || text.includes("과학") || text.includes("화학"))
    return "🔬";
  if (text.includes("문학") || text.includes("어문") || text.includes("언어"))
    return "📖";

  return "🎓";
}

function finalPerformanceSubject(subject: string, customSubject: string) {
  const cleanSubject = subject.trim();
  const cleanCustomSubject = customSubject.trim();

  if (cleanSubject === "직접입력") return cleanCustomSubject || "선택안함";
  if (!cleanSubject || cleanSubject === "선택안함") return "선택안함";
  return cleanSubject;
}

function performanceSubjectForEvent(subject?: string | null) {
  if (!subject || subject === "선택안함") return null;
  return subject;
}

function numberFromFormValue(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function rankPercentile(row: GradeTrendRecord) {
  const rank = Number(row.rank || 0);
  const total = Number(row.total_students || 0);
  if (rank <= 0 || total <= 0) return null;
  return roundOne((rank / total) * 100);
}

function weightedAverageGrade(rows: GradeTrendRecord[]) {
  const valid = rows
    .map((row) => ({
      value: Number(row.grade || 0),
      hours: Number(row.lesson_hours || 0),
    }))
    .filter((row) => row.value > 0 && row.hours > 0);

  if (valid.length === 0) return null;

  const totalHours = valid.reduce((sum, row) => sum + row.hours, 0);
  if (!totalHours) return null;

  return roundOne(
    valid.reduce((sum, row) => sum + row.value * row.hours, 0) / totalHours,
  );
}

function weightedAveragePercentile(rows: GradeTrendRecord[]) {
  const valid = rows
    .map((row) => ({
      value: Number(row.percentile || 0),
      hours: Number(row.lesson_hours || 0),
    }))
    .filter((row) => row.value > 0 && row.hours > 0);

  if (valid.length === 0) return null;

  const totalHours = valid.reduce((sum, row) => sum + row.hours, 0);
  if (!totalHours) return null;

  return roundOne(
    valid.reduce((sum, row) => sum + row.value * row.hours, 0) / totalHours,
  );
}

function weightedAverageRankPercentile(rows: GradeTrendRecord[]) {
  const valid = rows
    .map((row) => ({
      value: rankPercentile(row),
      hours: Number(row.lesson_hours || 0),
    }))
    .filter(
      (row) => row.value !== null && Number(row.value) > 0 && row.hours > 0,
    ) as {
    value: number;
    hours: number;
  }[];

  if (valid.length === 0) return null;

  const totalHours = valid.reduce((sum, row) => sum + row.hours, 0);
  if (!totalHours) return null;

  return roundOne(
    valid.reduce((sum, row) => sum + row.value * row.hours, 0) / totalHours,
  );
}

function weightedAverageRank(rows: GradeTrendRecord[]) {
  const valid = rows
    .map((row) => ({
      value: Number(row.rank || 0),
      hours: Number(row.lesson_hours || 0),
    }))
    .filter((row) => row.value > 0 && row.hours > 0);

  if (valid.length === 0) return null;

  const totalHours = valid.reduce((sum, row) => sum + row.hours, 0);
  if (!totalHours) return null;

  return roundOne(
    valid.reduce((sum, row) => sum + row.value * row.hours, 0) / totalHours,
  );
}

function semesterSortValue(label: string) {
  const match = label.match(/(\d{4}).*?([12])/);
  if (!match) return label;
  return `${match[1]}-${match[2]}`;
}

function gradeBarWidth(grade?: number | null) {
  const value = Number(grade || 0);
  if (!value) return 0;
  return Math.max(8, Math.min(100, ((10 - value) / 9) * 100));
}

function percentileBarWidth(percentile?: number | null) {
  const value = Number(percentile || 0);
  if (!value) return 0;
  return Math.max(8, Math.min(100, 100 - value));
}

function gradeTrendArea(row: GradeTrendRecord) {
  if (row.subject_area) return row.subject_area;
  if (["국어", "국어과"].includes(row.subject)) return "국어과";
  if (["영어", "영어과"].includes(row.subject)) return "영어과";
  if (["수학", "수학과"].includes(row.subject)) return "수학과";
  if (["사회", "한국사", "사회과"].includes(row.subject)) return "사회과";
  if (["과학", "과학과"].includes(row.subject)) return "과학과";
  return "기타과";
}

function gradeTrendSubjectLabel(row: GradeTrendRecord) {
  const area = gradeTrendArea(row);
  const name =
    row.subject_name ||
    (GRADE_SUBJECT_AREAS.includes(row.subject) ? "" : row.subject);
  return name ? `${area} · ${name}` : area;
}

function gradeTrendSubjectEmoji(row: GradeTrendRecord) {
  const area = gradeTrendArea(row);
  if (area === "국어과") return "📖";
  if (area === "영어과") return "🧸";
  if (area === "수학과") return "🧮";
  if (area === "사회과") return "🌏";
  if (area === "과학과") return "🔬";
  return "🌷";
}

function formatNullableNumber(value?: number | null, suffix = "") {
  const num = Number(value || 0);
  if (!num) return "-";
  return `${num}${suffix}`;
}

function AvatarBox({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] bg-transparent md:h-36 md:w-36">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${name} 아바타`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="relative h-full w-full">
          <div className="absolute bottom-3 left-3 h-8 w-14 rounded-xl border border-[#e5e5e5] bg-white" />
          <div className="absolute bottom-9 left-6 h-4 w-5 rotate-[-15deg] rounded-md border border-[#e5e5e5] bg-[#f7f7f7]" />
          <div className="absolute bottom-7 right-5 h-8 w-9 rounded-b-2xl rounded-t-md border border-[#e5e5e5] bg-[#ffffff]" />
          <div className="absolute bottom-8 right-3 h-5 w-3 rounded-r-lg border border-[#e5e5e5] bg-[#ffffff]" />
          <div className="absolute bottom-7 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-[#404040]" />
          <div className="absolute bottom-5 left-1/2 h-16 w-20 -translate-x-1/2 rounded-[45%] border border-[#d4d4d4] bg-[#f7f7f7]" />
          <div className="absolute bottom-[54px] left-[54px] h-1.5 w-1.5 rounded-full bg-[#171717]" />
          <div className="absolute bottom-[54px] right-[54px] h-1.5 w-1.5 rounded-full bg-[#171717]" />
          <div className="absolute bottom-[43px] left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-full bg-[#737373]" />
          <div className="absolute bottom-[40px] left-[43px] h-2.5 w-4 rounded-full bg-[#e5e5e5]" />
          <div className="absolute bottom-[40px] right-[43px] h-2.5 w-4 rounded-full bg-[#e5e5e5]" />
          <div className="absolute bottom-0 left-1/2 h-12 w-24 -translate-x-1/2 rounded-t-[2rem] border border-[#e5e5e5] bg-[#ffffff]" />
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
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("role, student_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "student") {
    redirect("/student");
  }

  if (profile.role !== "teacher") {
    redirect("/login");
  }

  const isTeacher = true;
  const isStudentSelf = false;
  const canEditStudentAllowedParts = true;
  const canEditTeacherOnly = true;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { year, month, prevMonthText, nextMonthText } = getMonthInfo(
    resolvedSearchParams?.month,
  );
  const monthStartText = makeDateText(year, month, 1);
  const monthEndText = makeDateText(
    year,
    month,
    new Date(year, month, 0).getDate(),
  );
  const lessonSettingsYear = year;
  const lessonSettingsMonth = month;
  const lessonSettingsPreviousMonth = addMonthsToYearMonth(
    lessonSettingsYear,
    lessonSettingsMonth,
    -1,
  );
  const lessonSettingsNextMonth = addMonthsToYearMonth(
    lessonSettingsYear,
    lessonSettingsMonth,
    1,
  );
  const lessonSettingsFetchStart = makeMonthBoundary(
    lessonSettingsPreviousMonth.year,
    lessonSettingsPreviousMonth.month,
  ).startDate;
  const lessonSettingsFetchEnd = makeMonthBoundary(
    lessonSettingsNextMonth.year,
    lessonSettingsNextMonth.month,
  ).endDate;
  const previousMonthDate = new Date(year, month - 2, 1);
  const previousMonthStartText = makeDateText(
    previousMonthDate.getFullYear(),
    previousMonthDate.getMonth() + 1,
    1,
  );
  const nextMonthDate = new Date(year, month, 1);
  const nextMonthEndText = makeDateText(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth() + 1,
    new Date(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth() + 2,
      0,
    ).getDate(),
  );
  const monthTextForUrl = `${year}-${String(month).padStart(2, "0")}`;
  const showStudyPlans = resolvedSearchParams?.showPlans === "1";
  const weeklyEditMode = resolvedSearchParams?.weeklyEdit === "1";
  const weeklyEditHref = `/students/${id}?month=${monthTextForUrl}${showStudyPlans ? "&showPlans=1" : ""}${weeklyEditMode ? "" : "&weeklyEdit=1"}#weekly-plan-section`;
  const planToggleHref = `/students/${id}?month=${monthTextForUrl}${showStudyPlans ? "" : "&showPlans=1"}#calendar-section`;

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

  const { data: gradeTrendRows } = await supabase
    .from("student_grade_records")
    .select("*")
    .eq("student_id", id)
    .order("semester_label", { ascending: true })
    .order("subject", { ascending: true });

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

  const { data: settlementRows } = await supabase
    .from("settlements")
    .select(
      "id, expected_lesson_count, previous_carryover_count, actual_lesson_count_override, feedback_date, feedback_done, start_date, end_date",
    )
    .eq("student_id", id)
    .lte("start_date", [nextMonthEndText, lessonSettingsFetchEnd].sort()[1])
    .gte("end_date", [previousMonthStartText, lessonSettingsFetchStart].sort()[0])
    .order("created_at", { ascending: false });

  const { data: studyPlanRows } = await supabase
    .from("student_study_plans")
    .select("*")
    .eq("student_id", id)
    .order("week_number", { ascending: true })
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !student) {
    return (
      <main className="min-h-screen bg-[#ffffff] px-6 py-10 text-[#171717]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[#e5e5e5] bg-white p-8">
          <h1 className="text-2xl font-black">학생을 찾을 수 없어요.</h1>
          <p className="mt-3 text-sm text-[#525252]">
            Supabase에서 해당 학생 정보를 불러오지 못했어요.
          </p>
          <Link
            href="/students"
            className="mt-6 inline-flex rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
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
  const gradeTrendRecords = (gradeTrendRows || []) as GradeTrendRecord[];
  const gradeTrendSemesters = Array.from(
    new Set(gradeTrendRecords.map((row) => row.semester_label).filter(Boolean)),
  ).sort((a, b) => semesterSortValue(a).localeCompare(semesterSortValue(b)));
  const gradeTrendRowsBySemester = gradeTrendSemesters.map((semester) => {
    const rows = gradeTrendRecords.filter(
      (row) => row.semester_label === semester,
    );
    const coreRows = rows.filter((row) =>
      CORE_GRADE_SUBJECT_AREAS.includes(gradeTrendArea(row)),
    );
    return {
      semester,
      rows,
      coreAverage: weightedAverageGrade(coreRows),
      allAverage: weightedAverageGrade(rows),
      corePercentileAverage: weightedAveragePercentile(coreRows),
      allPercentileAverage: weightedAveragePercentile(rows),
      coreRankPercentileAverage: weightedAverageRankPercentile(coreRows),
      allRankPercentileAverage: weightedAverageRankPercentile(rows),
      coreRankAverage: weightedAverageRank(coreRows),
      allRankAverage: weightedAverageRank(rows),
    };
  });
  const lessonTimes = (lessonTimeRows || []) as LessonTime[];
  const performanceTasks = (performanceRows || []) as PerformanceTask[];
  const visiblePerformanceTasks = performanceTasks.filter(
    (task) => task.status !== "done",
  );
  const events = (eventRows || []) as StudentEvent[];
  const studyPlans = (studyPlanRows || []) as StudyPlan[];
  const examRows = (examProgressRows || []) as ExamProgress[];
  const examInfoById = new Map(
    examRows.map((row) => [
      row.id,
      {
        publisher: row.publisher || null,
        materialName: row.material_name || null,
        majorUnit: row.major_unit || null,
        unitName: row.unit_name || null,
      },
    ]),
  );

  const remainingMakeupCount = makeupLessons.filter(
    (lesson) => !lesson.is_done,
  ).length;
  const currentExp = student.exp_points || 0;
  const currentLevel = levelFromExp(student.exp_points, student.level);
  const currentExpPercent = expPercent(student.exp_points);
  const settlementsForMonth = (settlementRows || []) as SettlementRow[];
  const currentSettlement = pickCurrentSettlement(
    settlementsForMonth,
    monthStartText,
    monthEndText,
  );
  const settlementStartDate = currentSettlement?.start_date || monthStartText;
  const settlementEndDate = currentSettlement?.end_date || monthEndText;
  const nextSettlementFallbackRange = makeMonthRangeFromStartDate(
    addDaysToDateText(settlementEndDate, 1),
  );
  const nextMonthSettlement = settlementsForMonth.find(
    (settlement) =>
      settlement.start_date === nextSettlementFallbackRange.startDate &&
      settlement.end_date === nextSettlementFallbackRange.endDate,
  );
  const usedLessonMonthSettlementIds = new Set<string>();
  const lessonMonthSettings = [-1, 0, 1].map((offset) => {
    const target = addMonthsToYearMonth(
      lessonSettingsYear,
      lessonSettingsMonth,
      offset,
    );
    const boundary = makeMonthBoundary(target.year, target.month);
    const settlement = pickSettlementForLessonMonth(
      settlementsForMonth,
      boundary,
      usedLessonMonthSettlementIds,
    );
    if (settlement?.id) {
      usedLessonMonthSettlementIds.add(settlement.id);
    }

    const fallbackRange = makeMonthRangeFromStartDate(boundary.startDate);

    return {
      key: `${target.year}-${String(target.month).padStart(2, "0")}`,
      year: target.year,
      month: target.month,
      label: formatLessonMonthLabel(target.month),
      startDate: settlement?.start_date || fallbackRange.startDate,
      endDate: settlement?.end_date || fallbackRange.endDate,
      expected: Number(settlement?.expected_lesson_count || 0),
      actual: Number(settlement?.actual_lesson_count_override || 0),
      makeupCount: Number(settlement?.previous_carryover_count || 0),
      feedbackDate: settlement?.feedback_date || "",
      settlementId: settlement?.id || "",
    };
  });
  const expectedLessonCount = Number(
    currentSettlement?.expected_lesson_count || 0,
  );
  const makeupCarryoverCount = Number(
    currentSettlement?.previous_carryover_count || 0,
  );
  const weeklyPlanData = parseWeeklyPlan(student.weekly_plan);
  const weeklyBlocks = weeklyPlanData.blocks.sort((a, b) => {
    const dayDiff =
      WEEKLY_PLAN_DAYS.indexOf(a.day) - WEEKLY_PLAN_DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });

  const examHomeworkTasks: HomeworkTask[] = examRows.flatMap((row) => {
    const statuses = parseStatuses(row.statuses);

    return getVisibleStatusEntries(statuses)
      .filter(([, status]) => status === "homework")
      .map(([taskName]) => ({
        id: `${row.id}:::${taskName}`,
        progressId: row.id,
        subject: row.subject,
        unitName: row.unit_name,
        taskName,
        publisher: row.publisher,
        materialName: row.material_name,
        majorUnit: row.major_unit,
        source: "exam" as const,
      }));
  });

  const homeworkTaskMap = new Map<string, HomeworkTask>();
  examHomeworkTasks.forEach((task) => {
    const key = `${task.subject}::${task.unitName}::${task.taskName}`;
    if (!homeworkTaskMap.has(key)) homeworkTaskMap.set(key, task);
  });
  const homeworkTasks = Array.from(homeworkTaskMap.values());

  const currentTaskStatusMap = new Map<string, string>();
  examRows.forEach((row) => {
    const statuses = parseStatuses(row.statuses);
    getVisibleStatusEntries(statuses).forEach(([taskName, status]) => {
      currentTaskStatusMap.set(`${row.id}::${taskName}`, String(status));
    });
  });

  lessonRecords.forEach((record) => {
    const subjectRecords = Array.isArray(record.subject_records)
      ? record.subject_records
      : [];
    subjectRecords.forEach((subjectRecord) => {
      const items = Array.isArray(subjectRecord.homework_items)
        ? subjectRecord.homework_items
        : [];
      items.forEach((item) => {
        if (!item.progress_id || !item.task_name) return;
        if (item.checked_status)
          currentTaskStatusMap.set(
            `${item.progress_id}::${item.task_name}`,
            String(item.checked_status),
          );
        if (item.deferred)
          currentTaskStatusMap.set(
            `${item.progress_id}::${item.task_name}`,
            "deferred",
          );
      });
    });
  });

  const incompleteExamItems = examRows.flatMap((row) => {
    const statuses = parseStatuses(row.statuses);

    return getVisibleStatusEntries(statuses)
      .filter(([, status]) =>
        STUDY_PLAN_SELECTABLE_STATUSES.includes(String(status)),
      )
      .map(([taskName, status]) => ({
        value: makeStudyPlanTaskValue(
          row.id,
          row.subject,
          row.unit_name,
          taskName,
        ),
        label: `${row.subject} · ${row.unit_name} · ${taskName}`,
        subject: row.subject,
        unitName: row.unit_name,
        taskName,
        status: String(status),
      }));
  });

  const studyPlanPickerRowsBySubject = examRows.reduce<
    Record<string, ExamProgress[]>
  >((acc, row) => {
    const key = row.subject || "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const studyPlanTaskNamesBySubject = Object.fromEntries(
    Object.entries(studyPlanPickerRowsBySubject).map(([subject, rows]) => [
      subject,
      collectTaskNamesInExamScopeOrder(rows),
    ]),
  ) as Record<string, string[]>;

  const calendarDays = makeCalendarDays(year, month);
  const calendarRows = chunkCalendarRows(calendarDays);
  const visibleCalendarDateTexts = calendarDays.map((cell) => cell.dateText);

  const autoLessonEvents = makeAutoLessonEventsForDates(
    lessonTimes,
    visibleCalendarDateTexts,
    lessonRecords,
    id,
  );

  const makeupEvents = makeMakeupEvents(makeupLessons, lessonRecords, id);

  const lessonRecordEvents = makeLessonRecordEvents(
    lessonRecords,
    autoLessonEvents,
    makeupLessons,
    visibleCalendarDateTexts,
    id,
  );

  const fixedLessonChangeKeys = new Set(
    events
      .filter(
        (event) =>
          (event.source_type === "fixed_lesson_override" ||
            event.source_type === "fixed_lesson_cancelled") &&
          (event.original_lesson_time_id || event.source_id) &&
          (event.original_event_date || event.event_date),
      )
      .map((event) => {
        const lessonTimeId = event.original_lesson_time_id || event.source_id;
        const originalDate = event.original_event_date || event.event_date;
        return `${lessonTimeId}::${originalDate}`;
      }),
  );

  const makeupMovedFixedLessonKeys = new Set(
    makeupLessons.flatMap((lesson) => {
      if (!lesson.absent_date) return [];

      const [absentYear, absentMonth, absentDay] = lesson.absent_date
        .split("-")
        .map(Number);

      if (!absentYear || !absentMonth || !absentDay) return [];

      const dayLabel =
        WEEKDAYS_BY_DATE[
          new Date(absentYear, absentMonth - 1, absentDay).getDay()
        ];

      return lessonTimes
        .filter((lessonTime) => lessonTime.day_of_week === dayLabel)
        .map((lessonTime) => `${lessonTime.id}::${lesson.absent_date}`);
    }),
  );

  const makeupAbsentDates = new Set(
    makeupLessons
      .filter((lesson) => lesson.absent_date)
      .map((lesson) => lesson.absent_date),
  );

  const visibleAutoLessonEvents = autoLessonEvents.filter((event) => {
    if (event.source_type !== "fixed_lesson_time") return true;
    if (!event.source_id) return true;
    if (makeupAbsentDates.has(event.event_date)) return false;
    const fixedKey = `${event.source_id}::${event.event_date}`;
    return (
      !fixedLessonChangeKeys.has(fixedKey) &&
      !makeupMovedFixedLessonKeys.has(fixedKey)
    );
  });

  const lessonRoundStartDate =
    lessonMonthSettings
      .map((item) => item.startDate)
      .sort((a, b) => a.localeCompare(b))[0] || settlementStartDate;
  const lessonRoundEndDate =
    lessonMonthSettings
      .map((item) => item.endDate)
      .sort((a, b) => b.localeCompare(a))[0] || settlementEndDate;
  const lessonRoundDateTexts = makeDateRange(
    lessonRoundStartDate,
    lessonRoundEndDate,
  );
  const lessonRoundAutoLessonEvents = makeAutoLessonEventsForDates(
    lessonTimes,
    lessonRoundDateTexts,
    lessonRecords,
    id,
  ).filter((event) => {
    if (event.source_type !== "fixed_lesson_time") return true;
    if (!event.source_id) return true;
    if (makeupAbsentDates.has(event.event_date)) return false;
    const fixedKey = `${event.source_id}::${event.event_date}`;
    return (
      !fixedLessonChangeKeys.has(fixedKey) &&
      !makeupMovedFixedLessonKeys.has(fixedKey)
    );
  });
  const lessonRoundRecordEvents = makeLessonRecordEvents(
    lessonRecords,
    lessonRoundAutoLessonEvents,
    makeupLessons,
    lessonRoundDateTexts,
    id,
  );

  const dbEvents: CalendarEvent[] = events
    .filter((event) => event.source_type !== "fixed_lesson_cancelled")
    .map((event) => {
      const eventType = event.event_type || "기타";
      const matchedRecord =
        eventType === "수업" ||
        eventType === "추가수업" ||
        eventType === "보강수업" ||
        eventType === "직전보강"
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
        original_event_date: event.original_event_date,
        original_lesson_time_id: event.original_lesson_time_id,
        link_url: matchedRecord
          ? `/students/${id}/records/${matchedRecord.id}/edit`
          : null,
        deletable: event.source_type !== "performance_task",
      };
    });

  const studyPlanDateEvents: CalendarEvent[] = showStudyPlans
    ? studyPlans
        .filter((plan) => plan.plan_type === "date" && plan.due_date)
        .map((plan) => ({
          id: `study-plan-${plan.id}`,
          event_date: plan.due_date as string,
          event_time: null,
          subject: plan.subject,
          title: studyPlanCalendarTitle(plan),
          event_type: "공부계획",
          memo: plan.memo,
          is_auto: false,
          source_type: "study_plan",
          source_id: plan.id,
          link_url: null,
          deletable: true,
        }))
    : [];

  const weeklyStudyPlansByWeek = studyPlans
    .filter((plan) => plan.plan_type === "week" && plan.week_number)
    .reduce<Record<number, StudyPlan[]>>((acc, plan) => {
      const key = Number(plan.week_number || 0);
      if (!acc[key]) acc[key] = [];
      acc[key].push(plan);
      return acc;
    }, {});

  const feedbackSettlementsByMonth = new Map<string, SettlementRow>();
  settlementsForMonth
    .filter((settlement) => settlement.feedback_date)
    .filter((settlement) =>
      visibleCalendarDateTexts.includes(settlement.feedback_date as string),
    )
    .forEach((settlement) => {
      const key = String(settlement.feedback_date).slice(0, 7);
      if (!feedbackSettlementsByMonth.has(key)) {
        feedbackSettlementsByMonth.set(key, settlement);
      }
    });

  const feedbackEvents: CalendarEvent[] = Array.from(
    feedbackSettlementsByMonth.values(),
  ).map((settlement) => ({
      id: `feedback-${settlement.id || settlement.start_date}`,
      event_date: settlement.feedback_date as string,
      event_time: null,
      subject: null,
      title: `${Number(String(settlement.start_date).slice(5, 7))}월 피드백일 - ${formatDueDate(settlement.feedback_date)}`,
      event_type: "피드백",
      memo: `${settlement.start_date} ~ ${settlement.end_date}`,
      is_auto: true,
      source_type: "settlement_feedback",
      source_id: settlement.id || null,
      link_url: null,
      deletable: false,
    }));

  const combinedEvents = [
    ...visibleAutoLessonEvents,
    ...lessonRecordEvents,
    ...makeupEvents,
    ...dbEvents,
    ...studyPlanDateEvents,
    ...feedbackEvents,
  ].sort((a, b) => {
    const dateCompare = String(a.event_date).localeCompare(
      String(b.event_date),
    );
    if (dateCompare !== 0) return dateCompare;
    return String(a.event_time || "").localeCompare(String(b.event_time || ""));
  });

  const upcomingExamEvent = combinedEvents
    .filter(
      (event) =>
        event.event_type === "중간고사" || event.event_type === "기말고사",
    )
    .filter((event) => {
      const diff = daysUntilDue(event.event_date);
      return diff !== null && diff >= 0;
    })
    .sort((a, b) =>
      String(a.event_date).localeCompare(String(b.event_date)),
    )[0];

  const eventsByDate = getEventsByDate(combinedEvents);
  const todayText = getTodayText();
  const lessonRoundSourceEvents = [
    ...lessonRoundAutoLessonEvents,
    ...lessonRoundRecordEvents,
    ...makeupEvents,
    ...dbEvents,
  ].filter(
    (event) =>
      isLessonCalendarEvent(event) &&
      event.event_date >= lessonRoundStartDate &&
      event.event_date <= lessonRoundEndDate,
  );
  const lessonRoundByEventId = makeLessonRoundMap(
    lessonRoundSourceEvents,
    lessonMonthSettings,
    settlementStartDate,
  );
  const calendarActualLessonCount = combinedEvents.filter(
    (event) =>
      isLessonCalendarEvent(event) &&
      event.event_date >= settlementStartDate &&
      event.event_date <= settlementEndDate &&
      event.event_date <= todayText,
  ).length;
  const actualLessonCount =
    currentSettlement?.actual_lesson_count_override !== null &&
    currentSettlement?.actual_lesson_count_override !== undefined
      ? Number(currentSettlement.actual_lesson_count_override || 0)
      : 0;
  const remainingLessonCount = Math.max(
    expectedLessonCount - actualLessonCount,
    0,
  );
  const lessonProgressPercent = expectedLessonCount
    ? Math.min(Math.round((actualLessonCount / expectedLessonCount) * 100), 100)
    : 0;
  async function assertCanEditStudentAllowedParts() {
    "use server";

    const authSupabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      throw new Error("로그인이 필요해.");
    }

    const { data: viewer } = await authSupabase
      .from("app_users")
      .select("role, student_id")
      .eq("id", user.id)
      .single();

    if (!viewer) {
      throw new Error("권한 정보를 찾을 수 없어.");
    }

    const allowed =
      viewer.role === "teacher" ||
      (viewer.role === "student" && viewer.student_id === id);

    if (!allowed) {
      throw new Error("수정 권한이 없어.");
    }

    return authSupabase;
  }

  async function assertTeacherOnly() {
    "use server";

    const authSupabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await authSupabase.auth.getUser();

    if (!user) {
      throw new Error("로그인이 필요해.");
    }

    const { data: viewer } = await authSupabase
      .from("app_users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (viewer?.role !== "teacher") {
      throw new Error("선생님만 수정할 수 있어.");
    }

    return authSupabase;
  }

  async function updateStudentInfo(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const name = String(formData.get("name") || "").trim();
    const age = String(formData.get("age") || "").trim();
    const school = String(formData.get("school") || "").trim();
    const career = String(formData.get("career") || "").trim();
    const targetUniversity = String(
      formData.get("target_university") || "",
    ).trim();
    const targetMajor = String(formData.get("target_major") || "").trim();
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
        career: career || null,
        target_university: targetUniversity || null,
        target_major: targetMajor || null,
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
    const supabase = await assertTeacherOnly();

    const dayOfWeek = String(formData.get("day_of_week") || "").trim();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!dayOfWeek || !startTime || !endTime) {
      throw new Error("요일, 시작시간, 종료시간은 꼭 입력해야 해.");
    }

    const { error: insertError } = await supabase
      .from("student_lesson_times")
      .insert({
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
    const supabase = await assertTeacherOnly();

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
    const supabase = await assertTeacherOnly();

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
    const supabase = await assertCanEditStudentAllowedParts();

    const subject = String(formData.get("subject") || "").trim();
    const previousScore = String(formData.get("previous_score") || "").trim();
    const targetScore = String(formData.get("target_score") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!subject) return;

    const { error: insertError } = await supabase
      .from("student_score_records")
      .insert({
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
    const supabase = await assertCanEditStudentAllowedParts();

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

  async function hideOriginalFixedLessonForMakeup(absentDate: string) {
    "use server";

    const supabase = await assertTeacherOnly();

    const [absentYear, absentMonth, absentDay] = absentDate
      .split("-")
      .map(Number);

    if (!absentYear || !absentMonth || !absentDay) return;

    const dayLabel =
      WEEKDAYS_BY_DATE[
        new Date(absentYear, absentMonth - 1, absentDay).getDay()
      ];

    const { data: matchingLessonTimes, error: lessonTimeError } = await supabase
      .from("student_lesson_times")
      .select("id, start_time")
      .eq("student_id", id)
      .eq("day_of_week", dayLabel);

    if (lessonTimeError) {
      throw new Error(lessonTimeError.message);
    }

    for (const lessonTime of matchingLessonTimes || []) {
      await supabase
        .from("student_events")
        .delete()
        .eq("student_id", id)
        .in("source_type", ["fixed_lesson_override", "fixed_lesson_cancelled"])
        .eq("original_lesson_time_id", lessonTime.id)
        .eq("original_event_date", absentDate);

      const { error: insertCancelError } = await supabase
        .from("student_events")
        .insert({
          student_id: id,
          event_date: absentDate,
          event_time: normalizeTime(lessonTime.start_time) || null,
          subject: "수업",
          title: "수업 취소",
          event_type: "수업",
          memo: "보강수업으로 이동",
          is_auto: false,
          source_type: "fixed_lesson_cancelled",
          source_id: lessonTime.id,
          original_lesson_time_id: lessonTime.id,
          original_event_date: absentDate,
        });

      if (insertCancelError) {
        throw new Error(insertCancelError.message);
      }
    }
  }

  async function addMakeupLesson(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const absentDate = String(formData.get("absent_date") || "").trim();
    const makeupDate = String(formData.get("makeup_date") || "").trim();
    const makeupTime = String(formData.get("makeup_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!absentDate) return;

    const { error: insertError } = await supabase
      .from("makeup_lessons")
      .insert({
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

    await hideOriginalFixedLessonForMakeup(absentDate);

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
  }

  async function updateMakeupLesson(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const makeupId = String(formData.get("makeup_id") || "").trim();
    const absentDate = String(formData.get("absent_date") || "").trim();
    const makeupDate = String(formData.get("makeup_date") || "").trim();
    const makeupTime = String(formData.get("makeup_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!makeupId || !absentDate) {
      throw new Error("보강 수정값이 부족해.");
    }

    const { error: updateError } = await supabase
      .from("makeup_lessons")
      .update({
        absent_date: absentDate,
        makeup_date: makeupDate || null,
        makeup_time: makeupTime || null,
        memo: memo || null,
      })
      .eq("id", makeupId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    await hideOriginalFixedLessonForMakeup(absentDate);

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
  }

  async function toggleMakeupDone(formData: FormData) {
    "use server";

    const supabase = await assertTeacherOnly();

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
    const supabase = await assertTeacherOnly();

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
    const supabase = await assertCanEditStudentAllowedParts();

    const subject = String(formData.get("subject") || "").trim();
    const customSubject = String(formData.get("custom_subject") || "").trim();
    const finalSubject = finalPerformanceSubject(subject, customSubject);
    const title = String(formData.get("title") || "").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const dueTime = String(formData.get("due_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();
    const photoUrl = String(formData.get("photo_url") || "").trim();

    if (!title) {
      throw new Error("수행평가 이름은 꼭 필요해.");
    }

    const { data: performance, error: insertPerformanceError } = await supabase
      .from("student_performance_tasks")
      .insert({
        student_id: id,
        subject: finalSubject,
        title,
        due_date: dueDate || null,
        due_time: dueTime || null,
        status: "not_started",
        memo: memo || null,
        photo_url: photoUrl || null,
      })
      .select("id")
      .single();

    if (insertPerformanceError) {
      throw new Error(insertPerformanceError.message);
    }

    if (performance && dueDate) {
      const { error: insertEventError } = await supabase
        .from("student_events")
        .insert({
          student_id: id,
          event_date: dueDate,
          event_time: dueTime || null,
          subject: performanceSubjectForEvent(finalSubject),
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
    const supabase = await assertCanEditStudentAllowedParts();

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
    redirect(`/students/${id}#performance-section`);
  }

  async function updatePerformanceStatusFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

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
    redirect(`/students/${id}#calendar-section`);
  }

  async function updatePerformanceTask(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const taskId = String(formData.get("task_id") || "");
    const subject = String(formData.get("subject") || "").trim();
    const customSubject = String(formData.get("custom_subject") || "").trim();
    const finalSubject = finalPerformanceSubject(subject, customSubject);
    const title = String(formData.get("title") || "").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const dueTime = String(formData.get("due_time") || "").trim();
    const status = String(formData.get("status") || "not_started").trim();
    const memo = String(formData.get("memo") || "").trim();
    const photoUrl = String(formData.get("photo_url") || "").trim();

    if (!taskId || !title) {
      throw new Error("수행평가 수정값이 부족해.");
    }

    const { error: updateError } = await supabase
      .from("student_performance_tasks")
      .update({
        subject: finalSubject,
        title,
        due_date: dueDate || null,
        due_time: dueTime || null,
        status: status || "not_started",
        memo: memo || null,
        photo_url: photoUrl || null,
      })
      .eq("id", taskId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: eventUpdateError } = await supabase
      .from("student_events")
      .update({
        event_date: dueDate || null,
        event_time: dueTime || null,
        subject: performanceSubjectForEvent(finalSubject),
        title,
        memo: memo || null,
      })
      .eq("student_id", id)
      .eq("source_type", "performance_task")
      .eq("source_id", taskId);

    if (eventUpdateError) {
      throw new Error(eventUpdateError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(`/students/${id}#performance-section`);
  }

  async function deletePerformanceTask(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

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
    const supabase = await assertTeacherOnly();

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
    revalidatePath("/");
  }

  async function updateCalendarEvent(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const eventId = String(formData.get("event_id") || "").trim();
    const eventDate = String(formData.get("event_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const eventType = String(formData.get("event_type") || "기타").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    const finalTitle =
      title ||
      (eventType === "추가수업"
        ? "추가수업"
        : eventType === "수업"
          ? "수업"
          : eventType === "보강수업"
            ? "보강수업"
            : eventType === "직전보강"
              ? "직전보강"
              : eventType || "일정");

    if (!eventId || !eventDate || !finalTitle) {
      throw new Error("일정 날짜와 이름은 꼭 필요해.");
    }

    const { error: updateError } = await supabase
      .from("student_events")
      .update({
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || "기타",
        subject: subject || null,
        title: finalTitle,
        memo: memo || null,
      })
      .eq("id", eventId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function moveFixedLessonOccurrence(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const lessonTimeId = String(formData.get("lesson_time_id") || "").trim();
    const originalDate = String(
      formData.get("original_event_date") || "",
    ).trim();
    const newDate = String(formData.get("new_event_date") || "").trim();
    const newTime = String(formData.get("new_event_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!lessonTimeId || !originalDate || !newDate) {
      throw new Error("옮길 수업의 날짜 정보가 부족해.");
    }

    await supabase
      .from("student_events")
      .delete()
      .eq("student_id", id)
      .eq("source_type", "fixed_lesson_cancelled")
      .eq("original_lesson_time_id", lessonTimeId)
      .eq("original_event_date", originalDate);

    const { data: existingOverride, error: fetchError } = await supabase
      .from("student_events")
      .select("id")
      .eq("student_id", id)
      .eq("source_type", "fixed_lesson_override")
      .eq("original_lesson_time_id", lessonTimeId)
      .eq("original_event_date", originalDate)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (existingOverride?.id) {
      const { error: updateError } = await supabase
        .from("student_events")
        .update({
          event_date: newDate,
          event_time: newTime || null,
          subject: "수업",
          title: "수업",
          event_type: "수업",
          memo: memo || null,
          is_auto: false,
        })
        .eq("id", existingOverride.id)
        .eq("student_id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from("student_events")
        .insert({
          student_id: id,
          event_date: newDate,
          event_time: newTime || null,
          subject: "수업",
          title: "수업",
          event_type: "수업",
          memo: memo || null,
          is_auto: false,
          source_type: "fixed_lesson_override",
          source_id: lessonTimeId,
          original_lesson_time_id: lessonTimeId,
          original_event_date: originalDate,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function updateFixedLessonOverride(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const eventId = String(formData.get("event_id") || "").trim();
    const newDate = String(formData.get("new_event_date") || "").trim();
    const newTime = String(formData.get("new_event_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!eventId || !newDate) {
      throw new Error("수업 수정값이 부족해.");
    }

    const { error: updateError } = await supabase
      .from("student_events")
      .update({
        event_date: newDate,
        event_time: newTime || null,
        memo: memo || null,
        subject: "수업",
        title: "수업",
        event_type: "수업",
      })
      .eq("id", eventId)
      .eq("student_id", id)
      .eq("source_type", "fixed_lesson_override");

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function cancelFixedLessonOccurrence(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const lessonTimeId = String(formData.get("lesson_time_id") || "").trim();
    const originalDate = String(
      formData.get("original_event_date") || "",
    ).trim();
    const originalTime = String(
      formData.get("original_event_time") || "",
    ).trim();

    if (!lessonTimeId || !originalDate) {
      throw new Error("삭제할 수업의 날짜 정보가 부족해.");
    }

    await supabase
      .from("student_events")
      .delete()
      .eq("student_id", id)
      .eq("source_type", "fixed_lesson_override")
      .eq("original_lesson_time_id", lessonTimeId)
      .eq("original_event_date", originalDate);

    const { error: insertError } = await supabase
      .from("student_events")
      .insert({
        student_id: id,
        event_date: originalDate,
        event_time: originalTime || null,
        subject: "수업",
        title: "수업 취소",
        event_type: "수업",
        memo: null,
        is_auto: false,
        source_type: "fixed_lesson_cancelled",
        source_id: lessonTimeId,
        original_lesson_time_id: lessonTimeId,
        original_event_date: originalDate,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function cancelMovedFixedLessonOccurrence(formData: FormData) {
    "use server";

    const supabase = await assertTeacherOnly();

    const eventId = String(formData.get("event_id") || "").trim();
    const lessonTimeId = String(formData.get("lesson_time_id") || "").trim();
    const originalDate = String(
      formData.get("original_event_date") || "",
    ).trim();
    const originalTime = String(
      formData.get("original_event_time") || "",
    ).trim();

    if (!eventId || !lessonTimeId || !originalDate) {
      throw new Error("삭제할 수업의 원래 날짜 정보가 부족해.");
    }

    const { error: deleteError } = await supabase
      .from("student_events")
      .delete()
      .eq("id", eventId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { error: insertError } = await supabase
      .from("student_events")
      .insert({
        student_id: id,
        event_date: originalDate,
        event_time: originalTime || null,
        subject: "수업",
        title: "수업 취소",
        event_type: "수업",
        memo: null,
        is_auto: false,
        source_type: "fixed_lesson_cancelled",
        source_id: lessonTimeId,
        original_lesson_time_id: lessonTimeId,
        original_event_date: originalDate,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function updateMakeupLessonFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const makeupId = String(formData.get("makeup_id") || "").trim();
    const makeupDate = String(formData.get("makeup_date") || "").trim();
    const makeupTime = String(formData.get("makeup_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!makeupId || !makeupDate) {
      throw new Error("보강 날짜는 꼭 필요해.");
    }

    const { error: updateError } = await supabase
      .from("makeup_lessons")
      .update({
        makeup_date: makeupDate,
        makeup_time: makeupTime || null,
        memo: memo || null,
      })
      .eq("id", makeupId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function updateLessonRecordFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const recordId = String(formData.get("record_id") || "").trim();
    const lessonDate = String(formData.get("lesson_date") || "").trim();
    const startTime = String(formData.get("start_time") || "").trim();

    if (!recordId || !lessonDate) {
      throw new Error("수업기록 날짜 정보가 부족해.");
    }

    const { error: updateError } = await supabase
      .from("lesson_records")
      .update({
        lesson_date: lessonDate,
        start_time: startTime || null,
      })
      .eq("id", recordId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/");
    redirect(`/students/${id}#calendar-section`);
  }

  async function updateExamProgressStatusFromDetail(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const progressId = String(formData.get("progress_id") || "").trim();
    const taskName = String(formData.get("task_name") || "").trim();
    const status = String(formData.get("status") || "").trim();

    if (!progressId || !taskName || !status) return;

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
    const beforeStatus = statuses[taskName];
    statuses[taskName] = status;

    const { error } = await supabase
      .from("exam_progress")
      .update({ statuses })
      .eq("id", progressId)
      .eq("student_id", id);

    if (error) {
      throw new Error(error.message);
    }

    const expDelta =
      beforeStatus !== "done" && status === "done"
        ? 10
        : beforeStatus === "done" && status !== "done"
          ? -10
          : 0;

    if (expDelta !== 0) {
      const { data: studentRow, error: studentFetchError } = await supabase
        .from("students")
        .select("exp_points")
        .eq("id", id)
        .single();

      if (studentFetchError) {
        throw new Error(studentFetchError.message);
      }

      const nextExp = Math.max(
        Number(studentRow?.exp_points || 0) + expDelta,
        0,
      );

      const { error: expUpdateError } = await supabase
        .from("students")
        .update({ exp_points: nextExp })
        .eq("id", id);

      if (expUpdateError) {
        throw new Error(expUpdateError.message);
      }
    }

    revalidatePath(`/students/${id}`);
    revalidatePath(`/students/${id}/exam-scope`);
    redirect(`/students/${id}#inline-exam-scope-section`);
  }

  async function completeHomeworkTask(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const recordId = String(formData.get("record_id") || "");
    const progressId = String(formData.get("progress_id") || "");
    const taskName = String(formData.get("task_name") || "");

    if (!progressId || !taskName) return;

    const isManualTask =
      progressId.startsWith("manual-") ||
      progressId.startsWith("previous-manual-");

    if (isManualTask && recordId) {
      const { data: recordRow, error: fetchError } = await supabase
        .from("lesson_records")
        .select("subject_records, checked_homework_items")
        .eq("id", recordId)
        .eq("student_id", id)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const subjectRecordsForUpdate = Array.isArray(recordRow?.subject_records)
        ? recordRow.subject_records
        : [];
      const updatedSubjectRecords = subjectRecordsForUpdate.map(
        (subjectRecord: SubjectRecord) => ({
          ...subjectRecord,
          homework_items: Array.isArray(subjectRecord.homework_items)
            ? subjectRecord.homework_items.map((item) => {
                const sameTask =
                  String(item.progress_id || "") === progressId &&
                  String(item.task_name || "") === taskName;
                return sameTask
                  ? { ...item, deferred: false, checked_status: "done" }
                  : item;
              })
            : subjectRecord.homework_items,
        }),
      );

      const checkedItems = Array.isArray(recordRow?.checked_homework_items)
        ? recordRow.checked_homework_items
        : [];
      const alreadyChecked = checkedItems.some(
        (item: SavedTask) =>
          String(item.progress_id || "") === progressId &&
          String(item.task_name || "") === taskName,
      );
      const manualCheckedItem: SavedTask = {
        progress_id: progressId,
        subject: "기타",
        unit_name: "기타",
        task_name: taskName,
        before_status: "manual",
        checked_status: "done",
        deferred: false,
      };
      const updatedCheckedItems = alreadyChecked
        ? checkedItems.map((item: SavedTask) =>
            String(item.progress_id || "") === progressId &&
            String(item.task_name || "") === taskName
              ? { ...item, checked_status: "done", deferred: false }
              : item,
          )
        : [...checkedItems, manualCheckedItem];

      const { error: updateError } = await supabase
        .from("lesson_records")
        .update({
          subject_records: updatedSubjectRecords,
          checked_homework_items: updatedCheckedItems,
        })
        .eq("id", recordId)
        .eq("student_id", id);

      if (updateError) throw new Error(updateError.message);

      revalidatePath(`/students/${id}`);
      return;
    }

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
    const beforeStatus = statuses[taskName];
    statuses[taskName] = "done";

    const { error: updateError } = await supabase
      .from("exam_progress")
      .update({ statuses })
      .eq("id", progressId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (beforeStatus !== "done") {
      const { data: studentRow, error: studentFetchError } = await supabase
        .from("students")
        .select("exp_points")
        .eq("id", id)
        .single();

      if (studentFetchError) {
        throw new Error(studentFetchError.message);
      }

      const { error: expUpdateError } = await supabase
        .from("students")
        .update({ exp_points: Number(studentRow?.exp_points || 0) + 10 })
        .eq("id", id);

      if (expUpdateError) {
        throw new Error(expUpdateError.message);
      }
    }

    revalidatePath(`/students/${id}`);
  }

  async function deferHomeworkTask(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const recordId = String(formData.get("record_id") || "");
    const progressId = String(formData.get("progress_id") || "");
    const taskName = String(formData.get("task_name") || "");

    if (!recordId || !progressId || !taskName) return;

    const { data: recordRow, error: fetchError } = await supabase
      .from("lesson_records")
      .select("subject_records, checked_homework_items")
      .eq("id", recordId)
      .eq("student_id", id)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const subjectRecordsForUpdate = Array.isArray(recordRow?.subject_records)
      ? recordRow.subject_records
      : [];

    const updatedSubjectRecords = subjectRecordsForUpdate.map(
      (subjectRecord: SubjectRecord) => ({
        ...subjectRecord,
        homework_items: Array.isArray(subjectRecord.homework_items)
          ? subjectRecord.homework_items.map((item) => {
              const sameTask =
                String(item.progress_id || "") === progressId &&
                String(item.task_name || "") === taskName;
              return sameTask
                ? { ...item, deferred: true, checked_status: "deferred" }
                : item;
            })
          : subjectRecord.homework_items,
      }),
    );

    const checkedItems = Array.isArray(recordRow?.checked_homework_items)
      ? recordRow.checked_homework_items
      : [];

    const alreadyChecked = checkedItems.some(
      (item: SavedTask) =>
        String(item.progress_id || "") === progressId &&
        String(item.task_name || "") === taskName,
    );

    const updatedCheckedItems = alreadyChecked
      ? checkedItems.map((item: SavedTask) =>
          String(item.progress_id || "") === progressId &&
          String(item.task_name || "") === taskName
            ? { ...item, deferred: true, checked_status: "deferred" }
            : item,
        )
      : checkedItems;

    const { error: updateError } = await supabase
      .from("lesson_records")
      .update({
        subject_records: updatedSubjectRecords,
        checked_homework_items: updatedCheckedItems,
      })
      .eq("id", recordId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function resetHomeworkTasks(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const subject = String(formData.get("subject") || "").trim();

    const { data: examItems, error: examFetchError } = await supabase
      .from("exam_progress")
      .select("id, subject, statuses")
      .eq("student_id", id);

    if (examFetchError) {
      throw new Error(examFetchError.message);
    }

    for (const item of examItems || []) {
      if (subject && item.subject !== subject) continue;

      const statuses = parseStatuses(item.statuses);
      let changed = false;

      getVisibleStatusEntries(statuses).forEach(([taskName, status]) => {
        if (status === "homework") {
          statuses[taskName] = "not_started";
          changed = true;
        }
      });

      if (changed) {
        const { error: updateError } = await supabase
          .from("exam_progress")
          .update({ statuses })
          .eq("id", item.id)
          .eq("student_id", id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    }

    revalidatePath(`/students/${id}`);
  }

  async function resetExamProgressRows() {
    "use server";
    const supabase = await assertTeacherOnly();

    const { error } = await supabase
      .from("exam_progress")
      .delete()
      .eq("student_id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath(`/students/${id}/exam-scope`);
  }

  async function addCalendarEvent(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const eventDate = String(formData.get("event_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const eventType = String(formData.get("event_type") || "기타").trim();
    const memo = String(formData.get("memo") || "").trim();

    const finalTitle =
      title ||
      (eventType === "추가수업"
        ? "추가수업"
        : eventType === "수업"
          ? "수업"
          : eventType === "보강수업"
            ? "보강수업"
            : eventType === "직전보강"
              ? "직전보강"
              : eventType || "일정");

    if (!eventDate || !finalTitle) {
      throw new Error("일정 날짜와 이름은 꼭 입력해야 해.");
    }

    const { error: insertError } = await supabase
      .from("student_events")
      .insert({
        student_id: id,
        event_date: eventDate,
        event_time: eventTime || null,
        subject: subject || null,
        title: finalTitle,
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
    revalidatePath("/");
  }

  async function updateSettlementFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const startDate = String(formData.get("start_date") || "").trim();
    const endDate = String(formData.get("end_date") || "").trim();
    const expectedCount = Number(formData.get("expected_lesson_count") || 0);
    const actualCount = Number(formData.get("actual_lesson_count_override") || 0);
    const makeupCount = Number(formData.get("makeup_count") || 0);
    const feedbackDate = String(formData.get("feedback_date") || "").trim();
    const settlementId = String(formData.get("settlement_id") || "").trim();

    if (!startDate || !endDate) {
      throw new Error("수업 기준 시작일과 종료일이 필요해.");
    }

    if (startDate > endDate) {
      throw new Error("수업 기준 시작일은 종료일보다 늦을 수 없어요.");
    }

    let existing = null;

    if (settlementId) {
      const { data, error: fetchError } = await supabase
        .from("settlements")
        .select("*")
        .eq("id", settlementId)
        .eq("student_id", id)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      existing = data;
    } else {
      const { data, error: fetchError } = await supabase
        .from("settlements")
        .select("*")
        .eq("student_id", id)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      existing = data;
    }

    const adjacentRowSelect = "id, start_date, end_date";
    const existingId = existing?.id || settlementId || "";
    const dayBeforeStartDate = addDaysToDateText(startDate, -1);
    const dayAfterEndDate = addDaysToDateText(endDate, 1);

    let previousSettlementQuery = supabase
      .from("settlements")
      .select(adjacentRowSelect)
      .eq("student_id", id)
      .lt("end_date", startDate);

    if (existingId) {
      previousSettlementQuery = previousSettlementQuery.neq("id", existingId);
    }

    const { data: previousSettlement, error: previousSettlementError } =
      await previousSettlementQuery
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (previousSettlementError) {
      throw new Error(previousSettlementError.message);
    }

    if (
      previousSettlement?.id &&
      previousSettlement.end_date !== dayBeforeStartDate &&
      previousSettlement.start_date <= dayBeforeStartDate
    ) {
      const { error: previousUpdateError } = await supabase
        .from("settlements")
        .update({
          end_date: dayBeforeStartDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", previousSettlement.id)
        .eq("student_id", id);

      if (previousUpdateError) {
        throw new Error(previousUpdateError.message);
      }
    }

    let nextSettlementQuery = supabase
      .from("settlements")
      .select(adjacentRowSelect)
      .eq("student_id", id)
      .gt("start_date", endDate);

    if (existingId) {
      nextSettlementQuery = nextSettlementQuery.neq("id", existingId);
    }

    const { data: nextSettlement, error: nextSettlementError } =
      await nextSettlementQuery
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (nextSettlementError) {
      throw new Error(nextSettlementError.message);
    }

    if (
      nextSettlement?.id &&
      nextSettlement.start_date !== dayAfterEndDate &&
      dayAfterEndDate <= nextSettlement.end_date
    ) {
      const { error: nextUpdateError } = await supabase
        .from("settlements")
        .update({
          start_date: dayAfterEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextSettlement.id)
        .eq("student_id", id);

      if (nextUpdateError) {
        throw new Error(nextUpdateError.message);
      }
    }

    const { data: overlappingRows, error: overlapFetchError } = await supabase
      .from("settlements")
      .select("id, start_date, end_date")
      .eq("student_id", id)
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    if (overlapFetchError) {
      throw new Error(overlapFetchError.message);
    }

    for (const row of (overlappingRows || []) as SettlementRow[]) {
      if (settlementId && row.id === settlementId) continue;
      if (existing?.id && row.id === existing.id) continue;

      const rowStartsBeforeNewRange = row.start_date < startDate;
      const rowEndsAfterNewRange = row.end_date > endDate;

      if (rowStartsBeforeNewRange && rowEndsAfterNewRange) {
        throw new Error(
          "기존 수업 기간이 새 기간을 감싸고 있어서 자동으로 정리할 수 없어요. 앞/뒤 기간을 먼저 나눠주세요.",
        );
      }

      if (row.start_date === startDate && row.end_date === endDate) {
        throw new Error("이미 같은 수업 기준 기간이 있어요.");
      }

      if (rowStartsBeforeNewRange) {
        const trimmedEndDate = addDaysToDateText(startDate, -1);

        if (row.start_date > trimmedEndDate) {
          throw new Error("겹치는 이전 수업 기간을 정리할 수 없어요.");
        }

        const { error: trimError } = await supabase
          .from("settlements")
          .update({
            end_date: trimmedEndDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("student_id", id);

        if (trimError) throw new Error(trimError.message);
        continue;
      }

      if (rowEndsAfterNewRange) {
        const trimmedStartDate = addDaysToDateText(endDate, 1);

        if (trimmedStartDate > row.end_date) {
          throw new Error("겹치는 다음 수업 기간을 정리할 수 없어요.");
        }

        const { error: trimError } = await supabase
          .from("settlements")
          .update({
            start_date: trimmedStartDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("student_id", id);

        if (trimError) throw new Error(trimError.message);
        continue;
      }

      throw new Error(
        "새 수업 기준 기간 안에 다른 수업 기간이 들어 있어요. 그 기간을 먼저 수정하거나 삭제해주세요.",
      );
    }

    const payload = {
      student_id: id,
      start_date: startDate,
      end_date: endDate,
      expected_lesson_count: Math.max(expectedCount, 0),
      actual_lesson_count_override: Math.max(actualCount, 0),
      previous_carryover_count: Math.max(makeupCount, 0),
      lesson_hours: Number(
        existing?.lesson_hours ||
          student.default_lesson_hours ||
          student.lesson_hours ||
          1,
      ),
      hourly_rate: Number(existing?.hourly_rate || student.hourly_rate || 0),
      feedback_date: feedbackDate || null,
      feedback_done: Boolean(existing?.feedback_done),
      payment_status: existing?.payment_status || "대기중",
      payment_type: existing?.payment_type || "선불",
      payment_completed_date: existing?.payment_completed_date || null,
      feedback_note: existing?.feedback_note || null,
      total_fee_override: existing?.total_fee_override ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } =
      settlementId && existing?.id
        ? await supabase
            .from("settlements")
            .update(payload)
            .eq("id", settlementId)
            .eq("student_id", id)
        : await supabase
            .from("settlements")
            .upsert(payload, { onConflict: "student_id,start_date,end_date" });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/payments");
    revalidatePath("/");
    redirect(`/students/${id}?month=${monthTextForUrl}#calendar-section`);
  }

  async function updateLessonMonthSettings(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const settlementIds = formData.getAll("settlement_id").map((value) =>
      String(value || "").trim(),
    );
    const labels = formData.getAll("lesson_month_label").map((value) =>
      String(value || "").trim(),
    );
    const startDates = formData.getAll("start_date").map((value) =>
      String(value || "").trim(),
    );
    const endDates = formData.getAll("end_date").map((value) =>
      String(value || "").trim(),
    );
    const originalStartDates = formData.getAll("original_start_date").map((value) =>
      String(value || "").trim(),
    );
    const originalEndDates = formData.getAll("original_end_date").map((value) =>
      String(value || "").trim(),
    );
    const expectedCounts = formData
      .getAll("expected_lesson_count")
      .map((value) => Number(value || 0));
    const actualCounts = formData
      .getAll("actual_lesson_count_override")
      .map((value) => Number(value || 0));
    const makeupCounts = formData
      .getAll("makeup_count")
      .map((value) => Number(value || 0));
    const feedbackDates = formData.getAll("feedback_date").map((value) =>
      String(value || "").trim(),
    );

    const rows = labels.map((label, index) => ({
      settlementId: settlementIds[index] || "",
      label,
      startDate: startDates[index] || "",
      endDate: endDates[index] || "",
      originalStartDate: originalStartDates[index] || "",
      originalEndDate: originalEndDates[index] || "",
      expectedCount: Math.max(Number(expectedCounts[index] || 0), 0),
      actualCount: Math.max(Number(actualCounts[index] || 0), 0),
      makeupCount: Math.max(Number(makeupCounts[index] || 0), 0),
      feedbackDate: feedbackDates[index] || "",
    }));

    if (rows.some((row) => !row.startDate || !row.endDate)) {
      throw new Error("수업 시작일과 종료일을 모두 입력해줘.");
    }

    rows.forEach((row) => {
      if (row.startDate > row.endDate) {
        throw new Error(`${row.label} 시작일은 종료일보다 늦을 수 없어요.`);
      }
    });

    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index];
      const next = rows[index + 1];
      const nextStartChanged = next.startDate !== next.originalStartDate;
      const currentEndChanged = current.endDate !== current.originalEndDate;

      if (nextStartChanged || !currentEndChanged) {
        current.endDate = addDaysToDateText(next.startDate, -1);
      } else if (currentEndChanged) {
        next.startDate = addDaysToDateText(current.endDate, 1);
      }
    }

    rows.forEach((row) => {
      if (row.startDate > row.endDate) {
        throw new Error(`${row.label} 기간을 확인해줘.`);
      }
    });

    const ids = rows.map((row) => row.settlementId).filter(Boolean);
    const { data: existingRows, error: existingFetchError } = ids.length
      ? await supabase
          .from("settlements")
          .select("*")
          .eq("student_id", id)
          .in("id", ids)
      : { data: [], error: null };

    if (existingFetchError) {
      throw new Error(existingFetchError.message);
    }

    const existingById = new Map(
      ((existingRows || []) as EditableSettlementRow[]).map(
        (row) => [row.id, row],
      ),
    );

    const { data: studentSettlementRows, error: studentSettlementsFetchError } =
      await supabase.from("settlements").select("*").eq("student_id", id);

    if (studentSettlementsFetchError) {
      throw new Error(studentSettlementsFetchError.message);
    }

    const existingByExactRange = new Map(
      ((studentSettlementRows || []) as EditableSettlementRow[]).map(
        (row) => [`${row.start_date}:${row.end_date}`, row],
      ),
    );

    const rowsToSave = rows
      .map((row) => {
        const existing =
          (row.settlementId ? existingById.get(row.settlementId) : null) ||
          existingByExactRange.get(`${row.startDate}:${row.endDate}`) ||
          null;

        if (!row.settlementId && existing?.id) {
          row.settlementId = existing.id;
          existingById.set(existing.id, existing);
        }

        return { row, existing };
      })
      .sort((a, b) => {
        const aShrinks =
          a.existing &&
          a.row.startDate >= a.existing.start_date &&
          a.row.endDate <= a.existing.end_date;
        const bShrinks =
          b.existing &&
          b.row.startDate >= b.existing.start_date &&
          b.row.endDate <= b.existing.end_date;

        if (aShrinks !== bShrinks) return aShrinks ? -1 : 1;
        return String(a.row.startDate).localeCompare(String(b.row.startDate));
      });

    for (const { row, existing } of rowsToSave) {
      const rowExisting =
        existing ||
        (row.settlementId ? existingById.get(row.settlementId) : null) ||
        null;

      const payload = {
        student_id: id,
        start_date: row.startDate,
        end_date: row.endDate,
        expected_lesson_count: row.expectedCount,
        actual_lesson_count_override: row.actualCount,
        previous_carryover_count: row.makeupCount,
        lesson_hours: Number(
          rowExisting?.lesson_hours ||
            student.default_lesson_hours ||
            student.lesson_hours ||
            1,
        ),
        hourly_rate: Number(rowExisting?.hourly_rate || student.hourly_rate || 0),
        feedback_date: row.feedbackDate || null,
        feedback_done: Boolean(rowExisting?.feedback_done),
        payment_status: existing?.payment_status || "대기중",
        payment_type: existing?.payment_type || "선불",
        payment_completed_date: rowExisting?.payment_completed_date || null,
        feedback_note: rowExisting?.feedback_note || null,
        total_fee_override: rowExisting?.total_fee_override ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } =
        row.settlementId && rowExisting?.id
          ? await supabase
              .from("settlements")
              .update(payload)
              .eq("id", row.settlementId)
              .eq("student_id", id)
          : await supabase
              .from("settlements")
              .upsert(payload, {
                onConflict: "student_id,start_date,end_date",
              });

      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/payments");
    revalidatePath("/");
    redirect(`/students/${id}?month=${monthTextForUrl}#calendar-section`);
  }

  async function updateSettlementFeedbackFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const settlementId = String(formData.get("settlement_id") || "").trim();
    const feedbackDate = String(formData.get("feedback_date") || "").trim();

    if (!settlementId || !feedbackDate) {
      throw new Error("피드백 날짜 정보가 필요해.");
    }

    const { error } = await supabase
      .from("settlements")
      .update({
        feedback_date: feedbackDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settlementId)
      .eq("student_id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/payments");
    revalidatePath("/");
    redirect(`/students/${id}?month=${monthTextForUrl}#calendar-section`);
  }

  async function deleteSettlementFeedbackFromCalendar(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const settlementId = String(formData.get("settlement_id") || "").trim();

    if (!settlementId) return;

    const { error } = await supabase
      .from("settlements")
      .update({
        feedback_date: null,
        feedback_done: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settlementId)
      .eq("student_id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
    revalidatePath("/payments");
    revalidatePath("/");
    redirect(`/students/${id}?month=${monthTextForUrl}#calendar-section`);
  }

  async function addStudyPlan(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const planType = String(formData.get("plan_type") || "date").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const weekNumber = Number(formData.get("week_number") || 0);
    const selectedTasks = formData
      .getAll("selected_tasks")
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const customTitle = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (planType === "date" && !dueDate) {
      throw new Error("날짜 기준 공부 계획은 마감일이 필요해.");
    }

    if (planType === "week" && !weekNumber) {
      throw new Error("주 기준 공부 계획은 몇째 주인지 필요해.");
    }

    const taskValues = selectedTasks.length > 0 ? selectedTasks : [""];

    const insertRows = taskValues.map((selectedTask) => {
      const [progressId, subject, unitName, taskName] = selectedTask
        ? selectedTask.split("|||")
        : ["", "", "", ""];

      const finalTitle = taskName || customTitle || unitName || "공부 계획";

      return {
        student_id: id,
        plan_type: planType,
        due_date: planType === "date" ? dueDate : null,
        week_number: planType === "week" ? weekNumber : null,
        subject: subject || null,
        title: finalTitle,
        unit_name: unitName || null,
        task_name: taskName || null,
        progress_id: progressId || null,
        memo: memo || null,
      };
    });

    const { error: insertError } = await supabase
      .from("student_study_plans")
      .insert(insertRows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(
      `/students/${id}?month=${monthTextForUrl}&showPlans=1#calendar-section`,
    );
  }

  async function updateStudyPlan(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const planId = String(formData.get("plan_id") || "").trim();
    const planType = String(formData.get("plan_type") || "date").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const weekNumber = Number(formData.get("week_number") || 0);
    const selectedTask = String(formData.get("selected_task") || "").trim();
    const customTitle = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    const [progressId, subject, unitName, taskName] = selectedTask
      ? selectedTask.split("|||")
      : ["", "", "", ""];

    const finalTitle = customTitle || taskName || unitName || "공부 계획";

    if (!planId) return;

    const { error: updateError } = await supabase
      .from("student_study_plans")
      .update({
        plan_type: planType,
        due_date: planType === "date" ? dueDate || null : null,
        week_number: planType === "week" ? weekNumber || null : null,
        subject: subject || null,
        title: finalTitle,
        unit_name: unitName || null,
        task_name: taskName || null,
        progress_id: progressId || null,
        memo: memo || null,
      })
      .eq("id", planId)
      .eq("student_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(
      `/students/${id}?month=${monthTextForUrl}&showPlans=1#calendar-section`,
    );
  }

  async function deleteStudyPlan(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const planId = String(formData.get("plan_id") || "").trim();

    if (!planId) return;

    const { error: deleteError } = await supabase
      .from("student_study_plans")
      .delete()
      .eq("id", planId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(
      `/students/${id}?month=${monthTextForUrl}&showPlans=1#calendar-section`,
    );
  }
  async function addGradeTrendRecord(formData: FormData) {
    "use server";

    const supabase = await assertCanEditStudentAllowedParts();

    const semesterLabel = String(formData.get("semester_label") || "").trim();
    const subjectArea = String(formData.get("subject_area") || "기타과").trim();
    const subjectName = String(formData.get("subject_name") || "").trim();
    const lessonHours = numberFromFormValue(formData.get("lesson_hours"));
    const grade = numberFromFormValue(formData.get("grade"));
    const percentile = numberFromFormValue(formData.get("percentile"));
    const rank = numberFromFormValue(formData.get("rank"));
    const totalStudents = numberFromFormValue(formData.get("total_students"));
    const memo = String(formData.get("memo") || "").trim();

    if (!semesterLabel || !subjectArea || !subjectName) {
      throw new Error("학기, 교과, 과목 이름은 꼭 입력해야 해.");
    }

    const { error: insertError } = await supabase
      .from("student_grade_records")
      .insert({
        student_id: id,
        semester_label: semesterLabel,
        subject: subjectName,
        subject_area: subjectArea,
        subject_name: subjectName,
        lesson_hours: lessonHours,
        grade,
        percentile,
        rank,
        total_students: totalStudents,
        memo: memo || null,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(`/students/${id}#grade-trend-section`);
  }

  async function deleteGradeTrendRecord(formData: FormData) {
    "use server";

    const supabase = await assertCanEditStudentAllowedParts();

    const gradeRecordId = String(formData.get("grade_record_id") || "").trim();

    if (!gradeRecordId) return;

    const { error: deleteError } = await supabase
      .from("student_grade_records")
      .delete()
      .eq("id", gradeRecordId)
      .eq("student_id", id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    revalidatePath(`/students/${id}`);
    redirect(`/students/${id}#grade-trend-section`);
  }

  async function deleteLessonRecord(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const recordId = String(formData.get("record_id") || "");

    if (!recordId) return;

    const { data: recordBeforeDelete } = await supabase
      .from("lesson_records")
      .select("subject_records, checked_homework_items")
      .eq("id", recordId)
      .eq("student_id", id)
      .single();

    const savedTasks: SavedTask[] = [];
    const subjectRecordsBeforeDelete = Array.isArray(
      recordBeforeDelete?.subject_records,
    )
      ? recordBeforeDelete.subject_records
      : [];

    subjectRecordsBeforeDelete.forEach((subjectRecord: SubjectRecord) => {
      savedTasks.push(
        ...(Array.isArray(subjectRecord.progress_items)
          ? subjectRecord.progress_items
          : []),
      );
      savedTasks.push(
        ...(Array.isArray(subjectRecord.homework_items)
          ? subjectRecord.homework_items
          : []),
      );
      savedTasks.push(
        ...(Array.isArray(subjectRecord.plan_items)
          ? subjectRecord.plan_items
          : []),
      );
    });

    savedTasks.push(
      ...(Array.isArray(recordBeforeDelete?.checked_homework_items)
        ? recordBeforeDelete.checked_homework_items
        : []),
    );

    const revertTasks = savedTasks.filter(
      (task) =>
        task.progress_id &&
        task.task_name &&
        task.before_status &&
        task.before_status !== "manual" &&
        !String(task.progress_id).startsWith("manual-"),
    );

    const progressIds = Array.from(
      new Set(revertTasks.map((task) => task.progress_id!)),
    );

    if (progressIds.length > 0) {
      const { data: progressRows, error: progressFetchError } = await supabase
        .from("exam_progress")
        .select("id, statuses")
        .in("id", progressIds)
        .eq("student_id", id);

      if (progressFetchError) {
        throw new Error(progressFetchError.message);
      }

      for (const progressRow of progressRows || []) {
        const statuses = parseStatuses(progressRow.statuses);
        revertTasks
          .filter((task) => task.progress_id === progressRow.id)
          .forEach((task) => {
            statuses[task.task_name!] = task.before_status || "not_started";
          });

        const { error: statusUpdateError } = await supabase
          .from("exam_progress")
          .update({ statuses })
          .eq("id", progressRow.id)
          .eq("student_id", id);

        if (statusUpdateError) {
          throw new Error(statusUpdateError.message);
        }
      }
    }

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
  async function addWeeklyPlanBlock(formData: FormData) {
    "use server";

    const supabase = await assertCanEditStudentAllowedParts();

    const current = parseWeeklyPlan(student.weekly_plan);
    const selectedDays = formData
      .getAll("days")
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const days = selectedDays.length > 0 ? selectedDays : ["월"];

    const start = normalizeTime(String(formData.get("start") || ""));
    const end = normalizeTime(String(formData.get("end") || ""));
    const category = String(formData.get("category") || "기타");
    const subject = String(formData.get("subject") || "").trim();
    const customSubject = String(formData.get("custom_subject") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end, { midnightAsEnd: true });

    if (
      !start ||
      !end ||
      endMinutes <= startMinutes ||
      startMinutes < WEEKLY_PLAN_START_HOUR * 60 ||
      endMinutes > WEEKLY_PLAN_END_HOUR * 60
    ) {
      throw new Error(
        "시작시간과 끝시간을 확인해줘. 밤 12시는 끝시간에 00:00으로 입력해줘.",
      );
    }

    const timestamp = Date.now();

    const nextBlocks: WeeklyPlanBlock[] = days.map((day, index) => ({
      id: `${timestamp}-${index}-${Math.random().toString(16).slice(2)}`,
      day,
      start,
      end,
      category,
      subject: subject || null,
      customSubject: customSubject || null,
      memo: memo || null,
    }));

    const { error } = await supabase
      .from("students")
      .update({ weekly_plan: { blocks: [...current.blocks, ...nextBlocks] } })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function updateWeeklyPlanBlock(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const blockId = String(formData.get("block_id") || "");
    const current = parseWeeklyPlan(student.weekly_plan);
    const day = String(formData.get("day") || "월");
    const start = normalizeTime(String(formData.get("start") || ""));
    const end = normalizeTime(String(formData.get("end") || ""));
    const category = String(formData.get("category") || "기타");
    const subject = String(formData.get("subject") || "").trim();
    const customSubject = String(formData.get("custom_subject") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end, { midnightAsEnd: true });

    if (
      !blockId ||
      !start ||
      !end ||
      endMinutes <= startMinutes ||
      startMinutes < WEEKLY_PLAN_START_HOUR * 60 ||
      endMinutes > WEEKLY_PLAN_END_HOUR * 60
    ) {
      throw new Error("시간표 항목을 확인해줘.");
    }

    const nextBlocks = current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            day,
            start,
            end,
            category,
            subject: subject || null,
            customSubject: customSubject || null,
            memo: memo || null,
          }
        : block,
    );

    const { error } = await supabase
      .from("students")
      .update({ weekly_plan: { blocks: nextBlocks } })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function deleteWeeklyPlanBlock(formData: FormData) {
    "use server";
    const supabase = await assertCanEditStudentAllowedParts();

    const blockId = String(formData.get("block_id") || "");
    const current = parseWeeklyPlan(student.weekly_plan);
    const nextBlocks = current.blocks.filter((block) => block.id !== blockId);

    const { error } = await supabase
      .from("students")
      .update({ weekly_plan: { blocks: nextBlocks } })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
  }

  async function addStudentExpPoints(formData: FormData) {
    "use server";
    const supabase = await assertTeacherOnly();

    const pointDelta = Number(formData.get("point_delta") || 0);

    if (!Number.isFinite(pointDelta) || pointDelta === 0) return;

    const { data: studentRow, error: fetchError } = await supabase
      .from("students")
      .select("exp_points")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    const nextExp = Math.max(Number(studentRow?.exp_points || 0) + pointDelta, 0);

    const { error } = await supabase
      .from("students")
      .update({ exp_points: nextExp })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/students/${id}`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#ffffff] px-3 py-6 text-[#171717] sm:px-5 sm:py-8">
      <style>{`
        @media (max-width: 767px) {
          main { max-width: 100vw; }
          table { font-size: 12px; }
          input, select, textarea, button { font-size: 16px; }
          [class*="fixed"][class*="z-50"] {
            left: 0.5rem !important;
            right: 0.5rem !important;
            top: 0.75rem !important;
            width: auto !important;
            max-width: calc(100vw - 1rem) !important;
            max-height: 92vh !important;
            transform: none !important;
            overflow: auto !important;
            border-radius: 1.25rem !important;
          }
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {isTeacher && (
              <Link
                href="/"
                className="mb-2 inline-flex rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#525252] transition hover:-translate-y-0.5 hover:bg-[#f7f7f7]"
              >
                ← 대시보드로 돌아가기
              </Link>
            )}
            <p className="text-sm font-black text-[#525252]">학생 상세보기</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight">
                {student.name}
              </h1>
              {isTeacher && (
                <Link
                  href="/payments"
                  title="월별정산으로 이동"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d4d4d4] bg-[#ffffff] text-lg shadow-sm transition hover:-translate-y-0.5"
                >
                  🧾
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isTeacher && (
              <Link
                href={`/students/${id}/records/new`}
                className="rounded-full bg-[#171717] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
              >
                💗 수업기록 추가
              </Link>
            )}

            <Link
              href={`/students/${id}/exam-scope`}
              className="rounded-full border border-[#d4d4d4] bg-[#ffffff] px-4 py-3 text-sm font-black text-[#171717] transition hover:-translate-y-0.5"
            >
              📚 시험범위 진도표
            </Link>

            <Link
              href={`/students/${id}/portfolio`}
              className="rounded-full border border-[#d4d4d4] bg-[#ffffff] px-4 py-3 text-sm font-black text-[#171717] transition hover:-translate-y-0.5"
            >
              📝 수행평가 · 생기부 기록
            </Link>
            <LogoutButton />
          </div>
        </div>

        <section className="relative rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 pr-0 md:flex-row md:items-center md:pr-28">
            <AvatarBox name={student.name} avatarUrl={student.avatar_url} />

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-black">{student.name}</h2>
                {isTeacher && (
                  <Link
                    href="/payments"
                    title="월별정산으로 이동"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d4d4d4] bg-[#ffffff] text-base shadow-sm transition hover:-translate-y-0.5"
                  >
                    🧾
                  </Link>
                )}
                <span className="rounded-full border border-[#d4d4d4] bg-[#f5f5f5] px-3 py-1 text-xs font-black text-[#171717]">
                  Lv. {currentLevel}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm font-bold text-[#5c5751]">
                <div className="flex flex-wrap gap-2">
                  {student.age && (
                    <span className="rounded-full bg-[#f7f7f7] px-3 py-1">
                      {student.age}세
                    </span>
                  )}
                  {student.school && (
                    <span className="rounded-full bg-[#f7f7f7] px-3 py-1">
                      {student.school}
                    </span>
                  )}
                  {student.avatar_memo && (
                    <span className="rounded-full bg-[#f7f7f7] px-3 py-1">
                      {student.avatar_memo}
                    </span>
                  )}
                </div>

                {student.target_university || student.target_major ? (
                  <div className="inline-flex rounded-full border border-[#d4d4d4] bg-[#ffffff] px-3 py-1 text-[#171717]">
                    {universityEmoji(
                      student.target_university,
                      student.target_major,
                      student.career,
                    )}{" "}
                    {getCareerCountdownLabel(student.age)}{" "}
                    {student.target_university || "목표대학"}
                    {student.target_major
                      ? ` ${student.target_major}`
                      : student.career
                        ? ` ${student.career}`
                        : ""}{" "}
                    {getAdmissionClassLabel(student.age)}
                  </div>
                ) : student.career ? (
                  <div className="inline-flex rounded-full bg-[#f5f5f5] px-3 py-1 text-[#171717]">
                    {careerEmoji(student.career)}{" "}
                    {getCareerCountdownLabel(student.age)} {student.career}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 max-w-xl space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-black text-[#525252]">
                    <span>졸업까지</span>
                    <span>{getCareerCountdownLabel(student.age)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div
                      className="h-full rounded-full bg-[#171717]"
                      style={{
                        width: `${getGraduationGaugePercent(student.age)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-black text-[#525252]">
                    <span>성장 EXP</span>
                    <span>{currentExp} EXP</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div
                      className="h-full rounded-full bg-[#171717]"
                      style={{ width: `${currentExpPercent}%` }}
                    />
                  </div>
                  {isTeacher && (
                    <form
                      action={addStudentExpPoints}
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="number"
                        name="point_delta"
                        placeholder="+10"
                        className="w-24 rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-black text-[#171717] outline-none"
                      />
                      <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                        포인트 추가
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
          {isTeacher && (
            <details className="mt-5 rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-5 md:mt-0 md:border-0 md:bg-transparent md:p-0">
              <summary className="cursor-pointer list-none rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#171717] shadow-sm md:absolute md:right-5 md:top-5">
                기본정보 수정
              </summary>

              <form
                action={updateStudentInfo}
                className="mt-5 grid gap-4 md:grid-cols-2"
              >
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    이름
                  </label>
                  <input
                    name="name"
                    defaultValue={student.name || ""}
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    나이
                  </label>
                  <input
                    name="age"
                    defaultValue={student.age || ""}
                    placeholder="예: 16"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    학교
                  </label>
                  <input
                    name="school"
                    defaultValue={student.school || ""}
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    진로
                  </label>
                  <input
                    name="career"
                    defaultValue={student.career || ""}
                    placeholder="예: 마케팅 / 체육교육 / 간호보건"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    목표대학
                  </label>
                  <input
                    name="target_university"
                    defaultValue={student.target_university || ""}
                    placeholder="예: 중앙대 / 성균관대"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    목표학과
                  </label>
                  <input
                    name="target_major"
                    defaultValue={student.target_major || ""}
                    placeholder="예: 광고홍보학과 / 체육교육과"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    아바타 이미지 URL
                  </label>
                  <input
                    name="avatar_url"
                    defaultValue={student.avatar_url || ""}
                    placeholder="이미지 주소를 붙여넣으면 왼쪽 아바타에 표시돼요"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                    아바타 메모
                  </label>
                  <input
                    name="avatar_memo"
                    defaultValue={student.avatar_memo || ""}
                    placeholder="예: 단발 / 리본 / 분홍 가디건"
                    className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="md:col-span-2 rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
                >
                  기본정보 저장
                </button>
              </form>

              <div className="mt-6 rounded-3xl border border-[#e5e5e5] bg-white p-4">
                <h3 className="text-sm font-black text-[#171717]">
                  고정 수업시간
                </h3>
                <p className="mt-1 text-xs font-semibold text-[#525252]">
                  등록한 요일/시간은 아래 달력에 매주 반복으로 자동 표시돼요.
                </p>

                <form
                  action={addLessonTime}
                  className="mt-4 grid gap-3 md:grid-cols-5"
                >
                  <select
                    name="day_of_week"
                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
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
                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                  />

                  <input
                    name="end_time"
                    placeholder="종료 20:00"
                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                  />

                  <input
                    name="memo"
                    placeholder="메모"
                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                  />

                  <button
                    type="submit"
                    className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white"
                  >
                    추가
                  </button>
                </form>

                <div className="mt-4 space-y-3">
                  {lessonTimes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-4 py-4 text-sm font-semibold text-[#525252]">
                      등록된 고정 수업시간이 없어요.
                    </div>
                  ) : (
                    lessonTimes.map((lessonTime) => (
                      <form
                        key={lessonTime.id}
                        action={updateLessonTime}
                        className="grid gap-2 rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 md:grid-cols-6"
                      >
                        <input
                          type="hidden"
                          name="lesson_time_id"
                          value={lessonTime.id}
                        />

                        <select
                          name="day_of_week"
                          defaultValue={lessonTime.day_of_week}
                          className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
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
                          className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                        />

                        <input
                          name="end_time"
                          defaultValue={normalizeTime(lessonTime.end_time)}
                          className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                        />

                        <input
                          name="memo"
                          defaultValue={lessonTime.memo || ""}
                          className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                        />

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white"
                          >
                            수정
                          </button>

                          <button
                            formAction={deleteLessonTime}
                            className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
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
          )}{" "}
        </section>

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <input id="score-edit-mode" type="checkbox" className="peer hidden" />
          <style>{`#score-edit-mode:checked ~ .score-list .score-delete-button { display: flex; }`}</style>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black">목표등급</h2>
              <p className="mt-1 text-sm text-[#525252]">
                과목별 등급을 한눈에 가볍게 확인해요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <details className="group w-full md:w-auto">
                <summary className="w-fit cursor-pointer list-none rounded-full bg-[#171717] px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5">
                  + 성적 추가
                </summary>

                <form
                  action={addScoreRecord}
                  className="mt-3 grid gap-2 rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 md:grid-cols-5"
                >
                  <select
                    name="subject"
                    className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                  >
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                  <input
                    name="previous_score"
                    placeholder="현재 등급"
                    className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    name="target_score"
                    placeholder="목표 등급"
                    className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    name="memo"
                    placeholder="메모"
                    className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white"
                  >
                    저장
                  </button>
                </form>
              </details>

              <label
                htmlFor="score-edit-mode"
                className="cursor-pointer rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#171717] shadow-sm peer-checked:bg-[#f5f5f5]"
              >
                편집
              </label>
            </div>
          </div>

          {scoreRecords.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-5 text-sm font-semibold text-[#525252]">
              아직 성적 기록이 없어요.
            </div>
          ) : (
            <div className="score-list grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">
              {scoreRecords.map((score) => (
                <div
                  key={score.id}
                  className="relative min-h-[74px] rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2"
                >
                  <form
                    action={deleteScoreRecord}
                    className="score-delete-button absolute -right-1.5 -top-1.5 hidden"
                  >
                    <input type="hidden" name="score_id" value={score.id} />
                    <button
                      type="submit"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-[11px] font-black text-white shadow-sm"
                      aria-label={`${score.subject} 성적 기록 삭제`}
                    >
                      ×
                    </button>
                  </form>

                  <p className="truncate text-sm font-black text-[#525252]">
                    <span className="mr-1">{subjectEmoji(score.subject)}</span>
                    {score.subject}
                  </p>

                  <div className="mt-1 flex items-center gap-1 whitespace-nowrap">
                    <span
                      className={`rounded-full border px-2 py-1 text-[13px] font-black ${gradeStyle(score.previous_score)}`}
                    >
                      {gradeLabel(score.previous_score)}
                    </span>
                    <span className="text-xs font-black text-[#171717]">→</span>
                    <span
                      className={`rounded-full border px-2 py-1 text-[13px] font-black ${gradeStyle(score.target_score)}`}
                    >
                      {gradeLabel(score.target_score)}
                    </span>
                  </div>

                  {score.memo && (
                    <p className="mt-1 truncate text-[11px] font-semibold text-[#525252]">
                      {score.memo}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <details
          id="grade-trend-section"
          className="rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none text-lg font-black text-[#171717]">
            📈 내 성적 그래프 보기
          </summary>

          <div className="mt-4 space-y-4">
            <div className="rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
              <h3 className="text-sm font-black text-[#171717]">
                학기별 성적 입력
              </h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#525252]">
                고등학교 내신은 과목 수 평균이 아니라{" "}
                <b>시수/단위수 가중평균</b>으로 계산해요. 예: Σ(등급×시수) ÷
                Σ시수.
              </p>

              <form
                action={addGradeTrendRecord}
                className="mt-4 grid gap-2 md:grid-cols-10"
              >
                <input
                  name="semester_label"
                  placeholder="예: 2026 1학기"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                />

                <select
                  name="subject_area"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                >
                  {GRADE_SUBJECT_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>

                <input
                  name="subject_name"
                  placeholder="과목 이름 예: 문학"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                />

                <input
                  name="lesson_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="시수"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />

                <input
                  name="grade"
                  type="number"
                  min="1"
                  max="9"
                  step="0.1"
                  placeholder="등급"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />

                <input
                  name="rank"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="등수 선택"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />

                <input
                  name="total_students"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="전체 인원"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />

                <input
                  name="percentile"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="백분율 선택"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />

                <input
                  name="memo"
                  placeholder="메모"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-8"
                />

                <button
                  type="submit"
                  className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white md:col-span-2"
                >
                  저장
                </button>
              </form>
            </div>

            {gradeTrendRowsBySemester.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-6 text-sm font-semibold text-[#525252]">
                아직 입력된 학기별 성적이 없어요.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#171717]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f7f7f7]">
                        📈
                      </span>
                      국영수사과 내신 그래프
                    </h3>
                    <div className="space-y-3">
                      {gradeTrendRowsBySemester.map((semesterRow) => (
                        <div key={`core-grade-${semesterRow.semester}`}>
                          <div className="mb-1 flex items-center justify-between text-xs font-black text-[#5c5751]">
                            <span>{semesterRow.semester}</span>
                            <span>
                              {semesterRow.coreAverage
                                ? `${semesterRow.coreAverage}등급`
                                : "-"}
                            </span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-[#171717]"
                              style={{
                                width: `${gradeBarWidth(semesterRow.coreAverage)}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] font-bold text-[#525252]">
                            <span>
                              등수평균{" "}
                              {semesterRow.coreRankAverage
                                ? `${semesterRow.coreRankAverage}등`
                                : "-"}
                            </span>
                            <span>
                              백분율{" "}
                              {semesterRow.coreRankPercentileAverage ||
                              semesterRow.corePercentileAverage
                                ? `${semesterRow.coreRankPercentileAverage || semesterRow.corePercentileAverage}%`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#171717]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f7f7f7]">
                        📊
                      </span>
                      전과목 내신 그래프
                    </h3>
                    <div className="space-y-3">
                      {gradeTrendRowsBySemester.map((semesterRow) => (
                        <div key={`all-grade-${semesterRow.semester}`}>
                          <div className="mb-1 flex items-center justify-between text-xs font-black text-[#5c5751]">
                            <span>{semesterRow.semester}</span>
                            <span>
                              {semesterRow.allAverage
                                ? `${semesterRow.allAverage}등급`
                                : "-"}
                            </span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-[#171717]"
                              style={{
                                width: `${gradeBarWidth(semesterRow.allAverage)}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] font-bold text-[#525252]">
                            <span>
                              등수평균{" "}
                              {semesterRow.allRankAverage
                                ? `${semesterRow.allRankAverage}등`
                                : "-"}
                            </span>
                            <span>
                              백분율{" "}
                              {semesterRow.allRankPercentileAverage ||
                              semesterRow.allPercentileAverage
                                ? `${semesterRow.allRankPercentileAverage || semesterRow.allPercentileAverage}%`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {gradeTrendRowsBySemester.map((semesterRow) => (
                    <div
                      key={semesterRow.semester}
                      className="rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-4"
                    >
                      <p className="text-sm font-black text-[#171717]">
                        {semesterRow.semester}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-2xl bg-white px-2 py-3">
                          <p className="text-[11px] font-black text-[#525252]">
                            국영수사과
                          </p>
                          <p className="mt-1 text-lg font-black text-[#171717]">
                            {semesterRow.coreAverage
                              ? `${semesterRow.coreAverage}등급`
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-2 py-3">
                          <p className="text-[11px] font-black text-[#525252]">
                            전과목
                          </p>
                          <p className="mt-1 text-lg font-black text-[#171717]">
                            {semesterRow.allAverage
                              ? `${semesterRow.allAverage}등급`
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-2 py-3">
                          <p className="text-[11px] font-black text-[#525252]">
                            국영수사과 등수
                          </p>
                          <p className="mt-1 text-lg font-black text-[#404040]">
                            {semesterRow.coreRankAverage
                              ? `${semesterRow.coreRankAverage}등`
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-2 py-3">
                          <p className="text-[11px] font-black text-[#525252]">
                            전과목 등수
                          </p>
                          <p className="mt-1 text-lg font-black text-[#404040]">
                            {semesterRow.allRankAverage
                              ? `${semesterRow.allRankAverage}등`
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-3xl border border-[#e5e5e5]">
                  <table className="w-full min-w-[920px] border-separate border-spacing-0 bg-white text-sm">
                    <thead>
                      <tr className="bg-[#f7f7f7] text-[#5c5751]">
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-left font-black">
                          학기
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-left font-black">
                          교과
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-left font-black">
                          과목
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-black">
                          시수
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-black">
                          등급
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-black">
                          등수
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-black">
                          백분율
                        </th>
                        <th className="border-b border-r border-[#e5e5e5] px-4 py-3 text-left font-black">
                          메모
                        </th>
                        <th className="border-b border-[#e5e5e5] px-4 py-3 text-center font-black">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeTrendRecords.map((row) => (
                        <tr key={row.id} className="text-[#171717]">
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 font-bold">
                            {row.semester_label}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 font-black">
                            {gradeTrendArea(row)}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 font-black">
                            {row.subject_name || row.subject}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-bold">
                            {row.lesson_hours || "-"}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-black text-[#171717]">
                            {row.grade ? `${row.grade}등급` : "-"}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-bold">
                            {row.rank ? `${row.rank}등` : "-"}
                            {row.total_students
                              ? ` / ${row.total_students}명`
                              : ""}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 text-center font-bold">
                            {rankPercentile(row)
                              ? `${rankPercentile(row)}%`
                              : row.percentile
                                ? `${row.percentile}%`
                                : "-"}
                          </td>
                          <td className="border-b border-r border-[#e5e5e5] px-4 py-3 text-[#525252]">
                            {row.memo || "-"}
                          </td>
                          <td className="border-b border-[#e5e5e5] px-4 py-3 text-center">
                            <form action={deleteGradeTrendRecord}>
                              <input
                                type="hidden"
                                name="grade_record_id"
                                value={row.id}
                              />
                              <button className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-xs font-black text-[#171717]">
                                삭제
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </details>

        <section
          id="calendar-section"
          className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <div className="min-w-0">
              <h2 className="text-xl font-black">학생별 캘린더</h2>
              <p className="mt-1 text-sm text-[#525252]">
                일정을 누르면 큰 수정 박스가 열려요. 수업은 기록 연결도 바로
                확인할 수 있어요.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="hidden">
                  <span>{formatLessonMonthLabel(month)} 예상 수업</span>
                  <span className="text-[#171717]">
                    {expectedLessonCount || 0}회
                  </span>
                </span>
                <span className="hidden">
                  <span>기준</span>
                  <span>
                    {settlementStartDate} ~ {settlementEndDate}
                  </span>
                </span>
                {upcomingExamEvent && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#d4d4d4] bg-[#ffffff] px-3 py-1.5 text-xs font-black text-[#171717]">
                    <span>{upcomingExamEvent.event_type}</span>
                    <span>{examDdayLabel(upcomingExamEvent.event_date)}</span>
                  </span>
                )}
              </div>
              {isTeacher && (
                <details className="mt-3 rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-3 text-xs font-bold text-[#525252]">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3">
                    <span className="font-black text-[#171717]">
                      수업 기준 날짜
                    </span>
                    <div className="grid flex-1 gap-1 sm:min-w-[420px]">
                      {lessonMonthSettings.map((item) => (
                        <div
                          key={`lesson-month-summary-${item.key}`}
                          className="grid grid-cols-[82px_1fr_auto] items-center gap-2 rounded-xl bg-[#ffffff] px-3 py-2"
                        >
                          <span className="rounded-lg bg-[#171717] px-2 py-1 text-center text-[11px] font-black text-white">
                            {item.label}
                          </span>
                          <span className="text-[12px] font-black text-[#171717]">
                            {formatMonthDay(item.startDate)} -{" "}
                            {formatMonthDay(item.endDate)}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#171717] ring-1 ring-[#d4d4d4]">
                            {item.expected}회 수업
                          </span>
                        </div>
                      ))}
                    </div>
                    <span className="ml-auto rounded-full bg-[#f7f7f7] px-2.5 py-1 text-[10px] font-black text-[#171717]">
                      수정
                    </span>
                  </summary>

                  <form
                    action={updateLessonMonthSettings}
                    className="mt-3 space-y-3"
                  >
                    {lessonMonthSettings.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-[#e5e5e5] bg-white p-4"
                      >
                        <input
                          type="hidden"
                          name="settlement_id"
                          value={item.settlementId}
                        />
                        <input
                          type="hidden"
                          name="lesson_month_label"
                          value={item.label}
                        />
                        <input
                          type="hidden"
                          name="original_start_date"
                          value={item.startDate}
                        />
                        <input
                          type="hidden"
                          name="original_end_date"
                          value={item.endDate}
                        />

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                            {item.label}
                          </span>
                          <span className="rounded-xl bg-[#ffffff] px-3 py-2 text-sm font-black text-[#171717]">
                            {formatMonthDay(item.startDate)} ~{" "}
                            {formatMonthDay(item.endDate)}
                          </span>
                          <span className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#171717] ring-1 ring-[#d4d4d4]">
                            {item.expected}회 수업
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-10">
                          <label className="grid gap-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-[#171717]">
                              시작일
                            </span>
                            <input
                              type="date"
                              name="start_date"
                              defaultValue={item.startDate}
                              className="min-w-0 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-black text-[#171717] outline-none"
                            />
                          </label>
                          <label className="grid gap-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-[#171717]">
                              종료일
                            </span>
                            <input
                              type="date"
                              name="end_date"
                              defaultValue={item.endDate}
                              className="min-w-0 rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-black text-[#171717] outline-none"
                            />
                          </label>
                          <label className="grid gap-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-[#171717]">
                              예상 횟수
                            </span>
                            <input
                              type="number"
                              min="0"
                              name="expected_lesson_count"
                              defaultValue={item.expected}
                              className="min-w-0 rounded-xl border border-[#e5e5e5] px-2 py-1.5 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-[#171717]">
                              실제 진행
                            </span>
                            <input
                              type="number"
                              min="0"
                              name="actual_lesson_count_override"
                              defaultValue={item.actual}
                              className="min-w-0 rounded-xl border border-[#e5e5e5] px-2 py-1.5 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 sm:col-span-2">
                            <span className="text-[10px] font-black text-[#171717]">
                              보강
                            </span>
                            <input
                              type="number"
                              min="0"
                              name="makeup_count"
                              defaultValue={item.makeupCount}
                              className="min-w-0 rounded-xl border border-[#e5e5e5] px-2 py-1.5 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 sm:col-span-8">
                            <span className="text-[10px] font-black text-[#171717]">
                              피드백 날짜
                            </span>
                            <input
                              type="date"
                              name="feedback_date"
                              defaultValue={item.feedbackDate}
                              className="min-w-0 rounded-xl border border-[#e5e5e5] px-2 py-1.5 outline-none"
                            />
                          </label>
                          <div className="flex items-end sm:col-span-2">
                            <span className="rounded-xl bg-[#ffffff] px-3 py-2 text-[11px] font-black text-[#171717]">
                              {item.label} {item.expected}회 수업
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button className="w-full rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                      3개월 수업 기준 저장
                    </button>
                  </form>
                </details>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Link
                href={`/students/${id}?month=${prevMonthText}`}
                className="whitespace-nowrap rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-black text-[#171717]"
              >
                이전달
              </Link>

              <div className="min-w-[128px] rounded-2xl bg-[#f7f7f7] px-4 py-2 text-center text-sm font-black text-[#171717]">
                {year}년 {month}월
              </div>

              <Link
                href={`/students/${id}?month=${nextMonthText}`}
                className="whitespace-nowrap rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-black text-[#171717]"
              >
                다음달
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[1.75rem] border border-[#e5e5e5]">
            <div
              className={`grid min-w-[720px] md:min-w-0 ${showStudyPlans ? "grid-cols-8" : "grid-cols-7"} rounded-t-[1.75rem] bg-[#f7f7f7]`}
            >
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-[#e5e5e5] px-3 py-3 text-center text-xs font-black text-[#171717]"
                >
                  {day}
                </div>
              ))}
              {showStudyPlans && (
                <div className="px-3 py-3 text-center text-xs font-black text-[#404040]">
                  계획
                </div>
              )}
            </div>

            <div className="bg-white">
              {calendarRows.map((weekCells, weekIndex) => (
                <div
                  key={`week-${weekIndex}`}
                  className={`grid min-w-[720px] md:min-w-0 ${showStudyPlans ? "grid-cols-8" : "grid-cols-7"}`}
                >
                  {weekCells.map((cell, index) => {
                    const dateEvents = cell.dateText
                      ? groupCalendarEventsForDisplay(
                          eventsByDate[cell.dateText] || [],
                        )
                      : [];

                    return (
                      <div
                        key={`${cell.dateText || "blank"}-${index}`}
                        className={`min-h-[140px] border-r border-t border-[#e5e5e5] p-2 last:border-r-0 ${
                          cell.dateText === todayText
                            ? "bg-[#e5e5e5] ring-2 ring-inset ring-[#8d8177]"
                            : cell.isCurrentMonth
                              ? "bg-white"
                              : "bg-[#f5f5f5]"
                        }`}
                      >
                        {cell.dateText && (
                          <>
                            <div className="mb-2 flex items-center justify-between">
                              <span
                                className={`text-xs font-black ${
                                  cell.dateText === todayText
                                    ? "text-[#171717]"
                                    : cell.isCurrentMonth
                                      ? "text-[#171717]"
                                      : "text-[#a3a3a3]"
                                }`}
                              >
                                {cell.day}
                              </span>
                              {dateEvents.length > 0 && (
                                <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-black text-[#171717]">
                                  {dateEvents.length}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              {dateEvents.map((event) => {
                                const type = event.event_type || "기타";
                                const isFixedLesson =
                                  event.source_type === "fixed_lesson_time";
                                const isMovedFixedLesson =
                                  event.source_type === "fixed_lesson_override";
                                const isMakeup =
                                  event.source_type === "makeup_lesson";
                                const isLessonRecord =
                                  event.source_type === "lesson_record";
                                const isPerformance =
                                  event.source_type === "performance_task";
                                const isStudyPlan =
                                  event.source_type === "study_plan";
                                const isSettlementFeedback =
                                  event.source_type === "settlement_feedback";
                                const isManualEvent =
                                  event.source_type === "manual" ||
                                  (event.deletable &&
                                    !isPerformance &&
                                    !isStudyPlan &&
                                    !isFixedLesson &&
                                    !isMovedFixedLesson &&
                                    !isMakeup &&
                                    !isLessonRecord);
                                const originalLessonTimeId =
                                  event.original_lesson_time_id ||
                                  event.source_id ||
                                  "";
                                const originalEventDate =
                                  event.original_event_date || event.event_date;
                                const originalEventTime = normalizeTime(
                                  event.event_time,
                                );
                                const lessonRound =
                                  lessonRoundByEventId.get(event.id);
                                const lessonRoundMonthLabel =
                                  lessonRound === 1
                                    ? lessonMonthSettings.find(
                                        (item) =>
                                          event.event_date >= item.startDate &&
                                          event.event_date <= item.endDate,
                                      )?.label
                                    : null;

                                const eventCard = (
                                  <div
                                    className={`rounded-none border px-2 py-1 text-[11px] font-bold leading-snug ${
                                      EVENT_TYPE_STYLES[type] ||
                                      EVENT_TYPE_STYLES.기타
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span className="min-w-0 flex-1 truncate">
                                        {calendarEventTitle(event)}
                                      </span>
                                      {lessonRound && (
                                        <span className="ml-auto shrink-0 rounded-none border border-[#d4d4d4] bg-[#171717] px-2 py-1 text-[11px] font-black leading-none text-white shadow-sm">
                                          {lessonRoundMonthLabel
                                            ? `${lessonRoundMonthLabel.replace(" 수업", "")} ${lessonRound}회차`
                                            : `${lessonRound}회차`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );

                                if (
                                  isPerformance ||
                                  isStudyPlan ||
                                  isSettlementFeedback ||
                                  (isTeacher &&
                                    (event.deletable ||
                                      event.link_url ||
                                      isFixedLesson ||
                                      isMovedFixedLesson ||
                                      isMakeup ||
                                      isLessonRecord))
                                ) {
                                  return (
                                    <details key={event.id} className="group">
                                      <summary className="list-none cursor-pointer">
                                        {eventCard}
                                      </summary>

                                      <div className="fixed left-1/2 top-24 z-50 max-h-[88vh] w-[min(94vw,760px)] -translate-x-1/2 overflow-auto rounded-[2rem] border border-[#e5e5e5] bg-white p-4 shadow-2xl sm:p-5">
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-xs font-black text-[#171717]">
                                              {formatDueDate(event.event_date)}{" "}
                                              {normalizeTime(event.event_time)}
                                            </p>
                                            <h3 className="mt-1 text-lg font-black text-[#171717]">
                                              {calendarEventTitle(event)}
                                            </h3>
                                            <p className="mt-1 text-xs font-semibold text-[#525252]">
                                              {type} 일정
                                            </p>
                                          </div>
                                          <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-black text-[#171717]">
                                            다시 누르면 닫힘
                                          </span>
                                        </div>

                                        {isTeacher &&
                                          (type === "수업" ||
                                            type === "추가수업" ||
                                            type === "보강수업" ||
                                            type === "직전보강") && (
                                            <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-3">
                                              {event.link_url ? (
                                                <Link
                                                  href={event.link_url}
                                                  className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white"
                                                >
                                                  수업기록 연결
                                                </Link>
                                              ) : (
                                                <Link
                                                  href={`/students/${id}/records/new?date=${event.event_date}&start=${normalizeTime(event.event_time)}&type=${encodeURIComponent(type)}&sourceType=${event.source_type || "calendar"}&sourceId=${event.source_id || ""}`}
                                                  className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white"
                                                >
                                                  수업기록 추가
                                                </Link>
                                              )}
                                              <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#525252]">
                                                날짜 {event.event_date} · 시작{" "}
                                                {normalizeTime(
                                                  event.event_time,
                                                ) || "미입력"}
                                              </span>
                                            </div>
                                          )}

                                        {isTeacher &&
                                          isSettlementFeedback &&
                                          event.source_id && (
                                            <div className="rounded-2xl bg-[#ffffff] p-3">
                                              <p className="mb-2 text-xs font-black text-[#171717]">
                                                피드백일 수정/삭제
                                              </p>
                                              <form
                                                action={
                                                  updateSettlementFeedbackFromCalendar
                                                }
                                                className="grid gap-2 sm:grid-cols-[1fr_auto]"
                                              >
                                                <input
                                                  type="hidden"
                                                  name="settlement_id"
                                                  value={event.source_id}
                                                />
                                                <input
                                                  type="date"
                                                  name="feedback_date"
                                                  defaultValue={
                                                    event.event_date
                                                  }
                                                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                                />
                                                <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                                  수정 저장
                                                </button>
                                              </form>
                                              <form
                                                action={
                                                  deleteSettlementFeedbackFromCalendar
                                                }
                                                className="mt-2"
                                              >
                                                <input
                                                  type="hidden"
                                                  name="settlement_id"
                                                  value={event.source_id}
                                                />
                                                <button className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]">
                                                  피드백일 삭제
                                                </button>
                                              </form>
                                            </div>
                                          )}

                                        {isFixedLesson && event.source_id && (
                                          <div className="rounded-2xl bg-[#ffffff] p-3">
                                            <p className="mb-2 text-xs font-black text-[#171717]">
                                              이 날짜의 고정수업만 수정/삭제
                                            </p>
                                            <form
                                              action={moveFixedLessonOccurrence}
                                              className="grid gap-2 sm:grid-cols-4"
                                            >
                                              <input
                                                type="hidden"
                                                name="lesson_time_id"
                                                value={event.source_id}
                                              />
                                              <input
                                                type="hidden"
                                                name="original_event_date"
                                                value={event.event_date}
                                              />
                                              <input
                                                type="date"
                                                name="new_event_date"
                                                defaultValue={event.event_date}
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="new_event_time"
                                                defaultValue={normalizeTime(
                                                  event.event_time,
                                                )}
                                                placeholder="시간"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="memo"
                                                defaultValue={event.memo || ""}
                                                placeholder="메모"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                                수정 저장
                                              </button>
                                            </form>
                                            <form
                                              action={
                                                cancelFixedLessonOccurrence
                                              }
                                              className="mt-2"
                                            >
                                              <input
                                                type="hidden"
                                                name="lesson_time_id"
                                                value={event.source_id}
                                              />
                                              <input
                                                type="hidden"
                                                name="original_event_date"
                                                value={event.event_date}
                                              />
                                              <input
                                                type="hidden"
                                                name="original_event_time"
                                                value={normalizeTime(
                                                  event.event_time,
                                                )}
                                              />
                                              <button className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]">
                                                이 날짜 수업 삭제
                                              </button>
                                            </form>
                                          </div>
                                        )}

                                        {isMovedFixedLesson && (
                                          <div className="rounded-2xl bg-[#ffffff] p-3">
                                            <p className="mb-2 text-xs font-black text-[#171717]">
                                              옮겨진 고정수업 수정/삭제
                                            </p>
                                            <form
                                              action={updateFixedLessonOverride}
                                              className="grid gap-2 sm:grid-cols-4"
                                            >
                                              <input
                                                type="hidden"
                                                name="event_id"
                                                value={event.id}
                                              />
                                              <input
                                                type="date"
                                                name="new_event_date"
                                                defaultValue={event.event_date}
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="new_event_time"
                                                defaultValue={normalizeTime(
                                                  event.event_time,
                                                )}
                                                placeholder="시간"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="memo"
                                                defaultValue={event.memo || ""}
                                                placeholder="메모"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                                수정 저장
                                              </button>
                                            </form>
                                            <form
                                              action={
                                                cancelMovedFixedLessonOccurrence
                                              }
                                              className="mt-2"
                                            >
                                              <input
                                                type="hidden"
                                                name="event_id"
                                                value={event.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="lesson_time_id"
                                                value={originalLessonTimeId}
                                              />
                                              <input
                                                type="hidden"
                                                name="original_event_date"
                                                value={originalEventDate}
                                              />
                                              <input
                                                type="hidden"
                                                name="original_event_time"
                                                value={originalEventTime}
                                              />
                                              <button className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]">
                                                이 수업 삭제
                                              </button>
                                            </form>
                                          </div>
                                        )}

                                        {isLessonRecord && event.source_id && (
                                          <div className="rounded-2xl bg-[#ffffff] p-3">
                                            <p className="mb-2 text-xs font-black text-[#171717]">
                                              수업기록 날짜/시작시간 수정
                                            </p>
                                            <form
                                              action={
                                                updateLessonRecordFromCalendar
                                              }
                                              className="grid gap-2 sm:grid-cols-4"
                                            >
                                              <input
                                                type="hidden"
                                                name="record_id"
                                                value={event.source_id}
                                              />
                                              <input
                                                type="date"
                                                name="lesson_date"
                                                defaultValue={event.event_date}
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="start_time"
                                                defaultValue={normalizeTime(
                                                  event.event_time,
                                                )}
                                                placeholder="시작 시간"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <Link
                                                href={
                                                  event.link_url ||
                                                  `/students/${id}/records/${event.source_id}/edit`
                                                }
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-center text-xs font-black text-[#171717]"
                                              >
                                                기록 열기
                                              </Link>
                                              <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                                수정 저장
                                              </button>
                                            </form>
                                            <form
                                              action={deleteLessonRecord}
                                              className="mt-2"
                                            >
                                              <input
                                                type="hidden"
                                                name="record_id"
                                                value={event.source_id}
                                              />
                                              <button
                                                type="submit"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                              >
                                                이 수업기록 삭제
                                              </button>
                                            </form>
                                          </div>
                                        )}

                                        {isMakeup && event.source_id && (
                                          <form
                                            action={
                                              updateMakeupLessonFromCalendar
                                            }
                                            className="grid gap-2 rounded-2xl bg-[#ffffff] p-3 sm:grid-cols-4"
                                          >
                                            <input
                                              type="hidden"
                                              name="makeup_id"
                                              value={event.source_id}
                                            />
                                            <input
                                              type="date"
                                              name="makeup_date"
                                              defaultValue={event.event_date}
                                              className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <input
                                              name="makeup_time"
                                              defaultValue={normalizeTime(
                                                event.event_time,
                                              )}
                                              placeholder="시간"
                                              className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <input
                                              name="memo"
                                              defaultValue={event.memo || ""}
                                              placeholder="메모"
                                              className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                              보강 수정
                                            </button>
                                          </form>
                                        )}

                                        {isManualEvent && (
                                          <div className="rounded-2xl bg-[#f5f5f5] p-3">
                                            <p className="mb-2 text-xs font-black text-[#171717]">
                                              직접 추가한 일정 수정/삭제
                                            </p>
                                            <form
                                              action={updateCalendarEvent}
                                              className="grid gap-2 sm:grid-cols-6"
                                            >
                                              <input
                                                type="hidden"
                                                name="event_id"
                                                value={event.id}
                                              />
                                              <input
                                                type="date"
                                                name="event_date"
                                                defaultValue={event.event_date}
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <input
                                                name="event_time"
                                                defaultValue={normalizeTime(
                                                  event.event_time,
                                                )}
                                                placeholder="시간"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <select
                                                name="event_type"
                                                defaultValue={event.event_type}
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              >
                                                <option value="시험">
                                                  시험
                                                </option>
                                                <option value="중간고사">
                                                  중간고사
                                                </option>
                                                <option value="기말고사">
                                                  기말고사
                                                </option>
                                                <option value="기타">
                                                  기타
                                                </option>
                                                <option value="수업">
                                                  수업
                                                </option>
                                                <option value="추가수업">
                                                  추가수업
                                                </option>
                                                <option value="보강수업">
                                                  보강수업
                                                </option>
                                                <option value="직전보강">
                                                  직전보강
                                                </option>
                                                <option value="수행평가">
                                                  수행평가
                                                </option>
                                              </select>
                                              <select
                                                name="subject"
                                                defaultValue={
                                                  event.subject || ""
                                                }
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              >
                                                <option value="">
                                                  과목 없음
                                                </option>
                                                {SUBJECTS.map((subject) => (
                                                  <option
                                                    key={subject}
                                                    value={subject}
                                                  >
                                                    {subject}
                                                  </option>
                                                ))}
                                              </select>
                                              <input
                                                name="title"
                                                defaultValue={event.title}
                                                placeholder="일정 이름(추가수업은 비워도 됨)"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none"
                                              />
                                              <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                                                수정 저장
                                              </button>
                                              <input
                                                name="memo"
                                                defaultValue={event.memo || ""}
                                                placeholder="메모"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-bold outline-none sm:col-span-5"
                                              />
                                            </form>
                                            <form
                                              action={deleteCalendarEvent}
                                              className="mt-2"
                                            >
                                              <input
                                                type="hidden"
                                                name="event_id"
                                                value={event.id}
                                              />
                                              <button
                                                type="submit"
                                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                              >
                                                삭제
                                              </button>
                                            </form>
                                          </div>
                                        )}

                                        {isStudyPlan &&
                                          event.source_id &&
                                          (() => {
                                            const plan = studyPlans.find(
                                              (item) =>
                                                item.id === event.source_id,
                                            );

                                            if (!plan) return null;

                                            return (
                                              <div className="rounded-2xl bg-[#f7fcff] p-3">
                                                <p className="mb-2 text-xs font-black text-[#404040]">
                                                  공부 계획 수정/삭제
                                                </p>
                                                <form
                                                  action={updateStudyPlan}
                                                  className="grid gap-2 sm:grid-cols-6"
                                                >
                                                  <input
                                                    type="hidden"
                                                    name="plan_id"
                                                    value={plan.id}
                                                  />
                                                  <select
                                                    name="plan_type"
                                                    defaultValue={
                                                      plan.plan_type
                                                    }
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                                  >
                                                    <option value="date">
                                                      날짜 기준
                                                    </option>
                                                    <option value="week">
                                                      주 기준
                                                    </option>
                                                  </select>
                                                  <input
                                                    type="date"
                                                    name="due_date"
                                                    defaultValue={
                                                      plan.due_date || ""
                                                    }
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                                  />
                                                  <select
                                                    name="week_number"
                                                    defaultValue={String(
                                                      plan.week_number || 1,
                                                    )}
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                                  >
                                                    {[1, 2, 3, 4, 5, 6].map(
                                                      (num) => (
                                                        <option
                                                          key={num}
                                                          value={num}
                                                        >
                                                          {num}째주
                                                        </option>
                                                      ),
                                                    )}
                                                  </select>
                                                  <select
                                                    name="selected_task"
                                                    defaultValue={
                                                      plan.progress_id &&
                                                      plan.subject &&
                                                      plan.unit_name &&
                                                      plan.task_name
                                                        ? `${plan.progress_id}|||${plan.subject}|||${plan.unit_name}|||${plan.task_name}`
                                                        : ""
                                                    }
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none sm:col-span-2"
                                                  >
                                                    <option value="">
                                                      시험범위 항목 선택
                                                    </option>
                                                    {incompleteExamItems.map(
                                                      (item) => (
                                                        <option
                                                          key={item.value}
                                                          value={item.value}
                                                        >
                                                          {item.label}
                                                        </option>
                                                      ),
                                                    )}
                                                  </select>
                                                  <input
                                                    name="title"
                                                    defaultValue={
                                                      plan.title || ""
                                                    }
                                                    placeholder="직접 계획명"
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none"
                                                  />
                                                  <input
                                                    name="memo"
                                                    defaultValue={
                                                      plan.memo || ""
                                                    }
                                                    placeholder="메모"
                                                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-bold outline-none sm:col-span-5"
                                                  />
                                                  <button className="rounded-xl bg-[#404040] px-3 py-2 text-xs font-black text-white">
                                                    수정 저장
                                                  </button>
                                                </form>
                                                <form
                                                  action={deleteStudyPlan}
                                                  className="mt-2"
                                                >
                                                  <input
                                                    type="hidden"
                                                    name="plan_id"
                                                    value={plan.id}
                                                  />
                                                  <button className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-black text-[#404040]">
                                                    삭제
                                                  </button>
                                                </form>
                                              </div>
                                            );
                                          })()}

                                        {isPerformance && event.source_id && (
                                          <div className="flex flex-wrap gap-1 rounded-2xl bg-[#ffffff] p-3">
                                            {Object.entries(
                                              PERFORMANCE_STATUS_LABELS,
                                            ).map(([value, label]) => (
                                              <form
                                                key={value}
                                                action={
                                                  updatePerformanceStatusFromCalendar
                                                }
                                              >
                                                <input
                                                  type="hidden"
                                                  name="task_id"
                                                  value={event.source_id || ""}
                                                />
                                                <input
                                                  type="hidden"
                                                  name="status"
                                                  value={value}
                                                />
                                                <button className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#171717]">
                                                  {label}
                                                </button>
                                              </form>
                                            ))}
                                          </div>
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
                  {showStudyPlans && (
                    <div className="min-h-[140px] border-t border-[#e5e5e5] bg-[#f7fcff] p-2">
                      <p className="mb-2 text-[11px] font-black text-[#404040]">
                        {weekIndex + 1}째주 계획
                      </p>
                      <div className="space-y-1">
                        {(weeklyStudyPlansByWeek[weekIndex + 1] || [])
                          .length === 0 ? (
                          <p className="text-[10px] font-semibold text-[#525252]">
                            계획 없음
                          </p>
                        ) : (
                          (weeklyStudyPlansByWeek[weekIndex + 1] || []).map(
                            (plan) => (
                              <details key={plan.id}>
                                <summary className="cursor-pointer list-none rounded-xl border border-[#d4d4d4] bg-white px-2 py-1 text-[11px] font-bold leading-snug text-[#404040]">
                                  {studyPlanCalendarTitle(plan)}
                                </summary>
                                <div className="fixed left-1/2 top-24 z-50 max-h-[88vh] w-[min(94vw,760px)] -translate-x-1/2 overflow-auto rounded-[2rem] border border-[#e5e5e5] bg-white p-4 shadow-2xl sm:p-5">
                                  <h3 className="mb-3 text-lg font-black text-[#171717]">
                                    공부 계획 수정
                                  </h3>
                                  <form
                                    action={updateStudyPlan}
                                    className="grid gap-2 md:grid-cols-6"
                                  >
                                    <input
                                      type="hidden"
                                      name="plan_id"
                                      value={plan.id}
                                    />
                                    <select
                                      name="plan_type"
                                      defaultValue={plan.plan_type}
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                                    >
                                      <option value="date">날짜 기준</option>
                                      <option value="week">주 기준</option>
                                    </select>
                                    <input
                                      type="date"
                                      name="due_date"
                                      defaultValue={plan.due_date || ""}
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <select
                                      name="week_number"
                                      defaultValue={String(
                                        plan.week_number || weekIndex + 1,
                                      )}
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                                    >
                                      {[1, 2, 3, 4, 5, 6].map((num) => (
                                        <option key={num} value={num}>
                                          {num}째주
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      name="selected_task"
                                      defaultValue={
                                        plan.progress_id &&
                                        plan.subject &&
                                        plan.unit_name &&
                                        plan.task_name
                                          ? `${plan.progress_id}|||${plan.subject}|||${plan.unit_name}|||${plan.task_name}`
                                          : ""
                                      }
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                                    >
                                      <option value="">
                                        시험범위 항목 선택
                                      </option>
                                      {incompleteExamItems.map((item) => (
                                        <option
                                          key={item.value}
                                          value={item.value}
                                        >
                                          {item.label}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      name="title"
                                      defaultValue={plan.title || ""}
                                      placeholder="직접 계획명"
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <input
                                      name="memo"
                                      defaultValue={plan.memo || ""}
                                      placeholder="메모"
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-5"
                                    />
                                    <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                                      저장
                                    </button>
                                  </form>
                                  <form
                                    action={deleteStudyPlan}
                                    className="mt-2"
                                  >
                                    <input
                                      type="hidden"
                                      name="plan_id"
                                      value={plan.id}
                                    />
                                    <button className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]">
                                      삭제
                                    </button>
                                  </form>
                                </div>
                              </details>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isTeacher && (
            <details className="mt-5 rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-4">
              <summary className="cursor-pointer text-sm font-black text-[#171717]">
                일정 직접 추가
              </summary>

              <form
                action={addCalendarEvent}
                className="mt-4 grid gap-2 md:grid-cols-6"
              >
                <input
                  type="date"
                  name="event_date"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />
                <input
                  name="event_time"
                  placeholder="시간"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />
                <select
                  name="event_type"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="시험">시험</option>
                  <option value="중간고사">중간고사</option>
                  <option value="기말고사">기말고사</option>
                  <option value="기타">기타</option>
                  <option value="수업">수업</option>
                  <option value="추가수업">추가수업</option>
                  <option value="보강수업">보강수업</option>
                  <option value="직전보강">직전보강</option>
                  <option value="수행평가">수행평가</option>
                </select>
                <select
                  name="subject"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
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
                  placeholder="일정 이름(추가수업은 비워도 됨)"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white"
                >
                  추가
                </button>
                <input
                  name="memo"
                  placeholder="메모"
                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-6"
                />
              </form>
            </details>
          )}

          <div className="mt-4 rounded-3xl border border-[#d4d4d4] bg-[#f7fcff] p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-black text-[#404040]">공부 계획</h3>
                <p className="mt-1 text-xs font-semibold text-[#525252]">
                  시험범위 진도표를 과목별로 확인하고, 필요한 항목을 날짜/주차
                  기준 계획으로 저장해요.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <details>
                  <summary className="w-fit cursor-pointer list-none rounded-full bg-[#404040] px-3 py-1.5 text-xs font-black text-white">
                    + 공부 계획 추가
                  </summary>

                  <form
                    action={addStudyPlan}
                    className="fixed left-1/2 top-20 z-50 max-h-[92vh] w-[min(94vw,980px)] -translate-x-1/2 overflow-auto rounded-[2rem] border border-[#e5e5e5] bg-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] bg-[#ffffff] px-6 py-5">
                      <div>
                        <p className="text-sm font-black text-[#404040]">
                          공부 계획 추가
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-[#171717]">
                          시험범위표에서 선택하기
                        </h2>
                        <p className="mt-2 text-sm text-[#525252]">
                          시험범위 진도표를 과목별로 그대로 불러와요.
                          미완료·진행중·예정 항목을 선택해 공부계획으로 저장할
                          수 있어요.
                        </p>
                      </div>
                      <span className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-black text-[#171717]">
                        다시 누르면 닫힘
                      </span>
                    </div>

                    <div className="grid gap-2 border-b border-[#e5e5e5] bg-white px-6 py-4 md:grid-cols-6">
                      <select
                        name="plan_type"
                        className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="date">날짜 기준</option>
                        <option value="week">주 기준</option>
                      </select>

                      <input
                        type="date"
                        name="due_date"
                        className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none"
                      />

                      <select
                        name="week_number"
                        className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>
                            {num}째주까지
                          </option>
                        ))}
                      </select>

                      <input
                        name="title"
                        placeholder="직접 계획명"
                        className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                      />

                      <button
                        type="submit"
                        className="rounded-xl bg-[#404040] px-3 py-2 text-sm font-black text-white"
                      >
                        저장
                      </button>

                      <input
                        name="memo"
                        placeholder="메모"
                        className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none md:col-span-6"
                      />
                    </div>

                    <div className="max-h-[58vh] overflow-auto p-6">
                      {examRows.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-8 text-center text-sm font-bold text-[#525252]">
                          아직 시험범위 진도표에 등록된 항목이 없어요.
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(studyPlanPickerRowsBySubject).map(
                            ([subject, rows]) => {
                              const taskNames =
                                studyPlanTaskNamesBySubject[subject] || [];

                              if (taskNames.length === 0) return null;

                              return (
                                <div key={subject}>
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="text-sm font-black text-[#404040]">
                                      {subjectEmoji(subject)} {subject}
                                    </p>
                                    <span className="rounded-full bg-[#e8f5ee] px-3 py-1 text-[11px] font-black text-[#404040]">
                                      범위 {rows.length}개
                                    </span>
                                  </div>

                                  <table className="w-full min-w-[980px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-[#e5e5e5] text-sm">
                                    <thead>
                                      <tr className="bg-[#f7f7f7] text-[#5c5751]">
                                        <th className="sticky left-0 z-20 w-[300px] border-b border-r border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 text-left font-black">
                                          시험범위
                                        </th>

                                        {taskNames.map((taskName) => (
                                          <th
                                            key={taskName}
                                            className="min-w-[128px] border-b border-r border-[#e5e5e5] px-3 py-3 text-center font-black last:border-r-0"
                                          >
                                            {taskName}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {rows.map((row) => {
                                        const statuses = parseStatuses(
                                          row.statuses,
                                        );

                                        return (
                                          <tr key={row.id} className="bg-white">
                                            <td className="sticky left-0 z-10 border-r border-t border-[#e5e5e5] bg-white px-4 py-3 align-top">
                                              <p className="break-words text-sm font-black leading-5 text-[#171717]">
                                                {examProgressFullTitle(row)}
                                              </p>

                                              <div className="mt-2 flex flex-wrap gap-1">
                                                {row.publisher && (
                                                  <span className="rounded-full bg-[#f7f7f7] px-2 py-0.5 text-[10px] font-black text-[#525252]">
                                                    {row.publisher}
                                                  </span>
                                                )}
                                                {row.material_name && (
                                                  <span className="rounded-full bg-[#ffffff] px-2 py-0.5 text-[10px] font-black text-[#525252]">
                                                    {row.material_name}
                                                  </span>
                                                )}
                                                {row.major_unit && (
                                                  <span className="rounded-full bg-[#f7fcff] px-2 py-0.5 text-[10px] font-black text-[#404040]">
                                                    {row.major_unit}
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            {taskNames.map((taskName) => {
                                              const rawStatus =
                                                statuses[taskName];
                                              const normalizedStatus = String(
                                                rawStatus || "",
                                              );
                                              const canSelect =
                                                rawStatus !== undefined &&
                                                STUDY_PLAN_SELECTABLE_STATUSES.includes(
                                                  normalizedStatus,
                                                );

                                              return (
                                                <td
                                                  key={`${row.id}-${taskName}`}
                                                  className="border-r border-t border-[#e5e5e5] px-3 py-3 text-center align-middle last:border-r-0"
                                                >
                                                  {rawStatus === undefined ? (
                                                    <span className="text-xs font-bold text-[#d1c1c7]">
                                                      -
                                                    </span>
                                                  ) : canSelect ? (
                                                    <label className="block cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        name="selected_tasks"
                                                        value={makeStudyPlanTaskValue(
                                                          row.id,
                                                          row.subject,
                                                          examProgressFullTitle(
                                                            row,
                                                          ),
                                                          taskName,
                                                        )}
                                                        className="peer sr-only"
                                                      />
                                                      <span
                                                        className={`block rounded-2xl border px-3 py-2 text-xs font-black transition peer-checked:border-[#404040] peer-checked:bg-[#e8f5ee] peer-checked:text-[#404040] ${studyPlanStatusStyle(
                                                          normalizedStatus,
                                                        )}`}
                                                      >
                                                        {studyPlanStatusLabel(
                                                          normalizedStatus,
                                                        )}
                                                      </span>
                                                    </label>
                                                  ) : (
                                                    <span
                                                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${studyPlanStatusStyle(
                                                        normalizedStatus,
                                                      )}`}
                                                    >
                                                      {studyPlanStatusLabel(
                                                        normalizedStatus,
                                                      )}
                                                    </span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-[#e5e5e5] bg-[#ffffff] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-bold text-[#525252]">
                        선택한 항목은 각각 공부 계획으로 저장돼요.
                      </p>

                      <button
                        type="submit"
                        className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
                      >
                        선택 항목 저장
                      </button>
                    </div>
                  </form>
                </details>

                <Link
                  href={planToggleHref}
                  className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${
                    showStudyPlans
                      ? "border-[#404040] bg-[#404040] text-white"
                      : "border-[#d4d4d4] bg-white text-[#404040]"
                  }`}
                >
                  {showStudyPlans ? "✓ 캘린더 표시 중" : "캘린더에 표시"}
                </Link>
              </div>
            </div>

            {studyPlans.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {studyPlans.slice(0, 8).map((plan) => (
                  <span
                    key={plan.id}
                    className="rounded-full border border-[#d4d4d4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#404040]"
                  >
                    {plan.plan_type === "week"
                      ? `${plan.week_number}째주`
                      : formatDueDate(plan.due_date)}{" "}
                    · {studyPlanCalendarTitle(plan)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          id="performance-section"
          className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-xl font-black">수행평가 관리</h2>
            <p className="mt-1 text-sm text-[#525252]">
              완성 처리한 수행평가는 여기서는 사라지고, 캘린더에는 남아요.
            </p>
          </div>

          <details className="mb-5 rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-4">
            <summary className="cursor-pointer text-sm font-black text-[#171717]">
              수행평가 추가
            </summary>

            <form
              action={addPerformanceTask}
              className="mt-4 grid gap-2 md:grid-cols-6"
            >
              <select
                name="subject"
                defaultValue="선택안함"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
              >
                {PERFORMANCE_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              <input
                name="custom_subject"
                placeholder="직접입력 과목"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
              />

              <input
                name="title"
                placeholder="수행평가 이름"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
              />

              <input
                type="date"
                name="due_date"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
              />

              <input
                name="due_time"
                placeholder="시간"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
              />

              <button
                type="submit"
                className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white"
              >
                추가
              </button>

              <input
                name="memo"
                placeholder="메모"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-3"
              />
            </form>
          </details>

          <div className="space-y-3">
            {visiblePerformanceTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-6 text-sm font-semibold text-[#525252]">
                진행 중인 수행평가가 없어요.
              </div>
            ) : (
              visiblePerformanceTasks.map((task) => {
                const urgent = urgentDueLabel(task.due_date);

                return (
                  <article
                    key={task.id}
                    className="relative rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-4 pr-20"
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1">
                      <details className="relative">
                        <summary className="cursor-pointer list-none rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-[10px] font-black leading-none text-[#171717]">
                          수정
                        </summary>
                        <div className="fixed left-1/2 top-28 z-50 max-h-[88vh] w-[min(94vw,760px)] -translate-x-1/2 overflow-auto rounded-[2rem] border border-[#e5e5e5] bg-white p-4 shadow-2xl sm:p-5">
                          <form
                            action={updatePerformanceTask}
                            className="grid gap-2 md:grid-cols-6"
                          >
                            <input
                              type="hidden"
                              name="task_id"
                              value={task.id}
                            />
                            <select
                              name="subject"
                              defaultValue={
                                PERFORMANCE_SUBJECTS.includes(task.subject)
                                  ? task.subject
                                  : "직접입력"
                              }
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                            >
                              {PERFORMANCE_SUBJECTS.map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                            <input
                              name="custom_subject"
                              defaultValue={
                                PERFORMANCE_SUBJECTS.includes(task.subject)
                                  ? ""
                                  : task.subject
                              }
                              placeholder="직접입력 과목"
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                            />
                            <input
                              name="title"
                              defaultValue={task.title}
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                            />
                            <input
                              type="date"
                              name="due_date"
                              defaultValue={task.due_date || ""}
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                            />
                            <input
                              name="due_time"
                              defaultValue={normalizeTime(task.due_time)}
                              placeholder="시간"
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                            />
                            <select
                              name="status"
                              defaultValue={task.status}
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                            >
                              {Object.entries(PERFORMANCE_STATUS_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            <input
                              name="memo"
                              defaultValue={task.memo || ""}
                              placeholder="메모"
                              className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                            />
                            <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                              저장
                            </button>
                          </form>
                        </div>
                      </details>
                      <form action={deletePerformanceTask} className="flex">
                        <input type="hidden" name="task_id" value={task.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-[10px] font-black leading-none text-[#171717]"
                        >
                          삭제
                        </button>
                      </form>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {task.subject && task.subject !== "선택안함" && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#171717]">
                              {task.subject}
                            </span>
                          )}
                          {urgent && (
                            <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-black text-[#171717]">
                              {urgent}
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${PERFORMANCE_STATUS_STYLES[task.status] || PERFORMANCE_STATUS_STYLES.not_started}`}
                          >
                            {PERFORMANCE_STATUS_LABELS[task.status] ||
                              task.status}
                          </span>
                        </div>

                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                          <span className="shrink-0 text-sm font-black text-[#171717]">
                            {formatDueDate(task.due_date)}{" "}
                            {normalizeTime(task.due_time)}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-base font-black text-[#171717]">
                            {task.title}
                          </p>
                        </div>

                        {task.memo && (
                          <p className="mt-1 truncate text-sm font-semibold text-[#525252]">
                            {task.memo}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {Object.entries(PERFORMANCE_STATUS_LABELS).map(
                          ([value, label]) => (
                            <form key={value} action={updatePerformanceStatus}>
                              <input
                                type="hidden"
                                name="task_id"
                                value={task.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value={value}
                              />
                              <button
                                type="submit"
                                className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                                  task.status === value
                                    ? "border-[#171717] bg-[#f5f5f5] text-[#171717]"
                                    : "border-[#e5e5e5] bg-white text-[#525252]"
                                }`}
                              >
                                {label}
                              </button>
                            </form>
                          ),
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section
          id="inline-exam-scope-section"
          className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-black">시험범위 진도표</h2>
              <p className="mt-1 text-sm text-[#525252]">
                진행상황을 바로 바꾸면 숙제 모아보기와 공부 계획에도 이어져요.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/students/${id}/exam-scope`}
                className="w-fit rounded-2xl border border-[#d4d4d4] bg-[#ffffff] px-4 py-2 text-sm font-black text-[#171717]"
              >
                전체 편집
              </Link>
              {isTeacher && examRows.length > 0 && (
                <form action={resetExamProgressRows}>
                  <button
                    type="submit"
                    className="w-fit rounded-2xl border border-[#d4d4d4] bg-white px-4 py-2 text-sm font-black text-[#171717]"
                  >
                    초기화
                  </button>
                </form>
              )}
            </div>
          </div>

          {examRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-6 text-sm font-semibold text-[#525252]">
              아직 등록된 시험범위가 없어요.
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(
                examRows.reduce<Record<string, ExamProgress[]>>((acc, row) => {
                  const key = row.subject || "과목 미입력";
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(row);
                  return acc;
                }, {}),
              ).map(([subject, rows]) => {
                const taskNames = collectTaskNamesInExamScopeOrder(rows);

                return (
                  <div
                    key={subject}
                    className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3">
                      <p className="text-sm font-black text-[#404040]">
                        {subjectEmoji(subject)} {subject}
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#525252]">
                        {rows.length}개 범위
                      </span>
                    </div>

                    <div className="overflow-x-auto bg-white">
                      <table className="w-full min-w-[820px] border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#f7f7f7] text-[#171717]">
                            <th className="w-[280px] border-b border-[#e5e5e5] px-3 py-2 text-left font-black">
                              범위
                            </th>
                            {taskNames.map((taskName) => (
                              <th
                                key={taskName}
                                className="border-b border-[#e5e5e5] px-2 py-2 text-center font-black"
                              >
                                {taskName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const statuses = parseStatuses(row.statuses);

                            return (
                              <tr key={row.id} className="align-top">
                                <td className="border-b border-[#e5e5e5] px-3 py-3 font-black text-[#171717]">
                                  <div className="break-words">
                                    {examProgressFullTitle(row)}
                                  </div>
                                </td>
                                {taskNames.map((taskName) => {
                                  const currentStatus =
                                    statuses[taskName] || "not_started";

                                  return (
                                    <td
                                      key={`${row.id}-${taskName}`}
                                      className="border-b border-[#e5e5e5] px-2 py-2"
                                    >
                                      <details>
                                        <summary
                                          className={`cursor-pointer list-none rounded-full border px-2.5 py-1 text-center text-[11px] font-black ${
                                            EXAM_STATUS_STYLES[currentStatus] ||
                                            EXAM_STATUS_STYLES.not_started
                                          }`}
                                        >
                                          {EXAM_STATUS_LABELS[currentStatus] ||
                                            currentStatus}
                                        </summary>
                                        <div className="mt-2 flex flex-wrap justify-center gap-1 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-2">
                                          {EXAM_STATUS_OPTIONS.map((status) => (
                                            <form
                                              key={status}
                                              action={
                                                updateExamProgressStatusFromDetail
                                              }
                                            >
                                              <input
                                                type="hidden"
                                                name="progress_id"
                                                value={row.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="task_name"
                                                value={taskName}
                                              />
                                              <input
                                                type="hidden"
                                                name="status"
                                                value={status}
                                              />
                                              <button
                                                className={`rounded-full border px-2 py-1 text-[10px] font-black ${
                                                  status === currentStatus
                                                    ? "border-[#171717] bg-[#f7f7f7] text-[#171717]"
                                                    : "border-[#e5e5e5] bg-white text-[#171717]"
                                                }`}
                                              >
                                                {EXAM_STATUS_LABELS[status]}
                                              </button>
                                            </form>
                                          ))}
                                        </div>
                                      </details>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <details
          id="weekly-plan-section"
          className="rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none text-lg font-black text-[#171717]">
            🗓️ 학생별 주간 시간표 펼치기
          </summary>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#525252]">
              요일과 시작/끝 시간을 입력하면 아이폰 캘린더처럼 시간 길이만큼
              박스로 떠. 1시간은 한 칸, 30분은 반 칸으로 보여.
            </p>
            <Link
              href={
                weeklyEditMode
                  ? `/students/${id}?month=${monthTextForUrl}${showStudyPlans ? "&showPlans=1" : ""}#weekly-plan-section`
                  : weeklyEditHref
              }
              className="rounded-2xl border border-[#e5e5e5] bg-[#ffffff] px-4 py-2 text-sm font-black text-[#171717]"
            >
              {weeklyEditMode ? "편집 닫기" : "편집"}
            </Link>
          </div>

          <form
            action={addWeeklyPlanBlock}
            className="mt-4 grid gap-3 rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4 md:grid-cols-8"
          >
            <div className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none md:col-span-2">
              <p className="mb-1 text-[11px] font-black text-[#525252]">
                요일 여러 개 선택 가능
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKLY_PLAN_DAYS.map((day) => (
                  <label
                    key={day}
                    className="inline-flex items-center gap-1 rounded-full bg-[#ffffff] px-2 py-1 text-xs font-black text-[#171717]"
                  >
                    <input
                      type="checkbox"
                      name="days"
                      value={day}
                      className="accent-[#171717]"
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <input
              type="time"
              step="60"
              name="start"
              defaultValue="10:00"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <input
              type="time"
              step="60"
              name="end"
              defaultValue="12:00"
              title="밤 12시는 00:00으로 입력하면 돼"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <select
              name="category"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            >
              {WEEKLY_PLAN_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              name="subject"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            >
              {WEEKLY_PLAN_SUBJECTS.map((subject) => (
                <option key={subject || "none"} value={subject}>
                  {subject || "소분류 없음"}
                </option>
              ))}
            </select>
            <input
              name="custom_subject"
              placeholder="직접입력"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <input
              name="memo"
              placeholder="메모"
              className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
            />
            <button className="rounded-2xl bg-[#171717] px-4 py-2 text-sm font-black text-white">
              추가
            </button>
          </form>

          <div className="mt-4 overflow-x-auto pb-4">
            <div className="grid min-w-[1120px] grid-cols-[116px_repeat(7,minmax(132px,1fr))] rounded-3xl border border-[#e5e5e5] bg-white text-xs">
              <div className="border-b border-r border-[#e5e5e5] bg-[#ffffff] px-4 py-2 text-center font-black text-[#171717]">
                시간
              </div>
              {WEEKLY_PLAN_DAYS.map((day) => (
                <div
                  key={day}
                  className="border-b border-r border-[#e5e5e5] bg-[#ffffff] px-3 py-2 text-center font-black text-[#171717] last:border-r-0"
                >
                  {day}
                </div>
              ))}

              <div
                className="relative border-r border-[#e5e5e5] bg-white"
                style={{
                  height: `${WEEKLY_PLAN_HOURS.length * WEEKLY_PLAN_ROW_HEIGHT}px`,
                }}
              >
                {WEEKLY_PLAN_HOURS.map((hour) => (
                  <div
                    key={`time-line-${hour}`}
                    className="border-b border-[#e5e5e5]"
                    style={{ height: `${WEEKLY_PLAN_ROW_HEIGHT}px` }}
                  />
                ))}
                {[...WEEKLY_PLAN_HOURS, WEEKLY_PLAN_END_HOUR].map((hour) => (
                  <div
                    key={`time-label-${hour}`}
                    className="absolute left-0 right-0 z-20 -translate-y-1/2 whitespace-nowrap bg-white/90 px-2 text-center text-[13px] font-black text-[#171717]"
                    style={{
                      top: `${(hour - WEEKLY_PLAN_START_HOUR) * WEEKLY_PLAN_ROW_HEIGHT}px`,
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {WEEKLY_PLAN_DAYS.map((day) => {
                const dayBlocks = weeklyBlocks.filter(
                  (block) => block.day === day,
                );
                return (
                  <div
                    key={day}
                    className="relative border-r border-[#e5e5e5] bg-white last:border-r-0"
                    style={{
                      height: `${WEEKLY_PLAN_HOURS.length * WEEKLY_PLAN_ROW_HEIGHT}px`,
                    }}
                  >
                    {WEEKLY_PLAN_HOURS.map((hour) => (
                      <div
                        key={`${day}-${hour}`}
                        className="border-b border-[#e5e5e5]"
                        style={{ height: `${WEEKLY_PLAN_ROW_HEIGHT}px` }}
                      />
                    ))}

                    {dayBlocks.map((block) => {
                      const startMinutes = timeToMinutes(block.start);
                      const endMinutes = timeToMinutes(block.end, {
                        midnightAsEnd: true,
                      });
                      const top =
                        (Math.max(
                          startMinutes - WEEKLY_PLAN_START_HOUR * 60,
                          0,
                        ) /
                          60) *
                        WEEKLY_PLAN_ROW_HEIGHT;
                      const height =
                        (Math.max(endMinutes - startMinutes, 10) / 60) *
                        WEEKLY_PLAN_ROW_HEIGHT;
                      const subjectLabel = weeklyBlockSubjectLabel(block);
                      const isIconOnly =
                        block.category === "이동" || block.category === "휴식";

                      if (isIconOnly) {
                        return (
                          <div
                            key={block.id}
                            className="absolute left-0 right-0 z-20 flex items-center justify-center overflow-visible text-center pointer-events-auto"
                            style={{ top: `${top}px`, height: `${height}px` }}
                          >
                            <span className="text-[22px] leading-none drop-shadow-sm">
                              {weeklyMoveEmoji(block)}
                            </span>
                            {weeklyEditMode && (
                              <div className="absolute bottom-1 right-1 flex items-center gap-1">
                                <a
                                  href={`#weekly-edit-${block.id}`}
                                  className="rounded-lg border border-[#e5e5e5] bg-white/90 px-1.5 py-0.5 text-[10px] font-black text-[#5c5751] shadow-sm"
                                >
                                  수정
                                </a>
                                <form action={deleteWeeklyPlanBlock}>
                                  <input
                                    type="hidden"
                                    name="block_id"
                                    value={block.id}
                                  />
                                  <button className="rounded-lg border border-[#e5e5e5] bg-white/90 px-1.5 py-0.5 text-[10px] font-black text-[#171717] shadow-sm">
                                    삭제
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const isShortBlock =
                        height <= WEEKLY_PLAN_ROW_HEIGHT * 0.6;
                      const categoryLabel = weeklyCategoryLabel(block.category);

                      return (
                        <div
                          key={block.id}
                          className={`absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-xl border shadow-sm ${isShortBlock ? "px-2 py-1" : "px-2.5 py-1.5"} ${weeklyBlockClass(block)}`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          {isShortBlock ? (
                            <div className="flex h-full min-h-0 flex-col justify-center gap-0.5">
                              <div className="flex min-w-0 items-center gap-1 text-[10px] font-black leading-none">
                                <span className="shrink-0 opacity-80">
                                  {block.start}
                                </span>
                                <span className="min-w-0 truncate text-[11px]">
                                  {categoryLabel}
                                  {subjectLabel ? ` · ${subjectLabel}` : ""}
                                </span>
                              </div>
                              {block.memo && (
                                <div className="line-clamp-1 text-[10.5px] font-extrabold leading-none opacity-90">
                                  {block.memo}
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="text-[10.5px] font-black leading-tight opacity-80">
                                {block.start} (
                                {formatDurationLabel(block.start, block.end)})
                              </div>
                              <div className="mt-0.5 text-[12.5px] font-black leading-tight">
                                {categoryLabel}
                                {subjectLabel ? ` · ${subjectLabel}` : ""}
                              </div>
                              {block.memo && (
                                <div className="mt-0.5 line-clamp-2 whitespace-normal break-words text-[11px] font-extrabold leading-tight opacity-90">
                                  {block.memo}
                                </div>
                              )}
                            </>
                          )}
                          {weeklyEditMode && (
                            <div className="absolute bottom-1 right-1 z-30 flex items-center gap-1">
                              <a
                                href={`#weekly-edit-${block.id}`}
                                className="rounded-lg border border-[#e5e5e5] bg-white px-1.5 py-0.5 text-[10px] font-black text-[#5c5751] shadow-sm"
                              >
                                수정
                              </a>
                              <form action={deleteWeeklyPlanBlock}>
                                <input
                                  type="hidden"
                                  name="block_id"
                                  value={block.id}
                                />
                                <button className="rounded-lg border border-[#e5e5e5] bg-white px-1.5 py-0.5 text-[10px] font-black text-[#171717] shadow-sm">
                                  삭제
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {weeklyEditMode && (
            <div className="mt-4 space-y-3 rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
              <p className="text-sm font-black text-[#5c5751]">
                시간표 항목 수정 / 삭제
              </p>
              {weeklyBlocks.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#e5e5e5] bg-white px-4 py-3 text-sm font-bold text-[#525252]">
                  수정할 항목이 없어.
                </p>
              ) : (
                weeklyBlocks.map((block) => (
                  <form
                    id={`weekly-edit-${block.id}`}
                    key={block.id}
                    action={updateWeeklyPlanBlock}
                    className="grid scroll-mt-24 gap-2 rounded-2xl border border-[#e5e5e5] bg-white p-3 md:grid-cols-[0.7fr_0.8fr_0.8fr_1fr_1fr_1fr_1.4fr_auto_auto]"
                  >
                    <input type="hidden" name="block_id" value={block.id} />
                    <select
                      name="day"
                      defaultValue={block.day}
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    >
                      {WEEKLY_PLAN_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      step="60"
                      name="start"
                      defaultValue={block.start}
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    />
                    <input
                      type="time"
                      step="60"
                      name="end"
                      defaultValue={block.end === "24:00" ? "00:00" : block.end}
                      title="밤 12시는 00:00으로 입력하면 돼"
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    />
                    <select
                      name="category"
                      defaultValue={weeklyCategoryLabel(block.category)}
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    >
                      {WEEKLY_PLAN_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <select
                      name="subject"
                      defaultValue={block.subject || ""}
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    >
                      {WEEKLY_PLAN_SUBJECTS.map((subject) => (
                        <option key={subject || "none"} value={subject}>
                          {subject || "소분류 없음"}
                        </option>
                      ))}
                    </select>
                    <input
                      name="custom_subject"
                      defaultValue={block.customSubject || ""}
                      placeholder="직접입력"
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    />
                    <input
                      name="memo"
                      defaultValue={block.memo || ""}
                      placeholder="메모"
                      className="rounded-xl border border-[#e5e5e5] px-2 py-2 text-xs font-bold"
                    />
                    <button className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white">
                      수정
                    </button>
                    <button
                      formAction={deleteWeeklyPlanBlock}
                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                    >
                      삭제
                    </button>
                  </form>
                ))
              )}
            </div>
          )}
        </details>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black">
                보강수업{" "}
                <span className="ml-2 rounded-full bg-[#f5f5f5] px-3 py-1 text-sm text-[#171717]">
                  미완료 {remainingMakeupCount}회
                </span>
              </h2>
              <details className="w-full md:w-auto">
                <summary className="ml-auto w-fit cursor-pointer list-none rounded-full bg-[#171717] px-3 py-1.5 text-xs font-black text-white shadow-sm">
                  + 보강 추가
                </summary>
                <div className="mt-3 rounded-[1.5rem] border border-[#e5e5e5] bg-[#ffffff] p-3">
                  <form
                    action={addMakeupLesson}
                    className="grid gap-2 md:grid-cols-5"
                  >
                    <input
                      type="date"
                      name="absent_date"
                      className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                    />
                    <input
                      type="date"
                      name="makeup_date"
                      title="보강일 미정이면 비워둬도 돼"
                      className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                    />
                    <input
                      name="makeup_time"
                      placeholder="보강 시간"
                      className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                    />
                    <input
                      name="memo"
                      placeholder="메모"
                      className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white"
                    >
                      저장
                    </button>
                  </form>
                </div>
              </details>
            </div>

            <div className="mt-4 space-y-3">
              {makeupLessons.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-6 text-sm font-semibold text-[#525252]">
                  등록된 보강수업이 없어요.
                </div>
              ) : (
                makeupLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`rounded-3xl border p-4 ${
                      lesson.is_done
                        ? "border-[#d7e7dc] bg-[#f7f7f7]"
                        : "border-[#e5e5e5] bg-[#f7f7f7]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap text-sm font-black text-[#171717]">
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-[#171717]">
                            결석일
                          </span>
                          <span className="shrink-0">
                            {formatDueDate(lesson.absent_date)}
                          </span>
                          <span className="shrink-0 text-[#171717]">→</span>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-[#171717]">
                            보강일
                          </span>
                          <span className="shrink-0 text-[#171717]">
                            {lesson.makeup_date
                              ? `${formatDueDate(lesson.makeup_date)} ${normalizeTime(lesson.makeup_time)}`.trim()
                              : "미정"}
                          </span>
                        </p>
                        {lesson.memo && (
                          <p className="mt-1 truncate text-sm font-semibold text-[#525252]">
                            {lesson.memo}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#171717]">
                            수정
                          </summary>
                          <div className="fixed left-1/2 top-28 z-50 max-h-[88vh] w-[min(94vw,760px)] -translate-x-1/2 overflow-auto rounded-[2rem] border border-[#e5e5e5] bg-white p-4 shadow-2xl sm:p-5">
                            <form
                              action={updateMakeupLesson}
                              className="grid gap-2 md:grid-cols-5"
                            >
                              <input
                                type="hidden"
                                name="makeup_id"
                                value={lesson.id}
                              />
                              <input
                                type="date"
                                name="absent_date"
                                defaultValue={lesson.absent_date}
                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                              />
                              <input
                                type="date"
                                name="makeup_date"
                                defaultValue={lesson.makeup_date || ""}
                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                              />
                              <input
                                name="makeup_time"
                                defaultValue={normalizeTime(lesson.makeup_time)}
                                placeholder="보강 시간"
                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                              />
                              <input
                                name="memo"
                                defaultValue={lesson.memo || ""}
                                placeholder="메모"
                                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                              />
                              <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                                저장
                              </button>
                            </form>
                          </div>
                        </details>

                        <form action={toggleMakeupDone}>
                          <input
                            type="hidden"
                            name="makeup_id"
                            value={lesson.id}
                          />
                          <input
                            type="hidden"
                            name="is_done"
                            value={String(lesson.is_done)}
                          />
                          <button
                            type="submit"
                            className={`rounded-full border px-3 py-1.5 text-xs font-black shadow-sm ${lesson.is_done ? "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]" : "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]"}`}
                          >
                            {lesson.is_done ? "미완료" : "완료"}
                          </button>
                        </form>

                        <form action={deleteMakeupLesson}>
                          <input
                            type="hidden"
                            name="makeup_id"
                            value={lesson.id}
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-black text-[#171717]"
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
          </section>

          <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">숙제 모아보기</h2>
                <p className="mt-1 text-sm text-[#525252]">
                  시험범위 진도표에서 진행상황이 숙제인 항목만 모아서 보여줘요.
                </p>
              </div>
            </div>

            {homeworkTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-6 text-sm font-semibold text-[#525252]">
                시험범위 진도표에서 숙제로 표시된 항목이 없어요.
              </div>
            ) : (
              <div className="grid gap-4">
                {groupBySubjectAndUnit(homeworkTasks).map(
                  ({ subject, units }) => (
                    <div
                      key={subject}
                      className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3">
                        <p className="min-w-0 text-sm font-black text-[#404040]">
                          {subjectEmoji(subject)} {subject}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#525252]">
                          {units.reduce(
                            (sum, unit) => sum + unit.rows.length,
                            0,
                          )}
                          개
                        </span>
                      </div>

                      <div className="divide-y divide-[#e5e5e5] bg-white">
                        {units.map((unit) => (
                          <div
                            key={`${subject}-${unitGroupKey(unit)}`}
                            className="px-4 py-3"
                          >
                            <p className="mb-2 text-xs font-black text-[#525252]">
                              {unitTitle(unit)}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {unit.rows.map((homework) => (
                                <span
                                  key={homework.id}
                                  className="rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-black text-[#171717]"
                                >
                                  {homework.taskName}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </section>

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black">수업기록</h2>
              <p className="mt-1 text-sm text-[#525252]">
                최근 수업 진도와 숙제를 확인해요.
              </p>
            </div>

            {isTeacher && (
              <Link
                href={`/students/${id}/records/new`}
                className="w-fit rounded-2xl bg-[#171717] px-4 py-3 text-center text-sm font-black text-white"
              >
                기록 추가
              </Link>
            )}
          </div>

          <div className="mb-5 w-full rounded-[1.5rem] border border-[#e5e5e5] bg-[#ffffff] px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs font-black text-[#525252]">
              <span>{formatLessonMonthLabel(month)} 진행률</span>
              <span className="text-[#171717]">
                {actualLessonCount}회 / {expectedLessonCount || 0}회
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-[#171717]"
                style={{ width: `${lessonProgressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-[#171717]">
              수업 기간 {settlementStartDate} ~ {settlementEndDate} 기준 · 남은{" "}
              {remainingLessonCount}회
            </p>
          </div>

          <details className="rounded-3xl border border-[#e5e5e5] bg-[#f7f7f7] p-4">
            <summary className="cursor-pointer list-none text-sm font-black text-[#171717]">
              수업기록 열기/닫기 · {lessonRecords.length}개
            </summary>

            {lessonRecords.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-[#e5e5e5] bg-white px-5 py-8 text-center text-sm font-semibold text-[#525252]">
                아직 수업기록이 없어요.
              </div>
            ) : (
              <div className="mt-4 space-y-5">
              {lessonRecords.map((record) => {
                const subjectRecords = Array.isArray(record.subject_records)
                  ? record.subject_records
                  : [];

                const checkedHomeworkItems = Array.isArray(
                  record.checked_homework_items,
                )
                  ? record.checked_homework_items
                  : [];

                return (
                  <article
                    key={record.id}
                    className="rounded-[2rem] border border-[#e5e5e5] bg-[#f7f7f7] p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-[#171717]">
                          {formatDate(record.lesson_date)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#525252]">
                          {formatTime(record.start_time, record.end_time)}
                          {record.duration_text
                            ? ` · ${record.duration_text}`
                            : ""}
                        </p>
                      </div>

                      {isTeacher && (
                        <div className="flex gap-2">
                          <Link
                            href={`/students/${id}/records/${record.id}/edit`}
                            className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-xs font-black text-[#171717]"
                          >
                            수정
                          </Link>

                          <form action={deleteLessonRecord}>
                            <input
                              type="hidden"
                              name="record_id"
                              value={record.id}
                            />
                            <button
                              type="submit"
                              className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-xs font-black text-[#171717]"
                            >
                              삭제
                            </button>
                          </form>
                        </div>
                      )}
                    </div>

                    {checkedHomeworkItems.length > 0 && (
                      <div className="mb-4 rounded-3xl border border-[#d4d4d4] bg-[#f7f7f7] p-4">
                        <p className="mb-2 text-xs font-black text-[#404040]">
                          저번 숙제 완료 확인
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {checkedHomeworkItems.map((item, index) => {
                            const deferred =
                              item.deferred ||
                              item.checked_status === "deferred";
                            return (
                              <span
                                key={`${item.progress_id}-${item.task_name}-${index}`}
                                className={`rounded-full border bg-white px-3 py-1 text-xs font-bold ${deferred ? "border-[#d4d4d4] text-[#404040]" : "border-[#d4d4d4] text-[#404040]"}`}
                              >
                                {deferred ? "미룬 숙제 · " : "완료 · "}
                                {taskText(item)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const progressRows: SummaryRow[] = subjectRecords.flatMap(
                        (subjectRecord) => {
                          const subject =
                            subjectRecord.subject || "과목 미입력";
                          const items = Array.isArray(
                            subjectRecord.progress_items,
                          )
                            ? subjectRecord.progress_items
                            : [];
                          if (items.length > 0) {
                            return items.map((item, itemIndex) => ({
                              id: `${subject}-progress-${item.progress_id}-${item.task_name}-${itemIndex}`,
                              subject,
                              text: taskText(item),
                              unitName:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.unitName || item.unit_name,
                              taskName: item.task_name,
                              publisher:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.publisher ?? item.publisher,
                              materialName:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.materialName ?? item.material_name,
                              majorUnit:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.majorUnit ?? item.major_unit,
                              progressId: item.progress_id,
                              source:
                                item.before_status === "manual" ||
                                item.unit_name === "직접입력" ||
                                item.unit_name === "기타" ||
                                String(item.progress_id || "").startsWith(
                                  "manual-",
                                )
                                  ? "manual"
                                  : "exam",
                              deferred:
                                item.deferred ||
                                item.checked_status === "deferred",
                              recordId: record.id,
                            }));
                          }
                          return subjectRecord.progress
                            ? [
                                {
                                  id: `${subject}-old-progress`,
                                  subject,
                                  text: subjectRecord.progress,
                                },
                              ]
                            : [];
                        },
                      );

                      const homeworkRows: SummaryRow[] = subjectRecords.flatMap(
                        (subjectRecord) => {
                          const subject =
                            subjectRecord.subject || "과목 미입력";
                          const items = Array.isArray(
                            subjectRecord.homework_items,
                          )
                            ? subjectRecord.homework_items
                            : [];
                          if (items.length > 0) {
                            return items.map((item, itemIndex) => ({
                              id: `${subject}-homework-${item.progress_id}-${item.task_name}-${itemIndex}`,
                              subject,
                              text: taskText(item),
                              unitName:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.unitName || item.unit_name,
                              taskName: item.task_name,
                              publisher:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.publisher ?? item.publisher,
                              materialName:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.materialName ?? item.material_name,
                              majorUnit:
                                examInfoById.get(String(item.progress_id || ""))
                                  ?.majorUnit ?? item.major_unit,
                              progressId: item.progress_id,
                              source:
                                item.before_status === "manual" ||
                                item.unit_name === "직접입력" ||
                                item.unit_name === "기타" ||
                                String(item.progress_id || "").startsWith(
                                  "manual-",
                                )
                                  ? "manual"
                                  : "exam",
                            }));
                          }
                          return subjectRecord.homework
                            ? [
                                {
                                  id: `${subject}-old-homework`,
                                  subject,
                                  text: subjectRecord.homework,
                                },
                              ]
                            : [];
                        },
                      );

                      const planRows: SummaryRow[] = subjectRecords.flatMap(
                        (subjectRecord) => {
                          const subject =
                            subjectRecord.subject || "과목 미입력";
                          const items = Array.isArray(subjectRecord.plan_items)
                            ? subjectRecord.plan_items
                            : [];
                          return items.map((item, itemIndex) => ({
                            id: `${subject}-plan-${item.progress_id}-${item.task_name}-${itemIndex}`,
                            subject,
                            text: taskText(item),
                            unitName:
                              examInfoById.get(String(item.progress_id || ""))
                                ?.unitName || item.unit_name,
                            taskName: item.task_name,
                            publisher:
                              examInfoById.get(String(item.progress_id || ""))
                                ?.publisher ?? item.publisher,
                            materialName:
                              examInfoById.get(String(item.progress_id || ""))
                                ?.materialName ?? item.material_name,
                            majorUnit:
                              examInfoById.get(String(item.progress_id || ""))
                                ?.majorUnit ?? item.major_unit,
                          }));
                        },
                      );

                      const renderTaskChips = (
                        rows: SummaryRow[],
                        tone: "progress" | "homework" | "plan",
                      ) => (
                        <div className="flex flex-wrap gap-2">
                          {rows.map((row) => {
                            const isManual =
                              row.source === "manual" ||
                              row.unitName === "직접입력" ||
                              row.unitName === "기타" ||
                              String(row.progressId || "").startsWith(
                                "manual-",
                              );
                            const isDone =
                              tone === "homework" &&
                              !isManual &&
                              currentTaskStatusMap.get(
                                `${row.progressId}::${row.taskName}`,
                              ) === "done";
                            const isDeferred =
                              tone === "homework" && Boolean(row.deferred);

                            return (
                              <div
                                key={row.id}
                                className="flex max-w-full items-center gap-2 rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm shadow-sm"
                              >
                                <span className="break-words text-sm font-black text-[#171717]">
                                  {summaryTaskLabel(row)}
                                </span>
                                {tone === "homework" && isDeferred && (
                                  <span className="shrink-0 rounded-full bg-[#f7f7f7] px-2.5 py-1 text-xs font-black text-[#404040]">
                                    다음수업으로 미룸
                                  </span>
                                )}
                                {tone === "homework" && isDone && (
                                  <span className="shrink-0 rounded-full bg-[#f7f7f7] px-2.5 py-1 text-xs font-black text-[#404040]">
                                    완료
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );

                      const renderSummaryBox = (
                        title: string,
                        rows: SummaryRow[],
                        tone: "progress" | "homework" | "plan",
                      ) => {
                        if (rows.length === 0) return null;

                        const toneClass =
                          tone === "homework"
                            ? "border-[#e5e5e5] bg-[#ffffff] text-[#171717]"
                            : tone === "plan"
                              ? "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]"
                              : "border-[#e5e5e5] bg-[#ffffff] text-[#171717]";

                        return (
                          <div
                            className={`overflow-hidden rounded-2xl border ${toneClass}`}
                          >
                            <div className="flex items-center justify-between border-b border-white/70 px-4 py-2">
                              <p className="text-xs font-black">{title}</p>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black">
                                {rows.length}개
                              </span>
                            </div>

                            <div className="space-y-3 p-3">
                              {groupBySubjectAndUnit(rows).map(
                                ({ subject, units }) => (
                                  <div
                                    key={`${title}-${subject}`}
                                    className="overflow-hidden rounded-2xl border border-white/80 bg-white/70"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-white px-3 py-2">
                                      <p className="min-w-0 text-xs font-black text-[#404040]">
                                        {subjectEmoji(subject)} {subject}
                                      </p>
                                      <span className="rounded-full bg-[#ffffff] px-2 py-0.5 text-[11px] font-black text-[#525252]">
                                        {units.reduce(
                                          (sum, unit) => sum + unit.rows.length,
                                          0,
                                        )}
                                        개
                                      </span>
                                    </div>

                                    <div className="divide-y divide-[#e5e5e5]">
                                      {units.map((unit) => (
                                        <div
                                          key={`${title}-${subject}-${unitGroupKey(unit)}`}
                                          className="grid gap-4 px-4 py-3 text-sm md:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.7fr)]"
                                        >
                                          <span className="break-words text-sm font-black text-[#525252]">
                                            {unitTitle(unit)}
                                          </span>
                                          {renderTaskChips(unit.rows, tone)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        );
                      };

                      if (
                        subjectRecords.length === 0 ||
                        (progressRows.length === 0 &&
                          homeworkRows.length === 0 &&
                          planRows.length === 0)
                      ) {
                        return (
                          <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-white px-5 py-6 text-sm font-semibold text-[#525252]">
                            과목별 기록이 없어요.
                          </div>
                        );
                      }

                      return (
                        <div className="grid gap-3 xl:grid-cols-3">
                          {renderSummaryBox(
                            "오늘 한 진도",
                            progressRows,
                            "progress",
                          )}
                          {renderSummaryBox(
                            "새로 낸 숙제",
                            homeworkRows,
                            "homework",
                          )}
                          {renderSummaryBox("다음 수업 계획", planRows, "plan")}
                        </div>
                      );
                    })()}

                    {(record.content || record.memo) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {record.content && (
                          <div className="rounded-3xl border border-[#e5e5e5] bg-white p-4">
                            <p className="mb-2 text-xs font-black text-[#171717]">
                              수업 내용
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-[#171717]">
                              {record.content}
                            </p>
                          </div>
                        )}

                        {record.memo && (
                          <div className="rounded-3xl border border-[#e5e5e5] bg-white p-4">
                            <p className="mb-2 text-xs font-black text-[#171717]">
                              메모
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-[#171717]">
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
          </details>
        </section>

      </div>
    </main>
  );
}
