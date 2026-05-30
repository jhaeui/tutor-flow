"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  name: string;
  hourly_rate?: number | null;
  lesson_hours?: number | null;
  default_lesson_hours?: number | null;
};

type LessonRecord = {
  id: string;
  student_id: string;
  lesson_date: string;
  is_extra: boolean | null;
  has_regular_extra: boolean | null;
  total_minutes: number | null;
  billable_minutes: number | null;
  extra_minutes: number | null;
};

type LessonTime = {
  id: string;
  student_id: string;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
};

type StudentEvent = {
  id: string;
  student_id: string;
  event_date: string;
  event_time: string | null;
  source_type: string | null;
  event_type?: string | null;
  original_event_date?: string | null;
  original_lesson_time_id?: string | null;
};

type MakeupLesson = {
  id: string;
  student_id: string;
  absent_date: string | null;
  makeup_date: string | null;
  makeup_time: string | null;
  is_done?: boolean | null;
};

type PaymentType = "선불" | "후불";
type PaymentStatus = "대기중" | "입금완료";

type Settlement = {
  id?: string;
  student_id: string;
  start_date: string;
  end_date: string;
  expected_lesson_count: number;
  lesson_hours: number;
  hourly_rate: number;
  feedback_date: string | null;
  feedback_done: boolean;
  payment_status: PaymentStatus;
  payment_type: PaymentType;
  payment_completed_date: string | null;
  feedback_note: string | null;
  actual_lesson_count_override: number | null;
  total_fee_override: number | null;
};

type SettlementMemo = {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  memo: string;
  created_at: string;
  students?: {
    name?: string;
  } | null;
};

