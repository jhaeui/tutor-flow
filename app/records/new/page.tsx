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

export default function NewRecordPage() {
  return (
    <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <a href="/" className="text-sm font-semibold text-[#525252]">
            ← 대시보드로
          </a>
          <h1 className="mt-3 text-3xl font-bold">생기부 / 학종 기록 추가</h1>
          <p className="mt-2 text-sm text-[#525252]">
            학생별 진로, 탐구주제, 수행평가, 세특 문장 후보를 누적하는 페이지
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

            <FormField label="과목 / 활동 분야">
              <select className="input-style">
                <option>영어</option>
                <option>국어</option>
                <option>사회</option>
                <option>과학</option>
                <option>중국어</option>
                <option>진로</option>
                <option>기타</option>
              </select>
            </FormField>

            <FormField label="활동 유형">
              <select className="input-style">
                <option>탐구보고서</option>
                <option>발표</option>
                <option>수행평가</option>
                <option>독서활동</option>
                <option>영어에세이</option>
                <option>창작글</option>
                <option>토론</option>
                <option>세특소재</option>
              </select>
            </FormField>

            <FormField label="활동 날짜">
              <input type="date" className="input-style" />
            </FormField>

            <FormField label="진로 연결 분야">
              <input
                className="input-style"
                placeholder="예: 마케팅, 심리학, 사회학, 체육교육"
              />
            </FormField>

            <FormField label="핵심 키워드">
              <input
                className="input-style"
                placeholder="예: 소비자 심리, 리뷰 신뢰도, 환경 무감각"
              />
            </FormField>
          </section>

          <section className="mt-6 space-y-5">
            <FormField label="활동 주제">
              <input
                className="input-style"
                placeholder="예: 리뷰의 투명성과 문체가 소비자 신뢰에 미치는 영향"
              />
            </FormField>

            <FormField label="활동 내용 요약">
              <textarea
                className="input-style min-h-28"
                placeholder="학생이 어떤 활동을 했는지, 어떤 자료를 조사했는지 정리"
              />
            </FormField>

            <FormField label="학생의 역할 / 강점">
              <textarea
                className="input-style min-h-24"
                placeholder="예: 주제 선정, 자료 분석, 발표 구성, 사례 조사, 논리 전개"
              />
            </FormField>

            <FormField label="세특 문장 후보">
              <textarea
                className="input-style min-h-28"
                placeholder="나중에 생기부 문장으로 다듬을 수 있는 표현을 적어두기"
              />
            </FormField>

            <FormField label="다음 확장 방향">
              <textarea
                className="input-style min-h-24"
                placeholder="예: AI 리뷰 시대 소비자 판단 기준으로 확장 가능"
              />
            </FormField>

            <FormField label="재이쌤 메모">
              <textarea
                className="input-style min-h-24"
                placeholder="학생에게 아직 공개하지 않을 내부 메모, 보완점, 다음 상담 내용"
              />
            </FormField>

            <label className="flex items-center gap-3 rounded-2xl bg-[#fffaf5] p-4 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" />
              학생에게도 공개하기
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