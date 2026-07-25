import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CloseOnSubmitForm from "@/components/CloseOnSubmitForm";

type Student = {
  id: string;
  name: string;
  subject?: string | null;
  avatar_url?: string | null;
  exp_points?: number | null;
  level?: number | null;
};

type Settlement = {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  expected_lesson_count: number | null;
  actual_lesson_count_override?: number | null;
  total_fee_override?: number | null;
  feedback_date: string | null;
  feedback_done: boolean | null;
};

type LessonRecord = {
  id: string;
  student_id: string;
  lesson_date: string;
  start_time: string | null;
  end_time: string | null;
  is_extra?: boolean | null;
};

type LessonTime = {
  id: string;
  student_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  memo: string | null;
};

type MakeupLesson = {
  id: string;
  student_id: string;
  absent_date: string;
  makeup_date: string | null;
  makeup_time: string | null;
  is_done: boolean | null;
  memo: string | null;
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
  source_type: string | null;
  source_id: string | null;
  original_lesson_time_id?: string | null;
  original_event_date?: string | null;
};

type PersonalEvent = {
  id: string;
  event_date: string;
  event_time: string | null;
  end_time?: string | null;
  title: string;
  memo: string | null;
};

type PersonalDayEvent = {
  id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  title: string;
  memo: string | null;
};

type PersonalTodo = {
  id: string;
  due_date: string | null;
  title: string;
  is_done: boolean | null;
  created_at: string;
};

type LessonScheduleItem = {
  id: string;
  sourceType:
    | "fixed_lesson_time"
    | "makeup_lesson"
    | "student_event"
    | "lesson_record"
    | "personal_day_event";
  sourceId: string;
  studentId: string;
  studentName: string;
  date: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  title: string;
  eventType: "수업" | "보강수업" | "추가수업" | "직전보강" | "내 일정";
  memo?: string | null;
  color: string;
  eventSourceType?: string | null;
  originalLessonTimeId?: string | null;
  originalDate?: string | null;
};

type MonthlyEvent = {
  id: string;
  sourceType: "student_event" | "feedback" | "personal_event";
  sourceId: string;
  studentName: string;
  studentId: string;
  event_date: string;
  range_start?: string | null;
  range_end?: string | null;
  range_position?: "single" | "start" | "middle" | "end";
  event_time: string | null;
  end_time?: string | null;
  title: string;
  event_type: string;
  color: string;
  memo?: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    lessonMonth?: string;
    calendarMonth?: string;
    tab?: string;
  }>;
};

const WEEKDAYS_SUN = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_MON = ["월", "화", "수", "목", "금", "토", "일"];
const LESSON_EVENT_TYPES = ["수업", "보강수업", "추가수업", "직전보강"];
const PERFORMANCE_STATUS_OPTIONS = [
  ["not_started", "미완료"],
  ["in_progress", "진행중"],
  ["done", "완료"],
] as const;

const STUDENT_COLORS = [
  "border-l-[10px] border-[#8FCDD9] bg-[#EAF6F8] text-[#263236] shadow-[inset_0_0_0_1px_rgba(143,205,217,0.3)]",
  "border-l-[10px] border-[#A9C0D1] bg-[#EDF3F6] text-[#2c3338] shadow-[inset_0_0_0_1px_rgba(169,192,209,0.3)]",
  "border-l-[10px] border-[#C1B2C9] bg-[#F3EEF6] text-[#343038] shadow-[inset_0_0_0_1px_rgba(193,178,201,0.3)]",
  "border-l-[10px] border-[#D9A5C0] bg-[#F8EEF3] text-[#3b3036] shadow-[inset_0_0_0_1px_rgba(217,165,192,0.3)]",
  "border-l-[10px] border-[#E0B7BA] bg-[#F8EFEF] text-[#3b312f] shadow-[inset_0_0_0_1px_rgba(224,183,186,0.3)]",
  "border-l-[10px] border-[#E3C0B6] bg-[#F8F0EC] text-[#3d332f] shadow-[inset_0_0_0_1px_rgba(227,192,182,0.32)]",
  "border-l-[10px] border-[#F2C9A4] bg-[#FBF1E5] text-[#3c342b] shadow-[inset_0_0_0_1px_rgba(242,201,164,0.34)]",
  "border-l-[10px] border-[#EED9AD] bg-[#FBF6E7] text-[#3d392c] shadow-[inset_0_0_0_1px_rgba(238,217,173,0.36)]",
  "border-l-[10px] border-[#E6E6C4] bg-[#F8F8EC] text-[#383a2d] shadow-[inset_0_0_0_1px_rgba(230,230,196,0.36)]",
  "border-l-[10px] border-[#D2D9C8] bg-[#F3F5EC] text-[#33382f] shadow-[inset_0_0_0_1px_rgba(210,217,200,0.34)]",
  "border-l-[10px] border-[#ABD8D6] bg-[#EDF8F7] text-[#263634] shadow-[inset_0_0_0_1px_rgba(171,216,214,0.3)]",
  "border-l-[10px] border-[#CEC1C3] bg-[#F5F0F1] text-[#383232] shadow-[inset_0_0_0_1px_rgba(206,193,195,0.3)]",
];

const STUDENT_COLOR_OVERRIDES: Record<string, string> = {
  규리:
    "border-l-[10px] border-[#D9A5C0] bg-[#F8EEF3] text-[#3b3036] shadow-[inset_0_0_0_1px_rgba(217,165,192,0.3)]",
  서연:
    "border-l-[10px] border-[#8FCDD9] bg-[#EAF6F8] text-[#263236] shadow-[inset_0_0_0_1px_rgba(143,205,217,0.3)]",
  지후:
    "border-l-[10px] border-[#EED9AD] bg-[#FBF6E7] text-[#3d392c] shadow-[inset_0_0_0_1px_rgba(238,217,173,0.36)]",
  시연:
    "border-l-[10px] border-[#ABD8D6] bg-[#EDF8F7] text-[#263634] shadow-[inset_0_0_0_1px_rgba(171,216,214,0.3)]",
  승규:
    "border-l-[10px] border-[#C1B2C9] bg-[#F3EEF6] text-[#343038] shadow-[inset_0_0_0_1px_rgba(193,178,201,0.3)]",
  다은:
    "border-l-[10px] border-[#F2C9A4] bg-[#FBF1E5] text-[#3c342b] shadow-[inset_0_0_0_1px_rgba(242,201,164,0.34)]",
};

function getKstToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function getKstNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const rawHour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );

  return hour * 60 + minute;
}

function normalizeTime(time?: string | null) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

function timeToMinutes(time?: string | null) {
  const clean = normalizeTime(time);
  if (!clean) return null;

  const [hourText, minuteText] = clean.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function minutesToHeight(startTime?: string | null, endTime?: string | null) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 52;
  return Math.max(52, Math.min(180, Math.round((end - start) * 0.75)));
}

function formatTimeRange(start?: string | null, end?: string | null) {
  const cleanStart = normalizeTime(start);
  const cleanEnd = normalizeTime(end);
  if (cleanStart && cleanEnd) return `${cleanStart} - ${cleanEnd}`;
  if (cleanStart) return `${cleanStart} 시작`;
  return "시간 미입력";
}

function addHours(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return toDateText(date);
}

function toDateText(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getDayLabel(dateText: string) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  return WEEKDAYS_SUN[date.getDay()];
}

function getMonthStartEnd(todayText: string) {
  const today = new Date(`${todayText}T00:00:00+09:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toDateText(start),
    endDate: toDateText(end),
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  };
}

function getMonthDateFromParam(monthText: string | undefined, fallbackDateText: string) {
  if (monthText && /^\d{4}-\d{2}$/.test(monthText)) {
    return `${monthText}-01`;
  }

  return fallbackDateText;
}

function monthParamFromInfo(info: { year: number; month: number }) {
  return `${info.year}-${String(info.month).padStart(2, "0")}`;
}

function addMonthsToParam(monthText: string, amount: number) {
  const [year, month] = monthText.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthTitle(info: { year: number; month: number }) {
  return `${info.year}년 ${info.month}월`;
}

function getWeekStartEnd(todayText: string) {
  const today = new Date(`${todayText}T00:00:00+09:00`);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekStart: toDateText(monday),
    weekEnd: toDateText(sunday),
  };
}

function minDateText(...dates: string[]) {
  return dates.reduce((min, date) => (date < min ? date : min), dates[0]);
}

function maxDateText(...dates: string[]) {
  return dates.reduce((max, date) => (date > max ? date : max), dates[0]);
}

function makeWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addHours(weekStart, index));
}

function makeDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addHours(current, 1);
  }

  return dates;
}

function formatShortDate(dateText?: string | null) {
  if (!dateText) return "-";
  const date = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}/${WEEKDAYS_SUN[date.getDay()]}`;
}

function daysUntil(dateText?: string | null, todayText?: string) {
  if (!dateText || !todayText) return null;
  const target = new Date(`${dateText}T00:00:00+09:00`).getTime();
  const today = new Date(`${todayText}T00:00:00+09:00`).getTime();
  if (Number.isNaN(target) || Number.isNaN(today)) return null;
  return Math.round((target - today) / 86400000);
}

function deadlineBadge(dateText: string | null, todayText: string) {
  const diff = daysUntil(dateText, todayText);
  if (diff === null) return null;
  if (diff <= 0) return "🚨 오늘 마감";
  if (diff === 1) return "🚨 1일 남음";
  if (diff <= 3) return `${diff}일 남음`;
  return null;
}

function levelFromExp(exp?: number | null, level?: number | null) {
  if (level && level > 0) return level;
  return Math.floor((exp || 0) / 100) + 1;
}

function makeCalendarDaysMonday(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const firstDayIndex = firstDay.getDay();
  const startBlankCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = lastDay.getDate();

  const cells: Array<{
    dateText: string;
    day: number;
    isCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < startBlankCount; i++) {
    const date = new Date(year, month - 1, 1 - startBlankCount + i);
    cells.push({
      dateText: toDateText(date),
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateText: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      day,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const offset = cells.length - startBlankCount - daysInMonth + 1;
    const date = new Date(year, month, offset);
    cells.push({
      dateText: toDateText(date),
      day: date.getDate(),
      isCurrentMonth: false,
    });
  }

  return cells;
}

function getCalendarGridRange(year: number, month: number) {
  const days = makeCalendarDaysMonday(year, month);
  return {
    startDate: days[0].dateText,
    endDate: days[days.length - 1].dateText,
  };
}

function getStudentColor(studentId: string, students: Student[]) {
  const student = students.find((item) => item.id === studentId);
  const override = student?.name ? STUDENT_COLOR_OVERRIDES[student.name] : null;
  if (override) return override;

  const index = Math.max(
    0,
    students.findIndex((student) => student.id === studentId),
  );
  return STUDENT_COLORS[index % STUDENT_COLORS.length];
}

function getStudentName(studentId: string, students: Student[]) {
  return students.find((student) => student.id === studentId)?.name || "학생";
}

function getActiveSettlementPeriod(settlements: Settlement[], today: string) {
  const activeRows = settlements.filter(
    (settlement) =>
      settlement.start_date <= today && settlement.end_date >= today,
  );

  if (activeRows.length > 0) {
    const startDate = activeRows.reduce(
      (min, row) => (row.start_date < min ? row.start_date : min),
      activeRows[0].start_date,
    );
    const endDate = activeRows.reduce(
      (max, row) => (row.end_date > max ? row.end_date : max),
      activeRows[0].end_date,
    );

    return { startDate, endDate };
  }

  const monthInfo = getMonthStartEnd(today);
  return { startDate: monthInfo.startDate, endDate: monthInfo.endDate };
}

function calculateMonthElapsedProgress(today: string) {
  const monthInfo = getMonthStartEnd(today);
  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const lastDate = new Date(`${monthInfo.endDate}T00:00:00+09:00`);

  if (Number.isNaN(todayDate.getTime()) || Number.isNaN(lastDate.getTime())) {
    return { ...monthInfo, percent: 0 };
  }

  const elapsedDay = todayDate.getDate();
  const totalDays = lastDate.getDate();
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDay / totalDays) * 100)));

  return { ...monthInfo, elapsedDay, totalDays, percent };
}

function makeFixedLessonItems(
  lessonTimes: LessonTime[],
  students: Student[],
  dates: string[],
  hiddenFixedKeys: Set<string> = new Set(),
): LessonScheduleItem[] {
  return lessonTimes.flatMap((lessonTime) => {
    return dates
      .filter((dateText) => getDayLabel(dateText) === lessonTime.day_of_week)
      .filter((dateText) => !hiddenFixedKeys.has(`${lessonTime.id}::${dateText}`))
      .map((dateText) => ({
        id: `fixed-${lessonTime.id}-${dateText}`,
        sourceType: "fixed_lesson_time" as const,
        sourceId: lessonTime.id,
        studentId: lessonTime.student_id,
        studentName: getStudentName(lessonTime.student_id, students),
        date: dateText,
        dayLabel: getDayLabel(dateText),
        startTime: normalizeTime(lessonTime.start_time),
        endTime: normalizeTime(lessonTime.end_time),
        title: `${getStudentName(lessonTime.student_id, students)} 수업`,
        eventType: "수업" as const,
        memo: lessonTime.memo,
        color: getStudentColor(lessonTime.student_id, students),
        eventSourceType: "fixed_lesson_time",
        originalLessonTimeId: lessonTime.id,
        originalDate: dateText,
      }));
  });
}

