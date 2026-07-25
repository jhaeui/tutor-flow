"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ExamRow = {
  id: string;
  student_id: string;
  subject: string;
  major_unit?: string | null;
  unit_name: string;
  publisher?: string | null;
  material_name?: string | null;
  memo?: string | null;
  statuses: Record<string, string>;
  sort_order: number | null;
};

type StudentInfo = {
  name: string;
  age?: string | number | null;
  school?: string | null;
};

const SUBJECT_OPTIONS = [
  "국어",
  "영어",
  "수학",
  "사회",
  "과학",
  "한국사",
  "자율",
  "진로",
  "동아리",
];

const DEFAULT_TASKS = ["단어", "본문", "워크북", "변형문제", "오답"];

const STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "done",
  "review",
  "homework",
  "paused",
  "planned",
];

const STATUS_LABEL: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "복습",
  homework: "숙제",
  paused: "보류",
  planned: "계획",
};

const STATUS_CLASS: Record<string, string> = {
  not_started: "bg-white text-[#171717] border-[#e5e5e5]",
  in_progress: "bg-[#ffedd5] text-[#c2410c] border-[#fb923c]",
  done: "bg-[#dcfce7] text-[#166534] border-[#22c55e]",
  review: "bg-[#eef4ff] text-[#404040] border-[#c9d8f5]",
  homework: "bg-[#eee8df] text-[#171717] border-[#C8BAC6]",
  paused: "bg-[#f1f1f1] text-[#777] border-[#d8d8d8]",
  planned: "bg-[#f3e8ff] text-[#7e22ce] border-[#c084fc]",
};

const TASK_ORDER_META_KEY = "__task_order";

