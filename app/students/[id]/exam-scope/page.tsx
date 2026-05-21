"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ExamRow = {
  id: string;
  student_id: string;
  subject: string;
  unit_name: string;
  statuses: Record<string, string>;
  sort_order: number | null;
};

const SUBJECT_OPTIONS = ["국어", "영어", "수학", "사회", "과학", "한국사"];

const DEFAULT_TASKS = ["수업", "워크북", "변형문제", "오답", "단어"];

const STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "done",
  "review",
  "homework",
];

const STATUS_LABEL: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "다시보기",
  homework: "숙제",
};

const STATUS_CLASS: Record<string, string> = {
  not_started: "bg-white text-[#8a7668] border-[#eadfd5]",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  done: "bg-green-100 text-green-800 border-green-200",
  review: "bg-blue-100 text-blue-800 border-blue-200",
  homework: "bg-pink-100 text-pink-800 border-pink-200",
};

function getTasksFromRows(rows: ExamRow[]) {
  const tasks: string[] = [];

  rows.forEach((row) => {
    Object.keys(row.statuses || {}).forEach((task) => {
      if (!tasks.includes(task)) {
        tasks.push(task);
      }
    });
  });

  return tasks.length > 0 ? tasks : DEFAULT_TASKS;
}

export default function ExamScopePage() {
  const params = useParams();
  const studentId = params.id as string;

  const [studentName, setStudentName] = useState("");

  const [rows, setRows] = useState<ExamRow[]>([]);
  const [subject, setSubject] = useState("영어");
  const [unitName, setUnitName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editUnitName, setEditUnitName] = useState("");

  const [newTaskBySubject, setNewTaskBySubject] = useState<
    Record<string, string>
  >({});

  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchData() {
    setErrorMessage("");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name")
      .eq("id", studentId)
      .single();

    if (studentError) {
      setErrorMessage(studentError.message);
      return;
    }

    setStudentName(student?.name || "");

    const { data: progressRows, error: progressError } = await supabase
      .from("exam_progress")
      .select("*")
      .eq("student_id", studentId)
      .order("subject", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (progressError) {
      setErrorMessage(progressError.message);
      return;
    }

    setRows((progressRows || []) as ExamRow[]);
  }

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  const groupedRows = rows.reduce<Record<string, ExamRow[]>>((acc, row) => {
    if (!acc[row.subject]) acc[row.subject] = [];
    acc[row.subject].push(row);
    return acc;
  }, {});

  function getSubjectTasks(subjectName: string) {
    const subjectRows = rows.filter((row) => row.subject === subjectName);
    return getTasksFromRows(subjectRows);
  }

  async function addRow() {
    setErrorMessage("");

    if (!subject.trim()) {
      setErrorMessage("과목을 선택해줘.");
      return;
    }

    if (!unitName.trim()) {
      setErrorMessage("단원/범위를 입력해줘.");
      return;
    }

    setLoading(true);

    const nextOrder = rows.length + 1;
    const subjectRows = rows.filter((row) => row.subject === subject);
    const tasks = getTasksFromRows(subjectRows);

    const initialStatuses: Record<string, string> = {};
    tasks.forEach((task) => {
      initialStatuses[task] = "not_started";
    });

    const { error } = await supabase.from("exam_progress").insert({
      student_id: studentId,
      subject: subject.trim(),
      unit_name: unitName.trim(),
      statuses: initialStatuses,
      sort_order: nextOrder,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setUnitName("");
    await fetchData();
  }

  async function updateStatus(row: ExamRow, task: string, nextStatus: string) {
    const nextStatuses = {
      ...(row.statuses || {}),
      [task]: nextStatus,
    };

    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id ? { ...item, statuses: nextStatuses } : item
      )
    );

    const { error } = await supabase
      .from("exam_progress")
      .update({
        statuses: nextStatuses,
      })
      .eq("id", row.id)
      .eq("student_id", studentId);

    if (error) {
      setErrorMessage(error.message);
      await fetchData();
    }
  }

  function startEdit(row: ExamRow) {
    setEditingId(row.id);
    setEditSubject(row.subject);
    setEditUnitName(row.unit_name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSubject("");
    setEditUnitName("");
  }

  async function saveEdit(row: ExamRow) {
    setErrorMessage("");

    if (!editSubject.trim()) {
      setErrorMessage("과목을 선택해줘.");
      return;
    }

    if (!editUnitName.trim()) {
      setErrorMessage("단원/범위를 입력해줘.");
      return;
    }

    const targetSubjectRows = rows.filter(
      (item) => item.subject === editSubject && item.id !== row.id
    );

    const targetTasks =
      targetSubjectRows.length > 0
        ? getTasksFromRows(targetSubjectRows)
        : Object.keys(row.statuses || {}).length > 0
        ? Object.keys(row.statuses || {})
        : DEFAULT_TASKS;

    const nextStatuses: Record<string, string> = {};

    targetTasks.forEach((task) => {
      nextStatuses[task] = row.statuses?.[task] || "not_started";
    });

    const { error } = await supabase
      .from("exam_progress")
      .update({
        subject: editSubject.trim(),
        unit_name: editUnitName.trim(),
        statuses: nextStatuses,
      })
      .eq("id", row.id)
      .eq("student_id", studentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEditingId(null);
    setEditSubject("");
    setEditUnitName("");

    await fetchData();
  }

  async function deleteRow(rowId: string) {
    const ok = window.confirm("이 시험범위 행을 삭제할까?");
    if (!ok) return;

    const { error } = await supabase
      .from("exam_progress")
      .delete()
      .eq("id", rowId)
      .eq("student_id", studentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((prev) => prev.filter((row) => row.id !== rowId));
  }

  async function addTask(subjectName: string) {
    setErrorMessage("");

    const taskName = (newTaskBySubject[subjectName] || "").trim();

    if (!taskName) {
      setErrorMessage("추가할 작업 칸 이름을 입력해줘.");
      return;
    }

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const currentTasks = getTasksFromRows(subjectRows);

    if (currentTasks.includes(taskName)) {
      setErrorMessage("이미 있는 작업 칸 이름이야.");
      return;
    }

    const updatedRows = subjectRows.map((row) => ({
      ...row,
      statuses: {
        ...(row.statuses || {}),
        [taskName]: "not_started",
      },
    }));

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      })
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId)
      )
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
      return;
    }

    setNewTaskBySubject((prev) => ({
      ...prev,
      [subjectName]: "",
    }));
  }

  function startTaskEdit(subjectName: string, taskName: string) {
    setEditingTaskKey(`${subjectName}___${taskName}`);
    setEditTaskName(taskName);
  }

  function cancelTaskEdit() {
    setEditingTaskKey(null);
    setEditTaskName("");
  }

  async function saveTaskEdit(subjectName: string, oldTaskName: string) {
    setErrorMessage("");

    const nextTaskName = editTaskName.trim();

    if (!nextTaskName) {
      setErrorMessage("작업 칸 이름을 입력해줘.");
      return;
    }

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const currentTasks = getTasksFromRows(subjectRows);

    if (nextTaskName !== oldTaskName && currentTasks.includes(nextTaskName)) {
      setErrorMessage("이미 있는 작업 칸 이름이야.");
      return;
    }

    const updatedRows = subjectRows.map((row) => {
      const oldStatuses = row.statuses || {};
      const nextStatuses: Record<string, string> = {};

      Object.keys(oldStatuses).forEach((task) => {
        if (task === oldTaskName) {
          nextStatuses[nextTaskName] = oldStatuses[task];
        } else {
          nextStatuses[task] = oldStatuses[task];
        }
      });

      return {
        ...row,
        statuses: nextStatuses,
      };
    });

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      })
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId)
      )
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
      return;
    }

    setEditingTaskKey(null);
    setEditTaskName("");
  }

  async function deleteTask(subjectName: string, taskName: string) {
    const ok = window.confirm(
      `"${subjectName}" 과목에서 "${taskName}" 작업 칸을 삭제할까?`
    );

    if (!ok) return;

    const subjectRows = rows.filter((row) => row.subject === subjectName);

    const updatedRows = subjectRows.map((row) => {
      const nextStatuses = { ...(row.statuses || {}) };
      delete nextStatuses[taskName];

      return {
        ...row,
        statuses: nextStatuses,
      };
    });

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      })
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId)
      )
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f1ea] px-6 py-8 text-[#2f2a25]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[#8a7668]">시험범위 진도표</p>
            <h1 className="mt-1 text-3xl font-bold">
              {studentName ? `${studentName} 시험범위` : "시험범위"}
            </h1>
          </div>

          <Link
            href={`/students/${studentId}`}
            className="rounded-2xl border border-[#d7c8bb] bg-white px-4 py-3 text-sm font-semibold"
          >
            학생 상세보기
          </Link>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">시험범위 추가</h2>
          <p className="mt-1 text-sm text-[#8a7668]">
            과목을 선택하고 단원이나 시험범위를 추가해줘.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr_120px]">
            <div>
              <label className="mb-2 block text-sm font-semibold">과목</label>

              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-2xl border border-[#d7c8bb] bg-[#fffaf6] px-4 py-3 outline-none"
              >
                {SUBJECT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                단원 / 시험범위
              </label>
              <input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="예: Lesson 5 본문 / 함수의 극한 / 조선 후기"
                className="w-full rounded-2xl border border-[#d7c8bb] bg-[#fffaf6] px-4 py-3 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={addRow}
                disabled={loading}
                className="w-full rounded-2xl bg-[#2f2a25] px-4 py-3 text-sm font-bold text-white disabled:bg-[#a99b90]"
              >
                {loading ? "추가 중" : "추가"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">진도표</h2>
              <p className="mt-1 text-sm text-[#8a7668]">
                과목별로 따로 묶이고, 작업 칸도 과목별로 직접 추가/수정/삭제할 수 있어.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-[#eadfd5] bg-white px-3 py-1 text-[#8a7668]">
                미완료
              </span>
              <span className="rounded-full border border-yellow-200 bg-yellow-100 px-3 py-1 text-yellow-800">
                진행중
              </span>
              <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-green-800">
                완료
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-blue-800">
                다시보기
              </span>
              <span className="rounded-full border border-pink-200 bg-pink-100 px-3 py-1 text-pink-800">
                숙제
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl bg-[#fffaf6] p-5 text-sm text-[#8a7668]">
              아직 추가된 시험범위가 없어요.
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedRows).map(([subjectName, subjectRows]) => {
                const tasks = getSubjectTasks(subjectName);

                return (
                  <div
                    key={subjectName}
                    className="rounded-3xl border border-[#eadfd5] bg-[#fffaf6] p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">{subjectName}</h3>
                        <p className="mt-1 text-xs text-[#8a7668]">
                          이 과목 안에서만 작업 칸이 적용돼.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          value={newTaskBySubject[subjectName] || ""}
                          onChange={(e) =>
                            setNewTaskBySubject((prev) => ({
                              ...prev,
                              [subjectName]: e.target.value,
                            }))
                          }
                          placeholder="작업 칸 추가"
                          className="rounded-xl border border-[#d7c8bb] bg-white px-3 py-2 text-sm outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => addTask(subjectName)}
                          className="rounded-xl bg-[#2f2a25] px-3 py-2 text-sm font-bold text-white"
                        >
                          칸 추가
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {tasks.map((task) => {
                        const taskKey = `${subjectName}___${task}`;
                        const isTaskEditing = editingTaskKey === taskKey;

                        return (
                          <div
                            key={task}
                            className="flex items-center gap-1 rounded-full border border-[#eadfd5] bg-white px-2 py-1 text-xs"
                          >
                            {isTaskEditing ? (
                              <>
                                <input
                                  value={editTaskName}
                                  onChange={(e) =>
                                    setEditTaskName(e.target.value)
                                  }
                                  className="w-24 rounded-lg border border-[#d7c8bb] px-2 py-1 outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    saveTaskEdit(subjectName, task)
                                  }
                                  className="rounded-lg bg-[#2f2a25] px-2 py-1 text-white"
                                >
                                  저장
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelTaskEdit}
                                  className="rounded-lg bg-[#eee5dc] px-2 py-1 text-[#6b5b4f]"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="px-1 font-semibold">
                                  {task}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => startTaskEdit(subjectName, task)}
                                  className="rounded-md bg-[#f1e5da] px-1.5 py-0.5 text-[10px] text-[#6b5b4f]"
                                >
                                  수정
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteTask(subjectName, task)}
                                  className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600"
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-[#eadfd5]">
                      <table className="w-full min-w-[780px] border-collapse bg-white text-sm">
                        <thead>
                          <tr className="border-b border-[#eadfd5] bg-[#f1e5da]">
                            <th className="w-[260px] px-4 py-3 text-left">
                              단원 / 범위
                            </th>

                            {tasks.map((task) => (
                              <th key={task} className="px-4 py-3 text-center">
                                {task}
                              </th>
                            ))}

                            <th className="w-[150px] px-4 py-3 text-center">
                              관리
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {subjectRows.map((row) => {
                            const isEditing = editingId === row.id;

                            return (
                              <tr
                                key={row.id}
                                className="border-b border-[#eadfd5] last:border-b-0"
                              >
                                <td className="px-4 py-3 font-semibold">
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <select
                                        value={editSubject}
                                        onChange={(e) =>
                                          setEditSubject(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-[#d7c8bb] bg-white px-3 py-2 text-sm outline-none"
                                      >
                                        {SUBJECT_OPTIONS.map((item) => (
                                          <option key={item} value={item}>
                                            {item}
                                          </option>
                                        ))}
                                      </select>

                                      <input
                                        value={editUnitName}
                                        onChange={(e) =>
                                          setEditUnitName(e.target.value)
                                        }
                                        placeholder="단원 / 시험범위"
                                        className="w-full rounded-xl border border-[#d7c8bb] bg-white px-3 py-2 text-sm outline-none"
                                      />
                                    </div>
                                  ) : (
                                    row.unit_name
                                  )}
                                </td>

                                {tasks.map((task) => {
                                  const status =
                                    row.statuses?.[task] || "not_started";

                                  return (
                                    <td
                                      key={task}
                                      className="px-3 py-3 text-center"
                                    >
                                      <select
                                        value={status}
                                        onChange={(e) =>
                                          updateStatus(
                                            row,
                                            task,
                                            e.target.value
                                          )
                                        }
                                        disabled={isEditing}
                                        className={`w-full rounded-xl border px-3 py-2 text-center text-xs font-bold outline-none transition disabled:opacity-50 ${STATUS_CLASS[status]}`}
                                      >
                                        {STATUS_OPTIONS.map((option) => (
                                          <option key={option} value={option}>
                                            {STATUS_LABEL[option]}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  );
                                })}

                                <td className="px-3 py-3 text-center">
                                  {isEditing ? (
                                    <div className="flex justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => saveEdit(row)}
                                        className="rounded-xl bg-[#2f2a25] px-3 py-2 text-xs font-bold text-white"
                                      >
                                        저장
                                      </button>

                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="rounded-xl bg-[#eee5dc] px-3 py-2 text-xs font-bold text-[#6b5b4f]"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEdit(row)}
                                        className="rounded-xl bg-[#f1e5da] px-3 py-2 text-xs font-bold text-[#6b5b4f]"
                                      >
                                        수정
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => deleteRow(row.id)}
                                        className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}