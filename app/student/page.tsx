import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StudyTimer from "@/components/StudyTimer";
import StudyPlannerBoard from "@/components/StudyPlannerBoard";

const SUBJECTS = ["국어", "영어", "수학", "사회", "과학", "한국사", "기타"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DAY_INDEX: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const TAB_ITEMS = [
  { key: "home", label: "홈", href: "/student?tab=home", icon: "home" },
  { key: "homework", label: "공부", href: "/student?tab=homework", icon: "check" },
  { key: "performance", label: "수행", href: "/student?tab=performance", icon: "flag" },
  { key: "progress", label: "진도", href: "/student?tab=progress", icon: "chart" },
  { key: "schedule", label: "일정", href: "/student?tab=schedule", icon: "calendar" },
];

const PERFORMANCE_SUBJECTS = ["선택안함", "국어", "영어", "수학", "사회", "과학", "한국사", "자율", "진로", "동아리", "직접입력"];
const PERFORMANCE_STATUS_LABELS: Record<string, string> = { not_started: "미완료", in_progress: "진행중", done: "완성" };
const STATUS_LABELS: Record<string, string> = { not_started: "미완료", in_progress: "진행중", done: "완료", review: "복습", homework: "숙제", planned: "예정", deferred: "미뤄짐" };
const SELF_STUDY_STATUS_LABELS: Record<string, string> = { not_started: "○", in_progress: "△", done: "×", deferred: "↗" };
const SELF_STUDY_STATUS_TEXT: Record<string, string> = { not_started: "미완료", in_progress: "진행중", done: "완료", deferred: "미루기" };
const APP_FONT = "ui-rounded, Pretendard, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif";

const SUBJECT_STYLES: Record<string, { bg: string; soft: string; text: string; border: string; hex: string }> = {
  국어: { bg: "bg-[#dbeafe]", soft: "bg-[#f8fafc]", text: "text-[#2563eb]", border: "border-[#93c5fd]", hex: "#93c5fd" },
  영어: { bg: "bg-[#dcfce7]", soft: "bg-[#f8fafc]", text: "text-[#16a34a]", border: "border-[#86efac]", hex: "#86efac" },
  수학: { bg: "bg-[#fef3c7]", soft: "bg-[#f8fafc]", text: "text-[#d97706]", border: "border-[#fcd34d]", hex: "#fcd34d" },
  사회: { bg: "bg-[#ede9fe]", soft: "bg-[#f8fafc]", text: "text-[#7c3aed]", border: "border-[#c4b5fd]", hex: "#c4b5fd" },
  과학: { bg: "bg-[#cffafe]", soft: "bg-[#f8fafc]", text: "text-[#0891b2]", border: "border-[#67e8f9]", hex: "#67e8f9" },
  한국사: { bg: "bg-[#e5e7eb]", soft: "bg-[#f8fafc]", text: "text-[#4b5563]", border: "border-[#cbd5e1]", hex: "#cbd5e1" },
  기타: { bg: "bg-[#e2e8f0]", soft: "bg-[#f8fafc]", text: "text-[#64748b]", border: "border-[#cbd5e1]", hex: "#cbd5e1" },
};

type SavedTask = { progress_id?: string; subject?: string; unit_name?: string; task_name?: string; before_status?: string; publisher?: string | null; material_name?: string | null; major_unit?: string | null; };
type SubjectRecord = { subject?: string; homework_items?: SavedTask[] };
type LessonRecord = {
  id: string;
  student_id: string;
  lesson_date: string;
  start_time: string | null;
  end_time?: string | null;
  memo?: string | null;
  is_extra?: boolean | null;
  subject_records?: SubjectRecord[] | null;
};
type ExamProgress = { id: string; student_id: string; subject: string; unit_name: string; statuses: Record<string, string> | string | null; sort_order: number | null; publisher?: string | null; material_name?: string | null; major_unit?: string | null };
type PerformanceTask = { id: string; student_id: string; subject: string; title: string; due_date: string | null; due_time: string | null; status: string; memo: string | null; created_at: string };
type LessonTime = { id: string; student_id: string; day_of_week: string; start_time: string; end_time: string; memo: string | null };
type StudentEvent = {
  id: string;
  student_id: string;
  event_date: string;
  event_time: string | null;
  subject: string | null;
  title: string;
  event_type: string | null;
  memo: string | null;
  source_type?: string | null;
  source_id?: string | null;
  original_event_date?: string | null;
  original_lesson_time_id?: string | null;
  is_auto?: boolean | null;
};
type MakeupLesson = {
  id: string;
  student_id: string;
  absent_date?: string | null;
  makeup_date: string | null;
  makeup_time: string | null;
  memo?: string | null;
  is_done?: boolean | null;
};
type CalendarEvent = {
  id: string;
  event_date: string;
  event_time: string | null;
  subject: string | null;
  title: string;
  event_type: string | null;
  memo?: string | null;
  is_auto?: boolean | null;
  source_type?: string | null;
  source_id?: string | null;
  original_event_date?: string | null;
  original_lesson_time_id?: string | null;
  link_url?: string | null;
  deletable?: boolean;
};
type SelfStudyTask = { id: string; student_id: string; subject: string | null; title: string; due_date: string | null; status: string | null; memo: string | null };
type StudyTimeSession = { id: string; student_id: string; subject: string | null; title: string | null; duration_seconds: number; studied_at: string | null; started_at?: string | null; ended_at?: string | null };
type WeeklyPlanBlock = { id: string; day: string; start: string; end: string; category: string; subject?: string | null; customSubject?: string | null; memo?: string | null };
type HomeworkTask = { id: string; progressId: string; subject: string; unitName: string; taskName: string; publisher?: string | null; materialName?: string | null; majorUnit?: string | null; source?: "exam" | "manual"; lessonDate?: string | null; recordId?: string | null };
type HomeworkCheck = { id: string; student_id: string; homework_key: string; is_checked: boolean };
type StudyGoal = { id: string; student_id: string; goal_date: string; goal_seconds: number };
type NextLessonInfo = { dateText: string; timeText: string; leftText: string; memo?: string | null };

function Icon({ name }: { name: string }) {
  const common = "mx-auto mb-0.5 h-[18px] w-[18px]";
  if (name === "home") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>;
  if (name === "check") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  if (name === "flag") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M5 21V4"/><path d="M5 4h12l-2 5 2 5H5"/></svg>;
  if (name === "chart") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>;
}

function parseStatuses(statuses: ExamProgress["statuses"]) { if (!statuses) return {}; if (typeof statuses === "string") { try { return JSON.parse(statuses) as Record<string, string>; } catch { return {}; } } return statuses; }
function getVisibleStatusEntries(statuses: Record<string, string>) { return Object.entries(statuses).filter(([taskName]) => taskName && !taskName.startsWith("__")); }
function normalizeTime(time?: string | null) { if (!time) return ""; return String(time).slice(0, 5); }
function getTodayText() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function getNowKst() { return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })); }
function getTodayKoreanShort() { const today = new Date(`${getTodayText()}T00:00:00+09:00`); return today.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" }); }
function nextDateText(dateText: string) { const date = new Date(`${dateText}T00:00:00+09:00`); date.setDate(date.getDate() + 1); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function addDaysText(dateText: string, days: number) { const date = new Date(`${dateText}T00:00:00+09:00`); date.setDate(date.getDate() + days); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function minDateText(...dates: string[]) { return dates.reduce((min, date) => (date < min ? date : min), dates[0]); }
function maxDateText(...dates: string[]) { return dates.reduce((max, date) => (date > max ? date : max), dates[0]); }
function daysUntilDue(dateText?: string | null) { if (!dateText) return null; const today = new Date(`${getTodayText()}T00:00:00+09:00`); const due = new Date(`${dateText}T00:00:00+09:00`); if (Number.isNaN(due.getTime())) return null; return Math.round((due.getTime() - today.getTime()) / 86400000); }
function ddayLabel(dateText?: string | null) { const diff = daysUntilDue(dateText); if (diff === null) return "D-day 없음"; if (diff === 0) return "D-Day"; if (diff > 0) return `D-${diff}`; return `D+${Math.abs(diff)}`; }
function urgentLabel(dateText?: string | null) { const diff = daysUntilDue(dateText); if (diff === null) return ""; if (diff === 0) return "오늘"; if (diff === 1) return "내일"; if (diff < 0) return "지남"; if (diff <= 7) return `${diff}일 남음`; return ""; }
function formatDate(dateText?: string | null) { if (!dateText) return "날짜 미정"; const date = new Date(`${dateText}T00:00:00+09:00`); if (Number.isNaN(date.getTime())) return dateText; return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", weekday: "short" }); }
function formatHeaderDate(dateText?: string | null) { if (!dateText) return ""; const date = new Date(`${dateText}T00:00:00+09:00`); if (Number.isNaN(date.getTime())) return dateText; const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); const w = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()]; return `${m}월 ${d}일 (${w})`; }
function formatSlashDate(dateText?: string | null) { if (!dateText) return ""; const date = new Date(`${dateText}T00:00:00+09:00`); if (Number.isNaN(date.getTime())) return dateText; const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); const w = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()]; return `${y}/${m}/${d}/${w}`; }
function isCanceledEvent(event: StudentEvent) { const type = String(event.event_type || ""); const title = String(event.title || ""); const memo = String(event.memo || ""); return type.includes("취소") || title.includes("취소") || memo.includes("수업취소"); }
function formatSeconds(total: number) { const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); if (hours && minutes) return `${hours}시간 ${minutes}분`; if (hours) return `${hours}시간`; return `${minutes}분`; }
function sameScopeText(a?: string | null, b?: string | null) { return String(a || "").trim() && String(a || "").trim() === String(b || "").trim(); }
function studySubjectTotals(sessions: StudyTimeSession[]) { const map = new Map<string, number>(); sessions.forEach((session) => { const subject = session.subject || "기타"; const seconds = Number(session.duration_seconds || 0); map.set(subject, (map.get(subject) || 0) + seconds); }); return Array.from(map.entries()).map(([subject, seconds]) => ({ subject, seconds })).filter((item) => item.seconds > 0).sort((a, b) => b.seconds - a.seconds); }
function parseWeeklyPlan(value: unknown): { blocks: WeeklyPlanBlock[] } { if (!value || typeof value !== "object" || Array.isArray(value)) return { blocks: [] }; const raw = value as Record<string, any>; if (Array.isArray(raw.blocks)) return { blocks: raw.blocks.filter((b) => b && b.day && b.start && b.end && b.category).map((b) => ({ id: String(b.id || `${b.day}-${b.start}-${b.end}`), day: String(b.day), start: normalizeTime(b.start) || String(b.start), end: normalizeTime(b.end) || String(b.end), category: String(b.category) === "개인공부" ? "자습" : String(b.category), subject: b.subject ? String(b.subject) : null, customSubject: b.customSubject ? String(b.customSubject) : null, memo: b.memo ? String(b.memo) : null })) }; return { blocks: [] }; }
function weeklyLabel(block: WeeklyPlanBlock) { const subject = block.subject === "직접입력" ? block.customSubject || "직접입력" : block.subject || ""; return [block.category, subject, block.memo].filter(Boolean).join(" · "); }
function statusChip(status?: string | null) { if (status === "done" || status === "완료" || status === "완성") return "bg-[#f3f4f6] text-[#111827] border-[#d1d5db]"; if (status === "in_progress" || status === "진행중") return "bg-white text-[#111827] border-[#d1d5db]"; if (status === "homework" || status === "숙제") return "bg-[#f8fafc] text-[#334155] border-[#cbd5e1]"; if (status === "planned" || status === "예정") return "bg-[#f8fafc] text-[#475569] border-[#cbd5e1]"; if (status === "review" || status === "복습") return "bg-[#f9fafb] text-[#4b5563] border-[#d1d5db]"; return "bg-white text-[#6b7280] border-[#e5e7eb]"; }
function selfStudyChip(status?: string | null) { if (status === "done") return "border-[#111827] bg-[#111827] text-white"; if (status === "in_progress") return "border-[#9ca3af] bg-white text-[#111827]"; if (status === "deferred") return "border-[#9ca3af] bg-[#f3f4f6] text-[#111827]"; return "border-[#d1d5db] bg-white text-[#6b7280]"; }
function performanceStatusChip(status?: string | null) { if (status === "done") return "bg-[#111827] text-white"; if (status === "in_progress") return "bg-[#f3f4f6] text-[#111827]"; return "bg-white text-[#6b7280]"; }
function finalPerformanceSubject(subject: string, customSubject: string) { const cleanSubject = subject.trim(); const cleanCustomSubject = customSubject.trim(); if (cleanSubject === "직접입력") return cleanCustomSubject || "선택안함"; if (!cleanSubject || cleanSubject === "선택안함") return "선택안함"; return cleanSubject; }
function examProgressScopeTitle(row: ExamProgress) { const chunks = [row.major_unit || null, row.unit_name && !sameScopeText(row.major_unit, row.unit_name) ? row.unit_name : null].filter(Boolean); return chunks.length ? chunks.join(" · ") : row.unit_name || "범위명 없음"; }
function examProgressFullTitle(row: ExamProgress) { const chunks = [row.publisher ? `[${row.publisher}]` : null, row.material_name || null, row.major_unit || null, row.unit_name && !sameScopeText(row.major_unit, row.unit_name) ? row.unit_name : null].filter(Boolean); return chunks.length ? chunks.join(" · ") : row.unit_name || "범위명 없음"; }
function makeDateFromDayTime(day: string, time: string) { const now = getNowKst(); const targetDay = DAY_INDEX[day]; if (targetDay === undefined) return null; const [hourText, minuteText] = normalizeTime(time).split(":"); const hour = Number(hourText || 0); const minute = Number(minuteText || 0); let diff = targetDay - now.getDay(); if (diff < 0) diff += 7; const target = new Date(now); target.setDate(now.getDate() + diff); target.setHours(hour, minute, 0, 0); if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7); return target; }
function formatNextLeftText(target: Date) { const now = getNowKst(); const diffMs = target.getTime() - now.getTime(); const totalMinutes = Math.max(Math.round(diffMs / 60000), 0); const days = Math.floor(totalMinutes / 1440); const hours = Math.floor((totalMinutes % 1440) / 60); const minutes = totalMinutes % 60; if (days > 0) return `${days}일 ${hours}시간 후`; if (hours > 0) return `${hours}시간 ${minutes}분 후`; return `${minutes}분 후`; }
function getNextLessonInfo(lessonTimes: LessonTime[], events: StudentEvent[]): NextLessonInfo | null { const eventLessons = events.filter((event) => { const type = String(event.event_type || ""); const title = String(event.title || ""); return type.includes("수업") || type.includes("보강") || title.includes("수업") || title.includes("보강"); }).map((event) => { const time = normalizeTime(event.event_time) || "00:00"; const target = new Date(`${event.event_date}T${time}:00+09:00`); return { target, info: { dateText: formatDate(event.event_date), timeText: normalizeTime(event.event_time) || "시간 미정", leftText: formatNextLeftText(target), memo: event.memo || event.title } as NextLessonInfo }; }).filter((item) => !Number.isNaN(item.target.getTime()) && item.target.getTime() > getNowKst().getTime()); const fixedLessons = lessonTimes.map((lesson) => { const target = makeDateFromDayTime(lesson.day_of_week, lesson.start_time); if (!target) return null; return { target, info: { dateText: `${lesson.day_of_week}요일`, timeText: normalizeTime(lesson.start_time), leftText: formatNextLeftText(target), memo: lesson.memo } as NextLessonInfo }; }).filter(Boolean) as { target: Date; info: NextLessonInfo }[]; const all = [...eventLessons, ...fixedLessons].sort((a, b) => a.target.getTime() - b.target.getTime()); return all[0]?.info || null; }
function getUpcomingPerformance(tasks: PerformanceTask[]) { return tasks.filter((task) => task.status !== "done" && task.due_date).filter((task) => { const diff = daysUntilDue(task.due_date); return diff !== null && diff >= 0 && diff <= 14; }).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]; }
function parseMonthParam(month?: string) { const now = getNowKst(); if (!month || !/^\d{4}-\d{2}$/.test(month)) return { year: now.getFullYear(), month: now.getMonth() + 1 }; const [year, m] = month.split("-").map(Number); return { year, month: m }; }
function monthText(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}`; }
function addMonths(year: number, month: number, diff: number) { const date = new Date(year, month - 1 + diff, 1); return monthText(date.getFullYear(), date.getMonth() + 1); }
function getMonthDays(monthParam?: string) { const parsed = parseMonthParam(monthParam); const first = new Date(parsed.year, parsed.month - 1, 1); const last = new Date(parsed.year, parsed.month, 0); const days: { dateText: string; day: number; isToday: boolean }[] = []; for (let d = 1; d <= last.getDate(); d += 1) { const date = new Date(parsed.year, parsed.month - 1, d); const dateText = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); days.push({ dateText, day: d, isToday: dateText === getTodayText() }); } return { ...parsed, firstWeekday: first.getDay(), days, currentMonth: monthText(parsed.year, parsed.month), prevMonth: addMonths(parsed.year, parsed.month, -1), nextMonth: addMonths(parsed.year, parsed.month, 1) }; }
function isClassEvent(event: StudentEvent) { const type = String(event.event_type || ""); const title = String(event.title || ""); return type.includes("수업") || type.includes("보강") || title.includes("수업") || title.includes("보강"); }

const WEEKDAYS_BY_DATE = ["일", "월", "화", "수", "목", "금", "토"];

function makeDateText(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function findLessonRecordByDate(lessonRecords: LessonRecord[], dateText: string) {
  return lessonRecords.find((record) => record.lesson_date === dateText);
}

function makeAutoLessonEventsForMonth(
  lessonTimes: LessonTime[],
  year: number,
  month: number,
  lessonRecords: LessonRecord[],
  studentId: string,
): CalendarEvent[] {
  const dayIndexMap: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  const lastDay = new Date(year, month, 0).getDate();
  const events: CalendarEvent[] = [];

  lessonTimes.forEach((lessonTime) => {
    const targetDay = dayIndexMap[lessonTime.day_of_week];
    if (targetDay === undefined) return;

    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() !== targetDay) continue;

      const dateText = makeDateText(year, month, day);
      const matchedRecord = findLessonRecordByDate(lessonRecords, dateText);

      events.push({
        id: `auto-lesson-${lessonTime.id}-${dateText}`,
        event_date: dateText,
        event_time: normalizeTime(lessonTime.start_time),
        subject: lessonTime.memo || "영어",
        title: "수업",
        event_type: "수업",
        memo: lessonTime.memo || `${normalizeTime(lessonTime.start_time)} - ${normalizeTime(lessonTime.end_time)}`,
        is_auto: true,
        source_type: matchedRecord ? "lesson_record" : "fixed_lesson_time",
        source_id: matchedRecord?.id || lessonTime.id,
        link_url: matchedRecord ? `/students/${studentId}/records/${matchedRecord.id}/edit` : null,
        deletable: false,
      });
    }
  });

  return events;
}

function makeLessonRecordEvents(
  lessonRecords: LessonRecord[],
  fixedLessonEvents: CalendarEvent[],
  makeupLessons: MakeupLesson[],
  year: number,
  month: number,
  studentId: string,
): CalendarEvent[] {
  const fixedDates = new Set(fixedLessonEvents.map((event) => event.event_date));
  const makeupExactKeys = new Set(
    makeupLessons
      .filter((lesson) => lesson.makeup_date && lesson.makeup_time)
      .map((lesson) => `${lesson.makeup_date}::${normalizeTime(lesson.makeup_time)}`),
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
      if (makeupExactKeys.has(`${record.lesson_date}::${recordTime}`)) return false;
      if (!recordTime && makeupDateOnlyKeys.has(record.lesson_date)) return false;

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
      event_type: record.is_extra ? "추가수업" : "수업",
      memo: record.memo || null,
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
      const matchedRecord = lesson.makeup_date ? findLessonRecordByDate(lessonRecords, lesson.makeup_date) : null;

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
        link_url: matchedRecord ? `/students/${studentId}/records/${matchedRecord.id}/edit` : null,
        deletable: false,
      };
    });
}

function calendarEventTitle(event: CalendarEvent) {
  const time = event.event_time ? `${normalizeTime(event.event_time)} ` : "";
  const subject = event.subject && !["수업", "보강"].includes(event.subject) ? `${event.subject}` : "영어";

  if (event.event_type === "수업") return `${time}${subject}수업`;
  if (event.event_type === "보강수업") return `${time}${subject}수업`;
  if (event.event_type === "추가수업") return `${time}${subject}수업`;
  if (event.event_type === "중간고사") return `${time}중간고사`;
  if (event.event_type === "기말고사") return `${time}기말고사`;
  if (event.event_type === "수행평가") {
    return event.subject && event.subject !== "선택안함" ? `${time}${event.subject} ${event.title}` : `${time}${event.title}`;
  }
  return `${time}${event.title}`.trim();
}

function getCombinedCalendarEvents(
  lessonTimes: LessonTime[],
  lessonRecords: LessonRecord[],
  makeupLessons: MakeupLesson[],
  dbEventsRaw: StudentEvent[],
  year: number,
  month: number,
  studentId: string,
) {
  const autoLessonEvents = makeAutoLessonEventsForMonth(lessonTimes, year, month, lessonRecords, studentId);
  const makeupEvents = makeMakeupEvents(makeupLessons, lessonRecords, studentId);
  const lessonRecordEvents = makeLessonRecordEvents(lessonRecords, autoLessonEvents, makeupLessons, year, month, studentId);

  const fixedLessonChangeKeys = new Set(
    dbEventsRaw
      .filter(
        (event) =>
          (event.source_type === "fixed_lesson_override" || event.source_type === "fixed_lesson_cancelled") &&
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
      const [absentYear, absentMonth, absentDay] = lesson.absent_date.split("-").map(Number);
      if (!absentYear || !absentMonth || !absentDay) return [];
      const dayLabel = WEEKDAYS_BY_DATE[new Date(absentYear, absentMonth - 1, absentDay).getDay()];
      return lessonTimes
        .filter((lessonTime) => lessonTime.day_of_week === dayLabel)
        .map((lessonTime) => `${lessonTime.id}::${lesson.absent_date}`);
    }),
  );

  const makeupAbsentDates = new Set(
    makeupLessons.filter((lesson) => lesson.absent_date).map((lesson) => lesson.absent_date),
  );

  const visibleAutoLessonEvents = autoLessonEvents.filter((event) => {
    if (event.source_type !== "fixed_lesson_time") return true;
    if (!event.source_id) return true;
    if (makeupAbsentDates.has(event.event_date)) return false;
    const fixedKey = `${event.source_id}::${event.event_date}`;
    return !fixedLessonChangeKeys.has(fixedKey) && !makeupMovedFixedLessonKeys.has(fixedKey);
  });

  const dbEvents: CalendarEvent[] = dbEventsRaw
    .filter((event) => event.source_type !== "fixed_lesson_cancelled")
    .filter((event) => !isCanceledEvent(event))
    .map((event) => {
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
        source_type: event.source_type || null,
        source_id: event.source_id || null,
        original_event_date: event.original_event_date,
        original_lesson_time_id: event.original_lesson_time_id,
        link_url: matchedRecord ? `/students/${studentId}/records/${matchedRecord.id}/edit` : null,
        deletable: event.source_type !== "performance_task",
      };
    });

  return [
    ...visibleAutoLessonEvents,
    ...lessonRecordEvents,
    ...makeupEvents,
    ...dbEvents,
  ].sort((a, b) => {
    const dateCompare = String(a.event_date).localeCompare(String(b.event_date));
    if (dateCompare !== 0) return dateCompare;
    return String(a.event_time || "").localeCompare(String(b.event_time || ""));
  });
}

function isClassCalendarEvent(event: CalendarEvent) {
  return event.event_type === "수업" || event.event_type === "보강수업" || event.event_type === "추가수업";
}


function studentAvatarUrl(student: any) { return student.avatar_url || student.avatar || student.profile_image_url || student.photo_url || student.image_url || ""; }

function parseHomeworkUnitAndNumber(task: HomeworkTask) {
  const unitName = task.unitName || "";
  const majorUnit = task.majorUnit || "";
  const taskName = task.taskName || "";
  let displayUnit = majorUnit || unitName || "기타";
  let numberPart = "";
  let stepName = taskName || "숙제";
  const dashParts = taskName.split(" - ");
  if (dashParts.length >= 2) { numberPart = dashParts[0]?.trim() || ""; stepName = dashParts.slice(1).join(" - ").trim() || "숙제"; }
  const unitNumberMatch = unitName.match(/^(.*?)(\d+\s*번)$/);
  if (unitNumberMatch) { const prefix = unitNumberMatch[1]?.trim(); const num = unitNumberMatch[2]?.trim(); if (prefix) displayUnit = majorUnit || prefix; if (num) numberPart = num; }
  if (!numberPart && /^\d+\s*번$/.test(unitName.trim())) { numberPart = unitName.trim(); displayUnit = majorUnit || "기타"; }
  if (!numberPart && /^\d+\s*번$/.test(taskName.trim())) { numberPart = taskName.trim(); stepName = "숙제"; }
  if (!numberPart) numberPart = unitName || taskName || "항목";
  return { displayUnit, numberPart, stepName };
}
function homeworkKey(task: HomeworkTask) { return [task.progressId, task.subject, task.publisher || "", task.materialName || "", task.majorUnit || "", task.unitName, task.taskName].join("|||"); }
function groupHomeworkTasks(tasks: HomeworkTask[]) { const map = new Map<string, { key: string; subject: string; scopeTitle: string; displayUnit: string; stepName: string; numbers: Array<{ label: string; key: string }>; rows: HomeworkTask[] }>(); tasks.forEach((task) => { const { displayUnit, numberPart, stepName } = parseHomeworkUnitAndNumber(task); const scopeTitle = [task.publisher ? `[${task.publisher}]` : "", task.materialName || ""].filter(Boolean).join(" "); const finalScopeTitle = scopeTitle || task.materialName || "교재 미입력"; const key = [task.subject || "기타", finalScopeTitle, displayUnit, stepName].join("|||"); if (!map.has(key)) map.set(key, { key, subject: task.subject || "기타", scopeTitle: finalScopeTitle, displayUnit, stepName, numbers: [], rows: [] }); const group = map.get(key)!; const keyForCheck = homeworkKey(task); if (!group.numbers.some((item) => item.key === keyForCheck)) group.numbers.push({ label: numberPart, key: keyForCheck }); group.rows.push(task); }); return Array.from(map.values()).map((group) => ({ ...group, numbers: group.numbers.sort((a, b) => { const aNum = Number(a.label.match(/\d+/)?.[0] || 0); const bNum = Number(b.label.match(/\d+/)?.[0] || 0); if (aNum && bNum) return aNum - bNum; return a.label.localeCompare(b.label); }) })); }

export default async function StudentHomePage({ searchParams }: { searchParams?: Promise<{ tab?: string; date?: string; month?: string; addDate?: string; eventId?: string; hideClasses?: string }> }) {
  const params = await searchParams;
  const activeTab = TAB_ITEMS.some((item) => item.key === params?.tab) ? params?.tab || "home" : "home";
  const selectedDate = params?.date || getTodayText();
  const calendar = getMonthDays(params?.month);
  const addDate = params?.addDate || "";
  const eventId = params?.eventId || "";
  const hideClasses = params?.hideClasses === "1";
  const today = getTodayText();
  const calendarStart = calendar.days[0]?.dateText || today;
  const calendarEnd = calendar.days[calendar.days.length - 1]?.dateText || today;
  const recentStart = minDateText(addDaysText(today, -120), calendarStart);
  const upcomingEnd = maxDateText(addDaysText(today, 180), calendarEnd);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("app_users").select("role, student_id").eq("id", user.id).single();
  if (!profile?.student_id) redirect("/login");
  const studentId = profile.student_id;

  const { data: student } = await supabase.from("students").select("*").eq("id", studentId).single();
  if (!student) redirect("/login");

  const [{ data: records }, { data: makeupLessonRows }, { data: examProgressRows }, { data: performanceRows }, { data: lessonTimeRows }, { data: eventRows }, { data: selfStudyRows }, { data: studyTimeRows }, { data: homeworkCheckRows }, { data: goalRows }] = await Promise.all([
    supabase.from("lesson_records").select("*").eq("student_id", studentId).gte("lesson_date", recentStart).lte("lesson_date", calendarEnd).order("lesson_date", { ascending: false }).order("start_time", { ascending: false }).order("created_at", { ascending: false }).limit(120),
    supabase.from("makeup_lessons").select("*").eq("student_id", studentId).gte("absent_date", recentStart).lte("absent_date", upcomingEnd).order("is_done", { ascending: true }).order("absent_date", { ascending: false }).order("created_at", { ascending: false }).limit(120),
    supabase.from("exam_progress").select("*").eq("student_id", studentId).order("subject", { ascending: true }).order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(300),
    supabase.from("student_performance_tasks").select("*").eq("student_id", studentId).neq("status", "done").order("due_date", { ascending: true }).order("due_time", { ascending: true }).order("created_at", { ascending: false }).limit(200),
    supabase.from("student_lesson_times").select("*").eq("student_id", studentId).order("created_at", { ascending: true }),
    supabase.from("student_events").select("*").eq("student_id", studentId).gte("event_date", calendarStart).lte("event_date", upcomingEnd).order("event_date", { ascending: true }).order("event_time", { ascending: true }).limit(200),
    supabase.from("student_self_study_tasks").select("*").eq("student_id", studentId).neq("status", "done").order("due_date", { ascending: true }).order("created_at", { ascending: false }).limit(200),
    supabase.from("student_study_time_sessions").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(100),
    supabase.from("student_homework_checks").select("*").eq("student_id", studentId).limit(500),
    supabase.from("student_study_goals").select("*").eq("student_id", studentId).eq("goal_date", today).limit(1),
  ]);

  const lessonRecords = (records || []) as LessonRecord[];
  const makeupLessons = (makeupLessonRows || []) as MakeupLesson[];
  const examRows = (examProgressRows || []) as ExamProgress[];
  const performanceTasks = (performanceRows || []) as PerformanceTask[];
  const lessonTimes = (lessonTimeRows || []) as LessonTime[];
  const rawEvents = (eventRows || []) as StudentEvent[];
  const events = rawEvents.filter((event) => !isCanceledEvent(event));
  const selfStudyTasks = (selfStudyRows || []) as SelfStudyTask[];
  const studyTimeSessions = (studyTimeRows || []) as StudyTimeSession[];
  const homeworkChecks = (homeworkCheckRows || []) as HomeworkCheck[];
  const goal = ((goalRows || []) as StudyGoal[])[0];
  const goalSeconds = goal?.goal_seconds || 0;

  const checkedHomeworkSet = new Set(homeworkChecks.filter((row) => row.is_checked).map((row) => row.homework_key));
  const upcomingExam = events.filter((event) => event.event_type === "중간고사" || event.event_type === "기말고사").filter((event) => { const diff = daysUntilDue(event.event_date); return diff !== null && diff >= 0; }).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))[0];
  const todayStudySessions = studyTimeSessions.filter((row) => row.studied_at === getTodayText() && row.started_at && row.ended_at);
  const todayStudyTotals = studySubjectTotals(todayStudySessions);
  const todayStudyTotalSeconds = todayStudyTotals.reduce((sum, item) => sum + item.seconds, 0);
  const selectedSelfStudyTasks = selfStudyTasks.filter((task) => (task.due_date || getTodayText()) === selectedDate);
  const nextLesson = getNextLessonInfo(lessonTimes, events);
  const upcomingPerformance = performanceTasks.filter((task) => task.status !== "done" && task.due_date).filter((task) => { const diff = daysUntilDue(task.due_date); return diff !== null && diff >= 0 && diff <= 14; }).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
  const visiblePerformanceTasks = performanceTasks;
  const selectedEvent = events.find((event) => event.id === eventId) || null;

  const examHomeworkTasks: HomeworkTask[] = examRows.flatMap((row) => getVisibleStatusEntries(parseStatuses(row.statuses)).filter(([, status]) => status === "homework").map(([taskName]) => ({ id: `${row.id}:::${taskName}`, progressId: row.id, subject: row.subject, unitName: row.unit_name, taskName, publisher: row.publisher, materialName: row.material_name, majorUnit: row.major_unit, source: "exam" as const })));
  const manualHomeworkTasks: HomeworkTask[] = lessonRecords.flatMap((record) => { const subjectRecords = Array.isArray(record.subject_records) ? record.subject_records : []; return subjectRecords.flatMap((subjectRecord, subjectIndex) => { const subject = subjectRecord.subject || "과목 미입력"; const items = Array.isArray(subjectRecord.homework_items) ? subjectRecord.homework_items : []; return items.filter((item) => item.before_status === "manual" || item.unit_name === "직접입력" || item.unit_name === "기타" || String(item.progress_id || "").startsWith("manual-")).map((item, itemIndex) => ({ id: `manual-homework-${record.id}-${subjectIndex}-${itemIndex}`, progressId: item.progress_id || `manual-${record.id}-${subjectIndex}-${itemIndex}`, subject: item.subject || subject, unitName: item.unit_name || "기타", taskName: item.task_name || "기타 숙제", publisher: item.publisher || null, materialName: item.material_name || null, majorUnit: item.major_unit || null, source: "manual" as const, lessonDate: record.lesson_date, recordId: record.id })); }); });
  const homeworkTaskMap = new Map<string, HomeworkTask>();
  [...examHomeworkTasks, ...manualHomeworkTasks].forEach((task) => { const key = [task.subject, task.publisher || "", task.materialName || "", task.majorUnit || "", task.unitName, task.taskName].join("::"); if (!homeworkTaskMap.has(key)) homeworkTaskMap.set(key, task); });
  const groupedHomeworkTasks = groupHomeworkTasks(Array.from(homeworkTaskMap.values()));
  const totalHomeworkCount = groupedHomeworkTasks.reduce((sum, group) => sum + group.numbers.length, 0);
  const checkedHomeworkCount = groupedHomeworkTasks.reduce((sum, group) => sum + group.numbers.filter((item) => checkedHomeworkSet.has(item.key)).length, 0);

  const examSummaryBySubject = Object.entries(examRows.reduce<Record<string, ExamProgress[]>>((acc, row) => { const key = `${row.subject}|||${row.publisher || ""}|||${row.material_name || ""}`; if (!acc[key]) acc[key] = []; acc[key].push(row); return acc; }, {})).map(([key, rows]) => { const [subject, publisher, materialName] = key.split("|||"); const allStatuses = rows.flatMap((row) => getVisibleStatusEntries(parseStatuses(row.statuses))); const total = allStatuses.length; const done = allStatuses.filter(([, status]) => status === "done" || status === "review").length; return { key, subject, publisher, materialName, rows, total, done, percent: total ? Math.round((done / total) * 100) : 0 }; });
  const weeklyBlocks = parseWeeklyPlan(student.weekly_plan).blocks.sort((a, b) => { const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day); if (dayDiff !== 0) return dayDiff; return String(a.start).localeCompare(String(b.start)); });

  async function toggleHomeworkCheck(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const key = String(formData.get("homework_key") || "").trim(); const isChecked = String(formData.get("is_checked") || "") === "true"; if (!key) return; if (isChecked) { const { error } = await actionSupabase.from("student_homework_checks").delete().eq("student_id", studentId).eq("homework_key", key); if (error) throw new Error(error.message); } else { const { error } = await actionSupabase.from("student_homework_checks").upsert({ student_id: studentId, homework_key: key, is_checked: true, checked_at: new Date().toISOString() }, { onConflict: "student_id,homework_key" }); if (error) throw new Error(error.message); } revalidatePath("/student"); }
  async function addPerformanceTask(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const subject = String(formData.get("subject") || "").trim(); const customSubject = String(formData.get("custom_subject") || "").trim(); const finalSubject = finalPerformanceSubject(subject, customSubject); const title = String(formData.get("title") || "").trim(); const dueDate = String(formData.get("due_date") || "").trim(); const dueTime = String(formData.get("due_time") || "").trim(); const memo = String(formData.get("memo") || "").trim(); if (!title) throw new Error("수행평가 이름은 꼭 필요해."); const { data: performance, error } = await actionSupabase.from("student_performance_tasks").insert({ student_id: studentId, subject: finalSubject, title, due_date: dueDate || null, due_time: dueTime || null, status: "not_started", memo: memo || null }).select("id").single(); if (error) throw new Error(error.message); if (performance && dueDate) await actionSupabase.from("student_events").insert({ student_id: studentId, event_date: dueDate, event_time: dueTime || null, subject: finalSubject === "선택안함" ? null : finalSubject, title, event_type: "수행평가", memo: memo || null, is_auto: true, source_type: "performance_task", source_id: performance.id }); revalidatePath("/student"); }
  async function updatePerformanceStatus(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const taskId = String(formData.get("task_id") || ""); const status = String(formData.get("status") || "not_started"); if (!taskId) return; const { error } = await actionSupabase.from("student_performance_tasks").update({ status }).eq("id", taskId).eq("student_id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function addSelfStudyTask(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const subject = String(formData.get("subject") || "영어").trim(); const title = String(formData.get("title") || "").trim(); const dueDate = String(formData.get("due_date") || selectedDate).trim(); const memo = String(formData.get("memo") || "").trim(); if (!title) throw new Error("공부할 내용을 입력해줘."); const { error } = await actionSupabase.from("student_self_study_tasks").insert({ student_id: studentId, subject, title, due_date: dueDate || selectedDate, status: "not_started", memo: memo || null }); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function updateSelfStudyStatus(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const taskId = String(formData.get("task_id") || ""); const status = String(formData.get("status") || "not_started"); const title = String(formData.get("title") || "").trim(); const subject = String(formData.get("subject") || "기타").trim(); const memo = String(formData.get("memo") || "").trim(); const dueDate = String(formData.get("due_date") || getTodayText()).trim(); if (!taskId) return; const { error } = await actionSupabase.from("student_self_study_tasks").update({ status }).eq("id", taskId).eq("student_id", studentId); if (error) throw new Error(error.message); if (status === "deferred") { const { error: insertError } = await actionSupabase.from("student_self_study_tasks").insert({ student_id: studentId, subject, title, due_date: nextDateText(dueDate), status: "not_started", memo: memo || null }); if (insertError) throw new Error(insertError.message); } revalidatePath("/student"); }
  async function saveStudyTime(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const subject = String(formData.get("subject") || "영어").trim(); const title = String(formData.get("title") || "").trim(); const durationSeconds = Number(formData.get("duration_seconds") || 0); const startedAt = String(formData.get("started_at") || "").trim(); const endedAt = String(formData.get("ended_at") || "").trim(); if (!durationSeconds || durationSeconds < 10 || !startedAt || !endedAt) return; const { error } = await actionSupabase.from("student_study_time_sessions").insert({ student_id: studentId, subject, title: title || null, duration_seconds: durationSeconds, studied_at: getTodayText(), started_at: startedAt, ended_at: endedAt }); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function updateStudySession(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const sessionId = String(formData.get("session_id") || ""); const subject = String(formData.get("subject") || "기타"); const title = String(formData.get("title") || "").trim(); if (!sessionId) return; const { error } = await actionSupabase.from("student_study_time_sessions").update({ subject, title: title || null }).eq("id", sessionId).eq("student_id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function saveStudyGoal(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const hours = Number(formData.get("goal_hours") || 0); const goalSeconds = Math.max(hours, 0) * 3600; const { error } = await actionSupabase.from("student_study_goals").upsert({ student_id: studentId, goal_date: getTodayText(), goal_seconds: goalSeconds }, { onConflict: "student_id,goal_date" }); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function addWeeklyPlanBlock(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const day = String(formData.get("day") || "월"); const start = normalizeTime(String(formData.get("start") || "")); const end = normalizeTime(String(formData.get("end") || "")); const category = String(formData.get("category") || "자습"); const subject = String(formData.get("subject") || "").trim(); const memo = String(formData.get("memo") || "").trim(); if (!start || !end) throw new Error("시작/끝 시간을 입력해줘."); const current = parseWeeklyPlan(student.weekly_plan); const block = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, day, start, end, category, subject: subject || null, customSubject: null, memo: memo || null }; const { error } = await actionSupabase.from("students").update({ weekly_plan: { blocks: [...current.blocks, block] } }).eq("id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function deleteWeeklyPlanBlock(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const blockId = String(formData.get("block_id") || ""); const current = parseWeeklyPlan(student.weekly_plan); const nextBlocks = current.blocks.filter((block) => block.id !== blockId); const { error } = await actionSupabase.from("students").update({ weekly_plan: { blocks: nextBlocks } }).eq("id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function addStudentEvent(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const title = String(formData.get("title") || "").trim(); const eventDate = String(formData.get("event_date") || "").trim(); const eventTime = String(formData.get("event_time") || "").trim(); const eventType = String(formData.get("event_type") || "개인일정").trim(); const memo = String(formData.get("memo") || "").trim(); if (!title || !eventDate) return; if (eventType.includes("수업") || eventType.includes("보강")) return; const { error } = await actionSupabase.from("student_events").insert({ student_id: studentId, event_date: eventDate, event_time: eventTime || null, title, event_type: eventType || "개인일정", memo: memo || null, is_auto: false, source_type: "student_added" }); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function updateStudentEvent(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const id = String(formData.get("event_id") || ""); const title = String(formData.get("title") || "").trim(); const eventDate = String(formData.get("event_date") || "").trim(); const eventTime = String(formData.get("event_time") || "").trim(); const eventType = String(formData.get("event_type") || "개인일정").trim(); const memo = String(formData.get("memo") || "").trim(); if (!id || !title || !eventDate || eventType.includes("수업") || eventType.includes("보강")) return; const original = events.find((event) => event.id === id); if (!original || isClassEvent(original)) return; const { error } = await actionSupabase.from("student_events").update({ title, event_date: eventDate, event_time: eventTime || null, event_type: eventType, memo: memo || null }).eq("id", id).eq("student_id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }
  async function deleteStudentEvent(formData: FormData) { "use server"; const actionSupabase = await createSupabaseServerClient(); const id = String(formData.get("event_id") || ""); if (!id) return; const original = events.find((event) => event.id === id); if (!original || isClassEvent(original)) return; const { error } = await actionSupabase.from("student_events").delete().eq("id", id).eq("student_id", studentId); if (error) throw new Error(error.message); revalidatePath("/student"); }

  const avatar = studentAvatarUrl(student);
  const calendarEvents = getCombinedCalendarEvents(
    lessonTimes,
    lessonRecords,
    makeupLessons,
    rawEvents,
    calendar.year,
    calendar.month,
    studentId,
  );
  const visibleCalendarEvents = hideClasses
    ? calendarEvents.filter((event) => !isClassCalendarEvent(event))
    : calendarEvents;
  const classEventDates = new Set(calendarEvents.filter(isClassCalendarEvent).map((event) => event.event_date));
  const personalEventDates = new Set(calendarEvents.filter((event) => !isClassCalendarEvent(event)).map((event) => event.event_date));

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-3 pb-24 pt-3 text-[#111827]" style={{ fontFamily: APP_FONT }}>
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
        <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f3f4f6] text-xl font-bold text-[#111827]">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : String(student.name || "?").slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#6b7280]">오늘</p>
                <h1 className="whitespace-nowrap text-base font-bold tracking-[-0.04em] text-[#111827]">{formatHeaderDate(getTodayText())}</h1>
              </div>
            </div>
            <div className="shrink-0 rounded-[16px] bg-[#f3f4f6] px-2.5 py-1.5 text-right">
              <p className="text-[10px] font-bold text-[#6b7280]">시험</p>
              <p className="text-sm font-bold leading-4 text-[#111827]">{ddayLabel(upcomingExam?.event_date)}</p>
              <p className="max-w-[46px] truncate text-[9px] font-semibold text-[#6b7280]">{upcomingExam?.event_type || "없음"}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[22px] bg-[#f9fafb] p-3">
              <p className="text-[10px] font-bold text-[#6b7280]">다음 수업</p>
              <p className="mt-1 truncate text-[13px] font-bold text-[#111827]">{nextLesson ? `${nextLesson.dateText} ${nextLesson.timeText}` : "등록 없음"}</p>
              <p className="mt-1 truncate text-[9px] font-semibold text-[#6b7280]">{nextLesson ? nextLesson.leftText : "시간표 확인 필요"}</p>
            </div>
            <div className="rounded-[22px] bg-[#f9fafb] p-3">
              <p className="text-[10px] font-bold text-[#6b7280]">가까운 수행</p>
              <p className="mt-1 truncate text-[13px] font-bold text-[#111827]">{upcomingPerformance ? upcomingPerformance.title : "없음"}</p>
              <p className="mt-1 truncate text-[9px] font-semibold text-[#6b7280]">{upcomingPerformance ? `${formatDate(upcomingPerformance.due_date)} · ${urgentLabel(upcomingPerformance.due_date)}` : "여유 있음"}</p>
            </div>
          </div>
        </section>

        {activeTab === "home" && (
          <>
            <StudyPlannerBoard sessions={todayStudySessions} totals={todayStudyTotals} totalSeconds={todayStudyTotalSeconds} goalSeconds={goalSeconds} subjects={SUBJECTS} subjectStyles={SUBJECT_STYLES} updateAction={updateStudySession} saveGoalAction={saveStudyGoal} />
            <StudyTimer subjects={SUBJECTS} saveAction={saveStudyTime} />
          </>
        )}

        {activeTab === "homework" && (
          <>
            <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Study</p><h2 className="text-[15px] font-bold text-[#111827]">선생님이 낸 숙제</h2></div>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#111827]">{checkedHomeworkCount}/{totalHomeworkCount}</span>
              </div>
              {groupedHomeworkTasks.length === 0 ? <div className="rounded-[20px] border border-dashed border-[#d1d5db] bg-[#f9fafb] p-4 text-xs font-semibold text-[#6b7280]">아직 등록된 숙제가 없어요.</div> : <div className="space-y-2">{groupedHomeworkTasks.map((group) => <div key={group.key} className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-3"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">{group.subject}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#111827]">{group.stepName}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">{group.numbers.length}개</span></div><p className="mt-2 truncate text-[13px] font-bold text-[#111827]">{group.scopeTitle}</p><p className="truncate text-[12px] font-semibold text-[#6b7280]">{group.displayUnit}</p><div className="mt-2 flex flex-wrap gap-1.5">{group.numbers.map((item) => { const isChecked = checkedHomeworkSet.has(item.key); return <form key={item.key} action={toggleHomeworkCheck}><input type="hidden" name="homework_key" value={item.key}/><input type="hidden" name="is_checked" value={String(isChecked)}/><button type="submit" className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${isChecked ? "border-[#111827] bg-[#111827] text-white line-through" : "border-[#d1d5db] bg-white text-[#374151]"}`}>{isChecked ? "✓ " : ""}{item.label}</button></form>; })}</div></div>)}</div>}
            </section>

            <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-end justify-between gap-2">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Planner</p><h2 className="text-[15px] font-bold text-[#111827]">내 스터디플래너</h2><p className="mt-0.5 text-[11px] font-medium text-[#6b7280]">{formatDate(selectedDate)} 기준</p></div>
                <Link href={`/student?tab=homework&date=${getTodayText()}`} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-bold text-[#111827]">오늘</Link>
              </div>
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                  const base = new Date(`${getTodayText()}T00:00:00+09:00`);
                  base.setDate(base.getDate() + offset);
                  const dateText = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Seoul",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(base);
                  const date = new Date(`${dateText}T00:00:00+09:00`);
                  const label =
                    offset === 0
                      ? "오늘"
                      : `${date.getMonth() + 1}/${date.getDate()} ${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]}`;

                  return (
                    <Link
                      key={dateText}
                      href={`/student?tab=homework&date=${dateText}`}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-center text-[11px] font-bold ${
                        selectedDate === dateText
                          ? "bg-[#111827] text-white"
                          : "bg-[#f3f4f6] text-[#6b7280]"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>

              <details className="mb-3 rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <summary className="cursor-pointer list-none text-[11px] font-bold text-[#111827]">
                  + 항목 추가
                </summary>
                <form action={addSelfStudyTask} className="mt-2 grid w-full gap-1.5">
                  <select
                    name="subject"
                    className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"
                  >
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                  <input
                    name="title"
                    placeholder="예: 영어 단어 Day 1"
                    className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"
                  />
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={selectedDate}
                    className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"
                  />
                  <input
                    name="memo"
                    placeholder="메모"
                    className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"
                  />
                  <button className="w-full rounded-2xl bg-[#111827] px-3 py-2 text-[11px] font-bold text-white">
                    저장
                  </button>
                </form>
              </details>

              {selectedSelfStudyTasks.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#d1d5db] bg-[#f9fafb] p-4 text-xs font-semibold text-[#6b7280]">
                  이 날짜에 추가한 공부가 없어요.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedSelfStudyTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#6b7280]">
                          {task.subject || "기타"}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${selfStudyChip(task.status)}`}>
                          {SELF_STUDY_STATUS_LABELS[task.status || "not_started"] || "○"}{" "}
                          {SELF_STUDY_STATUS_TEXT[task.status || "not_started"] || "미완료"}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] font-bold text-[#111827]">
                        {task.title}
                      </p>
                      {task.memo && (
                        <p className="mt-1 text-[11px] font-medium text-[#6b7280]">
                          {task.memo}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          ["not_started", "○"],
                          ["in_progress", "△"],
                          ["done", "×"],
                          ["deferred", "↗"],
                        ].map(([value, mark]) => (
                          <form key={value} action={updateSelfStudyStatus}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="status" value={value} />
                            <input type="hidden" name="title" value={task.title} />
                            <input type="hidden" name="subject" value={task.subject || "기타"} />
                            <input type="hidden" name="memo" value={task.memo || ""} />
                            <input type="hidden" name="due_date" value={task.due_date || selectedDate} />
                            <button
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                                task.status === value
                                  ? "border-[#111827] bg-[#111827] text-white"
                                  : "border-[#d1d5db] bg-white text-[#374151]"
                              }`}
                            >
                              {mark}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "performance" && (
          <section className="space-y-3">
            <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Performance</p><h2 className="text-[15px] font-bold text-[#111827]">진행 중인 수행평가</h2></div><span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#111827]">{performanceTasks.filter((task) => task.status !== "done").length}개</span></div>
              <details className="mb-3 rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <summary className="cursor-pointer list-none text-[11px] font-bold text-[#111827]">+ 직접 추가</summary>
                <form action={addPerformanceTask} className="mt-2 grid w-full gap-1.5">
                  <select name="subject" defaultValue="선택안함" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none">{PERFORMANCE_SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
                  <input name="custom_subject" placeholder="직접입력 과목" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/>
                  <input name="title" placeholder="수행평가 이름" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/>
                  <input type="date" name="due_date" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/>
                  <input name="due_time" placeholder="시간 예: 09:00" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/>
                  <input name="memo" placeholder="메모" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/>
                  <button className="w-full rounded-2xl bg-[#111827] px-3 py-2 text-[11px] font-bold text-white">추가</button>
                </form>
              </details>
              {performanceTasks.filter((task) => task.status !== "done").length === 0 ? <div className="rounded-[20px] border border-dashed border-[#d1d5db] bg-[#f9fafb] p-4 text-xs font-semibold text-[#6b7280]">진행 중인 수행평가가 없어요.</div> : <div className="space-y-2">{performanceTasks.filter((task) => task.status !== "done").map((task) => <article key={task.id} className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-3"><div className="flex flex-wrap items-center gap-1.5">{task.subject && task.subject !== "선택안함" && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#6b7280]">{task.subject}</span>}<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${performanceStatusChip(task.status)}`}>{PERFORMANCE_STATUS_LABELS[task.status] || task.status}</span>{urgentLabel(task.due_date) && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#111827]">{urgentLabel(task.due_date)}</span>}</div><p className="mt-2 truncate text-[13px] font-bold text-[#111827]">{task.title}</p><p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{formatDate(task.due_date)} {normalizeTime(task.due_time)}</p>{task.memo && <p className="mt-1 text-[11px] font-medium text-[#6b7280]">{task.memo}</p>}<div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(PERFORMANCE_STATUS_LABELS).map(([value, label]) => <form key={value} action={updatePerformanceStatus}><input type="hidden" name="task_id" value={task.id}/><input type="hidden" name="status" value={value}/><button className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${task.status === value ? "border-[#111827] bg-[#111827] text-white" : "border-[#d1d5db] bg-white text-[#374151]"}`}>{label}</button></form>)}</div></article>)}</div>}
            </section>
            <details className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <summary className="cursor-pointer list-none text-[13px] font-bold text-[#6b7280]">완료한 수행평가 {performanceTasks.filter((task) => task.status === "done").length}개</summary>
              <div className="mt-3 space-y-2">{performanceTasks.filter((task) => task.status === "done").map((task) => <article key={task.id} className="rounded-[18px] bg-[#f9fafb] p-3"><p className="truncate text-[12px] font-bold text-[#111827]">{task.title}</p><p className="mt-1 text-[9px] font-semibold text-[#6b7280]">{task.subject} · {formatDate(task.due_date)}</p></article>)}</div>
            </details>
          </section>
        )}

        {activeTab === "progress" && (
          <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Progress</p><h2 className="text-[15px] font-bold text-[#111827]">시험범위 진도표</h2></div>
            {examSummaryBySubject.length === 0 ? <div className="rounded-[20px] border border-dashed border-[#d1d5db] bg-[#f9fafb] p-4 text-xs font-semibold text-[#6b7280]">아직 등록된 시험범위가 없어요.</div> : <div className="space-y-3">{examSummaryBySubject.map((item) => <details key={item.key} open className="rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[13px] font-bold text-[#111827]">{item.subject}</p><p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">{[item.publisher, item.materialName].filter(Boolean).join(" · ") || "교재 미입력"}</p></div><span className="shrink-0 text-sm font-bold text-[#111827]">{item.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#111827]" style={{ width: `${item.percent}%` }}/></div></summary><div className="mt-3 overflow-x-auto rounded-[14px] border border-[#e5e7eb] bg-white"><table className="w-full min-w-[640px] border-collapse text-[10px]"><thead><tr className="bg-[#f3f4f6] text-[#6b7280]"><th className="border-b border-[#e5e7eb] px-2 py-1.5 text-left">범위</th>{Array.from(new Set(item.rows.flatMap((row) => getVisibleStatusEntries(parseStatuses(row.statuses)).map(([taskName]) => taskName)))).map((taskName) => <th key={taskName} className="border-b border-[#e5e7eb] px-2 py-1.5 text-center">{taskName}</th>)}</tr></thead><tbody>{item.rows.map((row) => { const statuses = parseStatuses(row.statuses); const taskNames = Array.from(new Set(item.rows.flatMap((r) => getVisibleStatusEntries(parseStatuses(r.statuses)).map(([taskName]) => taskName)))); return <tr key={row.id}><td className="border-b border-[#f3f4f6] px-2 py-1.5 font-semibold">{examProgressScopeTitle(row)}</td>{taskNames.map((taskName) => <td key={taskName} className="border-b border-[#f3f4f6] px-2 py-1.5 text-center"><span className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[8.5px] font-bold ${statusChip(statuses[taskName])}`}>{STATUS_LABELS[statuses[taskName]] || statuses[taskName] || "-"}</span></td>)}</tr>; })}</tbody></table></div></details>)}</div>}
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="space-y-3">
            <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Schedule</p><h2 className="text-[15px] font-bold text-[#111827]">주간 시간표</h2></div>
              <details className="mb-3 rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2"><summary className="cursor-pointer list-none text-[11px] font-bold text-[#111827]">+ 추가</summary><form action={addWeeklyPlanBlock} className="mt-2 grid w-full gap-1.5"><select name="day" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none">{DAYS.map((day) => <option key={day} value={day}>{day}요일</option>)}</select><div className="grid grid-cols-2 gap-2"><input name="start" placeholder="시작 18:00" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><input name="end" placeholder="끝 20:00" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/></div><select name="category" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none">{["학교", "학원", "과외", "자습", "이동", "휴식", "기타"].map((item) => <option key={item} value={item}>{item}</option>)}</select><select name="subject" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"><option value="">과목 없음</option>{SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select><input name="memo" placeholder="메모" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><button className="w-full rounded-2xl bg-[#111827] px-3 py-2 text-[11px] font-bold text-white">시간표 추가</button></form></details>
              <div className="overflow-x-auto rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb]"><table className="w-full min-w-[640px] border-collapse text-[10px]"><thead><tr>{DAYS.map((day) => <th key={day} className="border-b border-[#e5e7eb] bg-white px-2 py-2 text-[#6b7280]">{day}</th>)}</tr></thead><tbody><tr>{DAYS.map((day) => { const blocks = weeklyBlocks.filter((block) => block.day === day); return <td key={day} className="w-[74px] align-top border-r border-[#e5e7eb] p-1.5 last:border-r-0">{blocks.length === 0 ? <span className="text-[#9ca3af]">-</span> : <div className="space-y-1">{blocks.map((block) => <div key={block.id} className="rounded-[12px] bg-white px-1.5 py-1.5 font-semibold text-[#111827]"><p>{block.start}-{block.end}</p><p className="truncate text-[#6b7280]">{weeklyLabel(block)}</p><form action={deleteWeeklyPlanBlock} className="mt-0.5"><input type="hidden" name="block_id" value={block.id}/><button className="text-[8px] text-[#6b7280]">삭제</button></form></div>)}</div>}</td>; })}</tr></tbody></table></div>
            </section>

            <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">Calendar</p><h2 className="text-[15px] font-bold text-[#111827]">{calendar.month}월 캘린더</h2></div><div className="flex gap-1"><Link href={`/student?tab=schedule&month=${calendar.currentMonth}${hideClasses ? "" : "&hideClasses=1"}`} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${hideClasses ? "bg-[#111827] text-white" : "bg-[#f3f4f6] text-[#111827]"}`}>수업 빼고 보기</Link><Link href={`/student?tab=schedule&month=${calendar.prevMonth}${hideClasses ? "&hideClasses=1" : ""}`} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#111827]">‹</Link><Link href={`/student?tab=schedule&month=${calendar.nextMonth}${hideClasses ? "&hideClasses=1" : ""}`} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold text-[#111827]">›</Link></div></div>
              <details open={Boolean(addDate)} className="mb-3 rounded-[16px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2"><summary className="cursor-pointer list-none text-[11px] font-bold text-[#111827]">+ 일정 추가</summary><form action={addStudentEvent} className="mt-2 grid w-full gap-1.5"><input name="title" placeholder="일정 이름" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><input type="date" name="event_date" defaultValue={addDate || getTodayText()} className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><input name="event_time" placeholder="시간 예: 18:00" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><select name="event_type" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"><option value="개인일정">개인일정</option><option value="시험">시험</option><option value="수행평가">수행평가</option><option value="학교일정">학교일정</option><option value="기타">기타</option></select><input name="memo" placeholder="메모" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><button className="w-full rounded-2xl bg-[#111827] px-3 py-2 text-[11px] font-bold text-white">일정 추가</button></form></details>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#6b7280]">{["일","월","화","수","목","금","토"].map((day) => <div key={day} className="py-1">{day}</div>)}{Array.from({ length: calendar.firstWeekday }, (_, index) => <div key={`blank-${index}`}/>)}{calendar.days.map((day) => { const dayEvents = visibleCalendarEvents.filter((event) => event.event_date === day.dateText); const hasClass = !hideClasses && classEventDates.has(day.dateText); const hasPersonal = personalEventDates.has(day.dateText); return <Link key={day.dateText} href={`/student?tab=schedule&month=${calendar.currentMonth}${hideClasses ? "&hideClasses=1" : ""}&addDate=${day.dateText}`} className={`min-h-[48px] rounded-[14px] border p-1 text-left ${day.isToday ? "border-[#111827] bg-[#111827] text-white" : "border-[#e5e7eb] bg-[#f9fafb] text-[#111827]"}`}><p className="text-[10px] font-bold">{day.day}</p><div className="mt-1 flex gap-0.5">{hasClass && <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]"/>}{hasPersonal && <span className={`h-1.5 w-1.5 rounded-full ${day.isToday ? "bg-white" : "bg-[#111827]"}`}/>} {dayEvents.length > 1 && <span className={`text-[8px] ${day.isToday ? "text-white" : "text-[#6b7280]"}`}>+{dayEvents.length}</span>}</div></Link>; })}</div>
              <div className="mt-4 space-y-2"><p className="text-[11px] font-bold text-[#111827]">이번 달 일정</p>{visibleCalendarEvents.filter((event) => event.event_date?.startsWith(calendar.currentMonth)).length === 0 ? <p className="rounded-[18px] bg-[#f9fafb] p-3 text-xs font-semibold text-[#6b7280]">등록된 일정이 없어요.</p> : <>{calendar.days.flatMap((day) => { const rows = visibleCalendarEvents.filter((event) => event.event_date === day.dateText).map((event) => ({ id: event.id, title: calendarEventTitle(event), type: event.event_type || "일정", time: "", memo: event.memo, class: isClassCalendarEvent(event), date: event.event_date, sourceType: event.source_type })); return rows.map((row) => <div key={row.id} className="rounded-[18px] border border-[#e5e7eb] bg-[#f9fafb] p-3"><div className="flex items-start justify-between gap-2"><div><p className="whitespace-nowrap text-[10px] font-bold text-[#111827]"><span className={row.class ? "text-[#ef4444]" : ""}>●</span> {formatDate(row.date)} {row.title}</p><p className="mt-1 text-[9px] font-semibold text-[#6b7280]">{row.type}{row.memo ? ` · ${row.memo}` : ""}</p></div>{!row.class && row.sourceType !== "performance_task" && <Link href={`/student?tab=schedule&month=${calendar.currentMonth}${hideClasses ? "&hideClasses=1" : ""}&eventId=${row.id}`} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#111827]">수정</Link>}</div></div>); })}</>}</div>
            </section>
          </section>
        )}

        {selectedEvent && !isClassEvent(selectedEvent) && (
          <div className="fixed inset-0 z-[80] flex items-end bg-black/35 px-3 pb-3">
            <div className="w-full rounded-[26px] bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-[#111827]">일정 수정</h3><Link href={`/student?tab=schedule&month=${calendar.currentMonth}${hideClasses ? "&hideClasses=1" : ""}`} className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-bold text-[#374151]">닫기</Link></div>
              <form action={updateStudentEvent} className="grid gap-2"><input type="hidden" name="event_id" value={selectedEvent.id}/><input name="title" defaultValue={selectedEvent.title} className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><input type="date" name="event_date" defaultValue={selectedEvent.event_date} className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><input name="event_time" defaultValue={normalizeTime(selectedEvent.event_time)} placeholder="시간 예: 18:00" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><select name="event_type" defaultValue={selectedEvent.event_type || "개인일정"} className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"><option value="개인일정">개인일정</option><option value="시험">시험</option><option value="수행평가">수행평가</option><option value="학교일정">학교일정</option><option value="기타">기타</option></select><input name="memo" defaultValue={selectedEvent.memo || ""} placeholder="메모" className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-2 text-[11px] font-semibold outline-none"/><button className="w-full rounded-2xl bg-[#111827] px-3 py-2 text-[11px] font-bold text-white">수정 저장</button></form>
              <form action={deleteStudentEvent} className="mt-2"><input type="hidden" name="event_id" value={selectedEvent.id}/><button className="w-full rounded-2xl bg-[#fee2e2] px-3 py-2 text-[11px] font-bold text-[#b91c1c]">삭제</button></form>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e7eb] bg-white/70 px-2 py-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[390px] grid-cols-5 gap-1">
          {TAB_ITEMS.map((item) => <Link key={item.key} href={item.href} className={`rounded-2xl px-1 py-1.5 text-center text-[10px] font-bold ${activeTab === item.key ? "text-[#111827]" : "text-[#9ca3af]/70"}`}><Icon name={item.icon}/>{item.label}</Link>)}
        </div>
      </nav>
    </main>
  );
}
