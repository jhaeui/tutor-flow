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
  payment_status: "대기중" | "입금완료";
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
  actualLessonCount: number;
  actualTotalMinutes: number;
  billableMinutes: number;
  expectedFee: number;
  totalFee: number;
  progress: number;
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

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString()}원`;
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
  };
}

export default function PaymentsPage() {
  const { startDate: defaultStart, endDate: defaultEnd } = useMemo(
    () => getMonthRange(),
    [],
  );

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [settlements, setSettlements] = useState<Record<string, Settlement>>(
    {},
  );
  const [memos, setMemos] = useState<SettlementMemo[]>([]);
  const [openSettings, setOpenSettings] = useState<Record<string, boolean>>({});
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [newMemoStudentId, setNewMemoStudentId] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  function moveSettlementMonth(offset: number) {
    const nextRange = getMonthRangeByOffset(startDate, offset);
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [studentsResult, recordsResult, settlementsResult, memosResult] =
        await Promise.all([
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
            .from("settlements")
            .select("*")
            .eq("start_date", startDate)
            .eq("end_date", endDate),
          supabase
            .from("settlement_memos")
            .select("*, students(name)")
            .eq("start_date", startDate)
            .eq("end_date", endDate)
            .order("created_at", { ascending: false }),
        ]);

      if (studentsResult.error) throw studentsResult.error;
      if (recordsResult.error) throw recordsResult.error;
      if (settlementsResult.error) throw settlementsResult.error;
      if (memosResult.error) throw memosResult.error;

      const loadedStudents = (studentsResult.data || []) as Student[];
      const loadedSettlements = (
        (settlementsResult.data || []) as Settlement[]
      ).reduce(
        (acc, item) => {
          acc[item.student_id] = {
            ...item,
            expected_lesson_count: Number(item.expected_lesson_count || 0),
            lesson_hours: Number(item.lesson_hours || 2),
            hourly_rate: Number(item.hourly_rate || 35000),
            feedback_done: Boolean(item.feedback_done),
            payment_status:
              item.payment_status === "입금완료" ? "입금완료" : "대기중",
          };
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

      const actualLessonCount = billableRecords.length;
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

      const expectedFee =
        Number(settlement.expected_lesson_count || 0) *
        Number(settlement.lesson_hours || 0) *
        Number(settlement.hourly_rate || 0);
      const totalFee =
        (billableMinutes / 60) * Number(settlement.hourly_rate || 0);
      const progress =
        Number(settlement.expected_lesson_count || 0) > 0
          ? (actualLessonCount / Number(settlement.expected_lesson_count)) * 100
          : 0;

      return {
        student,
        settlement,
        records: studentRecords,
        actualLessonCount,
        actualTotalMinutes,
        billableMinutes,
        expectedFee,
        totalFee,
        progress,
      };
    });
  }, [students, records, settlements, startDate, endDate]);

  const overallExpectedCount = rows.reduce(
    (sum, row) => sum + Number(row.settlement.expected_lesson_count || 0),
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
  const totalExpectedFee = rows.reduce((sum, row) => sum + row.expectedFee, 0);
  const totalUnpaidFee = rows.reduce((sum, row) => {
    if (row.settlement.payment_status === "대기중") {
      return sum + row.totalFee;
    }
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
    const current = settlements[studentId];
    if (!current) return;

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
      payment_status:
        (patch?.payment_status ?? current.payment_status) === "입금완료"
          ? "입금완료"
          : "대기중",
      feedback_done: Boolean(patch?.feedback_done ?? current.feedback_done),
    };

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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,start_date,end_date" },
      );

      if (error) throw error;
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

  return (
    <main className="min-h-screen bg-[#fff3f7] px-5 py-8 text-[#3a2a30]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-[#f4d6df] bg-white/80 p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="text-sm font-semibold text-[#b56b82] hover:text-[#8f405a]"
              >
                ← 대시보드로
              </Link>
              <Link
                href="/students"
                className="rounded-full border border-[#efc8d4] bg-[#fff7fa] px-3 py-1 text-xs font-black text-[#b56b82] hover:bg-[#ffe8f0]"
              >
                학생목록
              </Link>
            </div>
            <h1 className="mt-3 text-3xl font-black text-[#583743]">
              월별 정산
            </h1>
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
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                />
              </label>
              <label className="font-bold text-[#8e5366]">
                마무리
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
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
            title="이번달 예상 총 수업료"
            value={formatMoney(totalExpectedFee)}
          />
          <SummaryBox
            title="미입금 수업료"
            value={formatMoney(totalUnpaidFee)}
            tone="pink"
          />
        </section>

        <section className="rounded-[2rem] border border-[#f3d3dd] bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#583743]">
                학생별 정산 현황
              </h2>
              
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

              return (
                <article
                  key={studentId}
                  className="rounded-[2rem] border border-[#f3d3dd] bg-[#fff9fb] p-5 shadow-sm"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-black text-[#583743]">
                        {row.student.name}
                      </h3>
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
                      <InfoCard title="예상 총 수업료" tone="strong">
                        <span className="text-lg font-black text-[#7d2f49]">
                          {formatMoney(row.expectedFee)}
                        </span>
                      </InfoCard>

                      <InfoCard title="총 수업료">
                        <span className="text-lg font-black text-[#b34262]">
                          {formatMoney(row.totalFee)}
                        </span>
                      </InfoCard>

                      <InfoCard title="예상 수업횟수">
                        {isEditingExpected ? (
                          <input
                            type="number"
                            min="0"
                            value={settlement.expected_lesson_count}
                            onChange={(event) =>
                              updateLocalSettlement(studentId, {
                                expected_lesson_count: Number(
                                  event.target.value || 0,
                                ),
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
                          <button
                            type="button"
                            onClick={() => setEditingExpected(studentId)}
                            className="text-left text-lg font-black text-[#583743] underline decoration-[#f3b6c6] underline-offset-4"
                          >
                            {settlement.expected_lesson_count}회
                          </button>
                        )}
                      </InfoCard>

                      <InfoCard title="실제 수업횟수">
                        <span className="text-lg font-black text-[#583743]">
                          {row.actualLessonCount}회
                        </span>
                      </InfoCard>

                      <InfoCard title="피드백">
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
                        </div>
                      </InfoCard>

                      <InfoCard title="수업료 현황">
                        <button
                          type="button"
                          onClick={() =>
                            saveSettlement(studentId, {
                              payment_status:
                                settlement.payment_status === "입금완료"
                                  ? "대기중"
                                  : "입금완료",
                            })
                          }
                          className={`rounded-full px-4 py-2 text-sm font-black ${
                            settlement.payment_status === "입금완료"
                              ? "bg-[#ffd6e1] text-[#9e3556]"
                              : "bg-white text-[#9b6d7a] ring-1 ring-[#efc8d4]"
                          }`}
                        >
                          {settlement.payment_status}
                        </button>
                      </InfoCard>
                    </div>

                    <StudentProgressBar
                      percent={row.progress}
                      actualCount={row.actualLessonCount}
                      expectedCount={Number(
                        settlement.expected_lesson_count || 0,
                      )}
                    />
                  </div>

                  {isOpen && (
                    <div className="mt-5 rounded-3xl border border-[#f3d3dd] bg-white p-4">
                      <p className="mb-3 text-sm font-black text-[#8e5366]">
                        숨겨둔 정산 설정
                      </p>
                      <div className="grid gap-3 md:grid-cols-4">
                        <label className="text-sm font-bold text-[#8e5366]">
                          1회 수업시간
                          <select
                            value={String(settlement.lesson_hours)}
                            onChange={(event) => {
                              const lessonHours = Number(event.target.value);
                              updateLocalSettlement(studentId, {
                                lesson_hours: lessonHours,
                              });
                              saveSettlement(studentId, {
                                lesson_hours: lessonHours,
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
                              })
                            }
                            onBlur={() => saveSettlement(studentId)}
                            className="mt-1 w-full rounded-2xl border border-[#efc8d4] bg-white px-3 py-2 text-sm outline-none focus:border-[#dc7f9a]"
                          />
                        </label>

                        <div className="rounded-2xl bg-[#fff7fa] p-3 text-sm">
                          <p className="font-bold text-[#9b6d7a]">
                            예상 총시간
                          </p>
                          <p className="mt-1 text-lg font-black text-[#583743]">
                            {Number(settlement.expected_lesson_count || 0) *
                              Number(settlement.lesson_hours || 0)}
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
              placeholder="예: 뽀야미는 귀여워"
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
  sub: string;
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
      <p className="mt-2 text-xs font-bold text-[#9b6d7a]">{sub}</p>
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
