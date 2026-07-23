const students = [
  "시연",
  "승규",
  "솔이",
  "다은",
  "서진",
  "서연",
  "한나",
  "나현",
  "규리",
];

export default function NewLessonPage() {
  return (
    <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <a href="/" className="text-sm font-semibold text-[#525252]">
            ← 대시보드로
          </a>
          <h1 className="mt-3 text-3xl font-bold">수업 기록 추가</h1>
          <p className="mt-2 text-sm text-[#525252]">
            수업 날짜, 진도, 과제, 다음 수업 계획을 기록하는 페이지
          </p>
        </header>

        <form className="rounded-3xl bg-white p-6 shadow-sm">
          <section className="grid gap-5 md:grid-cols-2">
            <FormField label="학생">
              <select className="input-style">
                <option>학생 선택</option>
                {students.map((student) => (
                  <option key={student}>{student}</option>
                ))}
              </select>
            </FormField>

            <FormField label="과목">
              <select className="input-style">
                <option>영어</option>
                <option>국어</option>
                <option>사회</option>
                <option>생기부</option>
                <option>기타</option>
              </select>
            </FormField>

            <FormField label="수업 날짜">
              <input type="date" className="input-style" />
            </FormField>

            <FormField label="수업 시간">
              <div className="grid grid-cols-2 gap-3">
                <input type="time" className="input-style" />
                <input type="time" className="input-style" />
              </div>
            </FormField>
          </section>

          <section className="mt-6 space-y-5">
            <FormField label="오늘 한 진도">
              <textarea
                className="input-style min-h-28"
                placeholder="예: YBM 3과 본문 1~3문단 분석, 26년 6모 21번 해석"
              />
            </FormField>

            <FormField label="내준 과제">
              <textarea
                className="input-style min-h-28"
                placeholder="예: 단어 1회독, 본문 해석 다시 읽기, 변형문제 1~5번"
              />
            </FormField>

            <FormField label="다음 수업 계획">
              <textarea
                className="input-style min-h-24"
                placeholder="예: 3과 문법 포인트 복습 후 26년 6모 22번 진행"
              />
            </FormField>

            <FormField label="수업 메모">
              <textarea
                className="input-style min-h-24"
                placeholder="학생 상태, 집중도, 학부모님께 전달할 내용 등"
              />
            </FormField>

            <label className="flex items-center gap-3 rounded-2xl bg-[#fffaf5] p-4 text-sm font-semibold">
              <input type="checkbox" defaultChecked className="h-4 w-4" />
              이번 달 정산에 포함하기
            </label>
          </section>

          <div className="mt-8 flex justify-end gap-3">
            <a
              href="/"
              className="rounded-2xl border border-[#d7c8bb] px-5 py-3 text-sm font-semibold"
            >
              취소
            </a>
            <button
              type="button"
              className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-semibold text-white"
            >
              저장하기
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <p className="mb-2 text-sm font-bold">{label}</p>
      {children}
    </label>
  );
}