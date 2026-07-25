"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BasicSubjectName = "국어" | "영어" | "수학" | "사회" | "과학" | "한국사";
type SubjectInputMode = "preset" | "custom";

type StudentInfo = {
  name: string;
  default_start_time: string | null;
  default_end_time: string | null;
};

type ExamProgress = {
  id: string;
  student_id: string;
  subject: string;
  unit_name: string;
  statuses: Record<string, string> | null;
  sort_order: number | null;
  publisher?: string | null;
  material_name?: string | null;
  major_unit?: string | null;
  memo?: string | null;
};

type SelectableTask = {
  id: string;
  progressId: string;
  subject: string;
  unitName: string;
  taskName: string;
  status: string;
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
};

type SubjectRecord = {
  id: string;
  subject: string;
  subjectInputMode: SubjectInputMode;
  isEditingSubject: boolean;
  progress_item_ids: string[];
  homework_item_ids: string[];
  plan_item_ids: string[];
  show_progress: boolean;
  show_homework: boolean;
  show_plan: boolean;
  manual_homework_text: string;
};

type SavedTask = {
  progress_id: string;
  subject: string;
  unit_name: string;
  task_name: string;
  before_status: string;
  publisher?: string | null;
  material_name?: string | null;
  major_unit?: string | null;
  checked_status?: "done" | "deferred" | string | null;
  deferred?: boolean | null;
};

type PickerField = "progress_item_ids" | "homework_item_ids" | "plan_item_ids";

type PickerState = {
  recordId: string;
  field: PickerField;
  title: string;
} | null;

const SAVE_TIMEOUT_MS = 15000;
const SAVE_TIMEOUT_MESSAGE = "저장 응답이 지연되고 있어. 잠시 후 다시 시도해줘.";

function withSaveTimeout<T>(request: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(request),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(SAVE_TIMEOUT_MESSAGE));
      }, SAVE_TIMEOUT_MS);
    }),
  ]);
}

const SUBJECTS: BasicSubjectName[] = [
  "국어",
  "영어",
  "수학",
  "사회",
  "과학",
  "한국사",
];

const SELECTABLE_STATUSES = [
  "not_started",
  "in_progress",
  "review",
  "homework",
  "paused",
  "planned",
];
const PREVIOUS_HOMEWORK_STATUS = "homework";
const TASK_ORDER_META_KEY = "__task_order";

function getTaskOrderFromStatuses(
  statuses: Record<string, string> | null | undefined,
) {
  const raw = statuses?.[TASK_ORDER_META_KEY];
  const visibleKeys = Object.keys(statuses || {}).filter(
    (key) => key !== TASK_ORDER_META_KEY,
  );
  const ordered: string[] = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.map(String).forEach((task) => {
          if (visibleKeys.includes(task) && !ordered.includes(task))
            ordered.push(task);
        });
      }
    } catch {
      raw
        .split(",")
        .map((item) => item.trim())
        .forEach((task) => {
          if (visibleKeys.includes(task) && !ordered.includes(task))
            ordered.push(task);
        });
    }
  }

  visibleKeys.forEach((task) => {
    if (!ordered.includes(task)) ordered.push(task);
  });

  return ordered;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "복습",
  homework: "숙제",
  paused: "보류",
  planned: "계획",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-white text-[#525252] border-[#e5e5e5]",
  in_progress: "bg-[#ffedd5] text-[#c2410c] border-[#fb923c]",
  done: "bg-[#dcfce7] text-[#166534] border-[#22c55e]",
  review: "bg-[#f7f7f7] text-[#404040] border-[#d4d4d4]",
  homework: "bg-[#f5f5f5] text-[#171717] border-[#d4d4d4]",
  paused: "bg-[#f1f1f1] text-[#777] border-[#d8d8d8]",
  planned: "bg-[#f3e8ff] text-[#7e22ce] border-[#c084fc]",
};

const subjectBadgeStyle: Record<string, string> = {
  국어: "bg-[#f5f5f5] text-[#171717] border-[#d4d4d4]",
  영어: "bg-[#fdf2f6] text-[#404040] border-[#d4d4d4]",
  수학: "bg-[#f7f7f7] text-[#404040] border-[#d4d4d4]",
  사회: "bg-[#fff7e8] text-[#404040] border-[#d4d4d4]",
  과학: "bg-[#f7f7f7] text-[#404040] border-[#d4d4d4]",
  한국사: "bg-[#f7f7f7] text-[#404040] border-[#d4d4d4]",
};

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

function normalizeTimeValue(value: unknown) {
  if (value === null || value === undefined) return "";

  const text = String(value).trim();
  if (!text) return "";

  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";

  const hour = String(Number(match[1])).padStart(2, "0");
  const minute = match[2];

  return `${hour}:${minute}`;
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  if (!time) return "";

  const [hourText, minuteText] = time.split(":");
  const total = Number(hourText) * 60 + Number(minuteText) + minutesToAdd;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");

  return `${hour}:${minute}`;
}

function calculateDurationMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return 0;
  }

  const startTotal = startHour * 60 + startMinute;
  let endTotal = endHour * 60 + endMinute;

  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }

  return Math.max(0, endTotal - startTotal);
}

function formatMinutes(minutes: number) {
  if (!minutes || minutes <= 0) return "";

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (restMinutes === 0) return `${hours}시간`;
  if (hours === 0) return `${restMinutes}분`;

  return `${hours}시간 ${restMinutes}분`;
}

function makeTaskId(progressId: string, taskName: string) {
  return `${progressId}:::${taskName}`;
}

