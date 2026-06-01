"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type DateScrollerProps = {
  baseDate: string;
  selectedDate: string;
  tab: string;
};

function addDays(dateText: string, offset: number) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function label(dateText: string, offset: number) {
  if (offset === 0) return "오늘";
  const date = new Date(`${dateText}T00:00:00+09:00`);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${m}/${d} ${w}`;
}

export default function DateScroller({ baseDate, selectedDate, tab }: DateScrollerProps) {
  const selectedRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "auto",
      inline: "center",
      block: "nearest",
    });
  }, [selectedDate]);

  const offsets = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {offsets.map((offset) => {
        const dateText = addDays(baseDate, offset);
        const active = selectedDate === dateText;

        return (
          <Link
            key={dateText}
            ref={active ? selectedRef : undefined}
            href={`/student?tab=${tab}&date=${dateText}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-center text-[11px] font-bold ${
              active ? "bg-[#111827] text-white" : "bg-[#f3f4f6] text-[#6b7280]"
            }`}
          >
            {label(dateText, offset)}
          </Link>
        );
      })}
    </div>
  );
}