function makeHiddenFixedLessonKeys(events: StudentEvent[]) {
  return new Set(
    events
      .filter(
        (event) =>
          (event.source_type === "fixed_lesson_override" ||
            event.source_type === "fixed_lesson_cancelled") &&
          event.original_lesson_time_id &&
          event.original_event_date,
      )
      .map((event) => `${event.original_lesson_time_id}::${event.original_event_date}`),
  );
}

function makeMakeupMovedFixedLessonKeys(makeupLessons: MakeupLesson[], lessonTimes: LessonTime[]) {
  return new Set(
    makeupLessons.flatMap((lesson) => {
      if (!lesson.absent_date) return [];
      const dayLabel = getDayLabel(lesson.absent_date);
      return lessonTimes
        .filter((lessonTime) => lessonTime.student_id === lesson.student_id && lessonTime.day_of_week === dayLabel)
        .map((lessonTime) => `${lessonTime.id}::${lesson.absent_date}`);
    }),
  );
}

function makeMakeupItems(
  makeupLessons: MakeupLesson[],
  students: Student[],
  startDate: string,
  endDate: string,
): LessonScheduleItem[] {
  return makeupLessons
    .filter(
      (lesson) =>
        lesson.makeup_date &&
        lesson.makeup_date >= startDate &&
        lesson.makeup_date <= endDate,
    )
    .map((lesson) => ({
      id: `makeup-${lesson.id}`,
      sourceType: "makeup_lesson" as const,
      sourceId: lesson.id,
      studentId: lesson.student_id,
      studentName: getStudentName(lesson.student_id, students),
      date: lesson.makeup_date as string,
      dayLabel: getDayLabel(lesson.makeup_date as string),
      startTime: normalizeTime(lesson.makeup_time),
      endTime: "",
      title: `${getStudentName(lesson.student_id, students)} 보강수업`,
      eventType: "보강수업" as const,
      memo: lesson.memo,
      color: getStudentColor(lesson.student_id, students),
    }));
}

function makeStudentEventLessonItems(
  events: StudentEvent[],
  students: Student[],
  startDate: string,
  endDate: string,
): LessonScheduleItem[] {
  return events
    .filter(
      (event) =>
        event.event_date >= startDate &&
        event.event_date <= endDate &&
        LESSON_EVENT_TYPES.includes(event.event_type || "") &&
        event.source_type !== "fixed_lesson_cancelled",
    )
    .map((event) => ({
      id: `event-${event.id}`,
      sourceType: "student_event" as const,
      sourceId: event.id,
      studentId: event.student_id,
      studentName: getStudentName(event.student_id, students),
      date: event.event_date,
      dayLabel: getDayLabel(event.event_date),
      startTime: normalizeTime(event.event_time),
      endTime: getLessonEndTimeFromMemo(event.memo),
      title: `${getStudentName(event.student_id, students)} ${event.event_type || "수업"}`,
      eventType: (event.event_type || "수업") as
        | "수업"
        | "보강수업"
        | "추가수업",
      memo: stripLessonEndTimeMarker(event.memo),
      color: getStudentColor(event.student_id, students),
      eventSourceType: event.source_type,
      originalLessonTimeId: event.original_lesson_time_id || event.source_id || null,
      originalDate: event.original_event_date || event.event_date,
    }));
}

function makeLessonRecordItems(
  records: LessonRecord[],
  students: Student[],
  startDate: string,
  endDate: string,
  existingItems: LessonScheduleItem[],
  makeupLessons: MakeupLesson[] = [],
): LessonScheduleItem[] {
  const existingKeys = new Set(
    existingItems.map(
      (item) => `${item.studentId}-${item.date}-${item.startTime}`,
    ),
  );
  const makeupExactKeys = new Set(
    makeupLessons
      .filter((lesson) => lesson.makeup_date && lesson.makeup_time)
      .map((lesson) => `${lesson.student_id}-${lesson.makeup_date}-${normalizeTime(lesson.makeup_time)}`),
  );
  const makeupDateOnlyKeys = new Set(
    makeupLessons
      .filter((lesson) => lesson.makeup_date && !lesson.makeup_time)
      .map((lesson) => `${lesson.student_id}-${lesson.makeup_date}`),
  );

  return records
    .filter(
      (record) =>
        record.lesson_date >= startDate && record.lesson_date <= endDate,
    )
    .filter((record) => {
      const recordTime = normalizeTime(record.start_time);
      const exactKey = `${record.student_id}-${record.lesson_date}-${recordTime}`;
      const dateKey = `${record.student_id}-${record.lesson_date}`;

      if (existingKeys.has(exactKey)) return false;
      if (makeupExactKeys.has(exactKey)) return false;
      if (!recordTime && makeupDateOnlyKeys.has(dateKey)) return false;

      return true;
    })
    .map((record) => ({
      id: `record-${record.id}`,
      sourceType: "lesson_record" as const,
      sourceId: record.id,
      studentId: record.student_id,
      studentName: getStudentName(record.student_id, students),
      date: record.lesson_date,
      dayLabel: getDayLabel(record.lesson_date),
      startTime: normalizeTime(record.start_time),
      endTime: normalizeTime(record.end_time),
      title: `${getStudentName(record.student_id, students)} ${record.is_extra ? "추가수업" : "수업"}`,
      eventType: record.is_extra ? ("추가수업" as const) : ("수업" as const),
      memo: null,
      color: getStudentColor(record.student_id, students),
    }));
}

function sortScheduleItems(items: LessonScheduleItem[]) {
  return [...items].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.startTime.localeCompare(b.startTime);
  });
}

function clampPercent(value: number) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function todayTimelinePercent(items: LessonScheduleItem[], today: string) {
  const todayItems = sortScheduleItems(items)
    .filter((item) => item.date === today)
    .filter((item) => timeToMinutes(item.startTime) !== null);

  if (todayItems.length === 0) return 0;

  const now = getKstNowMinutes();
  const getStart = (item: LessonScheduleItem) => timeToMinutes(item.startTime) || 0;
  const getEnd = (item: LessonScheduleItem) => {
    const start = getStart(item);
    const end = timeToMinutes(item.endTime);
    return end !== null && end > start ? end : start + 60;
  };

  if (todayItems.length === 1) {
    const onlyStart = getStart(todayItems[0]);
    const onlyEnd = getEnd(todayItems[0]);

    if (now <= onlyStart) return 0;
    if (now >= onlyEnd) return 100;

    return clampPercent(((now - onlyStart) / Math.max(onlyEnd - onlyStart, 1)) * 100);
  }

  const firstStart = getStart(todayItems[0]);
  const lastItem = todayItems[todayItems.length - 1];
  const lastStart = getStart(lastItem);
  const lastEnd = getEnd(lastItem);

  if (now <= firstStart) return 0;
  if (now >= lastEnd) return 100;

  const pointForIndex = (index: number) =>
    (index / Math.max(todayItems.length - 1, 1)) * 100;

  for (let index = 0; index < todayItems.length; index++) {
    const current = todayItems[index];
    const currentStart = getStart(current);
    const currentEnd = getEnd(current);
    const currentPoint = pointForIndex(index);

    // 수업/일정 진행 중이면 그 일정 위치에 머물게 한다.
    if (now >= currentStart && now <= currentEnd) {
      return clampPercent(currentPoint);
    }

    const next = todayItems[index + 1];
    if (!next) continue;

    const nextStart = getStart(next);
    const nextPoint = pointForIndex(index + 1);

    // 아직 다음 수업 시작 전이면 다음 카드 '가운데'까지 가지 않고,
    // 이전 일정과 다음 일정 사이의 빈 구간에서만 움직이게 한다.
    if (now > currentEnd && now < nextStart) {
      const gapSize = nextPoint - currentPoint;
      const safeOffset = Math.min(8, gapSize * 0.35);
      const gapStartPoint = currentPoint + safeOffset;
      const gapEndPoint = nextPoint - safeOffset;
      const ratio = (now - currentEnd) / Math.max(nextStart - currentEnd, 1);

      return clampPercent(gapStartPoint + (gapEndPoint - gapStartPoint) * ratio);
    }
  }

  const lastPoint = pointForIndex(todayItems.length - 1);
  const lastRatio = (now - lastStart) / Math.max(lastEnd - lastStart, 1);
  return clampPercent(lastPoint + (100 - lastPoint) * lastRatio);
}
function groupByDate(items: LessonScheduleItem[]) {
  return items.reduce<Record<string, LessonScheduleItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
}

function groupMonthlyEvents(events: MonthlyEvent[]) {
  return events.reduce<Record<string, MonthlyEvent[]>>((acc, event) => {
    if (!acc[event.event_date]) acc[event.event_date] = [];
    acc[event.event_date].push(event);
    return acc;
  }, {});
}

const RANGE_END_MARKER = "[end_date:";
const LESSON_END_TIME_MARKER = "[end_time:";

function stripRangeEndMarker(memo?: string | null) {
  return String(memo || "").replace(/\s*\[end_date:\d{4}-\d{2}-\d{2}\]\s*/g, " ").trim();
}

function getRangeEndFromMemo(memo?: string | null) {
  return String(memo || "").match(/\[end_date:(\d{4}-\d{2}-\d{2})\]/)?.[1] || null;
}

function memoWithRangeEnd(memo: string, startDate: string, endDate: string) {
  const cleanMemo = stripRangeEndMarker(memo);
  if (!endDate || endDate <= startDate) return cleanMemo || null;
  return `${cleanMemo ? `${cleanMemo} ` : ""}${RANGE_END_MARKER}${endDate}]`;
}

function stripLessonEndTimeMarker(memo?: string | null) {
  return String(memo || "").replace(/\s*\[end_time:\d{2}:\d{2}\]\s*/g, " ").trim();
}

function getLessonEndTimeFromMemo(memo?: string | null) {
  return String(memo || "").match(/\[end_time:(\d{2}:\d{2})\]/)?.[1] || "";
}

function memoWithLessonEndTime(memo: string, endTime: string) {
  const cleanMemo = stripLessonEndTimeMarker(memo);
  const cleanEndTime = normalizeTime(endTime);
  if (!cleanEndTime) return cleanMemo || null;
  return `${cleanMemo ? `${cleanMemo} ` : ""}${LESSON_END_TIME_MARKER}${cleanEndTime}]`;
}

function expandMonthlyEventRange(event: MonthlyEvent, monthStart: string, monthEnd: string) {
  const rangeStart = event.event_date;
  const rawRangeEnd = event.range_end && event.range_end >= rangeStart ? event.range_end : rangeStart;
  const start = rangeStart < monthStart ? monthStart : rangeStart;
  const end = rawRangeEnd > monthEnd ? monthEnd : rawRangeEnd;
  const dates = makeDateRange(start, end);
  return dates.map((dateText) => ({
    ...event,
    id: `${event.id}-${dateText}`,
    event_date: dateText,
    range_start: rangeStart,
    range_end: rawRangeEnd,
    range_position: (
      rangeStart === rawRangeEnd
        ? "single"
        : dateText === rangeStart
          ? "start"
          : dateText === rawRangeEnd
            ? "end"
            : "middle"
    ) as MonthlyEvent["range_position"],
  }));
}