function normalizeStatus(status?: string) {
  return status || "not_started";
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

function subjectEmoji(subject?: string) {
  const emojis: Record<string, string> = {
    국어: "📖",
    영어: "🧸",
    수학: "🧮",
    사회: "🌏",
    과학: "🔬",
    한국사: "🏛️",
  };

  return emojis[subject || ""] || "🌷";
}

function taskLabel(task: SelectableTask) {
  const publisher = task.publisher ? `[${task.publisher}] ` : "";
  const material = task.materialName ? `${task.materialName} ` : "";
  const major = task.majorUnit ? `${task.majorUnit} ` : "";

  if (task.unitName === "직접입력" || task.unitName === "기타")
    return task.taskName;
  return `${publisher}${material}${major}${task.unitName} - ${task.taskName}`.trim();
}

function normalizeGroupText(value?: string | null) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function materialLabel(row: ExamProgress) {
  const publisher = row.publisher?.trim();
  const material = row.material_name?.trim();

  if (publisher && material) return `${publisher} · ${material}`;
  if (material) return material;
  if (publisher) return publisher;
  return "교재/자료 미분류";
}

function materialGroupKey(row: ExamProgress) {
  const publisherKey = normalizeGroupText(row.publisher);
  const materialKey = normalizeGroupText(row.material_name);
  return `${publisherKey || "__no_publisher__"}|||${materialKey || "__no_material__"}`;
}

function groupRowsByMaterial(rows: ExamProgress[]) {
  return rows.reduce<Record<string, ExamProgress[]>>((acc, row) => {
    const key = materialGroupKey(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
}

function isDuplicateSubUnit(row: ExamProgress) {
  const major = (row.major_unit || "").trim();
  const unit = (row.unit_name || "").trim();
  return Boolean(major && unit && major === unit);
}

function taskDisplayLabel(task: SelectableTask) {
  const range = [task.majorUnit, task.unitName].filter(Boolean).join(" · ");
  return `${range || "범위 미입력"} - ${task.taskName}`;
}

function unitGroupKeyForSelectable(task: SelectableTask) {
  return [
    task.publisher || "",
    task.materialName || "",
    task.majorUnit || "",
    task.unitName || "기타",
  ].join("::");
}

function selectableUnitTitle(unit: {
  publisher?: string | null;
  materialName?: string | null;
  majorUnit?: string | null;
  unitName?: string | null;
}) {
  if (unit.unitName === "직접입력" || unit.unitName === "기타") return "기타";
  const chunks = [
    unit.publisher,
    unit.materialName,
    unit.majorUnit,
    unit.unitName,
  ].filter((value) => value && value !== "직접입력" && value !== "기타");
  return chunks.length ? chunks.join(" · ") : "기타";
}

function groupSelectableTasksBySubjectAndUnit(tasks: SelectableTask[]) {
  const subjectMap = new Map<
    string,
    Map<
      string,
      {
        publisher?: string | null;
        materialName?: string | null;
        majorUnit?: string | null;
        unitName?: string | null;
        rows: SelectableTask[];
      }
    >
  >();

  tasks.forEach((task) => {
    const subject =
      String(task.subject || "과목 미입력").trim() || "과목 미입력";
    const key = unitGroupKeyForSelectable(task);
    if (!subjectMap.has(subject)) subjectMap.set(subject, new Map());
    const unitMap = subjectMap.get(subject)!;

    if (!unitMap.has(key)) {
      unitMap.set(key, {
        publisher: task.publisher,
        materialName: task.materialName,
        majorUnit: task.majorUnit,
        unitName: task.unitName || "기타",
        rows: [],
      });
    }

    const unit = unitMap.get(key)!;
    if (!unit.rows.some((row) => row.id === task.id)) unit.rows.push(task);
  });

  return Array.from(subjectMap.entries())
    .map(([subject, unitMap]) => ({
      subject,
      units: Array.from(unitMap.values()).sort((a, b) =>
        selectableUnitTitle(a).localeCompare(selectableUnitTitle(b), "ko"),
      ),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
}

function makeSubjectRecord(
  subject = "영어",
  isEditingSubject = false,
): SubjectRecord {
  return {
    id: makeLocalId(),
    subject,
    subjectInputMode: SUBJECTS.includes(subject as BasicSubjectName)
      ? "preset"
      : "custom",
    isEditingSubject,
    progress_item_ids: [],
    homework_item_ids: [],
    plan_item_ids: [],
    show_progress: false,
    show_homework: false,
    show_plan: false,
    manual_homework_text: "",
  };
}

export default function EditStudentRecordPage() {
  const params = useParams();
  const router = useRouter();

  const studentId = params.id as string;
  const recordId = params.recordId as string;

  const [studentName, setStudentName] = useState("");
  const [lessonDate, setLessonDate] = useState(todayText());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [isExtra, setIsExtra] = useState(false);
  const [hasRegularExtra, setHasRegularExtra] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState("0");

  const [content, setContent] = useState("");
  const [memo, setMemo] = useState("");
  const [showContentBox, setShowContentBox] = useState(false);
  const [showMemoBox, setShowMemoBox] = useState(false);

  const [examProgressList, setExamProgressList] = useState<ExamProgress[]>([]);
  const [previousManualHomeworkTasks, setPreviousManualHomeworkTasks] =
    useState<SelectableTask[]>([]);
  const [previousDeferredHomeworkTaskIds, setPreviousDeferredHomeworkTaskIds] =
    useState<string[]>([]);
  const [completedPreviousHomeworkIds, setCompletedPreviousHomeworkIds] =
    useState<string[]>([]);
  const [deferredPreviousHomeworkIds, setDeferredPreviousHomeworkIds] =
    useState<string[]>([]);
  const [originalSavedTasks, setOriginalSavedTasks] = useState<SavedTask[]>([]);

  const [subjectRecords, setSubjectRecords] = useState<SubjectRecord[]>([
    makeSubjectRecord("영어"),
  ]);

  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const totalMinutes = useMemo(
    () => calculateDurationMinutes(startTime, endTime),
    [startTime, endTime],
  );

  const durationText = useMemo(
    () => formatMinutes(totalMinutes),
    [totalMinutes],
  );

  const parsedExtraMinutes = useMemo(() => {
    const value = Number(extraMinutes);
    if (Number.isNaN(value) || value < 0) return 0;
    return Math.floor(value);
  }, [extraMinutes]);

  const billableMinutes = useMemo(() => {
    if (isExtra) return 0;
    if (!hasRegularExtra) return totalMinutes;
    return Math.max(0, totalMinutes - parsedExtraMinutes);
  }, [isExtra, hasRegularExtra, parsedExtraMinutes, totalMinutes]);

  const billableText = useMemo(
    () => formatMinutes(billableMinutes),
    [billableMinutes],
  );
  const extraText = useMemo(
    () => formatMinutes(parsedExtraMinutes),
    [parsedExtraMinutes],
  );

  const allTasks = useMemo<SelectableTask[]>(() => {
    return examProgressList.flatMap((progress) => {
      const statuses = progress.statuses || {};

      return getTaskOrderFromStatuses(statuses).map((taskName) => ({
        id: makeTaskId(progress.id, taskName),
        progressId: progress.id,
        subject: progress.subject,
        unitName: progress.unit_name,
        taskName,
        status: normalizeStatus(statuses[taskName] as string),
        publisher: progress.publisher,
        materialName: progress.material_name,
        majorUnit: progress.major_unit,
      }));
    });
  }, [examProgressList]);

  const selectableTasks = useMemo(() => {
    return allTasks.filter((task) => SELECTABLE_STATUSES.includes(task.status));
  }, [allTasks]);

  const previousHomeworkTasks = useMemo(() => {
    return [
      ...allTasks.filter((task) => task.status === PREVIOUS_HOMEWORK_STATUS),
      ...previousManualHomeworkTasks,
    ];
  }, [allTasks, previousManualHomeworkTasks]);

  const pickerRecord = useMemo(() => {
    if (!pickerState) return null;
    return (
      subjectRecords.find((record) => record.id === pickerState.recordId) ||
      null
    );
  }, [pickerState, subjectRecords]);

  const pickerSubject = pickerRecord?.subject || "영어";

  const pickerRows = useMemo(() => {
    return examProgressList.filter(
      (progress) => progress.subject === pickerSubject,
    );
  }, [examProgressList, pickerSubject]);

  const pickerTaskNames = useMemo(() => {
    const sortedRows = [...pickerRows].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    );
    const names: string[] = [];
    sortedRows.forEach((row) => {
      getTaskOrderFromStatuses(row.statuses).forEach((name) => {
        if (!names.includes(name)) names.push(name);
      });
    });
    return names;
  }, [pickerRows]);

  useEffect(() => {
    async function fetchData() {
      setErrorMessage("");

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("name, default_start_time, default_end_time")
        .eq("id", studentId)
        .single();

      if (studentError) {
        setErrorMessage(studentError.message);
        return;
      }

      const student = studentData as StudentInfo | null;
      setStudentName(student?.name || "");

      const { data: progressData, error: progressError } = await supabase
        .from("exam_progress")
        .select(
          "id, student_id, subject, unit_name, statuses, sort_order, publisher, material_name, major_unit, memo",
        )
        .eq("student_id", studentId)
        .order("subject", { ascending: true })
        .order("sort_order", { ascending: true });

      if (progressError) {
        setErrorMessage(progressError.message);
        return;
      }

      const progressList = (progressData || []) as ExamProgress[];
      setExamProgressList(progressList);

      const { data: recordData, error: recordError } = await supabase
        .from("lesson_records")
        .select("*")
        .eq("id", recordId)
        .eq("student_id", studentId)
        .single();

      if (recordError) {
        setErrorMessage(recordError.message);
        return;
      }

      setLessonDate(recordData.lesson_date || todayText());
      setStartTime(normalizeTimeValue(recordData.start_time));
      setEndTime(normalizeTimeValue(recordData.end_time));
      setContent(recordData.content || "");
      setMemo(recordData.memo || "");
      setShowContentBox(Boolean(String(recordData.content || "").trim()));
      setShowMemoBox(Boolean(String(recordData.memo || "").trim()));

      const savedIsExtra = Boolean(recordData.is_extra);
      const savedHasRegularExtra = Boolean(recordData.has_regular_extra);
      const savedExtraMinutes = Number(recordData.extra_minutes || 0);

      setIsExtra(savedIsExtra);
      setHasRegularExtra(savedIsExtra ? false : savedHasRegularExtra);
      setExtraMinutes(
        savedIsExtra
          ? "0"
          : String(savedHasRegularExtra ? savedExtraMinutes : 0),
      );

      const originalSubjectRecords = Array.isArray(recordData.subject_records)
        ? recordData.subject_records
        : [];
      const originalCheckedHomeworkItems = Array.isArray(
        recordData.checked_homework_items,
      )
        ? recordData.checked_homework_items
        : [];

      setOriginalSavedTasks([
        ...originalSubjectRecords.flatMap((item: any) => [
          ...(Array.isArray(item.progress_items) ? item.progress_items : []),
          ...(Array.isArray(item.homework_items) ? item.homework_items : []),
          ...(Array.isArray(item.plan_items) ? item.plan_items : []),
        ]),
        ...originalCheckedHomeworkItems,
      ]);

      const loadedSubjectRecords =
        originalSubjectRecords.length > 0
          ? originalSubjectRecords.map((item: any) => {
              const subject = String(item.subject || "영어");
              const progressItems = Array.isArray(item.progress_items)
                ? item.progress_items
                : [];
              const homeworkItems = Array.isArray(item.homework_items)
                ? item.homework_items
                : [];
              const planItems = Array.isArray(item.plan_items)
                ? item.plan_items
                : [];
              const linkedHomeworkItems = homeworkItems.filter(
                (task: any) =>
                  !String(task.progress_id || "").startsWith("manual-"),
              );
              const manualHomeworkText = homeworkItems
                .filter(
                  (task: any) =>
                    String(task.progress_id || "").startsWith("manual-") ||
                    task.before_status === "manual" ||
                    task.unit_name === "직접입력" ||
                    task.unit_name === "기타",
                )
                .map((task: any) => String(task.task_name || "").trim())
                .filter(Boolean)
                .join("\n");

              return {
                id: makeLocalId(),
                subject,
                subjectInputMode: SUBJECTS.includes(subject as BasicSubjectName)
                  ? "preset"
                  : "custom",
                isEditingSubject: false,
                progress_item_ids: progressItems
                  .map((task: any) =>
                    makeTaskId(task.progress_id, task.task_name),
                  )
                  .filter(Boolean),
                homework_item_ids: linkedHomeworkItems
                  .map((task: any) =>
                    makeTaskId(task.progress_id, task.task_name),
                  )
                  .filter(Boolean),
                plan_item_ids: planItems
                  .map((task: any) =>
                    makeTaskId(task.progress_id, task.task_name),
                  )
                  .filter(Boolean),
                show_progress: progressItems.length > 0,
                show_homework: homeworkItems.length > 0,
                show_plan: planItems.length > 0,
                manual_homework_text: manualHomeworkText,
              };
            })
          : [];

      setSubjectRecords(
        loadedSubjectRecords.length > 0
          ? loadedSubjectRecords
          : [makeSubjectRecord("영어", true)],
      );

      const checkedHomeworkItems = Array.isArray(
        recordData.checked_homework_items,
      )
        ? recordData.checked_homework_items
        : [];

      const checkedManualHomeworkTasks = checkedHomeworkItems
        .filter(
          (task: any) =>
            String(task.progress_id || "").startsWith("manual-") ||
            task.before_status === "manual" ||
            task.unit_name === "직접입력" ||
            task.unit_name === "기타",
        )
        .map((task: any, index: number) => {
          const progressId =
            task.progress_id || `checked-manual-${recordId}-${index}`;
          const taskName = String(task.task_name || "기타 숙제").trim();

          return {
            id: makeTaskId(progressId, taskName),
            progressId,
            subject: task.subject || "숙제",
            unitName: "기타",
            taskName,
            status: PREVIOUS_HOMEWORK_STATUS,
            publisher: null,
            materialName: null,
          };
        });

      const { data: recentRecordData } = await supabase
        .from("lesson_records")
        .select("id, lesson_date, subject_records")
        .eq("student_id", studentId)
        .neq("id", recordId)
        .lt("lesson_date", recordData.lesson_date || todayText())
        .order("lesson_date", { ascending: false })
        .limit(6);

      const recentManualHomeworkTasks = (
        (recentRecordData || []) as {
          id: string;
          lesson_date: string;
          subject_records?:
            | { subject?: string; homework_items?: SavedTask[] }[]
            | null;
        }[]
      ).flatMap((lessonRecord) =>
        (Array.isArray(lessonRecord.subject_records)
          ? lessonRecord.subject_records
          : []
        ).flatMap((subjectRecord, subjectIndex) =>
          (Array.isArray(subjectRecord.homework_items)
            ? subjectRecord.homework_items
            : []
          )
            .filter(
              (item) =>
                item.before_status === "manual" ||
                item.unit_name === "직접입력" ||
                item.unit_name === "기타" ||
                String(item.progress_id || "").startsWith("manual-"),
            )
            .map((item, itemIndex) => {
              const progressId =
                item.progress_id ||
                `manual-${lessonRecord.id}-${subjectIndex}-${itemIndex}`;
              const taskName = item.task_name || "기타 숙제";

              return {
                id: makeTaskId(progressId, taskName),
                progressId,
                subject: item.subject || subjectRecord.subject || "숙제",
                unitName: "기타",
                taskName,
                status: PREVIOUS_HOMEWORK_STATUS,
                publisher: null,
                materialName: null,
              };
            }),
        ),
      );

      const manualTaskMap = new Map<string, SelectableTask>();
      [...checkedManualHomeworkTasks, ...recentManualHomeworkTasks].forEach(
        (task) => {
          manualTaskMap.set(task.id, task);
        },
      );

      setPreviousManualHomeworkTasks(Array.from(manualTaskMap.values()));
      setPreviousDeferredHomeworkTaskIds(
        (
          (recentRecordData || []) as {
            subject_records?: { homework_items?: SavedTask[] }[] | null;
          }[]
        )
          .flatMap((lessonRecord) =>
            (Array.isArray(lessonRecord.subject_records)
              ? lessonRecord.subject_records
              : []
            ).flatMap((subjectRecord) =>
              (Array.isArray(subjectRecord.homework_items)
                ? subjectRecord.homework_items
                : []
              )
                .filter(
                  (item) => item.deferred || item.checked_status === "deferred",
                )
                .map((item) => makeTaskId(item.progress_id, item.task_name)),
            ),
          )
          .filter(Boolean),
      );

      setCompletedPreviousHomeworkIds(
        checkedHomeworkItems
          .filter(
            (task: any) => task.checked_status !== "deferred" && !task.deferred,
          )
          .map((task: any) => makeTaskId(task.progress_id, task.task_name))
          .filter(Boolean),
      );
      setDeferredPreviousHomeworkIds(
        checkedHomeworkItems
          .filter(
            (task: any) => task.checked_status === "deferred" || task.deferred,
          )
          .map((task: any) => makeTaskId(task.progress_id, task.task_name))
          .filter(Boolean),
      );
    }

    if (studentId && recordId) {
      fetchData();
    }
  }, [studentId, recordId]);

  function handleStartTimeChange(value: string) {
    const normalized = normalizeTimeValue(value);
    const previousDuration = totalMinutes || 120;

    setStartTime(normalized);
    if (normalized) {
      setEndTime(addMinutesToTime(normalized, previousDuration));
    } else {
      setEndTime("");
    }
  }

  function handleEndTimeChange(value: string) {
    setEndTime(normalizeTimeValue(value));
  }

  function handleIsExtraChange(checked: boolean) {
    setIsExtra(checked);

    if (checked) {
      setHasRegularExtra(false);
      setExtraMinutes("0");
    }
  }

  function handleHasRegularExtraChange(checked: boolean) {
    setHasRegularExtra(checked);

    if (checked) {
      setIsExtra(false);
      if (extraMinutes === "0") setExtraMinutes("30");
    } else {
      setExtraMinutes("0");
    }
  }

  function addSubjectRecord() {
    setSubjectRecords((prev) => [...prev, makeSubjectRecord("영어", true)]);
  }

  function removeSubjectRecord(id: string) {
    setSubjectRecords((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((record) => record.id !== id);
    });
  }

  function toggleSubjectSection(
    recordId: string,
    section: "progress" | "homework" | "plan",
  ) {
    setSubjectRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record;

        if (section === "progress") {
          return { ...record, show_progress: true };
        }

        if (section === "homework") {
          return { ...record, show_homework: true };
        }

        return { ...record, show_plan: true };
      }),
    );
  }

  function hideSubjectSection(
    recordId: string,
    section: "progress" | "homework" | "plan",
  ) {
    setSubjectRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) return record;

        if (section === "progress") {
          return { ...record, show_progress: false, progress_item_ids: [] };
        }

        if (section === "homework") {
          return {
            ...record,
            show_homework: false,
            homework_item_ids: [],
            manual_homework_text: "",
          };
        }

        return { ...record, show_plan: false, plan_item_ids: [] };
      }),
    );
  }

  function updateManualHomeworkText(recordId: string, value: string) {
    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? { ...record, manual_homework_text: value }
          : record,
      ),
    );
  }

  function updateSubject(
    recordId: string,
    subject: string,
    mode: SubjectInputMode,
  ) {
    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? {
              ...record,
              subject,
              subjectInputMode: mode,
              isEditingSubject: mode === "custom",
              progress_item_ids: [],
              homework_item_ids: [],
              plan_item_ids: [],
              manual_homework_text: "",
            }
          : record,
      ),
    );
  }

  function updateCustomSubject(recordId: string, subject: string) {
    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? {
              ...record,
              subject,
              subjectInputMode: "custom",
              progress_item_ids: [],
              homework_item_ids: [],
              plan_item_ids: [],
              manual_homework_text: "",
            }
          : record,
      ),
    );
  }

  function saveSubjectName(recordId: string) {
    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? {
              ...record,
              subject: record.subject.trim(),
              isEditingSubject: false,
            }
          : record,
      ),
    );
  }

  function editSubjectName(recordId: string) {
    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === recordId
          ? {
              ...record,
              isEditingSubject: true,
            }
          : record,
      ),
    );
  }

  function openTaskPicker(recordId: string, field: PickerField, title: string) {
    const record = subjectRecords.find((item) => item.id === recordId);

    if (!record || !record.subject.trim()) return;

    setPickerState({
      recordId,
      field,
      title,
    });

    setDraftSelectedIds(record[field]);
  }

  function closeTaskPicker() {
    setPickerState(null);
    setDraftSelectedIds([]);
  }

  function confirmTaskPicker() {
    if (!pickerState) return;

    setSubjectRecords((prev) =>
      prev.map((record) =>
        record.id === pickerState.recordId
          ? {
              ...record,
              [pickerState.field]: draftSelectedIds,
            }
          : record,
      ),
    );

    closeTaskPicker();
  }

  function toggleDraftTask(taskId: string) {
    setDraftSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  }

  function togglePreviousHomework(taskId: string) {
    setCompletedPreviousHomeworkIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
    setDeferredPreviousHomeworkIds((prev) =>
      prev.filter((id) => id !== taskId),
    );
  }

  function toggleDeferredPreviousHomework(taskId: string) {
    setDeferredPreviousHomeworkIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
    setCompletedPreviousHomeworkIds((prev) =>
      prev.filter((id) => id !== taskId),
    );
  }

  function getSelectableTasksBySubject(subject: string) {
    return selectableTasks.filter((task) => task.subject === subject);
  }

  function isTaskSelectableForPicker(status: string) {
    return status !== "done";
  }

  function pickerStatusHelpText(field: PickerField) {
    if (field === "progress_item_ids")
      return "완료를 제외한 항목을 선택할 수 있어요. 저장하면 완료로 바뀌어요.";
    if (field === "homework_item_ids")
      return "완료를 제외한 항목을 선택할 수 있어요. 저장하면 숙제로 바뀌어요.";
    return "완료를 제외한 항목을 선택할 수 있어요. 저장하면 계획으로 바뀌어요.";
  }

  function getLinkedStatusForPicker(taskId: string, fallbackStatus: string) {
    let linkedStatus = fallbackStatus;

    subjectRecords.forEach((record) => {
      if (record.plan_item_ids.includes(taskId)) {
        linkedStatus = "planned";
      }

      if (record.homework_item_ids.includes(taskId)) {
        linkedStatus = "homework";
      }

      if (record.progress_item_ids.includes(taskId)) {
        linkedStatus = "done";
      }
    });

    if (completedPreviousHomeworkIds.includes(taskId)) {
      linkedStatus = "done";
    }

    if (deferredPreviousHomeworkIds.includes(taskId)) {
      linkedStatus = "homework";
    }

    return linkedStatus;
  }

  function getSelectedTasks(taskIds: string[]) {
    return taskIds
      .map((taskId) =>
        [...allTasks, ...previousManualHomeworkTasks].find(
          (task) => task.id === taskId,
        ),
      )
      .filter(Boolean) as SelectableTask[];
  }

  function findTaskById(taskId: string) {
    return [...allTasks, ...previousManualHomeworkTasks].find(
      (task) => task.id === taskId,
    );
  }

  function convertToSavedTasks(taskIds: string[]): SavedTask[] {
    return taskIds
      .map((taskId) => findTaskById(taskId))
      .filter(Boolean)
      .map((task) => ({
        progress_id: task!.progressId,
        subject: task!.subject,
        unit_name: task!.unitName,
        task_name: task!.taskName,
        before_status: task!.status,
        publisher: task!.publisher,
        material_name: task!.materialName,
        major_unit: task!.majorUnit,
      }));
  }

  function convertManualHomeworkToSavedTasks(
    record: SubjectRecord,
  ): SavedTask[] {
    return record.manual_homework_text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        progress_id: `manual-${record.id}-${index}`,
        subject: record.subject.trim(),
        unit_name: "기타",
        task_name: line,
        before_status: "manual",
        publisher: null,
        material_name: null,
        major_unit: null,
      }));
  }

  async function updateExamProgressStatuses() {
    const updatesByProgressId: Record<string, Record<string, string>> = {};

    function ensureProgress(progressId: string) {
      if (!updatesByProgressId[progressId]) {
        const origin = examProgressList.find((item) => item.id === progressId);
        updatesByProgressId[progressId] = {
          ...(origin?.statuses || {}),
        };
      }
    }

    function addUpdate(taskId: string, status: string) {
      const task = findTaskById(taskId);
      if (!task) return;

      ensureProgress(task.progressId);
      updatesByProgressId[task.progressId][task.taskName] = status;
    }

    function addSavedTaskRevert(task: SavedTask) {
      if (
        !task.progress_id ||
        !task.task_name ||
        !task.before_status ||
        task.before_status === "manual" ||
        String(task.progress_id).startsWith("manual-")
      ) {
        return;
      }

      ensureProgress(task.progress_id);
      updatesByProgressId[task.progress_id][task.task_name] =
        task.before_status;
    }

    // 기존 기록에서 빠진 진도/숙제/계획은 원래 상태로 되돌린 뒤,
    // 지금 선택된 항목을 다시 덮어써야 수정/삭제가 숙제정리와 바로 연동돼요.
    originalSavedTasks.forEach(addSavedTaskRevert);

    // 같은 항목이 여러 박스에 들어가도 최종 우선순위가 꼬이지 않게 처리해요.
    // 계획 < 숙제 < 완료 순서라서, 오늘 한 진도는 무조건 완료로 저장돼요.
    subjectRecords.forEach((record) => {
      record.plan_item_ids.forEach((taskId) => {
        addUpdate(taskId, "planned");
      });

      record.homework_item_ids.forEach((taskId) => {
        addUpdate(taskId, "homework");
      });

      record.progress_item_ids.forEach((taskId) => {
        addUpdate(taskId, "done");
      });
    });

    completedPreviousHomeworkIds.forEach((taskId) => {
      addUpdate(taskId, "done");
    });

    const entries = Object.entries(updatesByProgressId);

    for (const [progressId, statuses] of entries) {
      const { error } = await supabase
        .from("exam_progress")
        .update({ statuses })
        .eq("id", progressId);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  async function rebuildExamProgressStatusesAfterSave(
    nextSubjectRecords: any[],
    nextCheckedHomeworkItems: SavedTask[],
  ) {
    const { data: recordRows, error: recordError } = await supabase
      .from("lesson_records")
      .select(
        "id, lesson_date, start_time, subject_records, checked_homework_items",
      )
      .eq("student_id", studentId);

    if (recordError) throw new Error(recordError.message);

    const rowsForRebuild = ((recordRows || []) as any[]).map((row) =>
      row.id === recordId
        ? {
            ...row,
            lesson_date: lessonDate,
            start_time: startTime,
            subject_records: nextSubjectRecords,
            checked_homework_items: nextCheckedHomeworkItems,
          }
        : row,
    );

    rowsForRebuild.sort((a, b) => {
      const dateCompare = String(a.lesson_date || "").localeCompare(
        String(b.lesson_date || ""),
      );
      if (dateCompare !== 0) return dateCompare;
      return String(a.start_time || "").localeCompare(
        String(b.start_time || ""),
      );
    });

    const statusMap = new Map<string, Record<string, string>>();
    examProgressList.forEach((row) => {
      statusMap.set(row.id, { ...(row.statuses || {}) });
    });

    const touched = new Set<string>();

    function resetTouched(task: SavedTask) {
      const progressId = String(task.progress_id || "");
      const taskName = String(task.task_name || "");
      if (!progressId || !taskName || progressId.startsWith("manual-")) return;
      if (!statusMap.has(progressId)) statusMap.set(progressId, {});
      const statuses = statusMap.get(progressId)!;
      const key = `${progressId}:::${taskName}`;
      if (!touched.has(key)) {
        statuses[taskName] = normalizeStatus(
          task.before_status || statuses[taskName] || "not_started",
        );
        touched.add(key);
      }
    }

    function applyTask(task: SavedTask, status: string) {
      const progressId = String(task.progress_id || "");
      const taskName = String(task.task_name || "");
      if (!progressId || !taskName || progressId.startsWith("manual-")) return;
      if (!statusMap.has(progressId)) statusMap.set(progressId, {});
      statusMap.get(progressId)![taskName] = status;
      touched.add(`${progressId}:::${taskName}`);
    }

    rowsForRebuild.forEach((record) => {
      const subjectRecords = Array.isArray(record.subject_records)
        ? record.subject_records
        : [];
      const checkedItems = Array.isArray(record.checked_homework_items)
        ? record.checked_homework_items
        : [];

      subjectRecords.forEach((subjectRecord: any) => {
        [
          ...(Array.isArray(subjectRecord.progress_items)
            ? subjectRecord.progress_items
            : []),
          ...(Array.isArray(subjectRecord.homework_items)
            ? subjectRecord.homework_items
            : []),
          ...(Array.isArray(subjectRecord.plan_items)
            ? subjectRecord.plan_items
            : []),
        ].forEach(resetTouched);
      });
      checkedItems.forEach(resetTouched);
    });

    rowsForRebuild.forEach((record) => {
      const subjectRecords = Array.isArray(record.subject_records)
        ? record.subject_records
        : [];
      const checkedItems = Array.isArray(record.checked_homework_items)
        ? record.checked_homework_items
        : [];

      subjectRecords.forEach((subjectRecord: any) => {
        (Array.isArray(subjectRecord.progress_items)
          ? subjectRecord.progress_items
          : []
        ).forEach((task: SavedTask) => applyTask(task, "done"));
        (Array.isArray(subjectRecord.homework_items)
          ? subjectRecord.homework_items
          : []
        ).forEach((task: SavedTask) => applyTask(task, "homework"));
        (Array.isArray(subjectRecord.plan_items)
          ? subjectRecord.plan_items
          : []
        ).forEach((task: SavedTask) => applyTask(task, "planned"));
      });

      checkedItems.forEach((task: SavedTask) => applyTask(task, "done"));
    });

    const progressIds = Array.from(
      new Set(Array.from(touched).map((key) => key.split(":::")[0])),
    );
    await Promise.all(
      progressIds.map((progressId) =>
        supabase
          .from("exam_progress")
          .update({ statuses: statusMap.get(progressId) || {} })
          .eq("id", progressId)
          .eq("student_id", studentId),
      ),
    );
  }

  async function saveRecord() {
    setErrorMessage("");

    if (!lessonDate) {
      setErrorMessage("수업 날짜를 입력해줘.");
      return;
    }

    if (!startTime) {
      setErrorMessage("시작시간을 입력해줘.");
      return;
    }

    if (!endTime) {
      setErrorMessage("종료시간을 입력해줘.");
      return;
    }

    if (totalMinutes <= 0) {
      setErrorMessage(
        "수업시간이 0분이에요. 시작시간과 종료시간을 다시 확인해줘.",
      );
      return;
    }

    if (hasRegularExtra && parsedExtraMinutes <= 0) {
      setErrorMessage("정규+추가수업으로 기록하려면 추가수업 시간을 입력해줘.");
      return;
    }

    if (hasRegularExtra && parsedExtraMinutes > totalMinutes) {
      setErrorMessage("추가수업 시간이 총 수업시간보다 길 수는 없어.");
      return;
    }

    const cleanedSubjectRecords = subjectRecords
      .map((record) => {
        const progressItems = record.show_progress
          ? convertToSavedTasks(record.progress_item_ids)
          : [];
        const homeworkItems = record.show_homework
          ? [
              ...convertToSavedTasks(record.homework_item_ids),
              ...convertManualHomeworkToSavedTasks(record),
            ]
          : [];
        const planItems = record.show_plan
          ? convertToSavedTasks(record.plan_item_ids)
          : [];

        return {
          subject: record.subject.trim(),
          progress_items: progressItems,
          homework_items: homeworkItems,
          plan_items: planItems,
        };
      })
      .filter(
        (record) =>
          record.subject &&
          (record.progress_items.length > 0 ||
            record.homework_items.length > 0 ||
            record.plan_items.length > 0),
      );

    const checkedHomeworkItems = [
      ...convertToSavedTasks(completedPreviousHomeworkIds).map((item) => ({
        ...item,
        checked_status: "done",
        deferred: false,
      })),
      ...convertToSavedTasks(deferredPreviousHomeworkIds).map((item) => ({
        ...item,
        checked_status: "deferred",
        deferred: true,
      })),
    ];

    if (
      cleanedSubjectRecords.length === 0 &&
      checkedHomeworkItems.length === 0 &&
      !content.trim() &&
      !memo.trim()
    ) {
      setErrorMessage(
        "진도, 숙제, 다음 수업 계획, 저번 숙제 확인, 수업 내용, 메모 중 하나는 입력해줘.",
      );
      return;
    }

    setLoading(true);

    try {
      const regularExtraMinutes = hasRegularExtra ? parsedExtraMinutes : 0;
      const calculatedBillableMinutes = isExtra
        ? 0
        : Math.max(0, totalMinutes - regularExtraMinutes);

      const { error } = await withSaveTimeout(
        supabase
          .from("lesson_records")
          .update({
            lesson_date: lessonDate,
            start_time: startTime,
            end_time: endTime,
            content: content.trim() || "",
            memo: memo.trim() || null,
            subject_records: cleanedSubjectRecords,
            checked_homework_items: checkedHomeworkItems,
            duration_text: durationText,
            total_minutes: totalMinutes,
            is_extra: isExtra,
            has_regular_extra: hasRegularExtra,
            extra_minutes: regularExtraMinutes,
            billable_minutes: calculatedBillableMinutes,
          })
          .eq("id", recordId)
          .eq("student_id", studentId),
      );

      if (error) {
        throw new Error(error.message);
      }

      await withSaveTimeout(
        rebuildExamProgressStatusesAfterSave(
          cleanedSubjectRecords,
          checkedHomeworkItems,
        ),
      );

      router.push(`/students/${studentId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "저장 중 오류가 발생했어.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#ffffff] px-5 py-8 text-[#171717]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#525252]">
              수업 기록 수정
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#171717]">
              {studentName ? `${studentName} 수업 기록` : "수업 기록"}
            </h1>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/students/${studentId}`}
              className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm font-bold text-[#171717]"
            >
              상세보기
            </Link>

            <Link
              href="/students"
              className="rounded-2xl bg-[#171717] px-4 py-3 text-sm font-bold text-white"
            >
              학생 목록
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-600">
            {errorMessage}
          </div>
        )}

        <section className="rounded-[2rem] border border-[#e5e5e5] bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                수업 날짜
              </label>

              <input
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                시작시간
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                종료시간
              </label>

              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                수업시간
              </label>

              <div className="flex h-[50px] items-center rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 text-sm font-black text-[#525252]">
                {durationText || "자동 계산"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label
              className={`flex cursor-pointer gap-3 rounded-3xl border p-4 transition ${
                isExtra
                  ? "border-[#9a8a7a] bg-[#f5f5f5]"
                  : "border-[#e5e5e5] bg-[#f7f7f7]"
              }`}
            >
              <input
                type="checkbox"
                checked={isExtra}
                onChange={(e) => handleIsExtraChange(e.target.checked)}
                className="mt-1 h-4 w-4"
              />

              <div>
                <p className="text-sm font-black text-[#171717]">
                  추가수업으로 기록하기
                </p>
              </div>
            </label>

            <div
              className={`rounded-3xl border p-4 transition ${
                hasRegularExtra
                  ? "border-[#9a8a7a] bg-[#f5f5f5]"
                  : "border-[#e5e5e5] bg-[#f7f7f7]"
              }`}
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={hasRegularExtra}
                  onChange={(e) =>
                    handleHasRegularExtraChange(e.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <div>
                  <p className="text-sm font-black text-[#171717]">
                    정규 + 추가수업
                  </p>
                </div>
              </label>

              {hasRegularExtra && (
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-2 block text-xs font-black text-[#171717]">
                      추가수업 시간
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={extraMinutes}
                        onChange={(e) => setExtraMinutes(e.target.value)}
                        className="w-full rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                      />
                      <span className="shrink-0 text-sm font-black text-[#5c5751]">
                        분
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-xs font-bold text-[#525252]">
                    정규 수업시간:{" "}
                    <span className="text-[#525252]">
                      {billableText || "0분"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-[2rem] border border-[#e5e5e5] bg-[#f7f7f7] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#171717]">
                  저번 숙제 확인
                </h2>
                <p className="mt-1 text-sm font-bold text-[#525252]">
                  과목별 박스 안에서 같은 범위 숙제를 한 줄로 묶어 확인해요.
                </p>
              </div>
            </div>

            {previousHomeworkTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-white px-5 py-5 text-sm font-semibold text-[#525252]">
                확인할 지난 숙제가 없어요.
              </div>
            ) : (
              <div className="space-y-3">
                {groupSelectableTasksBySubjectAndUnit(
                  previousHomeworkTasks,
                ).map(({ subject, units }) => (
                  <div
                    key={subject}
                    className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-[#e5e5e5] bg-[#ffffff] px-5 py-3">
                      <p className="text-base font-black text-[#171717]">
                        {subjectEmoji(subject)} {subject}
                      </p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#171717]">
                        {units.reduce((sum, unit) => sum + unit.rows.length, 0)}
                        개
                      </span>
                    </div>
                    <div className="divide-y divide-[#e5e5e5]">
                      {units.map((unit) => (
                        <div
                          key={`${subject}-${selectableUnitTitle(unit)}`}
                          className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.6fr)]"
                        >
                          <div className="text-sm font-black text-[#525252]">
                            {selectableUnitTitle(unit)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {unit.rows.map((task) => {
                              const done =
                                completedPreviousHomeworkIds.includes(task.id);
                              const deferred =
                                deferredPreviousHomeworkIds.includes(task.id);
                              const wasDeferred =
                                previousDeferredHomeworkTaskIds.includes(
                                  task.id,
                                );
                              return (
                                <div
                                  key={task.id}
                                  className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black shadow-sm transition ${
                                    done
                                      ? "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]"
                                      : deferred
                                        ? "border-[#d4d4d4] bg-[#f7f7f7] text-[#404040]"
                                        : "border-[#e5e5e5] bg-white text-[#171717]"
                                  }`}
                                >
                                  <span>{task.taskName}</span>
                                  {wasDeferred && (
                                    <span className="rounded-full bg-[#f7f7f7] px-2 py-0.5 text-[11px] font-black text-[#404040]">
                                      저번에 미룸
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      togglePreviousHomework(task.id)
                                    }
                                    className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black"
                                  >
                                    {done ? "완료취소" : "완료"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleDeferredPreviousHomework(task.id)
                                    }
                                    className="rounded-full border border-[#d4d4d4] bg-[#f7f7f7] px-2.5 py-1 text-[11px] font-black text-[#404040]"
                                  >
                                    {deferred ? "미루기취소" : "미루기"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#171717]">
                  과목별 진도 / 숙제 / 다음 수업 계획
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#525252]">
                  과목을 추가한 뒤 필요한 박스만 열어서 기록하면 돼요.
                </p>
              </div>

              <button
                type="button"
                onClick={addSubjectRecord}
                className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white shadow-sm"
              >
                과목 추가
              </button>
            </div>

            <div className="space-y-5">
              {subjectRecords.map((record) => {
                const tasksForSubject = getSelectableTasksBySubject(
                  record.subject,
                );
                const selectedProgressTasks = getSelectedTasks(
                  record.progress_item_ids,
                );
                const selectedHomeworkTasks = getSelectedTasks(
                  record.homework_item_ids,
                );
                const selectedPlanTasks = getSelectedTasks(
                  record.plan_item_ids,
                );
                const manualHomeworkLines = record.manual_homework_text
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean);
                const badgeClass =
                  subjectBadgeStyle[record.subject] ||
                  "bg-[#f5f5f5] text-[#171717] border-[#e5e5e5]";

                return (
                  <article
                    key={record.id}
                    className="rounded-[2rem] border border-[#e5e5e5] bg-[#f7f7f7] p-5"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-4 py-2 text-base font-black ${badgeClass}`}
                        >
                          <span className="mr-1.5">
                            {subjectEmoji(record.subject)}
                          </span>
                          {record.subject || "과목 미입력"}
                        </span>

                        {!record.isEditingSubject && (
                          <button
                            type="button"
                            onClick={() => editSubjectName(record.id)}
                            className="rounded-full border border-[#e5e5e5] bg-white px-2 py-1 text-[13px] font-black text-[#171717]"
                          >
                            과목 수정
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSubjectRecord(record.id)}
                        className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-1 text-sm font-bold text-[#171717]"
                      >
                        삭제
                      </button>
                    </div>

                    {record.isEditingSubject && (
                      <div className="mb-5 rounded-3xl border border-[#e5e5e5] bg-white p-4">
                        <label className="mb-2 block text-sm font-bold text-[#5c5751]">
                          과목
                        </label>

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select
                            value={
                              record.subjectInputMode === "custom"
                                ? "직접입력"
                                : record.subject
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "직접입력") {
                                updateSubject(record.id, "", "custom");
                              } else {
                                updateSubject(record.id, value, "preset");
                              }
                            }}
                            className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                          >
                            {SUBJECTS.map((subject) => (
                              <option key={subject} value={subject}>
                                {subject}
                              </option>
                            ))}
                            <option value="직접입력">직접입력</option>
                          </select>

                          {record.subjectInputMode === "preset" && (
                            <button
                              type="button"
                              onClick={() => saveSubjectName(record.id)}
                              className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
                            >
                              선택 완료
                            </button>
                          )}
                        </div>

                        {record.subjectInputMode === "custom" && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                            <input
                              value={record.subject}
                              onChange={(e) =>
                                updateCustomSubject(record.id, e.target.value)
                              }
                              placeholder="예: 문학, 독해, 통합사회, 생명과학"
                              className="w-full rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => saveSubjectName(record.id)}
                              className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white disabled:bg-[#a3a3a3]"
                              disabled={!record.subject.trim()}
                            >
                              과목 저장
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-4 flex flex-wrap gap-2">
                      {!record.show_progress && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleSubjectSection(record.id, "progress")
                          }
                          className="rounded-full bg-[#171717] px-4 py-2 text-xs font-black text-white disabled:bg-[#a3a3a3]"
                          disabled={!record.subject.trim()}
                        >
                          + 진도 추가
                        </button>
                      )}

                      {!record.show_homework && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleSubjectSection(record.id, "homework")
                          }
                          className="rounded-full bg-[#171717] px-4 py-2 text-xs font-black text-white disabled:bg-[#a3a3a3]"
                          disabled={!record.subject.trim()}
                        >
                          + 숙제 추가
                        </button>
                      )}

                      {!record.show_plan && (
                        <button
                          type="button"
                          onClick={() =>
                            toggleSubjectSection(record.id, "plan")
                          }
                          className="rounded-full border border-[#d4d4d4] bg-[#f7f7f7] px-4 py-2 text-xs font-black text-[#404040] disabled:opacity-50"
                          disabled={!record.subject.trim()}
                        >
                          + 다음 수업 계획 추가
                        </button>
                      )}
                    </div>

                    {!record.show_progress &&
                    !record.show_homework &&
                    !record.show_plan ? (
                      <p className="rounded-3xl border border-dashed border-[#e5e5e5] bg-white px-5 py-5 text-sm font-semibold text-[#525252]">
                        진도, 숙제, 다음 수업 계획 중 필요한 것만 추가해줘.
                      </p>
                    ) : (
                      <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        {record.show_progress && (
                          <div className="rounded-3xl border border-[#e5e5e5] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-[#525252]">
                                오늘 한 진도
                              </p>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openTaskPicker(
                                      record.id,
                                      "progress_item_ids",
                                      `${record.subject} 진도 선택`,
                                    )
                                  }
                                  className="rounded-2xl bg-[#171717] px-3 py-2 text-xs font-black text-white disabled:bg-[#a3a3a3]"
                                  disabled={!record.subject.trim()}
                                >
                                  진도 선택
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    hideSubjectSection(record.id, "progress")
                                  }
                                  className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                >
                                  닫기
                                </button>
                              </div>
                            </div>

                            {tasksForSubject.length === 0 ? (
                              <p className="rounded-2xl bg-[#f7f7f7] px-4 py-4 text-sm font-semibold text-[#525252]">
                                이 과목에서 선택할 항목이 없어요.
                              </p>
                            ) : selectedProgressTasks.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-4 py-4 text-sm font-semibold text-[#525252]">
                                아직 선택한 진도가 없어요.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {selectedProgressTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 text-sm font-bold text-[#171717]"
                                  >
                                    {taskLabel(task)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {record.show_homework && (
                          <div className="rounded-3xl border border-[#e5e5e5] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-[#525252]">
                                오늘의 숙제
                              </p>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openTaskPicker(
                                      record.id,
                                      "homework_item_ids",
                                      `${record.subject} 숙제 선택`,
                                    )
                                  }
                                  className="rounded-2xl bg-[#171717] px-3 py-2 text-xs font-black text-white disabled:bg-[#a3a3a3]"
                                  disabled={!record.subject.trim()}
                                >
                                  숙제 선택
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    hideSubjectSection(record.id, "homework")
                                  }
                                  className="rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-black text-[#171717]"
                                >
                                  닫기
                                </button>
                              </div>
                            </div>

                            {selectedHomeworkTasks.length === 0 &&
                            manualHomeworkLines.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-4 py-4 text-sm font-semibold text-[#525252]">
                                시험범위표에서 고르거나 아래에 직접 입력해줘.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {selectedHomeworkTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3 text-sm font-bold text-[#171717]"
                                  >
                                    {taskLabel(task)}
                                  </div>
                                ))}
                                {manualHomeworkLines.map((line, index) => (
                                  <div
                                    key={`${record.id}-manual-homework-${index}`}
                                    className="rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 py-3 text-sm font-bold text-[#171717]"
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] p-3">
                              <label className="mb-2 block text-xs font-black text-[#171717]">
                                시험범위표 외 기타 숙제{" "}
                                <span className="font-bold text-[#171717]">
                                  (한 줄에 하나씩 여러 개 가능)
                                </span>
                              </label>
                              <textarea
                                value={record.manual_homework_text}
                                onChange={(e) =>
                                  updateManualHomeworkText(
                                    record.id,
                                    e.target.value,
                                  )
                                }
                                rows={3}
                                placeholder="예: 프린트 3쪽 풀기\n단어 1~30번 암기"
                                className="w-full resize-none rounded-2xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {record.show_plan && (
                          <div className="rounded-3xl border border-[#d4d4d4] bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-[#404040]">
                                다음 수업 계획
                              </p>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openTaskPicker(
                                      record.id,
                                      "plan_item_ids",
                                      `${record.subject} 다음 수업 계획 선택`,
                                    )
                                  }
                                  className="rounded-2xl bg-[#404040] px-3 py-2 text-xs font-black text-white disabled:bg-[#cfc2e8]"
                                  disabled={!record.subject.trim()}
                                >
                                  계획 선택
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    hideSubjectSection(record.id, "plan")
                                  }
                                  className="rounded-2xl border border-[#d4d4d4] bg-white px-3 py-2 text-xs font-black text-[#404040]"
                                >
                                  닫기
                                </button>
                              </div>
                            </div>

                            {selectedPlanTasks.length === 0 ? (
                              <p className="rounded-2xl border border-dashed border-[#d4d4d4] bg-[#f7f7f7] px-4 py-4 text-sm font-semibold text-[#525252]">
                                아직 선택한 다음 수업 계획이 없어요.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {selectedPlanTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="rounded-2xl border border-[#d4d4d4] bg-[#f7f7f7] px-4 py-3 text-sm font-bold text-[#171717]"
                                  >
                                    {taskLabel(task)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-[2rem] border border-[#e5e5e5] bg-[#f7f7f7] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#171717]">
                  수업 내용 / 메모
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#525252]">
                  필요한 것만 추가하면 입력 박스가 열려요.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!showContentBox && (
                  <button
                    type="button"
                    onClick={() => setShowContentBox(true)}
                    className="rounded-full bg-[#171717] px-4 py-2 text-xs font-black text-white"
                  >
                    + 수업 내용 추가
                  </button>
                )}
                {!showMemoBox && (
                  <button
                    type="button"
                    onClick={() => setShowMemoBox(true)}
                    className="rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-xs font-black text-[#171717]"
                  >
                    + 메모 추가
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {showContentBox && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-[#5c5751]">
                      수업 내용
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowContentBox(false);
                        setContent("");
                      }}
                      className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-[11px] font-black text-[#171717]"
                    >
                      닫기
                    </button>
                  </div>

                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    placeholder="예: 오늘 전체적으로 다룬 내용, 학생 반응, 보충 설명한 부분"
                    className="w-full resize-none rounded-3xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>
              )}

              {showMemoBox && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-bold text-[#5c5751]">
                      메모
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMemoBox(false);
                        setMemo("");
                      }}
                      className="rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-[11px] font-black text-[#171717]"
                    >
                      닫기
                    </button>
                  </div>

                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    rows={5}
                    placeholder="예: 집중도 좋음 / 다음 수업에서 다시 확인 필요 / 학부모님께 전달할 내용"
                    className="w-full resize-none rounded-3xl border border-[#e5e5e5] bg-white px-4 py-3 outline-none"
                  />
                </div>
              )}

              {!showContentBox && !showMemoBox && (
                <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-white px-5 py-5 text-sm font-semibold text-[#525252] lg:col-span-2">
                  수업 내용이나 메모가 필요하면 오른쪽 버튼으로 추가해줘.
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={saveRecord}
            disabled={loading}
            className="mt-7 w-full rounded-3xl bg-[#171717] px-4 py-4 text-center text-sm font-black text-white shadow-sm disabled:bg-[#a3a3a3]"
          >
            {loading ? "저장 중..." : "수정 저장하기"}
          </button>
        </section>
      </div>

      {pickerState && pickerRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5e5e5] bg-[#ffffff] px-6 py-5">
              <div>
                <p className="text-sm font-black text-[#525252]">
                  {pickerState.title}
                </p>

                <h2 className="mt-1 text-2xl font-black text-[#171717]">
                  시험범위표에서 선택하기
                </h2>

                <p className="mt-2 text-sm text-[#525252]">
                  {pickerStatusHelpText(pickerState.field)} 여러 개 선택 후 선택
                  완료를 눌러줘.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTaskPicker}
                className="rounded-2xl border border-[#e5e5e5] bg-white px-4 py-2 text-sm font-black text-[#171717]"
              >
                닫기
              </button>
            </div>

            <div className="max-h-[62vh] overflow-auto p-6">
              {pickerRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] px-5 py-8 text-center text-sm font-bold text-[#525252]">
                  이 과목의 시험범위 항목이 없어요.
                </div>
              ) : (
                <div className="space-y-4">
                  {(
                    Object.entries(groupRowsByMaterial(pickerRows)) as [
                      string,
                      ExamProgress[],
                    ][]
                  ).map(([materialNameKey, materialRows]) => {
                    const sortedMaterialRows = [...materialRows].sort(
                      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
                    );
                    const materialDisplayName = materialLabel(
                      sortedMaterialRows[0],
                    );
                    const taskNames = pickerTaskNames;

                    if (taskNames.length === 0) return null;

                    return (
                      <div
                        key={`${pickerSubject}-${materialNameKey}`}
                        className="overflow-x-auto rounded-3xl border border-[#e5e5e5] bg-white"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#171717]">
                              {materialDisplayName}
                            </span>
                            <span className="text-xs font-bold text-[#525252]">
                              시험범위 진도표와 같은 형태로 보여요
                            </span>
                          </div>
                        </div>

                        <table className="w-full min-w-[760px] border-collapse bg-white text-sm">
                          <thead>
                            <tr className="border-b border-[#e5e5e5] bg-[#f5f5f5]">
                              <th className="w-[170px] px-3 py-3 text-left text-xs font-black text-[#171717]">
                                범위
                              </th>
                              {taskNames.map((taskName) => (
                                <th
                                  key={taskName}
                                  className="min-w-[108px] px-2 py-3 text-center text-xs font-black text-[#171717]"
                                >
                                  {taskName}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {sortedMaterialRows.map((row) => {
                              const statuses = row.statuses || {};
                              const currentMajorUnit =
                                row.major_unit || "대단원 미입력";
                              const showSubUnit =
                                row.unit_name && !isDuplicateSubUnit(row);

                              return (
                                <tr
                                  key={row.id}
                                  className="border-b border-[#e5e5e5] last:border-b-0"
                                >
                                  <td className="w-[170px] px-3 py-3 align-top">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full bg-[#e5e5e5] px-2.5 py-1 text-xs font-black text-[#171717]">
                                          {currentMajorUnit}
                                        </span>
                                        {showSubUnit && (
                                          <span className="rounded-full bg-[#ffffff] px-2.5 py-1 text-[11px] font-bold text-[#525252]">
                                            {row.unit_name}
                                          </span>
                                        )}
                                      </div>
                                      {row.memo && (
                                        <p className="mt-1.5 text-xs font-semibold text-[#525252]">
                                          {row.memo}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {taskNames.map((taskName) => {
                                    const rawStatus = statuses[taskName];
                                    const originalStatus =
                                      normalizeStatus(rawStatus);
                                    const taskId = makeTaskId(row.id, taskName);
                                    const normalizedStatus =
                                      getLinkedStatusForPicker(
                                        taskId,
                                        originalStatus,
                                      );
                                    const canSelect =
                                      rawStatus !== undefined &&
                                      normalizedStatus !== "done";
                                    const selected =
                                      draftSelectedIds.includes(taskId);
                                    const statusClass =
                                      STATUS_STYLES[normalizedStatus] ||
                                      "border-[#e5e5e5] bg-[#f7f7f7] text-[#525252]";

                                    return (
                                      <td
                                        key={`${row.id}-${taskName}`}
                                        className="px-2 py-3 text-center align-top"
                                      >
                                        {rawStatus === undefined ? (
                                          <span className="text-xs font-bold text-[#d1c1c7]">
                                            -
                                          </span>
                                        ) : canSelect ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleDraftTask(taskId)
                                            }
                                            className={`min-w-[94px] rounded-xl border px-2 py-2 text-center text-xs font-black outline-none transition ${statusClass} ${
                                              selected
                                                ? "ring-2 ring-[#171717] ring-offset-2"
                                                : "hover:-translate-y-0.5"
                                            }`}
                                          >
                                            {selected
                                              ? "✓ 선택"
                                              : statusLabel(normalizedStatus)}
                                          </button>
                                        ) : (
                                          <span
                                            className={`inline-flex min-w-[94px] justify-center rounded-xl border px-2 py-2 text-xs font-black ${statusClass}`}
                                          >
                                            {statusLabel(normalizedStatus)}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}

              {pickerState.field === "homework_item_ids" && pickerRecord && (
                <div className="mt-5 rounded-3xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
                  <label className="mb-2 block text-sm font-black text-[#171717]">
                    시험범위표 외 기타 숙제{" "}
                    <span className="font-bold text-[#171717]">
                      (한 줄에 하나씩 여러 개 가능)
                    </span>
                  </label>
                  <textarea
                    value={pickerRecord.manual_homework_text}
                    onChange={(e) =>
                      updateManualHomeworkText(pickerRecord.id, e.target.value)
                    }
                    rows={3}
                    placeholder="예: 프린트 3쪽 풀기\n단어 1~30번 암기"
                    className="w-full resize-none rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#e5e5e5] bg-[#ffffff] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-[#525252]">
                선택한 항목 {draftSelectedIds.length}개
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeTaskPicker}
                  className="rounded-2xl border border-[#e5e5e5] bg-white px-5 py-3 text-sm font-black text-[#171717]"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={confirmTaskPicker}
                  className="rounded-2xl bg-[#171717] px-5 py-3 text-sm font-black text-white"
                >
                  선택 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
