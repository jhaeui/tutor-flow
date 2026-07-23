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

export default function NewTaskPage() {
  return (
    <main className="min-h-screen bg-[#ffffff] px-6 py-8 text-[#171717]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <a href="/" className="text-sm font-semibold text-[#525252]">
            ← 대시보드로
          </a>
          <h1 className="mt-3 text-3xl font-bold">수행평가 / 공지 추가</h1>
          <p className="mt-2 text-sm text-[#525252]">
            학생이 카톡으로 보내준 수행평가 일정, 공지, 내가 해줘야 할 일을 정리하는 페이지
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
                <option>과학</option>
                <option>생기부</option>
                <option>기타</option>
              </select>
            </FormField>

            <FormField label="수행평가명 / 공지 제목">
              <input
                className="input-style"
                placeholder="예: 영어 발표 대본, 사회 탐구보고서"
              />
            </FormField>

            <FormField label="마감일">
              <input type="date" className="input-style" />
            </FormField>

            <FormField label="상태">
              <select className="input-style">
                <option>접수</option>
                <option>정리중</option>
                <option>초안 작성</option>
                <option>피드백 완료</option>
                <option>최종 완료</option>
              </select>
            </FormField>

            <FormField label="중요도">
              <select className="input-style">
                <option>보통</option>
                <option>급함</option>
                <option>매우 급함</option>
                <option>나중에 확인</option>
              </select>
            </FormField>
          </section>

          <section className="mt-6 space-y-5">
            <FormField label="공지 내용">
              <textarea
                className="input-style min-h-28"
                placeholder="학생이 보내준 공지 내용, 조건, 분량, 제출 방식 등을 정리"
              />
            </FormField>

            <FormField label="내가 해줘야 하는 일">
              <textarea
                className="input-style min-h-28"
                placeholder="예: 주제 추천, 개요 작성, 대본 첨삭, 발표문 수정, 생기부 문장 정리"
              />
            </FormField>

            <FormField label="학생에게 확인할 것">
              <textarea
                className="input-style min-h-24"
                placeholder="예: 제출일 정확히 확인, 학교 양식 보내기, 선생님 피드백 여부 확인"
              />
            </FormField>

            <FormField label="메모">
              <textarea
                className="input-style min-h-24"
                placeholder="참고자료, 주의할 점, 학부모님 전달사항 등"
              />
            </FormField>

            <label className="flex items-center gap-3 rounded-2xl bg-[#fffaf5] p-4 text-sm font-semibold">
              <input type="checkbox" defaultChecked className="h-4 w-4" />
              전체 캘린더에도 표시하기
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