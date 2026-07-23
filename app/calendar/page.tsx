const weekDays = [
  {
    day: "월",
    date: "5/20",
    items: [
      { type: "수업", student: "시연", title: "3과 복습 / 4과 진도 확인", time: "시간 입력 예정" },
      { type: "자료제작", student: "승규", title: "26년 6모 지문 정리", time: "마감 설정 예정" },
    ],
  },
  {
    day: "화",
    date: "5/21",
    items: [
      { type: "수업", student: "다은", title: "천재(강) 2과 / 26년 3모", time: "시간 입력 예정" },
    ],
  },
  {
    day: "수",
    date: "5/22",
    items: [
      { type: "수업", student: "한나", title: "YBM 1~2과 / 26년 3모", time: "시간 입력 예정" },
      { type: "수행평가", student: "규리", title: "5/27 수행 준비", time: "D-5" },
    ],
  },
  {
    day: "목",
    date: "5/23",
    items: [
      { type: "수업", student: "서연", title: "교과서 1과, 3과 / 모의고사", time: "시간 입력 예정" },
    ],
  },
  {
    day: "금",
    date: "5/24",
    items: [
      { type: "수행평가", student: "한나", title: "5/27 영어 수행 확인", time: "D-3" },
      { type: "수행평가", student: "나현", title: "5/27 수행 확인", time: "D-3" },
    ],
  },
  {
    day: "토",
    date: "5/25",
    items: [
      { type: "수업", student: "규리", title: "수특영 25강~29강", time: "시간 입력 예정" },
    ],
  },
  {
    day: "일",
    date: "5/26",
    items: [
      { type: "정리", student: "재이", title: "다음 주 수업자료 / 수행평가 일정 확인", time: "주간 점검" },
    ],
  },
];

export default function CalendarPage() {
  return (
    <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <a href="/" className="text-sm font-semibold text-[#525252]">
              ← 대시보드로
            </a>
            <h1 className="mt-3 text-3xl font-bold">전체 일정 캘린더</h1>
            <p className="mt-2 text-sm text-[#525252]">
              수업, 수행평가, 자료제작, 정산 일정을 한눈에 보는 페이지
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/tasks/new"
              className="rounded-full border border-[#d7c8bb] px-5 py-3 text-sm font-semibold"
            >
              + 수행평가
            </a>
            <a
              href="/lessons/new"
              className="rounded-full bg-[#171717] px-5 py-3 text-sm font-semibold text-white"
            >
              + 수업 기록
            </a>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryBox title="이번 주 수업" value="5개" />
          <SummaryBox title="수행평가 마감" value="3개" />
          <SummaryBox title="자료제작" value="1개" />
          <SummaryBox title="주간 점검" value="1개" />
        </section>

        <section className="grid gap-4 lg:grid-cols-7">
          {weekDays.map((day) => (
            <article
              key={day.day}
              className="min-h-[420px] rounded-3xl bg-white p-4 shadow-sm"
            >
              <div className="mb-4 rounded-2xl bg-[#fffaf5] p-3">
                <p className="text-sm font-semibold text-[#525252]">{day.date}</p>
                <h2 className="mt-1 text-2xl font-bold">{day.day}</h2>
              </div>

              <div className="space-y-3">
                {day.items.map((item) => (
                  <div
                    key={`${day.day}-${item.student}-${item.title}`}
                    className="rounded-2xl border border-[#eee5dc] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#f0dfcf] px-2 py-1 text-[11px] font-bold">
                        {item.type}
                      </span>
                      <span className="text-[11px] font-semibold text-[#525252]">
                        {item.time}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-bold">{item.student}</p>
                    <p className="mt-1 text-xs leading-5 text-[#7d7065]">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function SummaryBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#525252]">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}