type StudentSettlementRow = {
  student: Student;
  settlement: Settlement;
  records: LessonRecord[];
  calendarExpectedCount: number;
  actualLessonCount: number;
  autoActualLessonCount: number;
  extraLessonCount: number;
  actualTotalMinutes: number;
  billableMinutes: number;
  expectedFee: number;
  actualFee: number;
  totalFee: number;
  prepaidCarryoverCount: number;
  prepaidExtraCount: number;
  prepaidExtraFee: number;
  progress: number;
  nextMonthExpectedCount: number;
  nextMonthTotalFee: number;
};

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function getMonthRangeByOffset(baseDate: string, offset: number) {
  const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const start = new Date(target.getFullYear(), target.getMonth(), 1);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function getSettlementTitle(startDate: string) {
  if (!startDate) return "이번 회차 수업";
  const [, month] = startDate.split("-");
  return `${Number(month)}월 수업`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayText() {
  return toDateInputValue(new Date());
}

function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString()}원`;
}

function formatHours(minutes: number) {
  if (!minutes) return "0시간";

  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}시간`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}시간`;
}

function formatDateShort(date: string | null) {
  if (!date) return "날짜 선택";
  const dateObj = new Date(`${date}T00:00:00`);
  const [, month, day] = date.split("-");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day}/${weekdays[dateObj.getDay()]}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizePaymentStatus(value?: string | null): PaymentStatus {
  return value === "입금완료" ? "입금완료" : "대기중";
}

function normalizePaymentType(value?: string | null): PaymentType {
  return value === "후불" ? "후불" : "선불";
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function dateToDayLabel(dateText?: string | null) {
  if (!dateText) return "";
  const [year, month, day] = dateText.split("-").map(Number);
  if (!year || !month || !day) return "";
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

function eachDateInRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  if (!startDate || !endDate) return dates;

  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current <= end) {
    dates.push(toDateInputValue(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function normalizeTimeValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function countCalendarExpectedLessons(
  studentId: string,
  startDate: string,
  endDate: string,
  lessonTimes: LessonTime[],
  events: StudentEvent[],
  makeupLessons: MakeupLesson[],
) {
  const studentLessonTimes = lessonTimes.filter(
    (lessonTime) => lessonTime.student_id === studentId,
  );
  const studentEvents = events.filter(
    (event) => event.student_id === studentId,
  );
  const studentMakeups = makeupLessons.filter(
    (lesson) => lesson.student_id === studentId,
  );

  const cancelledFixedKeys = new Set(
    studentEvents
      .filter(
        (event) =>
          (event.source_type === "fixed_lesson_cancelled" ||
            event.source_type === "fixed_lesson_override") &&
          event.original_lesson_time_id &&
          (event.original_event_date || event.event_date),
      )
      .map(
        (event) =>
          `${event.original_lesson_time_id}::${event.original_event_date || event.event_date}`,
      ),
  );

  const makeupMovedFixedKeys = new Set(
    studentMakeups.flatMap((lesson) => {
      if (!lesson.absent_date) return [];
      const dayLabel = dateToDayLabel(lesson.absent_date);
      return studentLessonTimes
        .filter((lessonTime) => lessonTime.day_of_week === dayLabel)
        .map((lessonTime) => `${lessonTime.id}::${lesson.absent_date}`);
    }),
  );

  const fixedCount = eachDateInRange(startDate, endDate).reduce(
    (count, date) => {
      const dayLabel = dateToDayLabel(date);
      const dayLessons = studentLessonTimes.filter(
        (lessonTime) => lessonTime.day_of_week === dayLabel,
      );

      const visibleDayLessons = dayLessons.filter((lessonTime) => {
        const key = `${lessonTime.id}::${date}`;
        return !cancelledFixedKeys.has(key) && !makeupMovedFixedKeys.has(key);
      });

      return count + visibleDayLessons.length;
    },
    0,
  );

  const makeupCount = studentMakeups.filter(
    (lesson) =>
      lesson.makeup_date &&
      lesson.makeup_date >= startDate &&
      lesson.makeup_date <= endDate,
  ).length;

  const fixedOverrideCount = studentEvents.filter(
    (event) =>
      event.source_type === "fixed_lesson_override" &&
      event.event_date >= startDate &&
      event.event_date <= endDate,
  ).length;

  const manualLessonEventCount = studentEvents.filter(
    (event) =>
      event.source_type !== "fixed_lesson_override" &&
      event.source_type !== "fixed_lesson_cancelled" &&
      event.event_date >= startDate &&
      event.event_date <= endDate &&
      (event.event_type === "수업" || event.event_type === "보강수업"),
  ).length;

  return fixedCount + makeupCount + fixedOverrideCount + manualLessonEventCount;
}

function makeDefaultSettlement(
  student: Student,
  startDate: string,
  endDate: string,
): Settlement {
  return {
    student_id: student.id,
    start_date: startDate,
    end_date: endDate,
    expected_lesson_count: 0,
    lesson_hours:
      Number(student.lesson_hours || student.default_lesson_hours || 0) > 0
        ? Number(student.lesson_hours || student.default_lesson_hours)
        : 2,
    hourly_rate: Number(student.hourly_rate || 35000),
    feedback_date: null,
    feedback_done: false,
    payment_status: "대기중",
    payment_type: "선불",
    payment_completed_date: null,
    feedback_note: null,
    actual_lesson_count_override: null,
    total_fee_override: null,
  };
}

function settlementRangeStorageKey(monthText: string) {
  return `tutor-flow-settlement-range-${monthText}`;
}

function getMonthTextFromDate(dateText: string) {
  return String(dateText || "").slice(0, 7);
}

function readStoredSettlementRange(fallback: { startDate: string; endDate: string }) {
  if (typeof window === "undefined") return fallback;

  const monthText = getMonthTextFromDate(fallback.startDate);
  const raw = window.localStorage.getItem(settlementRangeStorageKey(monthText));

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as { startDate?: string; endDate?: string };
    if (parsed.startDate && parsed.endDate) {
      return { startDate: parsed.startDate, endDate: parsed.endDate };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function saveStoredSettlementRange(monthText: string, startDate: string, endDate: string) {
  if (typeof window === "undefined" || !monthText || !startDate || !endDate) return;

  window.localStorage.setItem(
    settlementRangeStorageKey(monthText),
    JSON.stringify({ startDate, endDate }),
  );
}

export default function PaymentsPage() {
  const { startDate: defaultStart, endDate: defaultEnd } = useMemo(
    () => getMonthRange(),
    [],
  );

  const initialRange = useMemo(
    () => readStoredSettlementRange({ startDate: defaultStart, endDate: defaultEnd }),
    [defaultStart, defaultEnd],
  );

  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [lessonTimes, setLessonTimes] = useState<LessonTime[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [makeupLessons, setMakeupLessons] = useState<MakeupLesson[]>([]);
  const [nextMonthEvents, setNextMonthEvents] = useState<StudentEvent[]>([]);
  const [nextMonthMakeupLessons, setNextMonthMakeupLessons] = useState<
    MakeupLesson[]
  >([]);
  const [nextMonthSettlements, setNextMonthSettlements] = useState<
    Record<string, Settlement>
  >({});
  const [settlements, setSettlements] = useState<Record<string, Settlement>>(
    {},
  );
  const [memos, setMemos] = useState<SettlementMemo[]>([]);
  const [openSettings, setOpenSettings] = useState<Record<string, boolean>>({});
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [editingActual, setEditingActual] = useState<string | null>(null);
  const [editingTotalFee, setEditingTotalFee] = useState<string | null>(null);
  const [newMemoStudentId, setNewMemoStudentId] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  function moveSettlementMonth(offset: number) {
    const nextRange = getMonthRangeByOffset(startDate, offset);
    const storedRange = readStoredSettlementRange(nextRange);
    setStartDate(storedRange.startDate);
    setEndDate(storedRange.endDate);
  }

  function updateSettlementRange(nextStartDate: string, nextEndDate: string) {
    const monthText = getMonthTextFromDate(nextStartDate || startDate);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    saveStoredSettlementRange(monthText, nextStartDate, nextEndDate);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const nextMonthInfo = getMonthRangeByOffset(startDate, 1);

      const [
        studentsResult,
        recordsResult,
        lessonTimesResult,
        eventsResult,
        makeupLessonsResult,
        settlementsResult,
        nextMonthEventsResult,
        nextMonthMakeupLessonsResult,
        nextMonthSettlementsResult,
        memosResult,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("lesson_records")
          .select(
            "id, student_id, lesson_date, is_extra, has_regular_extra, total_minutes, billable_minutes, extra_minutes",
          )
          .gte("lesson_date", startDate)
          .lte("lesson_date", endDate),
        supabase
          .from("student_lesson_times")
          .select("id, student_id, day_of_week, start_time, end_time"),
        supabase
          .from("student_events")
          .select(
            "id, student_id, event_date, event_time, event_type, source_type, original_event_date, original_lesson_time_id",
          )
          .or(
            `and(event_date.gte.${startDate},event_date.lte.${endDate}),and(original_event_date.gte.${startDate},original_event_date.lte.${endDate})`,
          ),
        supabase
          .from("makeup_lessons")
          .select(
            "id, student_id, absent_date, makeup_date, makeup_time, is_done",
          )
          .or(
            `and(absent_date.gte.${startDate},absent_date.lte.${endDate}),and(makeup_date.gte.${startDate},makeup_date.lte.${endDate})`,
          ),
        supabase
          .from("settlements")
          .select("*")
          .eq("start_date", startDate)
          .eq("end_date", endDate),
        supabase
          .from("student_events")
          .select(
            "id, student_id, event_date, event_time, event_type, source_type, original_event_date, original_lesson_time_id",
          )
          .or(
            `and(event_date.gte.${nextMonthInfo.startDate},event_date.lte.${nextMonthInfo.endDate}),and(original_event_date.gte.${nextMonthInfo.startDate},original_event_date.lte.${nextMonthInfo.endDate})`,
          ),
        supabase
          .from("makeup_lessons")
          .select(
            "id, student_id, absent_date, makeup_date, makeup_time, is_done",
          )
          .or(
            `and(absent_date.gte.${nextMonthInfo.startDate},absent_date.lte.${nextMonthInfo.endDate}),and(makeup_date.gte.${nextMonthInfo.startDate},makeup_date.lte.${nextMonthInfo.endDate})`,
          ),
        supabase
          .from("settlements")
          .select("*")
          .eq("start_date", nextMonthInfo.startDate)
          .eq("end_date", nextMonthInfo.endDate),
        supabase
          .from("settlement_memos")
          .select("*, students(name)")
          .eq("start_date", startDate)
          .eq("end_date", endDate)
          .order("created_at", { ascending: false }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (recordsResult.error) throw recordsResult.error;
      if (lessonTimesResult.error) throw lessonTimesResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (makeupLessonsResult.error) throw makeupLessonsResult.error;
      if (settlementsResult.error) throw settlementsResult.error;
      if (nextMonthEventsResult.error) throw nextMonthEventsResult.error;
      if (nextMonthMakeupLessonsResult.error)
        throw nextMonthMakeupLessonsResult.error;
      if (nextMonthSettlementsResult.error)
        throw nextMonthSettlementsResult.error;
      if (memosResult.error) throw memosResult.error;

      const loadedStudents = (studentsResult.data || []) as Student[];
      const loadedSettlements = (
        (settlementsResult.data || []) as any[]
      ).reduce(
        (acc, item) => {
          acc[item.student_id] = {
            ...item,
            expected_lesson_count: Number(item.expected_lesson_count || 0),
            lesson_hours: Number(item.lesson_hours || 2),
            hourly_rate: Number(item.hourly_rate || 35000),
            feedback_done: Boolean(item.feedback_done),
            payment_status: normalizePaymentStatus(item.payment_status),
            payment_type: normalizePaymentType(item.payment_type),
            payment_completed_date: item.payment_completed_date || null,
            feedback_note: item.feedback_note || null,
            actual_lesson_count_override:
              item.actual_lesson_count_override === null ||
              item.actual_lesson_count_override === undefined
                ? null
                : Number(item.actual_lesson_count_override),
            total_fee_override:
              item.total_fee_override === null ||
              item.total_fee_override === undefined
                ? null
                : Number(item.total_fee_override),
          } as Settlement;
          return acc;
        },
        {} as Record<string, Settlement>,
      );

      const loadedNextMonthSettlements = (
        (nextMonthSettlementsResult.data || []) as any[]
      ).reduce(
        (acc, item) => {
          acc[item.student_id] = {
            ...item,
            expected_lesson_count: Number(item.expected_lesson_count || 0),
            lesson_hours: Number(item.lesson_hours || 2),
            hourly_rate: Number(item.hourly_rate || 35000),
            feedback_done: Boolean(item.feedback_done),
            payment_status: normalizePaymentStatus(item.payment_status),
            payment_type: normalizePaymentType(item.payment_type),
            payment_completed_date: item.payment_completed_date || null,
            feedback_note: item.feedback_note || null,
            actual_lesson_count_override:
              item.actual_lesson_count_override === null ||
              item.actual_lesson_count_override === undefined
                ? null
                : Number(item.actual_lesson_count_override),
            total_fee_override:
              item.total_fee_override === null ||
              item.total_fee_override === undefined
                ? null
                : Number(item.total_fee_override),
          } as Settlement;
          return acc;
        },
        {} as Record<string, Settlement>,
      );

      const mergedSettlements = loadedStudents.reduce(
        (acc, student) => {
          acc[student.id] =
            loadedSettlements[student.id] ||
            makeDefaultSettlement(student, startDate, endDate);
          return acc;
        },
        {} as Record<string, Settlement>,
      );

      setStudents(loadedStudents);
      setRecords((recordsResult.data || []) as LessonRecord[]);
      setLessonTimes((lessonTimesResult.data || []) as LessonTime[]);
      setEvents((eventsResult.data || []) as StudentEvent[]);
      setMakeupLessons((makeupLessonsResult.data || []) as MakeupLesson[]);
      setNextMonthEvents((nextMonthEventsResult.data || []) as StudentEvent[]);
      setNextMonthMakeupLessons(
        (nextMonthMakeupLessonsResult.data || []) as MakeupLesson[],
      );
      setNextMonthSettlements(loadedNextMonthSettlements);
      setSettlements(mergedSettlements);
      setMemos((memosResult.data || []) as SettlementMemo[]);

      if (!newMemoStudentId && loadedStudents.length > 0) {
        setNewMemoStudentId(loadedStudents[0].id);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "정산 정보를 불러오지 못했어.");
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo<StudentSettlementRow[]>(() => {
    return students.map((student) => {
      const settlement =
        settlements[student.id] ||
        makeDefaultSettlement(student, startDate, endDate);
      const studentRecords = records.filter(
        (record) => record.student_id === student.id,
      );
      const billableRecords = studentRecords.filter(
        (record) => !record.is_extra,
      );
      const extraRecords = studentRecords.filter((record) => record.is_extra);

      const calendarExpectedCount = countCalendarExpectedLessons(
        student.id,
        startDate,
        endDate,
        lessonTimes,
        events,
        makeupLessons,
      );
      const autoActualLessonCount = billableRecords.length;
      const actualLessonCount =
        settlement.actual_lesson_count_override === null ||
        settlement.actual_lesson_count_override === undefined
          ? autoActualLessonCount
          : Number(settlement.actual_lesson_count_override || 0);
      const extraLessonCount = extraRecords.length;
      const actualTotalMinutes = studentRecords.reduce(
        (sum, record) => sum + Number(record.total_minutes || 0),
        0,
      );

      const billableMinutes = studentRecords.reduce((sum, record) => {
        if (record.is_extra) return sum;

        if (typeof record.billable_minutes === "number") {
          return sum + Number(record.billable_minutes || 0);
        }

        const total = Number(record.total_minutes || 0);
        const extra = Number(record.extra_minutes || 0);
        return sum + Math.max(0, total - extra);
      }, 0);

      const expectedCount = Number(
        settlement.expected_lesson_count || calendarExpectedCount || 0,
      );
      const lessonHours = Number(settlement.lesson_hours || 0);
      const hourlyRate = Number(settlement.hourly_rate || 0);
      const oneLessonFee = lessonHours * hourlyRate;

      const expectedFee = expectedCount * oneLessonFee;
      const actualFee = actualLessonCount * oneLessonFee;
      const paymentType = settlement.payment_type || "선불";

      const prepaidCarryoverCount =
        paymentType === "선불"
          ? Math.max(expectedCount - actualLessonCount, 0)
          : 0;
      const prepaidExtraCount =
        paymentType === "선불"
          ? Math.max(actualLessonCount - expectedCount, 0)
          : 0;
      const prepaidExtraFee = prepaidExtraCount * oneLessonFee;
      const autoTotalFee = paymentType === "선불" ? expectedFee : actualFee;
      const totalFee =
        settlement.total_fee_override === null ||
        settlement.total_fee_override === undefined
          ? autoTotalFee
          : Number(settlement.total_fee_override || 0);

      const progress =
        expectedCount > 0 ? (actualLessonCount / expectedCount) * 100 : 0;
      const nextMonthInfoForRow = getMonthRangeByOffset(startDate, 1);
      const nextMonthAutoExpectedCount = countCalendarExpectedLessons(
        student.id,
        nextMonthInfoForRow.startDate,
        nextMonthInfoForRow.endDate,
        lessonTimes,
        nextMonthEvents,
        nextMonthMakeupLessons,
      );
      const nextMonthSettlement = nextMonthSettlements[student.id];
      const nextMonthExpectedCount = Number(
        nextMonthSettlement?.expected_lesson_count ||
          nextMonthAutoExpectedCount ||
          0,
      );
      const nextMonthLessonHours = Number(
        nextMonthSettlement?.lesson_hours || lessonHours || 0,
      );
      const nextMonthHourlyRate = Number(
        nextMonthSettlement?.hourly_rate || hourlyRate || 0,
      );
      const nextMonthAutoTotalFee =
        nextMonthExpectedCount * nextMonthLessonHours * nextMonthHourlyRate;
      const nextMonthTotalFee =
        nextMonthSettlement?.total_fee_override === null ||
        nextMonthSettlement?.total_fee_override === undefined
          ? nextMonthAutoTotalFee
          : Number(nextMonthSettlement.total_fee_override || 0);

      return {
        student,
        settlement,
        records: studentRecords,
        calendarExpectedCount,
        actualLessonCount,
        autoActualLessonCount,
        extraLessonCount,
        actualTotalMinutes,
        billableMinutes,
        expectedFee,
        actualFee,
        totalFee,
        prepaidCarryoverCount,
        prepaidExtraCount,
        prepaidExtraFee,
        progress,
        nextMonthExpectedCount,
        nextMonthTotalFee,
      };
    });
  }, [
    students,
    records,
    lessonTimes,
    events,
    makeupLessons,
    settlements,
    startDate,
    endDate,
  ]);

  const overallExpectedCount = rows.reduce(
    (sum, row) =>
      sum +
      Number(
        row.settlement.expected_lesson_count || row.calendarExpectedCount || 0,
      ),
    0,
  );
  const overallActualCount = rows.reduce(
    (sum, row) => sum + row.actualLessonCount,
    0,
  );
  const overallProgress =
    overallExpectedCount > 0
      ? (overallActualCount / overallExpectedCount) * 100
      : 0;

  const totalSettlementFee = rows.reduce((sum, row) => sum + row.totalFee, 0);
  const totalUnpaidFee = rows.reduce((sum, row) => {
    if (row.settlement.payment_status === "대기중") return sum + row.totalFee;
    return sum;
  }, 0);

  function updateLocalSettlement(
    studentId: string,
    patch: Partial<Settlement>,
  ) {
    setSettlements((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...patch,
      },
    }));
  }

  async function saveSettlement(
    studentId: string,
    patch?: Partial<Settlement>,
  ) {
    const current =
      settlements[studentId] ||
      makeDefaultSettlement(
        students.find((student) => student.id === studentId) || {
          id: studentId,
          name: "",
        },
        startDate,
        endDate,
      );

    const next: Settlement = {
      ...current,
      ...(patch || {}),
      student_id: studentId,
      start_date: startDate,
      end_date: endDate,
      expected_lesson_count: Number(
        (patch?.expected_lesson_count ?? current.expected_lesson_count) || 0,
      ),
      lesson_hours: Number((patch?.lesson_hours ?? current.lesson_hours) || 0),
      hourly_rate: Number((patch?.hourly_rate ?? current.hourly_rate) || 0),
      payment_status: normalizePaymentStatus(
        patch?.payment_status ?? current.payment_status,
      ),
      payment_type: normalizePaymentType(
        patch?.payment_type ?? current.payment_type,
      ),
      payment_completed_date:
        patch?.payment_completed_date ?? current.payment_completed_date ?? null,
      feedback_note: patch?.feedback_note ?? current.feedback_note ?? null,
      actual_lesson_count_override:
        patch?.actual_lesson_count_override === undefined
          ? (current.actual_lesson_count_override ?? null)
          : patch.actual_lesson_count_override,
      total_fee_override:
        patch?.total_fee_override === undefined
          ? (current.total_fee_override ?? null)
          : patch.total_fee_override,
      feedback_done: Boolean(patch?.feedback_done ?? current.feedback_done),
      feedback_date: patch?.feedback_date ?? current.feedback_date ?? null,
    };

    saveStoredSettlementRange(getMonthTextFromDate(startDate), startDate, endDate);

    setSavingId(studentId);
    setErrorMessage("");

    try {
      const { error } = await supabase.from("settlements").upsert(
        {
          student_id: next.student_id,
          start_date: next.start_date,
          end_date: next.end_date,
          expected_lesson_count: next.expected_lesson_count,
          lesson_hours: next.lesson_hours,
          hourly_rate: next.hourly_rate,
          feedback_date: next.feedback_date,
          feedback_done: next.feedback_done,
          payment_status: next.payment_status,
          payment_type: next.payment_type,
          payment_completed_date: next.payment_completed_date,
          feedback_note: next.feedback_note,
          actual_lesson_count_override: next.actual_lesson_count_override,
          total_fee_override: next.total_fee_override,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,start_date,end_date" },
      );

      if (error) throw error;

      // 정산설정에서 바꾼 기본값은 다음달/이전달로 이동해도 유지되도록 학생 기본값에도 같이 저장해요.
      const studentPatch: Record<string, number> = {};
      if (patch?.lesson_hours !== undefined)
        studentPatch.default_lesson_hours = next.lesson_hours;
      if (patch?.hourly_rate !== undefined)
        studentPatch.hourly_rate = next.hourly_rate;

      if (Object.keys(studentPatch).length > 0) {
        await supabase
          .from("students")
          .update(studentPatch)
          .eq("id", studentId);
      }

      updateLocalSettlement(studentId, next);
    } catch (error: any) {
      setErrorMessage(error.message || "정산 설정 저장에 실패했어.");
    } finally {
      setSavingId(null);
    }
  }

  async function addMemo() {
    if (!newMemoStudentId || !newMemo.trim()) return;

    setErrorMessage("");

    try {
      const { error } = await supabase.from("settlement_memos").insert({
        student_id: newMemoStudentId,
        start_date: startDate,
        end_date: endDate,
        memo: newMemo.trim(),
      });

      if (error) throw error;
      setNewMemo("");
      await loadData();
    } catch (error: any) {
      setErrorMessage(error.message || "메모 추가에 실패했어.");
    }
  }

  async function deleteMemo(memoId: string) {
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("settlement_memos")
        .delete()
        .eq("id", memoId);

      if (error) throw error;
      setMemos((prev) => prev.filter((memo) => memo.id !== memoId));
    } catch (error: any) {
      setErrorMessage(error.message || "메모 삭제에 실패했어.");
    }
  }

  function makeParentFeedbackMessage(row: StudentSettlementRow) {
    const studentName = row.student.name;
    const settlement = row.settlement;
    const paymentType = settlement.payment_type || "선불";
    const expectedCount = Number(
      settlement.expected_lesson_count || row.calendarExpectedCount || 0,
    );
    const lessonHours = Number(settlement.lesson_hours || 0);
    const feedbackDateText = settlement.feedback_date
      ? formatDateShort(settlement.feedback_date)
      : "월말";

    const extraLessonLine =
      row.extraLessonCount > 0
        ? `\n추가수업은 ${row.extraLessonCount}회 진행되었습니다.`
        : "";

    const paymentLine =
      paymentType === "선불"
        ? `다음 달 총 수업료는 ${formatMoney(row.totalFee)}입니다.`
        : `이번 달 실제 진행 기준 수업료는 ${formatMoney(row.totalFee)}입니다.`;

    const carryLine =
      paymentType === "선불" && row.prepaidCarryoverCount > 0
        ? `\n${Number(startDate.split("-")[1])}월 수업 ${row.prepaidCarryoverCount}회가 다음 달로 이월됩니다.`
        : paymentType === "선불" && row.prepaidExtraCount > 0
          ? `\n${Number(startDate.split("-")[1])}월 수업이 예정보다 ${row.prepaidExtraCount}회 더 진행되어, 추가 수업료 ${formatMoney(row.prepaidExtraFee)}는 다음 달 정산에 함께 반영하겠습니다.`
          : "";

    const feedbackNote = settlement.feedback_note?.trim()
      ? settlement.feedback_note.trim()
      : "- 시험 결과 / 숙제 수행 / 수업 태도 / 수행평가 관련 내용을 여기에 적어주세요.";

    return `어머님 안녕하세요^^ ${studentName} ${getSettlementTitle(startDate)} 수업 안내드립니다.

