"use client";

import { useState } from "react";

export type StudyTaskOption = {
  label: string;
  subject: string;
  title: string;
};

type StudentStudyTaskFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  subjects: string[];
  selectedDate: string;
  homeworkOptions: StudyTaskOption[];
};

export default function StudentStudyTaskForm({
  action,
  subjects,
  selectedDate,
  homeworkOptions,
}: StudentStudyTaskFormProps) {
  const [subject, setSubject] = useState(subjects[1] || subjects[0] || "영어");
  const [title, setTitle] = useState("");

  function applyHomework(indexText: string) {
    if (!indexText) {
      setTitle("");
      return;
    }

    const option = homeworkOptions[Number(indexText)];
    if (!option) return;
    setSubject(option.subject);
    setTitle(option.title);
  }

  return (
    <details className="mb-2 rounded-[14px] border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5">
      <summary className="cursor-pointer list-none text-[11px] font-bold text-[#111827]">
        + 항목 추가
      </summary>
      <form action={action} className="mt-2 grid w-full gap-1.5">
        {homeworkOptions.length > 0 && (
          <select
            defaultValue=""
            onChange={(event) => applyHomework(event.target.value)}
            className="w-full rounded-xl border border-[#d1d5db] bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none"
          >
            <option value="">숙제 중 선택하기</option>
            {homeworkOptions.map((option, index) => (
              <option key={`${option.label}-${index}`} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        <select
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-xl border border-[#d1d5db] bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none"
        >
          {subjects.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="공부할 내용"
          className="w-full rounded-xl border border-[#d1d5db] bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none"
        />
        <input
          type="date"
          name="due_date"
          defaultValue={selectedDate}
          className="w-full rounded-xl border border-[#d1d5db] bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none"
        />
        <input
          name="memo"
          placeholder="메모"
          className="w-full rounded-xl border border-[#d1d5db] bg-white px-2.5 py-1.5 text-[11px] font-semibold outline-none"
        />
        <button className="w-full rounded-xl bg-[#111827] px-3 py-1.5 text-[11px] font-bold text-white">
          저장
        </button>
      </form>
    </details>
  );
}
