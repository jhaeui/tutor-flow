"use client";

import { useMemo, useState } from "react";

type StudyTimeSession = {
  id: string;
  subject: string | null;
  title: string | null;
  duration_seconds: number;
  studied_at: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type SubjectStyle = {
  bg: string;
  soft: string;
  text: string;
  border: string;
  hex: string;
};

type StudyPlannerBoardProps = {
  sessions: StudyTimeSession[];
  totals: { subject: string; seconds: number }[];
  totalSeconds: number;
  goalSeconds: number;
  subjects: string[];
  subjectStyles: Record<string, SubjectStyle>;
  updateAction: (formData: FormData) => void | Promise<void>;
  saveGoalAction: (formData: FormData) => void | Promise<void>;
};

const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_MINUTES = 10;

function formatSeconds(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours && minutes) return `${hours}시간 ${minutes}분`;
  if (hours) return `${hours}시간`;
  return `${minutes}분`;
}

function percentText(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.min(Math.round((value / total) * 100), 999)}%`;
}

function dateToKoreanMinutes(dateText?: string | null) {
  if (!dateText) return null;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [hour, minute] = formatter.format(date).split(":").map(Number);
  return hour * 60 + minute;
}

function formatKoreanTime(dateText?: string | null) {
  if (!dateText) return "";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function subjectStyle(subject: string | null | undefined, styles: Record<string, SubjectStyle>) {
  return styles[subject || "기타"] || styles.기타;
}

function findSessionForSlot(sessions: StudyTimeSession[], hour: number, slotIndex: number) {
  const slotStart = hour * 60 + slotIndex * SLOT_MINUTES;
  const slotEnd = slotStart + SLOT_MINUTES;

  return sessions.find((session) => {
    const start = dateToKoreanMinutes(session.started_at);
    const end = dateToKoreanMinutes(session.ended_at);
    if (start === null || end === null) return false;
    return start < slotEnd && end > slotStart;
  });
}

function donutGradient(items: { subject: string; seconds: number }[], styles: Record<string, SubjectStyle>) {
  const total = items.reduce((sum, item) => sum + item.seconds, 0);
  if (!total) return "#e5e7eb 0deg 360deg";

  let current = 0;

  return items
    .map((item) => {
      const start = current;
      const degree = (item.seconds / total) * 360;
      current += degree;
      return `${subjectStyle(item.subject, styles).hex} ${start}deg ${current}deg`;
    })
    .join(", ");
}

function goalGradient(totalSeconds: number, goalSeconds: number) {
  if (!goalSeconds) return "#e5e7eb 0deg 360deg";
  const degree = Math.min((totalSeconds / goalSeconds) * 360, 360);
  return `#111827 0deg ${degree}deg, #e5e7eb ${degree}deg 360deg`;
}

export default function StudyPlannerBoard({
  sessions,
  totals,
  totalSeconds,
  goalSeconds,
  subjects,
  subjectStyles,
  updateAction,
  saveGoalAction,
}: StudyPlannerBoardProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  return (
    <section className="rounded-[28px] border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
            Study
          </p>
          <h2 className="text-[15px] font-bold text-[#111827]">오늘의 공부 시간표</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-[#6b7280]">오늘 공부</p>
          <p className="text-sm font-bold text-[#111827]">{formatSeconds(totalSeconds)}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
          <div className="space-y-0.5">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index).map((hour) => (
              <div key={hour} className="grid grid-cols-[24px_1fr] items-center gap-1">
                <div className="text-[8.5px] font-bold text-[#9ca3af]">
                  {String(hour).padStart(2, "0")}
                </div>

                <div className="flex gap-0">
                  {Array.from({ length: 6 }, (_, slotIndex) => {
                    const session = findSessionForSlot(sessions, hour, slotIndex);
                    const style = subjectStyle(session?.subject, subjectStyles);

                    return (
                      <button
                        key={`${hour}-${slotIndex}`}
                        type="button"
                        onClick={() => {
                          if (session) setSelectedSessionId(session.id);
                        }}
                        className={`h-3 w-3 shrink-0 border-y border-l first:rounded-l-[3px] last:rounded-r-[3px] last:border-r ${
                          session ? `${style.bg} ${style.border}` : "border-[#e5e7eb] bg-white"
                        }`}
                        aria-label={session ? `${session.subject} 공부 기록` : "빈 칸"}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
            <div
              className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${donutGradient(totals, subjectStyles)})` }}
            >
              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white text-center">
                <div>
                  <p className="text-[7px] font-bold text-[#9ca3af]">과목</p>
                  <p className="text-[9px] font-bold text-[#111827]">{formatSeconds(totalSeconds)}</p>
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              {totals.length === 0 ? (
                <p className="text-center text-[9px] font-semibold text-[#9ca3af]">기록 없음</p>
              ) : (
                totals.map((item) => {
                  const style = subjectStyle(item.subject, subjectStyles);
                  return (
                    <div key={item.subject} className="flex items-center justify-between gap-1 text-[8.5px] font-bold">
                      <span className={`min-w-0 flex-1 truncate ${style.text}`}>{item.subject}</span>
                      <span className="shrink-0 text-[#6b7280]">{percentText(item.seconds, totalSeconds)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#e5e7eb] bg-[#f9fafb] p-2.5">
            <button
              type="button"
              onClick={() => setGoalOpen((prev) => !prev)}
              className="w-full"
            >
              <div
                className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full"
                style={{ background: `conic-gradient(${goalGradient(totalSeconds, goalSeconds)})` }}
              >
                <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white text-center">
                  <div>
                    <p className="text-[7px] font-bold text-[#9ca3af]">목표</p>
                    <p className="text-[11px] font-bold text-[#111827]">
                      {percentText(totalSeconds, goalSeconds)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-center text-[8.5px] font-semibold text-[#6b7280]">
                {goalSeconds ? `목표 ${formatSeconds(goalSeconds)}` : "목표 설정"}
              </p>
            </button>

            {goalOpen && (
              <form action={saveGoalAction} className="mt-2 grid gap-1.5">
                <select
                  name="goal_hours"
                  defaultValue={goalSeconds ? String(goalSeconds / 3600) : "3"}
                  className="w-full rounded-xl border border-[#d1d5db] bg-white px-2 py-1.5 text-[10px] font-semibold outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}시간
                    </option>
                  ))}
                </select>
                <button className="rounded-xl bg-[#111827] px-2 py-1.5 text-[10px] font-bold text-white">
                  저장
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/35 px-3 pb-3">
          <div className="w-full rounded-[26px] bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                  Edit Study
                </p>
                <h3 className="text-base font-bold text-[#111827]">
                  {formatKoreanTime(selectedSession.started_at)} - {formatKoreanTime(selectedSession.ended_at)}
                </h3>
                <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">
                  {selectedSession.subject || "기타"} · {selectedSession.title || "내용 미입력"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionId(null)}
                className="rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-bold text-[#374151]"
              >
                닫기
              </button>
            </div>

            <form action={updateAction} className="mt-3 grid gap-2">
              <input type="hidden" name="session_id" value={selectedSession.id} />

              <select
                name="subject"
                defaultValue={selectedSession.subject || "기타"}
                className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-3 text-xs font-semibold outline-none"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <input
                name="title"
                defaultValue={selectedSession.title || ""}
                placeholder="예: 수특 라이트 12강 변형문제"
                className="w-full rounded-2xl border border-[#d1d5db] bg-white px-3 py-3 text-xs font-semibold outline-none"
              />

              <button type="submit" className="rounded-2xl bg-[#111827] px-3 py-3 text-xs font-bold text-white">
                수정 저장
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
