"use client";

import { useEffect, useMemo, useState } from "react";

type StudyTimerProps = {
  subjects: string[];
  saveAction: (formData: FormData) => void | Promise<void>;
};

const STORAGE_KEY = "student-study-timer-v1";

function formatTimer(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(
    2,
    "0",
  )}:${String(s).padStart(2, "0")}`;
}

export default function StudyTimer({ subjects, saveAction }: StudyTimerProps) {
  const [subject, setSubject] = useState(subjects[1] || subjects[0] || "영어");
  const [title, setTitle] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setSubject(parsed.subject || subjects[1] || subjects[0] || "영어");
      setTitle(parsed.title || "");
      setStartedAt(parsed.startedAt || "");
      setPausedSeconds(Number(parsed.pausedSeconds || 0));
      setRunning(Boolean(parsed.running));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [subjects]);

  useEffect(() => {
    const payload = {
      subject,
      title,
      startedAt,
      pausedSeconds,
      running,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [subject, title, startedAt, pausedSeconds, running]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0;

    if (running) {
      const started = new Date(startedAt).getTime();
      return Math.max(Math.floor((now - started) / 1000), 0);
    }

    return pausedSeconds;
  }, [now, pausedSeconds, running, startedAt]);

  const canSave = elapsedSeconds >= 10 && Boolean(startedAt);

  function startOrPause() {
    if (!startedAt) {
      setStartedAt(new Date().toISOString());
      setPausedSeconds(0);
      setRunning(true);
      return;
    }

    if (running) {
      setPausedSeconds(elapsedSeconds);
      setRunning(false);
      return;
    }

    const newStart = new Date(Date.now() - pausedSeconds * 1000).toISOString();
    setStartedAt(newStart);
    setRunning(true);
  }

  function reset() {
    setStartedAt("");
    setPausedSeconds(0);
    setRunning(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="rounded-[20px] bg-[#27222b] p-3.5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-[#f6b8d0]">Study Timer</p>
          <h2 className="text-base font-black">공부 시작</h2>
        </div>

        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black">
          10분 플래너
        </span>
      </div>

      <div className="my-4 text-center">
        <p className="font-mono text-4xl font-black tracking-[-0.06em]">
          {formatTimer(elapsedSeconds)}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/55">
          저장하면 시간표 칸에 색으로 채워져요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={startOrPause}
          className="rounded-2xl bg-[#7a6f65] px-3 py-2.5 text-xs font-black text-white"
        >
          {running ? "일시정지" : startedAt ? "다시 시작" : "시작"}
        </button>

        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-white/10 px-3 py-2.5 text-xs font-black text-white"
        >
          초기화
        </button>
      </div>

      <form
        action={async (formData) => {
          await saveAction(formData);
          reset();
        }}
        className="mt-3 grid gap-2"
      >
        <input type="hidden" name="duration_seconds" value={elapsedSeconds} />
        <input type="hidden" name="started_at" value={startedAt} />
        <input type="hidden" name="ended_at" value={new Date().toISOString()} />

        <select
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs font-bold text-white outline-none"
        >
          {subjects.map((item) => (
            <option key={item} value={item} className="text-black">
              {item}
            </option>
          ))}
        </select>

        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 수특 라이트 12강 변형문제"
          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:text-white/35"
        />

        <button
          type="submit"
          disabled={!canSave}
          className="rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-[#24202a] disabled:opacity-40"
        >
          공부시간 저장
        </button>
      </form>
    </section>
  );
}