function makeMonthlyEvents(
  events: StudentEvent[],
  personalEvents: PersonalEvent[],
  settlements: Settlement[],
  students: Student[],
  monthStart: string,
  monthEnd: string,
): MonthlyEvent[] {
  const normalEvents = events
    .filter(
      (event) =>
        event.event_date >= monthStart &&
        event.event_date <= monthEnd &&
        !LESSON_EVENT_TYPES.includes(event.event_type || ""),
    )
    .map((event) => {
      const studentName = getStudentName(event.student_id, students);
      const cleanTitle = String(event.title || "").trim();
      const subject = String(event.subject || "").trim();
      const titleWithSubject = subject && !cleanTitle.startsWith(subject)
        ? `${subject} ${cleanTitle}`
        : cleanTitle;
      const baseTitle = `${studentName} ${titleWithSubject}`.trim();

      return {
        id: `event-${event.id}`,
        sourceType: "student_event" as const,
        sourceId: event.id,
        studentName,
        studentId: event.student_id,
        event_date: event.event_date,
        event_time: normalizeTime(event.event_time),
        title: baseTitle,
        event_type: event.event_type || "기타",
        color: getStudentColor(event.student_id, students),
        memo: event.memo,
      };
    });

  const feedbackEvents = settlements
    .filter(
      (settlement) =>
        settlement.feedback_date &&
        settlement.feedback_date >= monthStart &&
        settlement.feedback_date <= monthEnd,
    )
    .map((settlement) => ({
      id: `feedback-${settlement.id}`,
      sourceType: "feedback" as const,
      sourceId: settlement.id,
      studentName: getStudentName(settlement.student_id, students),
      studentId: settlement.student_id,
      event_date: settlement.feedback_date as string,
      event_time: null,
      title: `${getStudentName(settlement.student_id, students)} 피드백`,
      event_type: settlement.feedback_done ? "피드백 완료" : "피드백",
      color: "border-[#CEC1C3] bg-[#ffffff] text-[#404040]",
      memo: null,
    }));

  const mineEvents = personalEvents
    .flatMap((event) => {
      const rangeEnd = getRangeEndFromMemo(event.memo) || event.event_date;
      if (event.event_date > monthEnd || rangeEnd < monthStart) return [];
      return expandMonthlyEventRange(
        {
          id: `personal-${event.id}`,
          sourceType: "personal_event" as const,
          sourceId: event.id,
          studentName: "나",
          studentId: "",
          event_date: event.event_date,
          event_time: normalizeTime(event.event_time),
          end_time: normalizeTime(event.end_time),
          title: `💗 ${event.title}`,
          event_type: "나만보기",
          color:
            "border-[#171717] bg-[#e5e5e5] text-[#4f4a45] font-black shadow-[0_0_0_1px_rgba(231,71,134,0.22)]",
          memo: stripRangeEndMarker(event.memo),
          range_end: rangeEnd,
        },
        monthStart,
        monthEnd,
      );
    });

  return [...normalEvents, ...feedbackEvents, ...mineEvents].sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return String(a.event_time || "").localeCompare(String(b.event_time || ""));
  });
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const today = getKstToday();
  const rawSearchParams = searchParams ? await searchParams : {};
  const mobileTab = ["schedule"].includes(rawSearchParams.tab || "")
    ? rawSearchParams.tab
    : "lessons";
  const currentMonthInfo = getMonthStartEnd(today);
  const lessonScheduleMonthInfo = getMonthStartEnd(
    getMonthDateFromParam(rawSearchParams.lessonMonth, today),
  );
  const calendarMonthInfo = getMonthStartEnd(
    getMonthDateFromParam(rawSearchParams.calendarMonth, today),
  );
  const lessonMonthParam = monthParamFromInfo(lessonScheduleMonthInfo);
  const calendarMonthParam = monthParamFromInfo(calendarMonthInfo);
  const lessonScheduleCalendarRange = getCalendarGridRange(
    lessonScheduleMonthInfo.year,
    lessonScheduleMonthInfo.month,
  );
  const monthlyCalendarRange = getCalendarGridRange(
    calendarMonthInfo.year,
    calendarMonthInfo.month,
  );
  const lessonRecordFetchStart =
    currentMonthInfo.startDate < lessonScheduleCalendarRange.startDate
      ? currentMonthInfo.startDate
      : lessonScheduleCalendarRange.startDate;
  const lessonRecordFetchEnd =
    currentMonthInfo.endDate > lessonScheduleCalendarRange.endDate
      ? currentMonthInfo.endDate
      : lessonScheduleCalendarRange.endDate;
  const { weekStart, weekEnd } = getWeekStartEnd(today);
  const weekDates = makeWeekDates(weekStart);
  const scheduleFetchStart = minDateText(
    weekStart,
    lessonScheduleCalendarRange.startDate,
  );
  const scheduleFetchEnd = maxDateText(
    weekEnd,
    lessonScheduleCalendarRange.endDate,
  );
  const eventFetchStart = minDateText(
    scheduleFetchStart,
    monthlyCalendarRange.startDate,
  );
  const eventFetchEnd = maxDateText(scheduleFetchEnd, monthlyCalendarRange.endDate);

  const [
    studentsResult,
    lessonTimesResult,
    lessonRecordsResult,
    makeupResult,
    taskResult,
    eventResult,
    settlementResult,
    personalEventResult,
    personalDayEventResult,
    personalTodoResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, subject, avatar_url, exp_points, level")
      .order("name", { ascending: true })
      .limit(500),
    supabase.from("student_lesson_times").select("*").limit(1000),
    supabase
      .from("lesson_records")
      .select("id, student_id, lesson_date, start_time, end_time, is_extra")
      .gte("lesson_date", lessonRecordFetchStart)
      .lte("lesson_date", lessonRecordFetchEnd)
      .limit(1000),
    supabase
      .from("makeup_lessons")
      .select("*")
      .or(
        `and(absent_date.gte.${scheduleFetchStart},absent_date.lte.${scheduleFetchEnd}),and(makeup_date.gte.${scheduleFetchStart},makeup_date.lte.${scheduleFetchEnd})`,
      )
      .limit(500),
    supabase
      .from("student_performance_tasks")
      .select("*")
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("due_time", { ascending: true })
      .limit(500),
    supabase
      .from("student_events")
      .select("*")
      .or(
        `and(event_date.gte.${eventFetchStart},event_date.lte.${eventFetchEnd}),and(original_event_date.gte.${scheduleFetchStart},original_event_date.lte.${scheduleFetchEnd})`,
      )
      .limit(1000),
    supabase
      .from("settlements")
      .select("*")
      .or(
        `and(start_date.lte.${today},end_date.gte.${today}),and(start_date.lte.${lessonScheduleMonthInfo.endDate},end_date.gte.${lessonScheduleMonthInfo.startDate}),and(start_date.eq.${currentMonthInfo.startDate},end_date.eq.${currentMonthInfo.endDate}),and(feedback_date.gte.${calendarMonthInfo.startDate},feedback_date.lte.${calendarMonthInfo.endDate})`,
      )
      .limit(500),
    supabase
      .from("personal_events")
      .select("*")
      .gte("event_date", addHours(calendarMonthInfo.startDate, -90))
      .lte("event_date", calendarMonthInfo.endDate)
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true }),
    supabase
      .from("personal_day_events")
      .select("*")
      .eq("event_date", today)
      .order("start_time", { ascending: true }),
    supabase
      .from("personal_todos")
      .select("*")
      .or(`is_done.eq.false,due_date.gte.${today},due_date.is.null`)
      .order("is_done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const students = (studentsResult.data || []) as Student[];
  const lessonTimes = (lessonTimesResult.data || []) as LessonTime[];
  const lessonRecords = (lessonRecordsResult.data || []) as LessonRecord[];
  const makeupLessons = (makeupResult.data || []) as MakeupLesson[];
  const performanceTasks = (taskResult.data || []) as PerformanceTask[];
  const studentEvents = (eventResult.data || []) as StudentEvent[];
  const hiddenFixedLessonKeys = new Set([
    ...makeHiddenFixedLessonKeys(studentEvents),
    ...makeMakeupMovedFixedLessonKeys(makeupLessons, lessonTimes),
  ]);
  const settlements = (settlementResult.data || []) as Settlement[];
  const personalEvents = (personalEventResult.data || []) as PersonalEvent[];
  const personalDayEvents = (personalDayEventResult.data ||
    []) as PersonalDayEvent[];
  const personalTodos = (personalTodoResult.data || []) as PersonalTodo[];

  const progress = calculateMonthElapsedProgress(today);

  const fixedWeekItems = makeFixedLessonItems(
    lessonTimes,
    students,
    weekDates,
    hiddenFixedLessonKeys,
  );
  const makeupWeekItems = makeMakeupItems(
    makeupLessons,
    students,
    weekStart,
    weekEnd,
  );
  const eventWeekItems = makeStudentEventLessonItems(
    studentEvents,
    students,
    weekStart,
    weekEnd,
  );
  const recordWeekItems = makeLessonRecordItems(
    lessonRecords,
    students,
    weekStart,
    weekEnd,
    [...fixedWeekItems, ...makeupWeekItems, ...eventWeekItems],
    makeupLessons,
  );
  const weekScheduleItems = sortScheduleItems([
    ...fixedWeekItems,
    ...makeupWeekItems,
    ...eventWeekItems,
    ...recordWeekItems,
  ]);
  const baseTodayItems = weekScheduleItems.filter(
    (item) => item.date === today,
  );
  const personalTimelineItems: LessonScheduleItem[] = personalDayEvents
    .filter((event) => event.event_date === today)
    .map((event) => ({
      id: `personal-day-${event.id}`,
      sourceType: "personal_day_event",
      sourceId: event.id,
      studentId: "",
      studentName: "나",
      date: event.event_date,
      dayLabel: getDayLabel(event.event_date),
      startTime: normalizeTime(event.start_time),
      endTime: normalizeTime(event.end_time),
      title: `💗 ${event.title}`,
      eventType: "내 일정",
      memo: event.memo,
      color: "border-[#C8BAC6] bg-[#ffffff] text-[#70665e]",
    }));
  const personalCalendarTodayItems: LessonScheduleItem[] = personalEvents
    .filter((event) => event.event_date === today)
    .map((event) => ({
      id: `personal-calendar-today-${event.id}`,
      sourceType: "personal_day_event",
      sourceId: event.id,
      studentId: "",
      studentName: "나",
      date: event.event_date,
      dayLabel: getDayLabel(event.event_date),
      startTime: normalizeTime(event.event_time),
      endTime: "",
      title: `💗 ${event.title ||  "나만보기 일정"}`,
      eventType: "내 일정",
      memo: event.memo,
      color: "border-[#C8BAC6] bg-[#ffffff] text-[#70665e]",
    }));
  const todayItems = sortScheduleItems([
    ...personalCalendarTodayItems,
    ...baseTodayItems,
    ...personalTimelineItems,
  ]);
  const sortedPerformanceTasks = [...performanceTasks].sort((a, b) => {
    const aDue = a.due_date || "9999-12-31";
    const bDue = b.due_date || "9999-12-31";
    const dueCompare = aDue.localeCompare(bDue);
    if (dueCompare !== 0) return dueCompare;
    return normalizeTime(a.due_time).localeCompare(normalizeTime(b.due_time));
  });
  const timelinePercent = todayTimelinePercent(todayItems, today);
  const scheduleByDate = groupByDate(weekScheduleItems);

  const lessonMonthDates = makeDateRange(
    lessonScheduleCalendarRange.startDate,
    lessonScheduleCalendarRange.endDate,
  );
  const fixedMonthItems = makeFixedLessonItems(
    lessonTimes,
    students,
    lessonMonthDates,
    hiddenFixedLessonKeys,
  );
  const makeupMonthItems = makeMakeupItems(
    makeupLessons,
    students,
    lessonScheduleCalendarRange.startDate,
    lessonScheduleCalendarRange.endDate,
  );
  const eventMonthItems = makeStudentEventLessonItems(
    studentEvents,
    students,
    lessonScheduleCalendarRange.startDate,
    lessonScheduleCalendarRange.endDate,
  );
  const recordMonthItems = makeLessonRecordItems(
    lessonRecords,
    students,
    lessonScheduleCalendarRange.startDate,
    lessonScheduleCalendarRange.endDate,
    [...fixedMonthItems, ...makeupMonthItems, ...eventMonthItems],
    makeupLessons,
  );
  const monthScheduleItems = sortScheduleItems([
    ...fixedMonthItems,
    ...makeupMonthItems,
    ...eventMonthItems,
    ...recordMonthItems,
  ]);
  const monthScheduleByDate = groupByDate(monthScheduleItems);

  const monthlyEvents = makeMonthlyEvents(
    studentEvents,
    personalEvents,
    settlements,
    students,
    monthlyCalendarRange.startDate,
    monthlyCalendarRange.endDate,
  );
  const monthlyEventsByDate = groupMonthlyEvents(monthlyEvents);
  const lessonScheduleCalendarDays = makeCalendarDaysMonday(
    lessonScheduleMonthInfo.year,
    lessonScheduleMonthInfo.month,
  );
  const monthlyCalendarDays = makeCalendarDaysMonday(
    calendarMonthInfo.year,
    calendarMonthInfo.month,
  );

  async function updatePerformanceMemo(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const taskId = String(formData.get("task_id") || "");
    const studentId = String(formData.get("student_id") || "");
    const memo = String(formData.get("memo") || "").trim();

    if (!taskId) return;

    const { error } = await actionSupabase
      .from("student_performance_tasks")
      .update({ memo: memo || null })
      .eq("id", taskId);

    if (error) throw new Error(error.message);

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function completePerformanceTask(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const taskId = String(formData.get("task_id") || "");
    const studentId = String(formData.get("student_id") || "");

    if (!taskId) return;

    const { error } = await actionSupabase
      .from("student_performance_tasks")
      .update({ status: "done" })
      .eq("id", taskId);

    if (error) throw new Error(error.message);

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function addDashboardPerformanceTask(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const studentId = String(formData.get("student_id") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const dueTime = String(formData.get("due_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!studentId || !subject || !title) {
      throw new Error("학생, 과목, 수행 내용은 꼭 필요해.");
    }

    const { data: task, error } = await actionSupabase
      .from("student_performance_tasks")
      .insert({
        student_id: studentId,
        subject,
        title,
        due_date: dueDate || null,
        due_time: dueTime || null,
        status: "not_started",
        memo: memo || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    if (task?.id && dueDate) {
      const { error: eventError } = await actionSupabase.from("student_events").insert({
        student_id: studentId,
        event_date: dueDate,
        event_time: dueTime || null,
        subject,
        title,
        event_type: "수행평가",
        memo: memo || null,
        is_auto: true,
        source_type: "performance_task",
        source_id: task.id,
      });
      if (eventError) throw new Error(eventError.message);
    }

    revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function updateDashboardPerformanceTask(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const taskId = String(formData.get("task_id") || "").trim();
    const studentId = String(formData.get("student_id") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const dueDate = String(formData.get("due_date") || "").trim();
    const dueTime = String(formData.get("due_time") || "").trim();
    const status = String(formData.get("status") || "not_started").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!taskId || !studentId || !subject || !title) return;

    const { error } = await actionSupabase
      .from("student_performance_tasks")
      .update({
        subject,
        title,
        due_date: dueDate || null,
        due_time: dueTime || null,
        status: status || "not_started",
        memo: memo || null,
      })
      .eq("id", taskId)
      .eq("student_id", studentId);

    if (error) throw new Error(error.message);

    const { data: existingEvent, error: eventFetchError } = await actionSupabase
      .from("student_events")
      .select("id")
      .eq("student_id", studentId)
      .eq("source_type", "performance_task")
      .eq("source_id", taskId)
      .maybeSingle();

    if (eventFetchError) throw new Error(eventFetchError.message);

    if (dueDate) {
      const payload = {
        student_id: studentId,
        event_date: dueDate,
        event_time: dueTime || null,
        subject,
        title,
        event_type: "수행평가",
        memo: memo || null,
        is_auto: true,
        source_type: "performance_task",
        source_id: taskId,
      };
      const { error: eventError } = existingEvent?.id
        ? await actionSupabase.from("student_events").update(payload).eq("id", existingEvent.id)
        : await actionSupabase.from("student_events").insert(payload);
      if (eventError) throw new Error(eventError.message);
    } else if (existingEvent?.id) {
      const { error: deleteEventError } = await actionSupabase
        .from("student_events")
        .delete()
        .eq("id", existingEvent.id);
      if (deleteEventError) throw new Error(deleteEventError.message);
    }

    revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function deleteDashboardPerformanceTask(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const taskId = String(formData.get("task_id") || "").trim();
    const studentId = String(formData.get("student_id") || "").trim();

    if (!taskId || !studentId) return;

    const { error } = await actionSupabase
      .from("student_performance_tasks")
      .delete()
      .eq("id", taskId)
      .eq("student_id", studentId);

    if (error) throw new Error(error.message);

    const { error: eventError } = await actionSupabase
      .from("student_events")
      .delete()
      .eq("student_id", studentId)
      .eq("source_type", "performance_task")
      .eq("source_id", taskId);

    if (eventError) throw new Error(eventError.message);

    revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function updateLessonSchedule(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const sourceType = String(formData.get("source_type") || "");
    const sourceId = String(formData.get("source_id") || "");
    const studentId = String(formData.get("student_id") || "");
    const date = String(formData.get("date") || "").trim();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!sourceType || !sourceId) return;

    if (sourceType === "fixed_lesson_time") {
      const originalDate = String(formData.get("original_date") || "").trim();
      const originalTime = String(formData.get("original_time") || "").trim();

      if (!studentId || !originalDate) return;

      await actionSupabase
        .from("student_events")
        .delete()
        .eq("student_id", studentId)
        .eq("source_type", "fixed_lesson_cancelled")
        .eq("original_lesson_time_id", sourceId)
        .eq("original_event_date", originalDate);

      const { data: existingOverride, error: fetchError } = await actionSupabase
        .from("student_events")
        .select("id")
        .eq("student_id", studentId)
        .eq("source_type", "fixed_lesson_override")
        .eq("original_lesson_time_id", sourceId)
        .eq("original_event_date", originalDate)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);

      const payload = {
        student_id: studentId,
        event_date: date || originalDate,
        event_time: startTime || originalTime || null,
        subject: "수업",
        title: "수업",
        event_type: "수업",
        memo: memoWithLessonEndTime(memo, endTime),
        is_auto: false,
        source_type: "fixed_lesson_override",
        source_id: sourceId,
        original_lesson_time_id: sourceId,
        original_event_date: originalDate,
      };

      const { error } = existingOverride?.id
        ? await actionSupabase
            .from("student_events")
            .update(payload)
            .eq("id", existingOverride.id)
        : await actionSupabase.from("student_events").insert(payload);

      if (error) throw new Error(error.message);
    }

    if (sourceType === "makeup_lesson") {
      const { error } = await actionSupabase
        .from("makeup_lessons")
        .update({
          makeup_date: date || null,
          makeup_time: startTime || null,
          memo: memo || null,
        })
        .eq("id", sourceId);

      if (error) throw new Error(error.message);
    }

    if (sourceType === "student_event") {
      const { error } = await actionSupabase
        .from("student_events")
        .update({
          event_date: date,
          event_time: startTime || null,
          memo: memoWithLessonEndTime(memo, endTime),
        })
        .eq("id", sourceId);

      if (error) throw new Error(error.message);
    }

    if (sourceType === "lesson_record") {
      const { error } = await actionSupabase
        .from("lesson_records")
        .update({
          lesson_date: date,
          start_time: startTime || null,
          end_time: endTime || null,
        })
        .eq("id", sourceId);

      if (error) throw new Error(error.message);
    }

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function deleteLessonSchedule(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const sourceType = String(formData.get("source_type") || "");
    const sourceId = String(formData.get("source_id") || "");
    const studentId = String(formData.get("student_id") || "");

    if (!sourceType || !sourceId) return;

    if (sourceType === "fixed_lesson_time") {
      const originalDate = String(formData.get("original_date") || "").trim();
      const originalTime = String(formData.get("original_time") || "").trim();

      if (!studentId || !originalDate) return;

      await actionSupabase
        .from("student_events")
        .delete()
        .eq("student_id", studentId)
        .eq("source_type", "fixed_lesson_override")
        .eq("original_lesson_time_id", sourceId)
        .eq("original_event_date", originalDate);

      const { error } = await actionSupabase.from("student_events").insert({
        student_id: studentId,
        event_date: originalDate,
        event_time: originalTime || null,
        subject: "수업",
        title: "수업 취소",
        event_type: "수업",
        memo: null,
        is_auto: false,
        source_type: "fixed_lesson_cancelled",
        source_id: sourceId,
        original_lesson_time_id: sourceId,
        original_event_date: originalDate,
      });

      if (error) throw new Error(error.message);
    }

    if (sourceType === "makeup_lesson") {
      const { error } = await actionSupabase
        .from("makeup_lessons")
        .delete()
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (sourceType === "student_event") {
      const { data: targetEvent, error: fetchEventError } = await actionSupabase
        .from("student_events")
        .select("*")
        .eq("id", sourceId)
        .maybeSingle();

      if (fetchEventError) throw new Error(fetchEventError.message);

      const { error } = await actionSupabase
        .from("student_events")
        .delete()
        .eq("id", sourceId);
      if (error) throw new Error(error.message);

      if (
        targetEvent?.source_type === "fixed_lesson_override" &&
        targetEvent.original_lesson_time_id &&
        targetEvent.original_event_date
      ) {
        const { error: cancelError } = await actionSupabase.from("student_events").insert({
          student_id: targetEvent.student_id,
          event_date: targetEvent.original_event_date,
          event_time: targetEvent.event_time || null,
          subject: "수업",
          title: "수업 취소",
          event_type: "수업",
          memo: null,
          is_auto: false,
          source_type: "fixed_lesson_cancelled",
          source_id: targetEvent.original_lesson_time_id,
          original_lesson_time_id: targetEvent.original_lesson_time_id,
          original_event_date: targetEvent.original_event_date,
        });
        if (cancelError) throw new Error(cancelError.message);
      }
    }

    if (sourceType === "lesson_record") {
      const { error } = await actionSupabase
        .from("lesson_records")
        .delete()
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function addDashboardLessonEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const studentId = String(formData.get("student_id") || "").trim();
    const eventDate = String(formData.get("event_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const eventType = String(formData.get("event_type") || "수업").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!studentId || !eventDate) {
      throw new Error("학생과 수업 날짜는 꼭 필요해.");
    }

    const finalType = LESSON_EVENT_TYPES.includes(eventType)
      ? eventType
      : "수업";

    const { error } = await actionSupabase.from("student_events").insert({
      student_id: studentId,
      event_date: eventDate,
      event_time: eventTime || null,
      subject: "수업",
      title: finalType,
      event_type: finalType,
      memo: memoWithLessonEndTime(memo, endTime),
      is_auto: false,
      source_type: "manual",
      source_id: null,
    });

    if (error) throw new Error(error.message);

    revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function addPersonalEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const eventDate = String(formData.get("event_date") || "").trim();
    const endDate = String(formData.get("end_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!eventDate || !title) {
      throw new Error("날짜와 일정 이름은 꼭 입력해야 해.");
    }

    const { error } = await actionSupabase.from("personal_events").insert({
      event_date: eventDate,
      event_time: eventTime || null,
      end_time: endTime || null,
      title,
      memo: memoWithRangeEnd(memo, eventDate, endDate || eventDate),
    });

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function addPersonalDayEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const eventDate =
      String(formData.get("event_date") || "").trim() || getKstToday();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!startTime || !endTime || !title) {
      throw new Error("시작시간, 끝시간, 일정 이름은 꼭 입력해야 해.");
    }

    const { error } = await actionSupabase.from("personal_day_events").insert({
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      title,
      memo: memo || null,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function updatePersonalDayEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const eventId = String(formData.get("event_id") || "");
    const eventDate =
      String(formData.get("event_date") || "").trim() || getKstToday();
    const startTime = String(formData.get("start_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!eventId || !startTime || !endTime || !title) return;

    const { error } = await actionSupabase
      .from("personal_day_events")
      .update({
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        title,
        memo: memo || null,
      })
      .eq("id", eventId);

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function deletePersonalDayEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const eventId = String(formData.get("event_id") || "");
    if (!eventId) return;

    const { error } = await actionSupabase
      .from("personal_day_events")
      .delete()
      .eq("id", eventId);

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function addPersonalTodo(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const dueDate = String(formData.get("due_date") || "").trim();
    const title = String(formData.get("title") || "").trim();

    if (!title) throw new Error("할일 이름은 꼭 입력해야 해.");

    const { error } = await actionSupabase.from("personal_todos").insert({
      due_date: dueDate || null,
      title,
      is_done: false,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function togglePersonalTodo(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const todoId = String(formData.get("todo_id") || "");
    const isDone = String(formData.get("is_done") || "") === "true";
    if (!todoId) return;

    const { error } = await actionSupabase
      .from("personal_todos")
      .update({ is_done: !isDone })
      .eq("id", todoId);

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function deletePersonalTodo(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const todoId = String(formData.get("todo_id") || "");
    if (!todoId) return;

    const { error } = await actionSupabase
      .from("personal_todos")
      .delete()
      .eq("id", todoId);

    if (error) throw new Error(error.message);

    revalidatePath("/");
  }

  async function updateMonthlyEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const sourceType = String(formData.get("source_type") || "");
    const sourceId = String(formData.get("source_id") || "");
    const studentId = String(formData.get("student_id") || "");
    const eventDate = String(formData.get("event_date") || "").trim();
    const endDate = String(formData.get("end_date") || "").trim();
    const eventTime = String(formData.get("event_time") || "").trim();
    const endTime = String(formData.get("end_time") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const memo = String(formData.get("memo") || "").trim();

    if (!sourceType || !sourceId || !eventDate) return;

    if (sourceType === "student_event") {
      const { error } = await actionSupabase
        .from("student_events")
        .update({
          event_date: eventDate,
          event_time: eventTime || null,
          title: title || undefined,
          memo: memo || null,
        })
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (sourceType === "feedback") {
      const { error } = await actionSupabase
        .from("settlements")
        .update({ feedback_date: eventDate })
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (sourceType === "personal_event") {
      const { error } = await actionSupabase
        .from("personal_events")
        .update({
          event_date: eventDate,
          event_time: eventTime || null,
          end_time: endTime || null,
          title,
          memo: memoWithRangeEnd(memo, eventDate, endDate || eventDate),
        })
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  async function deleteMonthlyEvent(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const sourceType = String(formData.get("source_type") || "");
    const sourceId = String(formData.get("source_id") || "");
    const studentId = String(formData.get("student_id") || "");

    if (!sourceType || !sourceId) return;

    if (sourceType === "student_event") {
      const { error } = await actionSupabase
        .from("student_events")
        .delete()
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (sourceType === "feedback") {
      const { error } = await actionSupabase
        .from("settlements")
        .update({ feedback_date: null })
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (sourceType === "personal_event") {
      const { error } = await actionSupabase
        .from("personal_events")
        .delete()
        .eq("id", sourceId);
      if (error) throw new Error(error.message);
    }

    if (studentId) revalidatePath(`/students/${studentId}`);
    revalidatePath("/");
  }

  return (
    <main className="min-h-screen bg-[#ffffff] px-2 pb-20 pt-2 text-[#171717] md:px-5 md:py-8">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-2 md:hidden">
        <header className="px-1 py-1">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-[#525252]">
                {formatShortDate(progress.startDate)} ~ {formatShortDate(progress.endDate)}
              </p>
              <p className="text-sm font-black text-[#171717]">{progress.percent}%</p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#d4d4d4]">
              <div className="h-full rounded-full bg-[#171717]" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </header>

        <section id="mobile-lessons" className={`${mobileTab === "lessons" ? "" : "hidden"} rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-sm`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#737373]">Today</p>
              <h2 className="text-[15px] font-black text-[#171717]">오늘 일정</h2>
            </div>
            <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-black text-[#404040]">
              {todayItems.length}개
            </span>
          </div>
          {todayItems.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#d4d4d4] bg-[#f7f7f7] px-3 py-4 text-center text-xs font-bold text-[#525252]">
              오늘 일정이 없어요.
            </p>
          ) : (
            <div className="space-y-1.5">
              {todayItems.map((item) => (
                <Link
                  key={`mobile-today-${item.id}`}
                  href={item.studentId ? `/students/${item.studentId}` : "/"}
                  className={`block rounded-none border px-3 py-2 ${item.color}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black">
                        {item.startTime || "시간 미입력"}{item.endTime ? ` - ${item.endTime}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] font-black">{item.title}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold opacity-75">{item.eventType}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="mobile-schedule" className={`${mobileTab === "schedule" ? "" : "hidden"} rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-sm`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-black text-[#171717]">다가오는 수행</h2>
            <span className="text-[10px] font-bold text-[#737373]">{sortedPerformanceTasks.length}개</span>
          </div>
          {sortedPerformanceTasks.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#d4d4d4] bg-[#f7f7f7] px-3 py-3 text-center text-xs font-bold text-[#525252]">
              진행 중인 수행평가가 없어요.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sortedPerformanceTasks.slice(0, 8).map((task) => {
                const badge = deadlineBadge(task.due_date, today);
                return (
                  <div key={`mobile-performance-${task.id}`} className="rounded-[12px] border border-[#e5e5e5] bg-[#f5f5f5] px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-[#171717]">{getStudentName(task.student_id, students)}</span>
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#525252]">{task.subject}</span>
                          {badge && <span className="ml-auto shrink-0 text-[9px] font-black text-[#9a3412]">{badge}</span>}
                        </div>
                        <p className="mt-1 truncate text-[12px] font-black text-[#171717]">{task.title}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-[#737373]">
                          {formatShortDate(task.due_date)}까지 {normalizeTime(task.due_time)}
                        </p>
                      </div>
                      <details suppressHydrationWarning className="shrink-0">
                        <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full bg-white text-[13px] font-black text-[#171717]">⋯</summary>
                        <div className="fixed inset-0 z-[70] bg-black/45" aria-hidden="true" />
                        <div className="fixed left-1/2 top-1/2 z-[80] w-[min(88vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-[#171717] p-3 text-white shadow-2xl">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-black">수행 수정</p>
                            <span className="text-[9px] font-bold text-white/60">다시 누르면 닫힘</span>
                          </div>
                          <CloseOnSubmitForm action={updateDashboardPerformanceTask} className="grid gap-1.5">
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="student_id" value={task.student_id} />
                            <input name="subject" defaultValue={task.subject} placeholder="과목" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                            <input name="title" defaultValue={task.title} placeholder="내용" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                            <div className="grid grid-cols-2 gap-1">
                              <input type="date" name="due_date" defaultValue={task.due_date || ""} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                              <input name="due_time" defaultValue={normalizeTime(task.due_time)} placeholder="시간" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                            </div>
                            <select name="status" defaultValue={task.status} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none">
                              {PERFORMANCE_STATUS_OPTIONS.map(([value, label]) => (
                                <option key={`mobile-performance-status-${task.id}-${value}`} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input name="memo" defaultValue={task.memo || ""} placeholder="메모" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                            <div className="grid grid-cols-2 gap-1">
                              <button className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-[#171717]">수정</button>
                              <button formAction={deleteDashboardPerformanceTask} className="rounded-lg bg-white/15 px-2 py-1.5 text-[11px] font-black text-white">삭제</button>
                            </div>
                          </CloseOnSubmitForm>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <details suppressHydrationWarning className="mt-2 rounded-[14px] border border-[#e5e5e5] bg-[#f7f7f7] px-2.5 py-1.5">
            <summary className="cursor-pointer list-none text-[11px] font-black text-[#171717]">+ 수행 추가</summary>
            <form action={addDashboardPerformanceTask} className="mt-2 grid gap-1.5">
              <select name="student_id" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none">
                <option value="">학생</option>
                {students.map((student) => (
                  <option key={`mobile-add-performance-${student.id}`} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-1">
                <input name="subject" placeholder="과목" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
                <input type="date" name="due_date" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              </div>
              <input name="title" placeholder="수행 내용" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <input name="due_time" placeholder="시간" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <input name="memo" placeholder="메모" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <button className="rounded-lg bg-[#171717] px-2 py-1.5 text-[11px] font-black text-white">추가</button>
            </form>
          </details>
        </section>

        <section id="mobile-week" className={`${mobileTab === "lessons" ? "" : "hidden"} rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-sm`}>
          <div className="mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#737373]">Week</p>
            <h2 className="text-[15px] font-black text-[#171717]">이번주 수업</h2>
          </div>
          <div className="overflow-x-auto rounded-[16px] border border-[#e5e5e5] bg-[#f5f5f5] p-1">
            <div className="grid min-w-[980px] grid-cols-7 gap-1">
              {weekDates.map((dateText) => {
                const dayItems = scheduleByDate[dateText] || [];
                return (
                  <div key={`mobile-week-${dateText}`} className={`min-h-[108px] rounded-[12px] border p-1.5 ${dateText === today ? "border-[#171717] bg-[#171717] text-white" : "border-[#e5e5e5] bg-white text-[#171717]"}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[10px] font-black">{getDayLabel(dateText)}</p>
                      <p className="text-[10px] font-black">{formatShortDate(dateText)}</p>
                    </div>
                    <div className="space-y-1">
                      {dayItems.map((item) => (
                        <details suppressHydrationWarning key={`mobile-week-item-${item.id}`} className={`rounded-none border px-2 py-1 text-[10px] font-bold ${item.color}`}>
                          <summary className="cursor-pointer list-none">
                            <p className="whitespace-nowrap">
                              {item.startTime || "--:--"} {item.studentName}
                            </p>
                          </summary>
                          <div className="fixed inset-0 z-[70] bg-black/45" aria-hidden="true" />
                          <div className="fixed left-1/2 top-1/2 z-[80] w-[min(88vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-[#171717] p-3 text-white shadow-2xl">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-black">{item.studentName} 수업</p>
                              <span className="text-[9px] font-bold text-white/60">다시 누르면 닫힘</span>
                            </div>
                            <CloseOnSubmitForm action={updateLessonSchedule} className="grid gap-1.5">
                              <input type="hidden" name="source_type" value={item.sourceType} />
                              <input type="hidden" name="source_id" value={item.sourceId} />
                              <input type="hidden" name="student_id" value={item.studentId} />
                              <input type="hidden" name="original_date" value={item.originalDate || item.date} />
                              <input type="hidden" name="original_time" value={item.startTime} />
                              <input type="date" name="date" defaultValue={item.date} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                              <div className="grid grid-cols-2 gap-1">
                                <input name="start_time" defaultValue={item.startTime} placeholder="시작" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                <input name="end_time" defaultValue={item.endTime} placeholder="종료" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                              </div>
                              <input name="memo" defaultValue={item.memo || ""} placeholder="메모" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                              <div className="grid grid-cols-2 gap-1">
                                <button className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-[#171717]">수정</button>
                                <button formAction={deleteLessonSchedule} className="rounded-lg bg-white/15 px-2 py-1.5 text-[11px] font-black text-white">삭제</button>
                              </div>
                            </CloseOnSubmitForm>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`${mobileTab === "lessons" ? "" : "hidden"} rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-sm`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#737373]">Month</p>
              <h2 className="text-[15px] font-black text-[#171717]">이번달 수업 캘린더</h2>
            </div>
            <div className="flex gap-1">
              <Link href={`/?lessonMonth=${addMonthsToParam(lessonMonthParam, -1)}&calendarMonth=${calendarMonthParam}`} className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[10px] font-black text-[#171717]">‹</Link>
              <Link href={`/?lessonMonth=${monthParamFromInfo(currentMonthInfo)}&calendarMonth=${calendarMonthParam}`} className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[10px] font-black text-[#171717]">이번달</Link>
              <Link href={`/?lessonMonth=${addMonthsToParam(lessonMonthParam, 1)}&calendarMonth=${calendarMonthParam}`} className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[10px] font-black text-[#171717]">›</Link>
            </div>
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-[#e5e5e5] bg-[#f5f5f5] p-0.5">
            <div className="min-w-[660px]">
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-black text-[#737373]">
                {WEEKDAYS_MON.map((day) => <div key={`mobile-lesson-month-head-${day}`} className="py-1">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {lessonScheduleCalendarDays.map((cell, index) => {
                  const dayItems = cell.dateText ? monthScheduleByDate[cell.dateText] || [] : [];
                  return (
                    <div key={`mobile-lesson-month-${cell.dateText || index}`} className={`min-h-[66px] rounded-[10px] border p-1 ${cell.dateText === today ? "border-[#171717] bg-[#171717] text-white" : cell.isCurrentMonth ? "border-[#e5e5e5] bg-white text-[#171717]" : "border-[#e5e5e5] bg-[#f5f5f5] text-[#8a8a8a]"}`}>
                      {cell.dateText && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-black">{cell.day}</p>
                            {dayItems.length > 0 && <p className={`rounded-full px-1 py-0.5 text-[7px] font-black ${cell.dateText === today ? "bg-white text-[#171717]" : "bg-[#f5f5f5] text-[#525252]"}`}>{dayItems.length}</p>}
                          </div>
                          <div className="space-y-0.5">
                            {dayItems.map((item) => (
                              <details suppressHydrationWarning key={`mobile-lesson-month-item-${item.id}`} className={`rounded-none border px-0.5 py-0.5 text-[8px] font-bold leading-tight ${item.color}`}>
                                <summary className="cursor-pointer list-none">
                                  <p className="whitespace-nowrap">
                                    {item.startTime || "--:--"} {item.studentName}
                                  </p>
                                </summary>
                                <div className="fixed inset-0 z-[70] bg-black/45" aria-hidden="true" />
                                <div className="fixed left-1/2 top-1/2 z-[80] w-[min(88vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-[#171717] p-3 text-white shadow-2xl">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-black">{item.studentName} 수업</p>
                                    <span className="text-[9px] font-bold text-white/60">다시 누르면 닫힘</span>
                                  </div>
                                  <CloseOnSubmitForm action={updateLessonSchedule} className="grid gap-1.5">
                                    <input type="hidden" name="source_type" value={item.sourceType} />
                                    <input type="hidden" name="source_id" value={item.sourceId} />
                                    <input type="hidden" name="student_id" value={item.studentId} />
                                    <input type="hidden" name="original_date" value={item.originalDate || item.date} />
                                    <input type="hidden" name="original_time" value={item.startTime} />
                                    <input type="date" name="date" defaultValue={item.date} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                    <div className="grid grid-cols-2 gap-1">
                                      <input name="start_time" defaultValue={item.startTime} placeholder="시작" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                      <input name="end_time" defaultValue={item.endTime} placeholder="종료" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                    </div>
                                    <input name="memo" defaultValue={item.memo || ""} placeholder="메모" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                    <div className="grid grid-cols-2 gap-1">
                                      <button className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-[#171717]">수정</button>
                                      <button formAction={deleteLessonSchedule} className="rounded-lg bg-white/15 px-2 py-1.5 text-[11px] font-black text-white">삭제</button>
                                    </div>
                                  </CloseOnSubmitForm>
                                </div>
                              </details>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <details suppressHydrationWarning className="mt-2 rounded-[14px] border border-[#e5e5e5] bg-[#f7f7f7] px-2.5 py-1.5">
            <summary className="cursor-pointer list-none text-[11px] font-black text-[#171717]">+ 수업 추가</summary>
            <form action={addDashboardLessonEvent} className="mt-2 grid gap-1.5">
              <select name="student_id" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none">
                <option value="">학생</option>
                {students.map((student) => (
                  <option key={`mobile-add-lesson-${student.id}`} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <input type="date" name="event_date" defaultValue={today} className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <div className="grid grid-cols-2 gap-1">
                <input name="event_time" placeholder="시작" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
                <input name="end_time" placeholder="종료" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              </div>
              <div>
                <select name="event_type" defaultValue="수업" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none">
                  {LESSON_EVENT_TYPES.map((type) => (
                    <option key={`mobile-lesson-type-${type}`} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <input name="memo" placeholder="메모" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <button className="rounded-lg bg-[#171717] px-2 py-1.5 text-[11px] font-black text-white">추가</button>
            </form>
          </details>
        </section>

        <section id="mobile-calendar" className={`${mobileTab === "schedule" ? "" : "hidden"} rounded-[20px] border border-[#e5e5e5] bg-white p-3 shadow-sm`}>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#737373]">Calendar</p>
              <h2 className="text-[15px] font-black text-[#171717]">{formatMonthTitle(calendarMonthInfo)}</h2>
            </div>
            <div className="flex gap-1">
              <Link href={`/?tab=schedule&lessonMonth=${lessonMonthParam}&calendarMonth=${addMonthsToParam(calendarMonthParam, -1)}`} className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[10px] font-black text-[#171717]">‹</Link>
              <Link href={`/?tab=schedule&lessonMonth=${lessonMonthParam}&calendarMonth=${addMonthsToParam(calendarMonthParam, 1)}`} className="rounded-full bg-[#f5f5f5] px-2 py-1 text-[10px] font-black text-[#171717]">›</Link>
            </div>
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-[#e5e5e5] bg-[#f5f5f5] p-0.5">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-black text-[#737373]">
                {WEEKDAYS_MON.map((day) => <div key={`mobile-month-head-${day}`} className="py-1">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthlyCalendarDays.map((cell, index) => {
                  const dayEvents = cell.dateText ? (monthlyEventsByDate[cell.dateText] || []).filter((event) => event.sourceType !== "feedback") : [];
                  return (
                    <div key={`mobile-month-${cell.dateText || index}`} className={`min-h-[66px] rounded-[10px] border p-1 ${cell.dateText === today ? "border-[#171717] bg-[#171717] text-white" : cell.isCurrentMonth ? "border-[#e5e5e5] bg-white text-[#171717]" : "border-[#e5e5e5] bg-[#f5f5f5] text-[#8a8a8a]"}`}>
                      {cell.dateText && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-black">{cell.day}</p>
                            {dayEvents.length > 0 && <p className={`rounded-full px-1 py-0.5 text-[7px] font-black ${cell.dateText === today ? "bg-white text-[#171717]" : "bg-[#f5f5f5] text-[#525252]"}`}>{dayEvents.length}</p>}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.map((event) => (
                              <details suppressHydrationWarning key={`mobile-month-event-${event.id}`}>
                                <summary className={`cursor-pointer list-none border px-0.5 py-0.5 font-bold leading-tight ${event.range_position === "start" ? "rounded-l-full rounded-r-none" : event.range_position === "middle" ? "rounded-none border-x-0" : event.range_position === "end" ? "rounded-l-none rounded-r-full" : "rounded-none"} ${cell.dateText === today ? "border-white/25 bg-white text-[#171717]" : event.color}`}>
                                  <span className="block whitespace-nowrap text-[clamp(6px,1.1vw,8px)]">
                                    {event.event_time ? `${event.event_time} ` : ""}{event.studentName !== "나" && !event.title.startsWith(event.studentName) ? `${event.studentName} ` : ""}{event.title}
                                  </span>
                                </summary>
                                <div className="fixed inset-0 z-[70] bg-black/45" aria-hidden="true" />
                                <div className="fixed left-1/2 top-1/2 z-[80] w-[min(88vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-[#171717] p-3 text-white shadow-2xl">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-black">{event.title}</p>
                                    <span className="text-[9px] font-bold text-white/60">다시 누르면 닫힘</span>
                                  </div>
                                  <CloseOnSubmitForm action={updateMonthlyEvent} className="grid gap-1.5">
                                    <input type="hidden" name="source_type" value={event.sourceType} />
                                    <input type="hidden" name="source_id" value={event.sourceId} />
                                    <input type="hidden" name="student_id" value={event.studentId} />
                                    <input type="date" name="event_date" defaultValue={event.range_start || event.event_date} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                    {event.sourceType === "personal_event" && (
                                      <input type="date" name="end_date" defaultValue={event.range_end || event.event_date} className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                    )}
                                    {event.sourceType !== "feedback" && (
                                      <div className="grid grid-cols-2 gap-1">
                                        <input name="event_time" defaultValue={event.event_time || ""} placeholder="시작" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                        <input name="end_time" defaultValue={event.end_time || ""} placeholder="끝" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                      </div>
                                    )}
                                    {event.sourceType === "personal_event" && (
                                      <>
                                        <input name="title" defaultValue={event.title} placeholder="일정 이름" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                        <input name="memo" defaultValue={stripRangeEndMarker(event.memo)} placeholder="메모" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                      </>
                                    )}
                                    {event.sourceType === "student_event" && (
                                      <>
                                        <input name="title" defaultValue={event.title} placeholder="일정 이름" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                        <input name="memo" defaultValue={event.memo || ""} placeholder="메모" className="w-full rounded-lg border border-white/15 bg-white px-2 py-1.5 text-[11px] text-[#171717] outline-none" />
                                      </>
                                    )}
                                    <div className="grid grid-cols-2 gap-1">
                                      <button className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-black text-[#171717]">수정</button>
                                      <button formAction={deleteMonthlyEvent} className="rounded-lg bg-white/15 px-2 py-1.5 text-[11px] font-black text-white">삭제</button>
                                    </div>
                                  </CloseOnSubmitForm>
                                </div>
                              </details>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <details suppressHydrationWarning className="mt-2 rounded-[14px] border border-[#e5e5e5] bg-[#f7f7f7] px-2.5 py-1.5">
            <summary className="cursor-pointer list-none text-[11px] font-black text-[#171717]">+ 내 일정 추가</summary>
            <form action={addPersonalEvent} className="mt-2 grid gap-1.5">
              <input type="date" name="event_date" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <input type="date" name="end_date" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <div className="grid grid-cols-2 gap-1">
                <input name="event_time" placeholder="시작" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
                <input name="end_time" placeholder="끝" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              </div>
              <input name="title" placeholder="일정 이름" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <input name="memo" placeholder="메모" className="rounded-lg border border-[#d4d4d4] bg-white px-2 py-1.5 text-[11px] outline-none" />
              <button className="rounded-lg bg-[#171717] px-2 py-1.5 text-[11px] font-black text-white">추가</button>
            </form>
          </details>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e5e5] bg-white/85 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-[390px] grid-cols-3 gap-1">
          {[
            ["⌂", "수업", `/?tab=lessons&lessonMonth=${lessonMonthParam}&calendarMonth=${calendarMonthParam}`],
            ["□", "일정", `/?tab=schedule&lessonMonth=${lessonMonthParam}&calendarMonth=${calendarMonthParam}`],
            ["₩", "정산", "/payments"],
          ].map(([symbol, label, href]) => (
            <a
              key={href}
              href={href}
              className={`grid gap-0.5 rounded-xl px-1 py-1 text-center font-black ${label === "수업" && mobileTab === "lessons" || label === "일정" && mobileTab === "schedule" || label === "학생" && mobileTab === "students" ? "bg-[#f5f5f5] text-[#171717]" : "text-[#737373]"}`}
            >
              <span className="text-[14px] leading-none">{symbol}</span>
              <span className="text-[8px] leading-none">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto hidden max-w-7xl space-y-6 md:block">
        <header className="rounded-[2rem] border border-[#e5e5e5] bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#525252]">
                Today’s daily dashboard
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#171717]">
                오늘 하루도 열심히 ~
              </h1>
            </div>

            <div className="flex flex-wrap justify-end">
              <Link
                href="/payments"
                aria-label="월별정산"
                title="월별정산"
                className="group flex h-9 w-9 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white text-[#171717] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f7f7f7]"
              >
                <span aria-hidden="true" className="text-sm transition group-hover:scale-105">
                  ₩
                </span>
              </Link>
            </div>
          </div>

          <section className="mt-6 rounded-[1.75rem] border border-[#e5e5e5] bg-[#f5f5f5] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold text-[#525252]">
                  {formatShortDate(progress.startDate)} ~{" "}
                  {formatShortDate(progress.endDate)}
                </p>
              </div>
              <p className="text-3xl font-black text-[#171717]">
                {progress.percent}%
              </p>
            </div>

            <div className="mt-4 h-4 overflow-hidden rounded-full bg-[#d4d4d4]">
              <div
                className="h-full rounded-full bg-[#171717] transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </section>
        </header>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <input
              id="show-mine-timeline"
              type="checkbox"
              className="peer/timeline sr-only"
            />

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#82776d]">TODAY</p>
                <h2 className="text-2xl font-black">오늘의 일정</h2>
                <p className="mt-1 text-sm font-semibold text-[#9b7a84]">
                  오늘의 수업 모아보기
                </p>
              </div>
              <label
                htmlFor="show-mine-timeline"
                className="cursor-pointer rounded-full border border-[#d4d4d4] bg-[#f7f7f7] px-3 py-1.5 text-xs font-black text-[#404040] transition peer-checked/timeline:bg-[#171717] peer-checked/timeline:text-white"
              >
                나만보기
              </label>
            </div>

            {todayItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#f7f7f7] px-5 py-6 text-center text-sm font-bold text-[#525252]">
                오예 오늘은 휴일이당 ~
              </div>
            ) : (
              <div className="relative pl-9 peer-checked/timeline:[&_.mine-timeline-event]:block">
                <div className="absolute left-3 top-2 h-[calc(100%-1rem)] w-2 rounded-full bg-[#e5e5e5]">
                  <div
                    className="w-full rounded-full bg-[#171717] transition-all"
                    style={{ height: `${timelinePercent}%` }}
                  />
                  <div
                    className="pointer-events-none absolute left-1/2 z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#C8BAC6] bg-white text-base shadow-[0_4px_10px_rgba(232,79,134,0.28)]"
                    style={{ top: `${timelinePercent}%` }}
                    aria-label="현재 위치"
                  >
                    💗
                  </div>
                </div>
                <div className="space-y-3">
                  {todayItems.map((item) => (
                    <div key={item.id} className="relative">
                      <div
                        className={`relative rounded-none border px-4 py-3 ${item.sourceType === "personal_day_event" ? "mine-timeline-event hidden" : ""} ${item.color}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">
                              {item.startTime || "시간 미입력"}
                              {item.endTime ? ` - ${item.endTime}` : ""}
                            </p>
                            <p className="mt-1 text-base font-black">
                              {item.title}
                            </p>
                            {item.memo && (
                              <p className="mt-1 text-xs font-bold opacity-75">
                                {item.memo}
                              </p>
                            )}
                          </div>
                          {item.sourceType === "personal_day_event" ? (
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              <details>
                                <summary className="cursor-pointer list-none rounded-xl bg-white/80 px-3 py-2 text-xs font-black">
                                  수정
                                </summary>
                                <div className="fixed left-1/2 top-24 z-50 w-[min(94vw,720px)] -translate-x-1/2 rounded-[2rem] border border-[#d4d4d4] bg-white p-5 text-[#171717] shadow-2xl">
                                  <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-black text-[#171717]">내 일정 수정</p>
                                      <h3 className="mt-1 text-lg font-black">오늘의 개인 일정</h3>
                                    </div>
                                    <span className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-black text-[#171717]">
                                      다시 누르면 닫힘
                                    </span>
                                  </div>

                                  <form action={updatePersonalDayEvent} className="grid gap-2 md:grid-cols-5">
                                    <input type="hidden" name="event_id" value={item.sourceId} />
                                    <input
                                      type="date"
                                      name="event_date"
                                      defaultValue={item.date}
                                      className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <input
                                      name="start_time"
                                      defaultValue={item.startTime}
                                      placeholder="시작"
                                      className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <input
                                      name="end_time"
                                      defaultValue={item.endTime}
                                      placeholder="끝"
                                      className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <input
                                      name="title"
                                      defaultValue={item.title.replace(/^💗\s*/, "")}
                                      placeholder="일정 이름"
                                      className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                                      저장
                                    </button>
                                    <input
                                      name="memo"
                                      defaultValue={item.memo || ""}
                                      placeholder="메모"
                                      className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none md:col-span-5"
                                    />
                                  </form>

                                  <form action={deletePersonalDayEvent} className="mt-2">
                                    <input type="hidden" name="event_id" value={item.sourceId} />
                                    <button className="rounded-xl border border-[#b7aaa0] bg-[#f6f1ed] px-3 py-2 text-xs font-black text-[#171717]">
                                      삭제
                                    </button>
                                  </form>
                                </div>
                              </details>
                              <span className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black">
                                MY
                              </span>
                            </div>
                          ) : item.studentId ? (
                            <Link
                              href={`/students/${item.studentId}`}
                              className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black"
                            >
                              상세
                            </Link>
                          ) : (
                            <span className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black">
                              MY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 hidden rounded-2xl border border-[#d4d4d4] bg-[#f7f7f7] p-4 peer-checked/timeline:block">
              <details>
                <summary className="cursor-pointer list-none text-sm font-black text-[#171717]">
                  💗 내 일정 추가
                </summary>
                <form
                  action={addPersonalDayEvent}
                  className="mt-3 grid gap-2 md:grid-cols-6"
                >
                  <input type="hidden" name="event_date" value={today} />
                  <input
                    name="start_time"
                    placeholder="시작 13:00"
                    className="border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    name="end_time"
                    placeholder="끝 15:00"
                    className="border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    name="title"
                    placeholder="일정 이름"
                    className="border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                  />
                  <input
                    name="memo"
                    placeholder="메모"
                    className="border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <button className="bg-[#171717] px-3 py-2 text-sm font-black text-white">
                    추가
                  </button>
                </form>
              </details>
            </div>
          </article>

          <article className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
            <input
              id="show-mine-todo"
              type="checkbox"
              className="peer/todo sr-only"
            />

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#82776d]">TASKS</p>
                <h2 className="text-2xl font-black">오늘의 할일</h2>
                <p className="mt-1 text-sm font-semibold text-[#9b7a84]">
                  미완료/진행중 수행평 모아보기
                </p>
              </div>
              <label
                htmlFor="show-mine-todo"
                className="cursor-pointer rounded-full border border-[#d4d4d4] bg-[#f7f7f7] px-3 py-1.5 text-xs font-black text-[#404040] transition peer-checked/todo:bg-[#aaa299] peer-checked/todo:text-white"
              >
                펼치기
              </label>
            </div>

            <div className="hidden peer-checked/todo:block">
              <input
                id="show-personal-todo"
                type="checkbox"
                className="peer/mine-todo sr-only"
              />
              <label
                htmlFor="show-personal-todo"
                className="mb-4 ml-auto flex w-fit cursor-pointer rounded-full border border-[#d4d4d4] bg-[#f7f7f7] px-3 py-1.5 text-xs font-black text-[#404040] transition peer-checked/mine-todo:bg-[#aaa299] peer-checked/mine-todo:text-white"
              >
                나만보기
              </label>

              <div className="mb-4 hidden rounded-2xl border border-[#d9d2c7] bg-[#f7f7f7] p-4 peer-checked/mine-todo:block">
                <p className="mb-3 text-sm font-black text-[#70665e]">
                  💗 내 할일
                </p>
                <form
                  action={addPersonalTodo}
                  className="grid gap-2 md:grid-cols-[190px_1fr_auto]"
                >
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={today}
                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    name="title"
                    placeholder="할일 이름"
                    className="rounded-xl border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <button className="rounded-xl bg-[#8f8176] px-4 py-2 text-sm font-black text-white">
                    추가
                  </button>
                </form>
                <div className="mt-3 space-y-2">
                  {personalTodos.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#d4d4d4] bg-white/70 px-4 py-4 text-center text-xs font-bold text-[#525252]">
                      내 할일이 없어요.
                    </p>
                  ) : (
                    personalTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`flex items-center justify-between gap-3 border-l-8 bg-white px-3 py-2 shadow-sm ${todo.is_done ? "border-[#d6c4cd] opacity-60" : "border-[#aaa299]"}`}
                      >
                        <form
                          action={togglePersonalTodo}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <input type="hidden" name="todo_id" value={todo.id} />
                          <input
                            type="hidden"
                            name="is_done"
                            value={String(Boolean(todo.is_done))}
                          />
                          <button
                            className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs font-black ${todo.is_done ? "border-[#b7a2ad] bg-[#f0e5ea] text-[#7f6873]" : "border-[#aaa299] bg-[#ffffff] text-[#171717]"}`}
                          >
                            {todo.is_done ? "✓" : ""}
                          </button>
                          <span className="shrink-0 text-xs font-black text-[#70665e]">
                            {todo.due_date
                              ? formatShortDate(todo.due_date)
                              : "날짜 없음"}
                          </span>
                          <p
                            className={`min-w-0 flex-1 truncate text-sm font-black text-[#171717] ${todo.is_done ? "line-through" : ""}`}
                          >
                            {todo.title}
                          </p>
                        </form>
                        <form action={deletePersonalTodo}>
                          <input type="hidden" name="todo_id" value={todo.id} />
                          <button className="px-2 py-1 text-xs font-black text-[#70665e]">
                            삭제
                          </button>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                {performanceTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#f7f7f7] px-5 py-8 text-center text-sm font-bold text-[#525252]">
                  오예 진행 중인 수행평가가 없어요.
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedPerformanceTasks.slice(0, 8).map((task) => {
                    const badge = deadlineBadge(task.due_date, today);
                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-black text-[#171717]">
                                {getStudentName(task.student_id, students)}
                              </span>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#171717]">
                                {task.subject}
                              </span>
                              <span className="rounded-full bg-[#f5f0ff] px-3 py-1 text-xs font-black text-[#6d5ba8]">
                                {task.status === "in_progress"
                                  ? "진행중"
                                  : "미완료"}
                              </span>
                              {badge && (
                                <span className="rounded-full bg-[#e6ded6] px-3 py-1 text-xs font-black text-[#d63f6f]">
                                  {badge}
                                </span>
                              )}
                            </div>
                            <p className="mt-3 text-base font-black text-[#171717]">
                              {task.title}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#525252]">
                              {formatShortDate(task.due_date)}{" "}
                              {normalizeTime(task.due_time)}
                            </p>
                          </div>

                          <form action={completePerformanceTask}>
                            <input
                              type="hidden"
                              name="task_id"
                              value={task.id}
                            />
                            <input
                              type="hidden"
                              name="student_id"
                              value={task.student_id}
                            />
                            <button className="rounded-xl bg-[#171717] px-4 py-2 text-xs font-black text-white">
                              완료
                            </button>
                          </form>
                        </div>

                        <form
                          action={updatePerformanceMemo}
                          className="mt-3 flex gap-2"
                        >
                          <input type="hidden" name="task_id" value={task.id} />
                          <input
                            type="hidden"
                            name="student_id"
                            value={task.student_id}
                          />
                          <input
                            name="memo"
                            defaultValue={task.memo || ""}
                            placeholder="메모 추가"
                            className="min-w-0 flex-1 rounded-xl border border-[#d4d4d4] bg-white px-4 py-2 text-sm outline-none"
                          />
                          <button className="rounded-xl border border-[#d4d4d4] bg-[#f7f7f7] px-4 py-2 text-xs font-black text-[#171717]">
                            저장
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            </div>
          </article>
        </section>

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-black text-[#525252]">WEEKLY LESSONS</p>
            <h2 className="text-2xl font-black">이번주 수업 스케줄</h2>
            <p className="mt-1 text-sm font-semibold text-[#525252]">
              학생 캘린더 연동
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-7">
            {weekDates.map((dateText) => {
              const dayItems = scheduleByDate[dateText] || [];
              return (
                <div
                  key={dateText}
                  className="rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-3"
                >
                  <div className="mb-3 text-center">
                    <p className="text-xs font-black text-[#525252]">
                      {getDayLabel(dateText)}
                    </p>
                    <p className="text-sm font-black text-[#171717]">
                      {formatShortDate(dateText)}
                    </p>
                  </div>

                  {dayItems.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white px-3 py-4 text-center text-xs font-bold text-[#525252]">
                      오예
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayItems.map((item) => (
                        <details
                          key={item.id}
                          className={`rounded-none border p-3 ${item.color}`}
                        >
                          <summary className="cursor-pointer list-none">
                            <p className="text-xs font-black">
                              {item.startTime || "시간 미입력"}
                            </p>
                            <p className="mt-1 text-xs font-black leading-snug">
                              {item.title}
                            </p>
                          </summary>

                          <form
                            action={updateLessonSchedule}
                            className="mt-3 space-y-2"
                          >
                            <input
                              type="hidden"
                              name="source_type"
                              value={item.sourceType}
                            />
                            <input
                              type="hidden"
                              name="source_id"
                              value={item.sourceId}
                            />
                            <input
                              type="hidden"
                              name="student_id"
                              value={item.studentId}
                            />
                            <input
                              type="hidden"
                              name="original_date"
                              value={item.originalDate || item.date}
                            />
                            <input
                              type="hidden"
                              name="original_time"
                              value={item.startTime}
                            />
                            <input
                              type="date"
                              name="date"
                              defaultValue={item.date}
                              className="w-full rounded-xl border border-white/70 bg-white px-2 py-2 text-xs outline-none"
                            />
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                name="start_time"
                                defaultValue={item.startTime}
                                placeholder="시작"
                                className="w-full rounded-xl border border-white/70 bg-white px-2 py-2 text-xs outline-none"
                              />
                              <input
                                name="end_time"
                                defaultValue={item.endTime}
                                placeholder="종료"
                                className="w-full rounded-xl border border-white/70 bg-white px-2 py-2 text-xs outline-none"
                              />
                            </div>
                            <input
                              name="memo"
                              defaultValue={item.memo || ""}
                              placeholder="메모"
                              className="w-full rounded-xl border border-white/70 bg-white px-2 py-2 text-xs outline-none"
                            />
                            <div className="grid grid-cols-2 gap-1">
                              <button className="rounded-xl bg-white px-2 py-2 text-xs font-black">
                                수정
                              </button>
                              <button
                                formAction={deleteLessonSchedule}
                                className="rounded-xl bg-white/70 px-2 py-2 text-xs font-black"
                              >
                                삭제
                              </button>
                            </div>
                          </form>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <details className="mt-6 rounded-[1.75rem] border border-[#e5e5e5] bg-[#f5f5f5] p-4">
            <summary className="cursor-pointer list-none rounded-2xl border border-[#cfc4ba] bg-white px-4 py-3 text-sm font-black text-[#404040] shadow-sm transition hover:-translate-y-0.5">
              📅 먼슬리 수업스케줄 보기
            </summary>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-[#525252]">MONTHLY LESSONS</p>
                <p className="text-lg font-black text-[#171717]">{formatMonthTitle(lessonScheduleMonthInfo)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/?lessonMonth=${addMonthsToParam(lessonMonthParam, -1)}&calendarMonth=${calendarMonthParam}`}
                  className="rounded-full border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-black text-[#171717]"
                >
                  이전달
                </Link>
                <Link
                  href={`/?lessonMonth=${monthParamFromInfo(currentMonthInfo)}&calendarMonth=${calendarMonthParam}`}
                  className="rounded-full border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-black text-[#171717]"
                >
                  이번달
                </Link>
                <Link
                  href={`/?lessonMonth=${addMonthsToParam(lessonMonthParam, 1)}&calendarMonth=${calendarMonthParam}`}
                  className="rounded-full border border-[#d4d4d4] bg-white px-3 py-1.5 text-xs font-black text-[#171717]"
                >
                  다음달
                </Link>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-[#e5e5e5] bg-white">
              <div className="grid grid-cols-7 bg-[#f7f7f7]">
                {WEEKDAYS_MON.map((day) => (
                  <div
                    key={`monthly-lesson-day-${day}`}
                    className="border-r border-[#e5e5e5] px-3 py-3 text-center text-xs font-black text-[#171717] last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-white">
                {lessonScheduleCalendarDays.map((cell, index) => {
                  const lessonItems = cell.dateText
                    ? monthScheduleByDate[cell.dateText] || []
                    : [];

                  return (
                    <div
                      key={`monthly-lesson-${cell.dateText || "blank"}-${index}`}
                      className={`min-h-[150px] border-r border-t border-[#e5e5e5] p-2 last:border-r-0 ${
                        cell.dateText === today
                          ? "bg-[#e5e5e5] ring-2 ring-inset ring-[#8d8177]"
                          : cell.isCurrentMonth
                            ? "bg-white"
                            : "bg-[#f5f5f5]"
                      }`}
                    >
                      {cell.dateText && (
                        <>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-xs font-black ${cell.isCurrentMonth ? "text-[#171717]" : "text-[#8a8a8a]"}`}>
                              {cell.day}
                            </span>
                            {lessonItems.length > 0 && (
                              <span className="rounded-full bg-[#f7f7f7] px-2 py-0.5 text-[10px] font-black text-[#171717]">
                                {lessonItems.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {lessonItems.map((item) => (
                              <details
                                key={`monthly-lesson-item-${item.id}`}
                                className={`rounded-none border px-2 py-1 text-[11px] font-bold leading-snug ${item.color}`}
                              >
                                <summary className="cursor-pointer list-none">
                                  <span className="block truncate">
                                    {item.startTime || "시간 미입력"}{" "}
                                    {item.title}
                                  </span>
                                </summary>

                                <form
                                  action={updateLessonSchedule}
                                  className="mt-2 space-y-1 rounded-xl bg-white/75 p-2"
                                >
                                  <input
                                    type="hidden"
                                    name="source_type"
                                    value={item.sourceType}
                                  />
                                  <input
                                    type="hidden"
                                    name="source_id"
                                    value={item.sourceId}
                                  />
                                  <input
                                    type="hidden"
                                    name="student_id"
                                    value={item.studentId}
                                  />
                                  <input
                                    type="hidden"
                                    name="original_date"
                                    value={item.originalDate || item.date}
                                  />
                                  <input
                                    type="hidden"
                                    name="original_time"
                                    value={item.startTime}
                                  />
                                  <input
                                    type="date"
                                    name="date"
                                    defaultValue={item.date}
                                    className="w-full rounded-lg border border-white bg-white px-2 py-1 text-[10px] outline-none"
                                  />
                                  <div className="grid grid-cols-2 gap-1">
                                    <input
                                      name="start_time"
                                      defaultValue={item.startTime}
                                      placeholder="시작"
                                      className="w-full rounded-lg border border-white bg-white px-2 py-1 text-[10px] outline-none"
                                    />
                                    <input
                                      name="end_time"
                                      defaultValue={item.endTime}
                                      placeholder="종료"
                                      className="w-full rounded-lg border border-white bg-white px-2 py-1 text-[10px] outline-none"
                                    />
                                  </div>
                                  <input
                                    name="memo"
                                    defaultValue={item.memo || ""}
                                    placeholder="메모"
                                    className="w-full rounded-lg border border-white bg-white px-2 py-1 text-[10px] outline-none"
                                  />
                                  <div className="grid grid-cols-2 gap-1">
                                    <button className="rounded-lg bg-white px-2 py-1 text-[10px] font-black">
                                      수정
                                    </button>
                                    <button
                                      formAction={deleteLessonSchedule}
                                      className="rounded-lg bg-white/80 px-2 py-1 text-[10px] font-black"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </form>
                              </details>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              action={addDashboardLessonEvent}
              className="mt-4 grid gap-2 rounded-[1.5rem] border border-[#e5e5e5] bg-white px-4 py-4 md:grid-cols-6"
            >
              <div className="md:col-span-6">
                <p className="text-xs font-black text-[#525252]">
                  LESSON ADD
                </p>
                <p className="text-sm font-black text-[#171717]">
                  학생 수업 추가
                </p>
              </div>
              <select
                name="student_id"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
                required
              >
                <option value="">학생</option>
                {students.map((student) => (
                  <option key={`lesson-add-student-${student.id}`} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="event_date"
                defaultValue={today}
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
                required
              />
              <input
                name="event_time"
                placeholder="시작"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
              />
              <input
                name="end_time"
                placeholder="종료"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
              />
              <select
                name="event_type"
                defaultValue="수업"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
              >
                {LESSON_EVENT_TYPES.map((type) => (
                  <option key={`lesson-add-type-${type}`} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                name="memo"
                placeholder="메모"
                className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
              />
              <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white md:col-span-6">
                수업 추가
              </button>
            </form>
          </details>
        </section>

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#525252]">
                MONTHLY CALENDAR
              </p>
              <h2 className="text-2xl font-black">이번달 스케줄</h2>
              <p className="mt-1 text-sm font-semibold text-[#525252]">
                {formatMonthTitle(calendarMonthInfo)} · 수행평가·시험·피드백·기타 일정만 모아보기
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/?lessonMonth=${lessonMonthParam}&calendarMonth=${addMonthsToParam(calendarMonthParam, -1)}`}
                className="rounded-full border border-[#d4d4d4] bg-[#f5f5f5] px-3 py-1.5 text-xs font-black text-[#171717]"
              >
                이전달
              </Link>
              <Link
                href={`/?lessonMonth=${lessonMonthParam}&calendarMonth=${monthParamFromInfo(currentMonthInfo)}`}
                className="rounded-full border border-[#d4d4d4] bg-[#f5f5f5] px-3 py-1.5 text-xs font-black text-[#171717]"
              >
                이번달
              </Link>
              <Link
                href={`/?lessonMonth=${lessonMonthParam}&calendarMonth=${addMonthsToParam(calendarMonthParam, 1)}`}
                className="rounded-full border border-[#d4d4d4] bg-[#f5f5f5] px-3 py-1.5 text-xs font-black text-[#171717]"
              >
                다음달
              </Link>
            </div>
          </div>

          <input
            id="show-mine-calendar"
            type="checkbox"
            className="peer/calendar sr-only"
          />
          <input
            id="show-feedback-calendar"
            type="checkbox"
            className="peer/feedback sr-only"
          />

          <div className="peer-checked/calendar:[&_.personal-calendar-event]:block peer-checked/calendar:[&_.personal-calendar-form]:grid peer-checked/calendar:[&_.personal-calendar-label]:bg-[#171717] peer-checked/calendar:[&_.personal-calendar-label]:text-white peer-checked/feedback:[&_.feedback-calendar-event]:block peer-checked/feedback:[&_.feedback-calendar-label]:bg-[#171717] peer-checked/feedback:[&_.feedback-calendar-label]:text-white">
            <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-[#e5e5e5] bg-white">
              <div className="grid grid-cols-7 bg-[#f7f7f7]">
                {WEEKDAYS_MON.map((day) => (
                  <div
                    key={day}
                    className="border-r border-[#e5e5e5] px-3 py-3 text-center text-xs font-black text-[#171717] last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-white">
                {monthlyCalendarDays.map((cell, index) => {
                  const allDateEvents = cell.dateText
                    ? monthlyEventsByDate[cell.dateText] || []
                    : [];
                  const visibleDateEvents = allDateEvents.filter(
                    (event) =>
                      event.sourceType !== "personal_event" &&
                      event.sourceType !== "feedback",
                  );
                  return (
                    <div
                      key={`${cell.dateText || "blank"}-${index}`}
                      className={`min-h-[132px] border-r border-t border-[#e5e5e5] p-2 last:border-r-0 ${
                        cell.dateText === today
                          ? "bg-[#e5e5e5] ring-2 ring-inset ring-[#8d8177]"
                          : cell.isCurrentMonth
                            ? "bg-white"
                            : "bg-[#f5f5f5]"
                      }`}
                    >
                      {cell.dateText && (
                        <>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-xs font-black ${cell.isCurrentMonth ? "text-[#171717]" : "text-[#8a8a8a]"}`}>
                              {cell.day}
                            </span>
                            {visibleDateEvents.length > 0 && (
                              <span className="rounded-full bg-[#f7f7f7] px-2 py-0.5 text-[10px] font-black text-[#171717]">
                                {visibleDateEvents.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {allDateEvents.map((event) => (
                              <details
                                key={event.id}
                                className={
                                  event.sourceType === "personal_event"
                                    ? "personal-calendar-event hidden"
                                    : event.sourceType === "feedback"
                                      ? "feedback-calendar-event hidden"
                                    : ""
                                }
                              >
                                <summary
                                  className={`cursor-pointer list-none border-l-[10px] px-2 py-1 text-[11px] font-bold leading-snug ${event.range_position === "start" ? "rounded-l-full rounded-r-none" : event.range_position === "middle" ? "rounded-none border-x-0" : event.range_position === "end" ? "rounded-l-none rounded-r-full" : "rounded-none"} ${event.color}`}
                                >
                                  <span className="block truncate">
                                    {event.sourceType === "personal_event"
                                      ? `${event.event_time ? `${event.event_time} ` : ""}${event.title}`
                                      : `${event.event_time ? `${event.event_time} ` : ""}${event.title}`}
                                  </span>
                                </summary>
                                <div className="mt-1 rounded-xl border border-[#e5e5e5] bg-white p-1">
                                  <form
                                    action={updateMonthlyEvent}
                                    className="space-y-1"
                                  >
                                    <input
                                      type="hidden"
                                      name="source_type"
                                      value={event.sourceType}
                                    />
                                    <input
                                      type="hidden"
                                      name="source_id"
                                      value={event.sourceId}
                                    />
                                    <input
                                      type="hidden"
                                      name="student_id"
                                      value={event.studentId}
                                    />
                                    <input
                                      type="date"
                                      name="event_date"
                                      defaultValue={event.range_start || event.event_date}
                                      className="w-full rounded-lg border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                    />
                                    {event.sourceType === "personal_event" && (
                                      <input
                                        type="date"
                                        name="end_date"
                                        defaultValue={event.range_end || event.event_date}
                                        className="w-full rounded-lg border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                      />
                                    )}
                                    {event.sourceType !== "feedback" && (
                                      <div className="grid grid-cols-2 gap-1">
                                        <input
                                          name="event_time"
                                          defaultValue={event.event_time || ""}
                                          placeholder="시작"
                                          className="w-full border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                        />
                                        <input
                                          name="end_time"
                                          defaultValue={event.end_time || ""}
                                          placeholder="끝"
                                          className="w-full border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                        />
                                      </div>
                                    )}
                                    {event.sourceType === "personal_event" && (
                                      <>
                                        <input
                                          name="title"
                                          defaultValue={event.title}
                                          placeholder="일정 이름"
                                          className="w-full rounded-lg border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                        />
                                        <input
                                          name="memo"
                                          defaultValue={stripRangeEndMarker(event.memo)}
                                          placeholder="메모"
                                          className="w-full rounded-lg border border-[#e5e5e5] px-2 py-1 text-[10px] outline-none"
                                        />
                                      </>
                                    )}
                                    <button className="w-full rounded-lg bg-[#f7f7f7] px-2 py-1 text-[10px] font-black text-[#171717]">
                                      수정
                                    </button>
                                  </form>
                                  <form
                                    action={deleteMonthlyEvent}
                                    className="mt-1"
                                  >
                                    <input
                                      type="hidden"
                                      name="source_type"
                                      value={event.sourceType}
                                    />
                                    <input
                                      type="hidden"
                                      name="source_id"
                                      value={event.sourceId}
                                    />
                                    <input
                                      type="hidden"
                                      name="student_id"
                                      value={event.studentId}
                                    />
                                    <button className="w-full rounded-lg bg-[#ffe6ec] px-2 py-1 text-[10px] font-black text-[#d63f6f]">
                                      삭제
                                    </button>
                                  </form>
                                </div>
                              </details>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-[#404040]">
                    보기 설정
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label
                    htmlFor="show-feedback-calendar"
                    className="feedback-calendar-label w-fit cursor-pointer rounded-full border border-[#cfc4ba] bg-white px-3 py-1.5 text-xs font-black text-[#404040] transition"
                  >
                    피드백 보기
                  </label>
                  <label
                    htmlFor="show-mine-calendar"
                    className="personal-calendar-label w-fit cursor-pointer rounded-full border border-[#cfc4ba] bg-white px-3 py-1.5 text-xs font-black text-[#404040] transition"
                  >
                    나만보기
                  </label>
                </div>
              </div>

              <form
                action={addPersonalEvent}
                className="personal-calendar-form mt-3 hidden grid-cols-2 gap-2 md:grid-cols-6"
              >
                <input
                  type="date"
                  name="event_date"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                />
                <input
                  type="date"
                  name="end_date"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                />
                <input
                  name="event_time"
                  placeholder="시작"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                />
                <input
                  name="end_time"
                  placeholder="끝"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none"
                />
                <input
                  name="title"
                  placeholder="일정 이름"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none md:col-span-2"
                />
                <button className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white">
                  추가
                </button>
                <input
                  name="memo"
                  placeholder="메모"
                  className="rounded-xl border border-[#b7aaa0] bg-white px-3 py-2 text-sm outline-none md:col-span-6"
                />
              </form>
            </div>
          </div>

          <div className="mt-6 p-2">
            <div className="flex flex-wrap gap-5">
              {students.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="group flex w-24 flex-col items-center gap-2 transition hover:-translate-y-1"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-transparent">
                    {student.avatar_url ? (
                      <img
                        src={student.avatar_url}
                        alt={`${student.name} 아바타`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#ffe5ef] text-xl font-black text-[#171717]">
                        {student.name.slice(0, 1)}
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-black text-[#171717]">
                      {student.name}
                    </p>
                    <p className="mt-0.5 text-[14px font-black text-[#171717]">
                      Lv. {levelFromExp(student.exp_points, student.level)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