function getStoredTaskOrder(
  statuses: Record<string, string> | null | undefined,
) {
  const raw = statuses?.[TASK_ORDER_META_KEY];
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : null;
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function visibleStatusEntries(
  statuses: Record<string, string> | null | undefined,
) {
  return Object.entries(statuses || {}).filter(
    ([task]) => task !== TASK_ORDER_META_KEY,
  );
}

function getTasksFromStatuses(
  statuses: Record<string, string> | null | undefined,
) {
  const storedOrder = getStoredTaskOrder(statuses) || [];
  const visibleKeys = visibleStatusEntries(statuses).map(([task]) => task);
  const orderedTasks: string[] = [];

  storedOrder.forEach((task) => {
    if (visibleKeys.includes(task) && !orderedTasks.includes(task)) {
      orderedTasks.push(task);
    }
  });

  visibleKeys.forEach((task) => {
    if (!orderedTasks.includes(task)) {
      orderedTasks.push(task);
    }
  });

  return orderedTasks;
}

function withTaskOrder(statuses: Record<string, string>, tasks: string[]) {
  const nextStatuses: Record<string, string> = {};

  tasks.forEach((task) => {
    if (!task || task === TASK_ORDER_META_KEY) return;
    nextStatuses[task] = statuses[task] || "not_started";
  });

  Object.entries(statuses || {}).forEach(([task, status]) => {
    if (task === TASK_ORDER_META_KEY) return;
    if (!(task in nextStatuses)) {
      nextStatuses[task] = status;
    }
  });

  nextStatuses[TASK_ORDER_META_KEY] = JSON.stringify(
    tasks.filter((task) => task && task !== TASK_ORDER_META_KEY),
  );
  return nextStatuses;
}

function getTasksFromRows(rows: ExamRow[]) {
  const orderedTasks: string[] = [];

  rows.forEach((row) => {
    getTasksFromStatuses(row.statuses).forEach((task) => {
      if (task && !orderedTasks.includes(task)) {
        orderedTasks.push(task);
      }
    });
  });

  return orderedTasks.length > 0 ? orderedTasks : DEFAULT_TASKS;
}

function normalizeStatuses(
  statuses: Record<string, string> | string | null | undefined,
) {
  if (!statuses) return {};

  if (typeof statuses === "string") {
    try {
      return JSON.parse(statuses) as Record<string, string>;
    } catch {
      return {};
    }
  }

  return statuses;
}

function gradeFromAge(age?: string | number | null) {
  const value = Number(String(age || "").replace(/[^0-9]/g, ""));

  if (!value) return "";
  if (value <= 14) return `중${Math.max(value - 13, 1)}`;
  if (value === 15) return "중2";
  if (value === 16) return "중3";
  if (value === 17) return "고1";
  if (value === 18) return "고2";
  if (value === 19) return "고3";
  return "졸업";
}

function subjectEmoji(subject?: string | null) {
  const emojis: Record<string, string> = {
    국어: "📖",
    영어: "🧸",
    수학: "🧮",
    사회: "🌏",
    과학: "🔬",
    한국사: "🏛️",
    자율: "🌱",
    진로: "✨",
    동아리: "🎨",
  };

  if (!subject) return "🌷";
  return emojis[subject] || "🌷";
}

function normalizeGroupText(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function materialLabel(row: ExamRow) {
  const publisher = row.publisher?.trim();
  const material = row.material_name?.trim();

  if (publisher && material) return `${publisher} · ${material}`;
  if (material) return material;
  if (publisher) return publisher;
  return "교재/자료 미분류";
}

function materialGroupKey(row: ExamRow) {
  const publisherKey = normalizeGroupText(row.publisher);
  const materialKey = normalizeGroupText(row.material_name);
  return `${publisherKey || "__no_publisher__"}|||${materialKey || "__no_material__"}`;
}

function groupRowsByMaterial(rows: ExamRow[]) {
  const grouped = rows.reduce<Record<string, ExamRow[]>>((acc, row) => {
    const key = materialGroupKey(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  Object.keys(grouped).forEach((key) => {
    grouped[key] = [...grouped[key]].sort(sortByScopeOrder);
  });

  return grouped;
}

function isDuplicateSubUnit(row: ExamRow) {
  const major = (row.major_unit || "").trim();
  const unit = (row.unit_name || "").trim();
  return Boolean(major && unit && major === unit);
}

function sortByScopeOrder(a: ExamRow, b: ExamRow) {
  const aOrder = a.sort_order ?? 999999;
  const bOrder = b.sort_order ?? 999999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.unit_name || "").localeCompare(
    String(b.unit_name || ""),
    "ko",
  );
}

function makeInitialStatuses(tasks: string[]) {
  const initialStatuses: Record<string, string> = {};
  tasks.forEach((task) => {
    initialStatuses[task] = "not_started";
  });
  return initialStatuses;
}

export default function ExamScopePage() {
  const params = useParams();
  const studentId = params.id as string;

  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

  const [rows, setRows] = useState<ExamRow[]>([]);

  const [subject, setSubject] = useState("영어");
  const [customSubject, setCustomSubject] = useState("");
  const [majorUnit, setMajorUnit] = useState("");
  const [unitName, setUnitName] = useState("");
  const [publisher, setPublisher] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [memo, setMemo] = useState("");
  const [pasteText, setPasteText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMajorUnit, setEditMajorUnit] = useState("");
  const [editUnitName, setEditUnitName] = useState("");
  const [editPublisher, setEditPublisher] = useState("");
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");

  const [newTaskBySubject, setNewTaskBySubject] = useState<
    Record<string, string>
  >({});
  const [quickAddByMaterial, setQuickAddByMaterial] = useState<
    Record<string, { majorUnit: string; unitName: string; memo: string }>
  >({});

  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");

  const [taskEditSubject, setTaskEditSubject] = useState<string | null>(null);
  const [scopeEditSubject, setScopeEditSubject] = useState<string | null>(null);
  const [editingMaterialKey, setEditingMaterialKey] = useState<string | null>(
    null,
  );
  const [editMaterialBoxName, setEditMaterialBoxName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const finalSubject =
    subject === "__custom__" ? customSubject.trim() : subject.trim();

  async function fetchData() {
    setErrorMessage("");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name, age, school")
      .eq("id", studentId)
      .single();

    if (studentError) {
      setErrorMessage(studentError.message);
      return;
    }

    setStudentInfo((student as StudentInfo) || null);

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

    const safeRows = ((progressRows || []) as ExamRow[]).map((row) => ({
      ...row,
      statuses: normalizeStatuses(row.statuses),
    }));

    setRows(safeRows);
  }

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  const studentName = studentInfo?.name || "";
  const studentGrade = gradeFromAge(studentInfo?.age);

  const groupedRows = rows.reduce<Record<string, ExamRow[]>>((acc, row) => {
    if (!acc[row.subject]) acc[row.subject] = [];
    acc[row.subject].push(row);
    return acc;
  }, {});

  Object.keys(groupedRows).forEach((key) => {
    groupedRows[key] = [...groupedRows[key]].sort(sortByScopeOrder);
  });

  function getSubjectTasks(subjectName: string) {
    const subjectRows = rows.filter((row) => row.subject === subjectName);
    return getTasksFromRows(subjectRows);
  }

  async function addRow() {
    setErrorMessage("");

    if (!finalSubject) {
      setErrorMessage("과목을 선택하거나 직접 입력해줘.");
      return;
    }

    if (!majorUnit.trim() && !unitName.trim() && !materialName.trim()) {
      setErrorMessage("대단원, 소단원, 교재/자료명 중 하나는 입력해줘.");
      return;
    }

    setLoading(true);

    const nextOrder = rows.length + 1;
    const subjectRows = rows.filter((row) => row.subject === finalSubject);
    const tasks = getTasksFromRows(subjectRows);

    const initialStatuses = makeInitialStatuses(tasks);

    const { error } = await supabase.from("exam_progress").insert({
      student_id: studentId,
      subject: finalSubject,
      major_unit: majorUnit.trim() || null,
      unit_name:
        unitName.trim() ||
        majorUnit.trim() ||
        materialName.trim() ||
        "시험범위",
      publisher: publisher.trim() || null,
      material_name: materialName.trim() || null,
      memo: memo.trim() || null,
      statuses: withTaskOrder(initialStatuses, tasks),
      sort_order: nextOrder,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMajorUnit("");
    setUnitName("");
    setPublisher("");
    setMaterialName("");
    setMemo("");
    await fetchData();
  }

  async function pasteRows() {
    setErrorMessage("");

    const rawText = pasteText.trim();

    if (!rawText) {
      setErrorMessage("붙여넣을 시험범위 박스 내용을 먼저 넣어줘.");
      return;
    }

    const nextOrder = rows.length + 1;

    try {
      const parsed = JSON.parse(rawText);

      if (parsed?.__scopeBox && Array.isArray(parsed.rows)) {
        const copiedSubject = String(
          parsed.subject || finalSubject || "영어",
        ).trim();
        const copiedTasks =
          Array.isArray(parsed.tasks) && parsed.tasks.length > 0
            ? parsed.tasks
                .map((task: unknown) => String(task).trim())
                .filter(Boolean)
            : DEFAULT_TASKS;
        const initialStatuses = makeInitialStatuses(copiedTasks);

        const insertRows = parsed.rows.map((item: any, index: number) => ({
          student_id: studentId,
          subject: copiedSubject,
          major_unit: item.major_unit || null,
          unit_name:
            item.unit_name ||
            item.major_unit ||
            item.material_name ||
            "시험범위",
          material_name: item.material_name || parsed.material_name || null,
          publisher: item.publisher || parsed.publisher || null,
          memo: item.memo || null,
          statuses: withTaskOrder(initialStatuses, copiedTasks),
          sort_order: nextOrder + index,
        }));

        setLoading(true);
        const { error } = await supabase
          .from("exam_progress")
          .insert(insertRows);
        setLoading(false);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setPasteText("");
        setErrorMessage(
          `${copiedSubject} 시험범위 박스 ${insertRows.length}개를 붙여넣었어.`,
        );
        await fetchData();
        return;
      }
    } catch {
      // JSON 박스 복붙이 아니면 아래 줄 단위 복붙으로 처리
    }

    if (!finalSubject) {
      setErrorMessage("과목을 선택하거나 직접 입력해줘.");
      return;
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setErrorMessage("복붙할 범위를 먼저 입력해줘.");
      return;
    }

    const subjectRows = rows.filter((row) => row.subject === finalSubject);
    const tasks = getTasksFromRows(subjectRows);
    const initialStatuses = makeInitialStatuses(tasks);

    const insertRows = lines.map((line, index) => {
      const cells = line.split(/\t|,/).map((cell) => cell.trim());
      const [major, unit, material, publisherName, memoText] = cells;

      return {
        student_id: studentId,
        subject: finalSubject,
        major_unit: major || null,
        unit_name: unit || major || material || "시험범위",
        material_name: material || materialName.trim() || null,
        publisher: publisherName || publisher.trim() || null,
        memo: memoText || null,
        statuses: initialStatuses,
        sort_order: nextOrder + index,
      };
    });

    setLoading(true);
    const { error } = await supabase.from("exam_progress").insert(insertRows);
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPasteText("");
    setErrorMessage(`${insertRows.length}개 범위를 추가했어.`);
    await fetchData();
  }

  async function copyMaterialBox(subjectName: string, materialRows: ExamRow[]) {
    const sorted = [...materialRows].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    );
    const payload = {
      __scopeBox: true,
      subject: subjectName,
      publisher: sorted[0]?.publisher || null,
      material_name: sorted[0]?.material_name || null,
      tasks: getTasksFromRows(sorted),
      rows: sorted.map((row) => ({
        major_unit: row.major_unit || null,
        unit_name: row.unit_name || "시험범위",
        publisher: row.publisher || null,
        material_name: row.material_name || null,
        memo: row.memo || null,
        sort_order: row.sort_order || null,
        statuses: row.statuses || {},
      })),
    };

    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setErrorMessage(
        "이 교재 시험범위 박스를 복사했어. 다른 학생 시험범위 페이지에서 복붙칸에 붙여넣으면 돼.",
      );
    } catch {
      setPasteText(text);
      setErrorMessage(
        "복사 권한이 막혀서 복붙칸에 대신 넣어뒀어. 이 내용을 복사해서 쓰면 돼.",
      );
    }
  }

  function updateQuickAdd(
    key: string,
    field: "majorUnit" | "unitName" | "memo",
    value: string,
  ) {
    setQuickAddByMaterial((prev) => ({
      ...prev,
      [key]: {
        majorUnit: prev[key]?.majorUnit || "",
        unitName: prev[key]?.unitName || "",
        memo: prev[key]?.memo || "",
        [field]: value,
      },
    }));
  }

  async function addRowToMaterial(
    subjectName: string,
    materialKey: string,
    materialRows: ExamRow[],
  ) {
    setErrorMessage("");

    const draft = quickAddByMaterial[materialKey] || {
      majorUnit: "",
      unitName: "",
      memo: "",
    };

    const inherited = materialRows[0];
    const inheritedPublisher = inherited?.publisher?.trim() || "";
    const inheritedMaterial = inherited?.material_name?.trim() || "";
    const nextMajorUnit = draft.majorUnit.trim();
    const nextUnitName = draft.unitName.trim();
    const nextMemo = draft.memo.trim();

    if (!nextMajorUnit && !nextUnitName) {
      setErrorMessage("대단원이나 소단원을 입력해줘.");
      return;
    }

    setLoading(true);

    const tasks = getSubjectTasks(subjectName);
    const initialStatuses = makeInitialStatuses(tasks);

    const { error } = await supabase.from("exam_progress").insert({
      student_id: studentId,
      subject: subjectName,
      major_unit: nextMajorUnit || null,
      unit_name:
        nextUnitName ||
        nextMajorUnit ||
        inheritedMaterial ||
        inheritedPublisher ||
        "시험범위",
      publisher: inheritedPublisher || null,
      material_name: inheritedMaterial || null,
      memo: nextMemo || null,
      statuses: withTaskOrder(initialStatuses, tasks),
      sort_order: rows.length + 1,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setQuickAddByMaterial((prev) => ({
      ...prev,
      [materialKey]: { majorUnit: "", unitName: "", memo: "" },
    }));
    await fetchData();
  }

  async function moveRowOrder(
    row: ExamRow,
    direction: "up" | "down",
    visibleRows?: ExamRow[],
  ) {
    setErrorMessage("");

    const targetRows = (visibleRows && visibleRows.length > 0 ? visibleRows : rows)
      .filter((item) => item.subject === row.subject)
      .sort(sortByScopeOrder);

    const currentIndex = targetRows.findIndex((item) => item.id === row.id);
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= targetRows.length) {
      return;
    }

    const reordered = [...targetRows];
    const [picked] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, picked);

    // 같은 화면 박스 안에서 바로 순서가 바뀌어 보이도록, 현재 보이는 행들의 sort_order만 재배치
    const baseOrder = Math.min(
      ...reordered.map((item) => item.sort_order ?? 999999).filter(Number.isFinite),
      1,
    );

    const updatedRows = reordered.map((item, index) => ({
      ...item,
      sort_order: baseOrder + index,
    }));

    setRows((prev) =>
      prev.map((item) => updatedRows.find((next) => next.id === item.id) || item),
    );

    const results = await Promise.all(
      updatedRows.map((item) =>
        supabase
          .from("exam_progress")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id)
          .eq("student_id", studentId),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
      return;
    }

    await fetchData();
  }

  async function updateStatus(row: ExamRow, task: string, nextStatus: string) {
    const nextStatuses = withTaskOrder(
      {
        ...(row.statuses || {}),
        [task]: nextStatus,
      },
      getTasksFromStatuses(row.statuses),
    );

    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id ? { ...item, statuses: nextStatuses } : item,
      ),
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

  function startMaterialBoxEdit(
    subjectName: string,
    materialNameKey: string,
    materialRows: ExamRow[],
  ) {
    setEditingMaterialKey(`${subjectName}::${materialNameKey}`);
    const firstMaterialName =
      materialRows.find((row) => row.material_name?.trim())?.material_name ||
      "";
    setEditMaterialBoxName(firstMaterialName);
  }

  function cancelMaterialBoxEdit() {
    setEditingMaterialKey(null);
    setEditMaterialBoxName("");
  }

  async function saveMaterialBoxEdit(materialRows: ExamRow[]) {
    setErrorMessage("");

    const nextMaterialName = editMaterialBoxName.trim() || null;
    const rowIds = materialRows.map((row) => row.id);

    if (rowIds.length === 0) {
      cancelMaterialBoxEdit();
      return;
    }

    const { error } = await supabase
      .from("exam_progress")
      .update({
        material_name: nextMaterialName,
      })
      .in("id", rowIds)
      .eq("student_id", studentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((prev) =>
      prev.map((row) =>
        rowIds.includes(row.id)
          ? { ...row, material_name: nextMaterialName }
          : row,
      ),
    );
    cancelMaterialBoxEdit();
    await fetchData();
  }

  function startEdit(row: ExamRow) {
    setEditingId(row.id);
    setEditSubject(row.subject);
    setEditMajorUnit(row.major_unit || "");
    setEditUnitName(row.unit_name);
    setEditPublisher(row.publisher || "");
    setEditMaterialName(row.material_name || "");
    setEditMemo(row.memo || "");
    setEditSortOrder(String(row.sort_order || ""));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSubject("");
    setEditMajorUnit("");
    setEditUnitName("");
    setEditPublisher("");
    setEditMaterialName("");
    setEditMemo("");
    setEditSortOrder("");
  }

  async function saveEdit(row: ExamRow) {
    setErrorMessage("");

    if (!editSubject.trim()) {
      setErrorMessage("과목을 입력해줘.");
      return;
    }

    if (
      !editMajorUnit.trim() &&
      !editUnitName.trim() &&
      !editMaterialName.trim()
    ) {
      setErrorMessage("대단원, 소단원, 교재/자료명 중 하나는 입력해줘.");
      return;
    }

    const targetSubjectRows = rows.filter(
      (item) => item.subject === editSubject.trim() && item.id !== row.id,
    );

    const targetTasks =
      targetSubjectRows.length > 0
        ? getTasksFromRows(targetSubjectRows)
        : getTasksFromStatuses(row.statuses).length > 0
          ? getTasksFromStatuses(row.statuses)
          : DEFAULT_TASKS;

    const nextStatuses: Record<string, string> = {};

    targetTasks.forEach((task) => {
      nextStatuses[task] = row.statuses?.[task] || "not_started";
    });

    const { error } = await supabase
      .from("exam_progress")
      .update({
        subject: editSubject.trim(),
        major_unit: editMajorUnit.trim() || null,
        unit_name:
          editUnitName.trim() ||
          editMajorUnit.trim() ||
          editMaterialName.trim() ||
          "시험범위",
        publisher: editPublisher.trim() || null,
        material_name: editMaterialName.trim() || null,
        memo: editMemo.trim() || null,
        sort_order: Number(editSortOrder) || row.sort_order || 0,
        statuses: nextStatuses,
      })
      .eq("id", row.id)
      .eq("student_id", studentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    cancelEdit();
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
      setErrorMessage("추가할 단계 이름을 입력해줘.");
      return;
    }

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const currentTasks = getTasksFromRows(subjectRows);

    if (currentTasks.includes(taskName)) {
      setErrorMessage("이미 있는 단계 이름이야.");
      return;
    }

    const nextTasks = [...currentTasks, taskName];

    const updatedRows = subjectRows.map((row) => ({
      ...row,
      statuses: withTaskOrder(
        {
          ...(row.statuses || {}),
          [taskName]: "not_started",
        },
        nextTasks,
      ),
    }));

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      }),
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId),
      ),
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

  async function moveTaskOrder(
    subjectName: string,
    taskName: string,
    direction: "left" | "right",
  ) {
    setErrorMessage("");

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const tasks = getTasksFromRows(subjectRows);
    const currentIndex = tasks.indexOf(taskName);
    const targetIndex =
      direction === "left" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= tasks.length)
      return;

    const reorderedTasks = [...tasks];
    const [picked] = reorderedTasks.splice(currentIndex, 1);
    reorderedTasks.splice(targetIndex, 0, picked);

    const updatedRows = subjectRows.map((row) => {
      const oldStatuses = row.statuses || {};
      const nextStatuses: Record<string, string> = {};

      reorderedTasks.forEach((task) => {
        nextStatuses[task] = oldStatuses[task] || "not_started";
      });

      return {
        ...row,
        statuses: withTaskOrder(nextStatuses, reorderedTasks),
      };
    });

    setRows((prev) =>
      prev.map((row) => updatedRows.find((item) => item.id === row.id) || row),
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
      return;
    }

    await fetchData();
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
      setErrorMessage("단계 이름을 입력해줘.");
      return;
    }

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const currentTasks = getTasksFromRows(subjectRows);

    if (nextTaskName !== oldTaskName && currentTasks.includes(nextTaskName)) {
      setErrorMessage("이미 있는 단계 이름이야.");
      return;
    }

    const nextTaskOrder = currentTasks.map((task) =>
      task === oldTaskName ? nextTaskName : task,
    );

    const updatedRows = subjectRows.map((row) => {
      const oldStatuses = row.statuses || {};
      const nextStatuses: Record<string, string> = {};

      nextTaskOrder.forEach((task) => {
        const sourceTask = task === nextTaskName ? oldTaskName : task;
        nextStatuses[task] = oldStatuses[sourceTask] || "not_started";
      });

      Object.keys(oldStatuses).forEach((task) => {
        if (task !== oldTaskName && !nextStatuses[task]) {
          nextStatuses[task] = oldStatuses[task];
        }
      });

      return {
        ...row,
        statuses: withTaskOrder(nextStatuses, nextTaskOrder),
      };
    });

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      }),
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId),
      ),
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
      `"${subjectName}" 과목에서 "${taskName}" 단계를 삭제할까?`,
    );

    if (!ok) return;

    const subjectRows = rows.filter((row) => row.subject === subjectName);
    const nextTaskOrder = getTasksFromRows(subjectRows).filter(
      (task) => task !== taskName,
    );

    const updatedRows = subjectRows.map((row) => {
      const nextStatuses = { ...(row.statuses || {}) };
      delete nextStatuses[taskName];

      return {
        ...row,
        statuses: withTaskOrder(nextStatuses, nextTaskOrder),
      };
    });

    setRows((prev) =>
      prev.map((row) => {
        const updated = updatedRows.find((item) => item.id === row.id);
        return updated || row;
      }),
    );

    const results = await Promise.all(
      updatedRows.map((row) =>
        supabase
          .from("exam_progress")
          .update({ statuses: row.statuses })
          .eq("id", row.id)
          .eq("student_id", studentId),
      ),
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setErrorMessage(failed.error.message);
      await fetchData();
    }
  }

  return (
    <main className="min-h-screen bg-[#ffffff] px-5 py-8 text-[#171717]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black text-[#525252]">시험범위 진도표</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              {studentName ? `${studentName} 시험범위` : "시험범위"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[#171717]">
              {studentGrade && (
                <span className="rounded-full border border-[#d4d4d4] bg-[#ffffff] px-3 py-1">
                  {studentGrade}
                </span>
              )}
              {studentInfo?.school && (
                <span className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1">
                  {studentInfo.school}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <details className="group">
              <summary className="cursor-pointer list-none rounded-full bg-[#171717] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5">
                + 시험범위 추가
              </summary>

              <section className="mt-3 rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm lg:absolute lg:right-52 lg:z-20 lg:w-[min(92vw,860px)]">
                <h2 className="text-lg font-black">시험범위 추가</h2>
                <p className="mt-1 text-sm font-semibold text-[#525252]">
                  교과서 단원, 모의고사 번호, 소단원까지 나눠서 넣을 수 있어.
                </p>

                <div className="mt-4 rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-[#171717]">
                        복붙으로 여러 범위 추가
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#a88b94]">
                        교재 박스의 “이 박스 복사”를 누른 뒤 여기에 그대로
                        붙여넣으면 같은 시험범위 박스가 통째로 추가돼.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={pasteRows}
                      disabled={loading}
                      className="rounded-2xl bg-[#171717] px-4 py-2 text-xs font-black text-white disabled:bg-[#c8b8bf]"
                    >
                      복붙 범위 추가
                    </button>
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`예:\nLesson 5, 본문 1문단, 교과서, 능률, 서술형 중요\nLesson 5, 워크북 p.12, 워크북, 능률, 숙제`}
                    rows={4}
                    className="mt-3 w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#dc7f9a]"
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      과목
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    >
                      {SUBJECT_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="__custom__">직접입력</option>
                    </select>
                  </div>

                  {subject === "__custom__" && (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-black text-[#171717]">
                        과목 직접입력
                      </label>
                      <input
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="예: 중국어 / 생윤 / 문학"
                        className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      대단원 / 묶음
                    </label>
                    <input
                      value={majorUnit}
                      onChange={(e) => setMajorUnit(e.target.value)}
                      placeholder="예: Lesson 5 / 모의고사 3회 / Ⅱ단원"
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      소단원 / 세부범위{" "}
                      <span className="font-semibold text-[#b998a3]">선택</span>
                    </label>
                    <input
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="예: 본문 1문단 / 20번 / 1-3 소단원"
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      출판사{" "}
                      <span className="font-semibold text-[#b998a3]">선택</span>
                    </label>
                    <input
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="예: 능률 / 천재 / 비상"
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      교재 / 자료명
                    </label>
                    <input
                      value={materialName}
                      onChange={(e) => setMaterialName(e.target.value)}
                      placeholder="예: 교과서 / 워크북 / 2024 3월 모고"
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      메모
                    </label>
                    <input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="예: 서술형 가능성 높음 / 변형문제 필요"
                      className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addRow}
                      disabled={loading}
                      className="w-full rounded-2xl bg-[#171717] px-4 py-3 text-sm font-black text-white disabled:bg-[#c8b8bf]"
                    >
                      {loading ? "추가 중" : "추가"}
                    </button>
                  </div>
                </div>
              </section>
            </details>

            <Link
              href={`/students/${studentId}`}
              className="rounded-full border border-[#e5e5e5] bg-white px-4 py-3 text-sm font-black text-[#525252] transition hover:-translate-y-0.5 hover:bg-[#f7f7f7]"
            >
              학생 상세보기
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {errorMessage}
          </div>
        )}

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-black">진도표</h2>
              <p className="mt-1 text-sm font-semibold text-[#525252]">
                과목별 · 대단원별로 묶어서 시험범위를 관리해요.
              </p>
            </div>

            <div className="flex max-w-3xl flex-wrap gap-2 text-xs font-black">
              {STATUS_OPTIONS.map((status) => (
                <span
                  key={status}
                  className={`rounded-full border px-3 py-1 ${
                    STATUS_CLASS[status] || STATUS_CLASS.not_started
                  }`}
                >
                  {STATUS_LABEL[status]}
                </span>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-8 text-center text-sm font-semibold text-[#525252]">
              아직 추가된 시험범위가 없어요.
            </div>
          ) : (
            <div className="space-y-8">
              {(Object.entries(groupedRows) as [string, ExamRow[]][]).map(
                ([subjectName, subjectRows]) => {
                  const tasks = getSubjectTasks(subjectName);
                  const isTaskEditOpen = taskEditSubject === subjectName;
                  const isScopeEditOpen = scopeEditSubject === subjectName;

                  return (
                    <div
                      key={subjectName}
                      className="rounded-[2rem] border border-[#e5e5e5] bg-[#f5f5f5] p-5"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-black text-[#171717]">
                            <span className="mr-1">
                              {subjectEmoji(subjectName)}
                            </span>
                            {subjectName}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-[#525252]">
                            단계 편집과 범위 수정은 필요할 때만 열어두면 돼.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setTaskEditSubject(
                                isTaskEditOpen ? null : subjectName,
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${
                              isTaskEditOpen
                                ? "bg-[#171717] text-white"
                                : "border border-[#e5e5e5] bg-white text-[#171717]"
                            }`}
                          >
                            단계편집
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setScopeEditSubject(
                                isScopeEditOpen ? null : subjectName,
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${
                              isScopeEditOpen
                                ? "bg-[#171717] text-white"
                                : "border border-[#e5e5e5] bg-white text-[#171717]"
                            }`}
                          >
                            과목별 시험범위 편집
                          </button>
                        </div>
                      </div>

                      {isTaskEditOpen && (
                        <div className="mb-4 rounded-3xl border border-[#e5e5e5] bg-white p-4">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <input
                              value={newTaskBySubject[subjectName] || ""}
                              onChange={(e) =>
                                setNewTaskBySubject((prev) => ({
                                  ...prev,
                                  [subjectName]: e.target.value,
                                }))
                              }
                              placeholder="단계 추가 예: 본문암기 / 서술형"
                              className="min-w-[220px] flex-1 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => addTask(subjectName)}
                              className="rounded-2xl bg-[#171717] px-4 py-2 text-sm font-black text-white"
                            >
                              단계 추가
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {tasks.map((task) => {
                              const taskKey = `${subjectName}___${task}`;
                              const isTaskEditing = editingTaskKey === taskKey;

                              return (
                                <div
                                  key={task}
                                  className="flex items-center gap-1 rounded-full border border-[#e5e5e5] bg-[#f7f7f7] px-2 py-1 text-xs"
                                >
                                  {isTaskEditing ? (
                                    <>
                                      <input
                                        value={editTaskName}
                                        onChange={(e) =>
                                          setEditTaskName(e.target.value)
                                        }
                                        className="w-28 rounded-lg border border-[#e5e5e5] bg-white px-2 py-1 text-xs font-bold outline-none"
                                      />

                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveTaskEdit(subjectName, task)
                                        }
                                        className="rounded-lg bg-[#171717] px-2 py-1 text-white"
                                      >
                                        저장
                                      </button>

                                      <button
                                        type="button"
                                        onClick={cancelTaskEdit}
                                        className="rounded-lg bg-white px-2 py-1 text-[#171717]"
                                      >
                                        취소
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="px-1 font-black text-[#171717]">
                                        {task}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          moveTaskOrder(
                                            subjectName,
                                            task,
                                            "left",
                                          )
                                        }
                                        className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black text-[#171717]"
                                        title="왼쪽으로"
                                      >
                                        ←
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          moveTaskOrder(
                                            subjectName,
                                            task,
                                            "right",
                                          )
                                        }
                                        className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black text-[#171717]"
                                        title="오른쪽으로"
                                      >
                                        →
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          startTaskEdit(subjectName, task)
                                        }
                                        className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black text-[#171717]"
                                      >
                                        수정
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteTask(subjectName, task)
                                        }
                                        className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600"
                                      >
                                        삭제
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        {(
                          Object.entries(groupRowsByMaterial(subjectRows)) as [
                            string,
                            ExamRow[],
                          ][]
                        ).map(([materialNameKey, materialRows]) => {
                          const materialDisplayName = materialLabel(
                            materialRows[0],
                          );
                          const materialEditKey = `${subjectName}::${materialNameKey}`;
                          const isMaterialEditing =
                            editingMaterialKey === materialEditKey;
                          const quickDraft = quickAddByMaterial[
                            materialNameKey
                          ] || {
                            majorUnit: "",
                            unitName: "",
                            memo: "",
                          };

                          return (
                            <div
                              key={`${subjectName}-${materialNameKey}`}
                              className="overflow-x-auto rounded-3xl border border-[#e5e5e5] bg-white"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {isMaterialEditing ? (
                                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2">
                                      <span className="text-xs font-black text-[#171717]">
                                        교재명
                                      </span>
                                      <input
                                        value={editMaterialBoxName}
                                        onChange={(e) =>
                                          setEditMaterialBoxName(e.target.value)
                                        }
                                        placeholder="교재 / 자료명"
                                        className="w-48 rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold text-[#171717] outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveMaterialBoxEdit(materialRows)
                                        }
                                        className="rounded-xl bg-[#171717] px-3 py-2 text-xs font-black text-white"
                                      >
                                        저장
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelMaterialBoxEdit}
                                        className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#171717]">
                                      {materialDisplayName}
                                    </span>
                                  )}
                                  {isScopeEditOpen && !isMaterialEditing && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startMaterialBoxEdit(
                                          subjectName,
                                          materialNameKey,
                                          materialRows,
                                        )
                                      }
                                      className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-xs font-black text-[#171717]"
                                    >
                                      교재명 수정
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyMaterialBox(subjectName, materialRows)
                                    }
                                    className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-xs font-black text-[#171717]"
                                  >
                                    이 박스 복사
                                  </button>
                                  <span className="text-xs font-bold text-[#525252]">
                                    복사한 박스는 다른 학생 페이지 복붙칸에
                                    그대로 붙여넣기 가능
                                  </span>
                                </div>
                              </div>

                              {isScopeEditOpen && (
                                <div className="border-b border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3">
                                  <div className="grid gap-2 md:grid-cols-5">
                                    <input
                                      value={quickDraft.majorUnit}
                                      onChange={(e) =>
                                        updateQuickAdd(
                                          materialNameKey,
                                          "majorUnit",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="대단원 추가 예: Lesson 6 / 3월 모고"
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none md:col-span-2"
                                    />
                                    <input
                                      value={quickDraft.unitName}
                                      onChange={(e) =>
                                        updateQuickAdd(
                                          materialNameKey,
                                          "unitName",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="소단원/세부범위 선택"
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
                                    />
                                    <input
                                      value={quickDraft.memo}
                                      onChange={(e) =>
                                        updateQuickAdd(
                                          materialNameKey,
                                          "memo",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="메모 선택"
                                      className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm font-bold outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addRowToMaterial(
                                          subjectName,
                                          materialNameKey,
                                          materialRows,
                                        )
                                      }
                                      disabled={loading}
                                      className="rounded-xl bg-[#171717] px-3 py-2 text-sm font-black text-white disabled:bg-[#d8b5c1]"
                                    >
                                      이 교재에 범위 추가
                                    </button>
                                  </div>
                                </div>
                              )}

                              <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
                                <thead>
                                  <tr className="border-b border-[#e5e5e5] bg-[#f5f5f5]">
                                    <th className="w-[280px] px-3 py-3 text-left text-xs font-black text-[#171717]">
                                      범위
                                    </th>

                                    {tasks.map((task) => (
                                      <th
                                        key={task}
                                        className="min-w-[108px] px-2 py-3 text-center text-xs font-black text-[#171717]"
                                      >
                                        {task}
                                      </th>
                                    ))}

                                    {isScopeEditOpen && (
                                      <th className="w-[150px] px-3 py-3 text-center text-xs font-black text-[#171717]">
                                        관리
                                      </th>
                                    )}
                                  </tr>
                                </thead>

                                <tbody>
                                  {materialRows.map((row) => {
                                    const isEditing = editingId === row.id;
                                    const currentMajorUnit =
                                      row.major_unit || "대단원 미입력";
                                    const showSubUnit =
                                      row.unit_name && !isDuplicateSubUnit(row);

                                    const rangeDisplay = (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center">
                                          <span
                                            className="inline-flex whitespace-nowrap rounded-full bg-[#e5e5e5] px-2.5 py-1 text-xs font-black text-[#171717]"
                                            title={currentMajorUnit}
                                          >
                                            {currentMajorUnit}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                          {showSubUnit && (
                                            <span
                                              className="inline-flex whitespace-nowrap rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-extrabold leading-none text-[#171717]"
                                              title={row.unit_name}
                                            >
                                              {row.unit_name}
                                            </span>
                                          )}

                                          {row.memo && (
                                            <span
                                              className="inline-flex whitespace-nowrap text-[11px] font-bold leading-none text-[#525252]"
                                              title={row.memo}
                                            >
                                              {row.memo}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <Fragment key={row.id}>
                                        <tr
                                          key={`${row.id}-row`}
                                          className="border-b border-[#e5e5e5] last:border-b-0"
                                        >
                                          <td className="px-3 py-3 align-top">
                                            {rangeDisplay}
                                          </td>

                                          {tasks.map((task) => {
                                            const status =
                                              row.statuses?.[task] ||
                                              "not_started";

                                            return (
                                              <td
                                                key={task}
                                                className="px-2 py-3 text-center align-top"
                                              >
                                                <select
                                                  value={status}
                                                  onChange={(e) =>
                                                    updateStatus(
                                                      row,
                                                      task,
                                                      e.target.value,
                                                    )
                                                  }
                                                  disabled={isEditing}
                                                  className={`min-w-[94px] rounded-xl border px-2 py-2 text-center text-xs font-black outline-none transition disabled:opacity-50 ${
                                                    STATUS_CLASS[status] ||
                                                    STATUS_CLASS.not_started
                                                  }`}
                                                >
                                                  {STATUS_OPTIONS.map(
                                                    (option) => (
                                                      <option
                                                        key={option}
                                                        value={option}
                                                      >
                                                        {STATUS_LABEL[option]}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </td>
                                            );
                                          })}

                                          {isScopeEditOpen && (
                                            <td className="px-3 py-3 text-center align-top">
                                              <div className="flex flex-wrap justify-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    moveRowOrder(row, "up", materialRows)
                                                  }
                                                  className="rounded-xl border border-[#e5e5e5] bg-white px-2.5 py-2 text-xs font-black text-[#171717]"
                                                  title="위로"
                                                >
                                                  ↑
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    moveRowOrder(row, "down", materialRows)
                                                  }
                                                  className="rounded-xl border border-[#e5e5e5] bg-white px-2.5 py-2 text-xs font-black text-[#171717]"
                                                  title="아래로"
                                                >
                                                  ↓
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => startEdit(row)}
                                                  className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                                >
                                                  수정
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    deleteRow(row.id)
                                                  }
                                                  className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                                                >
                                                  삭제
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>

                                        {isEditing && (
                                          <tr
                                            key={`${row.id}-edit`}
                                            className="border-b border-[#e5e5e5] bg-[#f5f5f5]"
                                          >
                                            <td
                                              colSpan={
                                                tasks.length +
                                                (isScopeEditOpen ? 2 : 1)
                                              }
                                              className="px-4 py-4"
                                            >
                                              <div className="rounded-3xl border border-[#e5e5e5] bg-white p-4 shadow-sm">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                  <p className="text-sm font-black text-[#171717]">
                                                    시험범위 수정
                                                  </p>
                                                  <div className="flex gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        saveEdit(row)
                                                      }
                                                      className="rounded-xl bg-[#171717] px-4 py-2 text-xs font-black text-white"
                                                    >
                                                      저장
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={cancelEdit}
                                                      className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-2 text-xs font-black text-[#171717]"
                                                    >
                                                      취소
                                                    </button>
                                                  </div>
                                                </div>

                                                <div className="grid gap-2 md:grid-cols-6">
                                                  <input
                                                    value={editSubject}
                                                    onChange={(e) =>
                                                      setEditSubject(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="과목"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none"
                                                  />

                                                  <input
                                                    value={editSortOrder}
                                                    onChange={(e) =>
                                                      setEditSortOrder(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="순서"
                                                    type="number"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none"
                                                  />

                                                  <input
                                                    value={editPublisher}
                                                    onChange={(e) =>
                                                      setEditPublisher(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="출판사 선택"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none"
                                                  />

                                                  <input
                                                    value={editMaterialName}
                                                    onChange={(e) =>
                                                      setEditMaterialName(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="교재 / 자료"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none md:col-span-2"
                                                  />

                                                  <input
                                                    value={editMajorUnit}
                                                    onChange={(e) =>
                                                      setEditMajorUnit(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="대단원 / 묶음"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none md:col-span-2"
                                                  />

                                                  <input
                                                    value={editUnitName}
                                                    onChange={(e) =>
                                                      setEditUnitName(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="소단원 / 세부범위 선택"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none md:col-span-2"
                                                  />

                                                  <input
                                                    value={editMemo}
                                                    onChange={(e) =>
                                                      setEditMemo(
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="메모"
                                                    className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm font-bold outline-none md:col-span-4"
                                                  />
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