${feedbackDateText} 기준으로 이번 회차 수업 정리드리며, 다음 달 예정 수업은 ${expectedCount}회, 회당 ${lessonHours}시간 기준입니다.
${paymentLine}${carryLine}${extraLessonLine}

다음 달 수업은 총 ${row.nextMonthExpectedCount}회로, 수업료는 ${formatMoney(row.nextMonthTotalFee)}입니다.
수업료는 토스뱅크 1000-2247-9798 김재이로 입금해주시면 감사하겠습니다.

수업 피드백
${feedbackNote}

확인 부탁드립니다. 감사합니다 :)`;
  }

  async function copyFeedbackMessage(row: StudentSettlementRow) {
    const message = makeParentFeedbackMessage(row);

    try {
      await navigator.clipboard.writeText(message);
      setCopiedStudentId(row.student.id);
      window.setTimeout(() => setCopiedStudentId(null), 1500);
    } catch {
      window.prompt("아래 문자를 복사해 주세요.", message);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff3f7] px-5 py-8 text-[#3a2a30]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-[#f4d6df] bg-white/80 p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold text-[#b56b82] hover:text-[#8f405a]"
            >
              ← 대시보드로
            </Link>

            <h1 className="mt-3 text-3xl font-black text-[#583743]">
              월별 정산
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#9b6d7a]">
              선불/후불, 이월 수업, 학부모 안내문자를 한 번에 정리해요.
            </p>
          </div>

          <div className="rounded-3xl bg-[#fff7fa] p-4 text-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => moveSettlementMonth(-1)}
                className="rounded-full border border-[#efc8d4] bg-white px-3 py-1.5 text-xs font-black text-[#b56b82] hover:bg-[#ffe8f0]"
              >
                ← 이전 회차
              </button>

              <div className="rounded-full bg-[#ffdce8] px-5 py-2 text-base font-black text-[#7d2f49] shadow-sm">
                {getSettlementTitle(startDate)}
              </div>

              <button
                type="button"
                onClick={() => moveSettlementMonth(1)}
                className="rounded-full border border-[#efc8d4] bg-white px-3 py-1.5 text-xs font-black text-[#b56b82] hover:bg-[#ffe8f0]"
              >
                다음 회차 →
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="font-bold text-[#8e5366]">
                시작
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => updateSettlementRange(event.target.value, endDate)}
                  className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                />
              </label>

              <label className="font-bold text-[#8e5366]">
                마무리
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => updateSettlementRange(startDate, event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                />
              </label>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-5 rounded-3xl border border-[#f0b8c8] bg-[#fff7fa] px-5 py-4 text-sm font-bold text-[#b34262]">
            {errorMessage}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <ProgressSummaryBox percent={overallProgress} />
          <SummaryBox
            title="이번달 정산 총액"
            value={formatMoney(totalSettlementFee)}
            sub="선불은 예정 기준, 후불은 실제 진행 기준"
          />
          <SummaryBox
            title="미입금 수업료"
            value={formatMoney(totalUnpaidFee)}
            sub="입금완료 처리 전 금액만 합산"
            tone="pink"
          />
        </section>

        <section className="rounded-[2rem] border border-[#f3d3dd] bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#583743]">
                학생별 정산 현황
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#9b6d7a]">
                학생 이름을 누르면 상세페이지로 이동해요.
              </p>
            </div>

            {loading && (
              <p className="text-sm font-bold text-[#b56b82]">불러오는 중...</p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => {
              const studentId = row.student.id;
              const settlement = row.settlement;
              const isOpen = Boolean(openSettings[studentId]);
              const isEditingExpected = editingExpected === studentId;
              const paymentType = settlement.payment_type || "선불";

              return (
                <article
                  key={studentId}
                  className="rounded-[2rem] border border-[#f3d3dd] bg-[#fff9fb] p-5 shadow-sm"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/students/${studentId}`}
                        className="text-2xl font-black text-[#583743] underline decoration-[#f3b6c6] underline-offset-4 hover:text-[#d93675]"
                      >
                        {row.student.name}
                      </Link>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          paymentType === "후불"
                            ? "bg-[#eef7ff] text-[#3f6f91]"
                            : "bg-[#fff0f5] text-[#b34262]"
                        }`}
                      >
                        {paymentType}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenSettings((prev) => ({
                            ...prev,
                            [studentId]: !prev[studentId],
                          }))
                        }
                        className="rounded-full border border-[#efc8d4] bg-white px-3 py-1 text-xs font-bold text-[#b56b82] hover:bg-[#fff0f5]"
                      >
                        정산 설정
                      </button>

                      {savingId === studentId && (
                        <span className="text-xs font-bold text-[#c4778c]">
                          저장 중...
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard
                        title={
                          paymentType === "후불" ? "예상 수업료" : "총 수업료"
                        }
                        tone="strong"
                      >
                        {editingTotalFee === studentId ? (
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={
                              settlement.total_fee_override ?? row.totalFee
                            }
                            onChange={(event) =>
                              updateLocalSettlement(studentId, {
                                total_fee_override: Number(
                                  event.target.value || 0,
                                ),
                              })
                            }
                            onBlur={() => {
                              setEditingTotalFee(null);
                              saveSettlement(studentId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setEditingTotalFee(null);
                                saveSettlement(studentId);
                              }
                            }}
                            autoFocus
                            className="w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-right text-lg font-black text-[#7d2f49] outline-none focus:border-[#dc7f9a]"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingTotalFee(studentId)}
                              className="text-left text-lg font-black text-[#7d2f49] underline decoration-[#f3b6c6] underline-offset-4"
                            >
                              {formatMoney(row.totalFee)}
                            </button>
                            <span className="shrink-0 rounded-2xl bg-white px-3 py-1.5 text-sm font-black text-[#9b4f65] shadow-sm ring-1 ring-[#f3c4d1]">
                              {Number(
                                row.settlement.expected_lesson_count ||
                                  row.calendarExpectedCount ||
                                  0,
                              )}
                              회 × {Number(settlement.lesson_hours || 0)}시간
                            </span>
                          </div>
                        )}

                        {settlement.total_fee_override !== null &&
                          settlement.total_fee_override !== undefined && (
                            <button
                              type="button"
                              onClick={() => {
                                updateLocalSettlement(studentId, {
                                  total_fee_override: null,
                                });
                                saveSettlement(studentId, {
                                  total_fee_override: null,
                                });
                              }}
                              className="mt-2 text-[11px] font-black text-[#c4778c] underline underline-offset-2"
                            >
                              자동계산으로 돌리기
                            </button>
                          )}
                      </InfoCard>

                      <InfoCard
                        title={
                          paymentType === "후불"
                            ? "실제 정산액"
                            : "이월/추가 반영"
                        }
                      >
                        <span className="text-lg font-black text-[#b34262]">
                          {paymentType === "후불"
                            ? formatMoney(row.totalFee)
                            : row.prepaidCarryoverCount > 0
                              ? `${Number(startDate.split("-")[1])}월 ${row.prepaidCarryoverCount}회 이월`
                              : row.prepaidExtraCount > 0
                                ? `${row.prepaidExtraCount}회 추가`
                                : "이월 없음"}
                        </span>

                        {paymentType === "선불" &&
                          row.prepaidExtraCount > 0 && (
                            <p className="mt-1 text-[11px] font-bold text-[#d93675]">
                              다음달 추가 {formatMoney(row.prepaidExtraFee)}
                            </p>
                          )}

                        {paymentType === "후불" && (
                          <p className="mt-1 text-[11px] font-bold text-[#9b6d7a]">
                            실제 {formatHours(row.billableMinutes)}
                          </p>
                        )}
                      </InfoCard>

                      <InfoCard title="예상 수업횟수">
                        {isEditingExpected ? (
                          <input
                            type="number"
                            min="0"
                            value={Number(
                              settlement.expected_lesson_count ||
                                row.calendarExpectedCount ||
                                0,
                            )}
                            onChange={(event) =>
                              updateLocalSettlement(studentId, {
                                expected_lesson_count: Number(
                                  event.target.value || 0,
                                ),
                                total_fee_override: null,
                              })
                            }
                            onBlur={() => {
                              setEditingExpected(null);
                              saveSettlement(studentId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setEditingExpected(null);
                                saveSettlement(studentId);
                              }
                            }}
                            autoFocus
                            className="w-24 rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-right text-lg font-black outline-none focus:border-[#dc7f9a]"
                          />
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingExpected(studentId)}
                              className="text-left text-lg font-black text-[#583743] underline decoration-[#f3b6c6] underline-offset-4"
                            >
                              {Number(
                                settlement.expected_lesson_count ||
                                  row.calendarExpectedCount ||
                                  0,
                              )}
                              회
                            </button>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#a36879] ring-1 ring-[#f3d3dd]">
                              캘린더 자동 {row.calendarExpectedCount}회
                            </span>
                          </div>
                        )}
                      </InfoCard>

                      <InfoCard title="실제 수업횟수">
                        {editingActual === studentId ? (
                          <input
                            type="number"
                            min="0"
                            value={row.actualLessonCount}
                            onChange={(event) =>
                              updateLocalSettlement(studentId, {
                                actual_lesson_count_override: Number(
                                  event.target.value || 0,
                                ),
                                total_fee_override: null,
                              })
                            }
                            onBlur={() => {
                              setEditingActual(null);
                              saveSettlement(studentId);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setEditingActual(null);
                                saveSettlement(studentId);
                              }
                            }}
                            autoFocus
                            className="w-24 rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-right text-lg font-black outline-none focus:border-[#dc7f9a]"
                          />
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingActual(studentId)}
                              className="text-left text-lg font-black text-[#583743] underline decoration-[#f3b6c6] underline-offset-4"
                            >
                              {row.actualLessonCount}회
                            </button>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#a36879] ring-1 ring-[#f3d3dd]">
                              기록 자동 {row.autoActualLessonCount}회
                            </span>
                            {settlement.actual_lesson_count_override !== null &&
                              settlement.actual_lesson_count_override !==
                                undefined && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateLocalSettlement(studentId, {
                                      actual_lesson_count_override: null,
                                      total_fee_override: null,
                                    });
                                    saveSettlement(studentId, {
                                      actual_lesson_count_override: null,
                                      total_fee_override: null,
                                    });
                                  }}
                                  className="text-[11px] font-black text-[#c4778c] underline underline-offset-2"
                                >
                                  자동으로
                                </button>
                              )}
                            {row.extraLessonCount > 0 && (
                              <span className="rounded-full bg-[#fff0f5] px-2.5 py-1 text-xs font-black text-[#b34262]">
                                추가수업 {row.extraLessonCount}회
                              </span>
                            )}
                          </div>
                        )}
                      </InfoCard>

                      <InfoCard title="피드백 / 안내문자">
                        <div className="flex flex-wrap items-center gap-2">
                          <DateTextPicker
                            value={settlement.feedback_date}
                            onChange={(feedbackDate) => {
                              updateLocalSettlement(studentId, {
                                feedback_date: feedbackDate,
                              });
                              saveSettlement(studentId, {
                                feedback_date: feedbackDate,
                              });
                            }}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              saveSettlement(studentId, {
                                feedback_done: !settlement.feedback_done,
                              })
                            }
                            className={`rounded-full px-3 py-2 text-xs font-black ${
                              settlement.feedback_done
                                ? "bg-[#ffd6e1] text-[#9e3556]"
                                : "bg-white text-[#9b6d7a] ring-1 ring-[#efc8d4]"
                            }`}
                          >
                            {settlement.feedback_done ? "안내완료" : "안내전"}
                          </button>

                          <details className="w-fit">
                            <summary className="w-fit cursor-pointer list-none rounded-full border border-[#efc8d4] bg-white px-3 py-2 text-xs font-black text-[#b56b82] hover:bg-[#fff0f5]">
                              학생별 피드백칸 열기
                            </summary>

                            <div className="mt-3 rounded-2xl border border-[#f3d3dd] bg-[#fff9fb] p-3">
                              <label className="text-xs font-black text-[#8e5366]">
                                수업 피드백 메모
                              </label>
                              <textarea
                                value={settlement.feedback_note || ""}
                                onChange={(event) =>
                                  updateLocalSettlement(studentId, {
                                    feedback_note: event.target.value,
                                  })
                                }
                                onBlur={() =>
                                  saveSettlement(studentId, {
                                    total_fee_override: null,
                                  })
                                }
                                placeholder="시험 결과, 숙제 수행, 수업 태도, 수행평가 관련 내용을 적어두면 아래 문자에 자동으로 들어가요."
                                className="mt-2 min-h-24 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-xs font-semibold leading-5 outline-none focus:border-[#dc7f9a]"
                              />

                              <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-semibold leading-6 text-[#583743]">
                                <p className="mb-2 font-black text-[#b34262]">
                                  자동 안내문자 초안
                                </p>
                                <pre className="whitespace-pre-wrap font-sans">
                                  {makeParentFeedbackMessage(row)}
                                </pre>
                              </div>

                              <button
                                type="button"
                                onClick={() => copyFeedbackMessage(row)}
                                className="mt-3 rounded-full bg-[#d96f8d] px-4 py-2 text-xs font-black text-white"
                              >
                                {copiedStudentId === studentId
                                  ? "복사 완료"
                                  : "문자 복사"}
                              </button>
                            </div>
                          </details>
                        </div>
                      </InfoCard>

                      <InfoCard title="수업료 현황">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus: PaymentStatus =
                                settlement.payment_status === "입금완료"
                                  ? "대기중"
                                  : "입금완료";

                              saveSettlement(studentId, {
                                payment_status: nextStatus,
                                payment_completed_date:
                                  nextStatus === "입금완료"
                                    ? settlement.payment_completed_date ||
                                      todayText()
                                    : null,
                              });
                            }}
                            className={`rounded-full px-4 py-2 text-sm font-black ${
                              settlement.payment_status === "입금완료"
                                ? "bg-[#ffd6e1] text-[#9e3556]"
                                : "bg-white text-[#9b6d7a] ring-1 ring-[#efc8d4]"
                            }`}
                          >
                            {settlement.payment_status}
                          </button>

                          {settlement.payment_status === "입금완료" && (
                            <input
                              type="date"
                              value={settlement.payment_completed_date || ""}
                              onChange={(event) => {
                                updateLocalSettlement(studentId, {
                                  payment_completed_date: event.target.value,
                                });
                                saveSettlement(studentId, {
                                  payment_completed_date: event.target.value,
                                });
                              }}
                              className="w-36 rounded-full border border-[#efc8d4] bg-white px-3 py-2 text-xs font-black text-[#9e3556] outline-none"
                            />
                          )}
                        </div>
                      </InfoCard>
                    </div>

                    <StudentProgressBar
                      percent={row.progress}
                      actualCount={row.actualLessonCount}
                      expectedCount={Number(
                        settlement.expected_lesson_count ||
                          row.calendarExpectedCount ||
                          0,
                      )}
                    />
                  </div>

                  {isOpen && (
                    <div className="mt-5 rounded-3xl border border-[#f3d3dd] bg-white p-4">
                      <p className="mb-3 text-sm font-black text-[#8e5366]">
                        숨겨둔 정산 설정
                      </p>

                      <div className="grid gap-3 md:grid-cols-5">
                        <label className="text-sm font-bold text-[#8e5366]">
                          정산 방식
                          <select
                            value={settlement.payment_type || "선불"}
                            onChange={(event) => {
                              const paymentType = normalizePaymentType(
                                event.target.value,
                              );
                              updateLocalSettlement(studentId, {
                                payment_type: paymentType,
                              });
                              saveSettlement(studentId, {
                                payment_type: paymentType,
                              });
                            }}
                            className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                          >
                            <option value="선불">선불</option>
                            <option value="후불">후불</option>
                          </select>
                        </label>

                        <label className="text-sm font-bold text-[#8e5366]">
                          1회 수업시간
                          <select
                            value={String(settlement.lesson_hours)}
                            onChange={(event) => {
                              const lessonHours = Number(event.target.value);
                              updateLocalSettlement(studentId, {
                                lesson_hours: lessonHours,
                                total_fee_override: null,
                              });
                              saveSettlement(studentId, {
                                lesson_hours: lessonHours,
                                total_fee_override: null,
                              });
                            }}
                            className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                          >
                            {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((hour) => (
                              <option key={hour} value={hour}>
                                {hour}시간
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm font-bold text-[#8e5366]">
                          시간당 수업료
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={settlement.hourly_rate}
                            onChange={(event) =>
                              updateLocalSettlement(studentId, {
                                hourly_rate: Number(event.target.value || 0),
                                total_fee_override: null,
                              })
                            }
                            onBlur={(event) =>
                              saveSettlement(studentId, {
                                hourly_rate: Number(event.target.value || 0),
                                total_fee_override: null,
                              })
                            }
                            className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                          />
                        </label>

                        <div className="rounded-2xl bg-[#fff7fa] p-3 text-sm">
                          <p className="font-bold text-[#9b6d7a]">
                            예상 총시간
                          </p>
                          <p className="mt-1 text-lg font-black text-[#583743]">
                            {Number(
                              settlement.expected_lesson_count ||
                                row.calendarExpectedCount ||
                                0,
                            ) * Number(settlement.lesson_hours || 0)}
                            시간
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#fff7fa] p-3 text-sm">
                          <p className="font-bold text-[#9b6d7a]">
                            실제 총 수업시간
                          </p>
                          <p className="mt-1 text-lg font-black text-[#583743]">
                            {formatHours(row.actualTotalMinutes)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-[#f3d3dd] bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-black text-[#583743]">정산 메모</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <select
              value={newMemoStudentId}
              onChange={(event) => setNewMemoStudentId(event.target.value)}
              className="rounded-2xl border border-[#efc8d4] bg-[#fff9fb] px-3 py-3 text-sm font-bold outline-none focus:border-[#dc7f9a]"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>

            <input
              value={newMemo}
              onChange={(event) => setNewMemo(event.target.value)}
              placeholder="예: 솔이만 후불 / 다음달 1회 이월"
              className="rounded-2xl border border-[#efc8d4] bg-[#fff9fb] px-4 py-3 text-sm outline-none focus:border-[#dc7f9a]"
            />

            <button
              type="button"
              onClick={addMemo}
              className="rounded-2xl bg-[#d96f8d] px-5 py-3 text-sm font-black text-white hover:bg-[#c75f7e]"
            >
              메모 추가
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {memos.length === 0 ? (
              <div className="rounded-3xl bg-[#fff7fa] p-4 text-sm font-bold text-[#9b6d7a]">
                아직 남긴 메모가 없어요.
              </div>
            ) : (
              memos.map((memo) => (
                <div
                  key={memo.id}
                  className="flex flex-col gap-2 rounded-3xl bg-[#fff7fa] p-4 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <p className="text-[#583743]">
                    <span className="mr-2 font-black text-[#b34262]">
                      {memo.students?.name ||
                        students.find(
                          (student) => student.id === memo.student_id,
                        )?.name ||
                        "학생"}
                    </span>
                    {memo.memo}
                  </p>

                  <button
                    type="button"
                    onClick={() => deleteMemo(memo.id)}
                    className="self-start rounded-full bg-white px-3 py-1 text-xs font-black text-[#9b6d7a] ring-1 ring-[#efc8d4] md:self-auto"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ProgressSummaryBox({ percent }: { percent: number }) {
  const safePercent = clampPercent(percent);

  return (
    <div className="rounded-[2rem] border border-[#f3d3dd] bg-white p-6 shadow-sm">
      <p className="text-sm font-black text-[#b56b82]">전체 수업 진행률</p>
      <p className="mt-2 text-3xl font-black text-[#583743]">
        {Math.round(safePercent)}%
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#ffe3ec]">
        <div
          className="h-full rounded-full bg-[#e84378] transition-all duration-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function SummaryBox({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "default" | "pink";
}) {
  return (
    <div
      className={`rounded-[2rem] border p-6 shadow-sm ${
        tone === "pink"
          ? "border-[#efb6c8] bg-[#ffe7ef]"
          : "border-[#f3d3dd] bg-white"
      }`}
    >
      <p className="text-sm font-black text-[#b56b82]">{title}</p>
      <p className="mt-2 text-3xl font-black text-[#583743]">{value}</p>
      {sub && <p className="mt-2 text-xs font-bold text-[#9b6d7a]">{sub}</p>}
    </div>
  );
}

function InfoCard({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "strong";
}) {
  return (
    <div
      className={`min-w-[150px] rounded-3xl p-3.5 ring-1 ${
        tone === "strong"
          ? "bg-[#ffdce8] ring-[#eca8bd]"
          : "bg-white ring-[#f3d3dd]"
      }`}
    >
      <p className="mb-1.5 text-xs font-black uppercase tracking-tight text-[#b56b82]">
        {title}
      </p>
      {children}
    </div>
  );
}

function DateTextPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    if (
      typeof (input as HTMLInputElement & { showPicker?: () => void })
        .showPicker === "function"
    ) {
      (input as HTMLInputElement & { showPicker: () => void }).showPicker();
    } else {
      input.click();
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        className="rounded-full bg-[#ffe1eb] px-3 py-2 text-xs font-black text-[#9e3556] hover:bg-[#ffd3e1]"
      >
        {formatDateShort(value)}
      </button>

      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
      />
    </div>
  );
}

function StudentProgressBar({
  percent,
  actualCount,
  expectedCount,
}: {
  percent: number;
  actualCount: number;
  expectedCount: number;
}) {
  const safePercent = clampPercent(percent);

  return (
    <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-[#f3d3dd]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black text-[#b56b82]">수업 진행률</p>
        <p className="text-sm font-black text-[#7d2f49]">
          {actualCount} / {expectedCount}회 · {Math.round(safePercent)}%
        </p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-[#ffe1eb]">
        <div
          className="h-full rounded-full bg-[#e84378] transition-all duration-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}
