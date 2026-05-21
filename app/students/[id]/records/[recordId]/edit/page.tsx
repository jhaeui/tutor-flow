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
};

type SubjectRecord = {
  id: string;
  subject: string;
  subjectInputMode: SubjectInputMode;
  isEditingSubject: boolean;
  progress_item_ids: string[];
  homework_item_ids: string[];
};

type SavedTask = {
  progress_id: string;
  subject: string;
  unit_name: string;
  task_name: string;
  before_status: string;
  publisher?: string | null;
  material_name?: string | null;
};

type PickerState = {
  recordId: string;
  field: "progress_item_ids" | "homework_item_ids";
  title: string;
} | null;

const SUBJECTS: BasicSubjectName[] = ["국어", "영어", "수학", "사회", "과학", "한국사"];

const SELECTABLE_STATUSES = ["not_started", "in_progress"];
const PREVIOUS_HOMEWORK_STATUS = "homework";

const STATUS_LABELS: Record<string, string> = {
  not_started: "미완료",
  in_progress: "진행중",
  done: "완료",
  review: "다시보기",
  homework: "숙제",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-white text-[#8b767c] border-[#ead9de]",
  in_progress: "bg-[#fff8e8] text-[#8a6630] border-[#ead6af]",
  done: "bg-[#eef8f2] text-[#47735b] border-[#cce6d6]",
  review: "bg-[#f4f1ff] text-[#6656a6] border-[#d8d0f2]",
  homework: "bg-[#fff1f4] text-[#9f5264] border-[#efcbd4]",
};

const subjectBadgeStyle: Record<string, string> = {
  국어: "bg-[#fff1f4] text-[#9f5264] border-[#efcbd4]",
  영어: "bg-[#fdf2f6] text-[#96576b] border-[#ebcbd6]",
  수학: "bg-[#f4f1ff] text-[#6656a6] border-[#d8d0f2]",
  사회: "bg-[#fff7e8] text-[#8a6630] border-[#ead6af]",
  과학: "bg-[#eef8f2] text-[#47735b] border-[#cce6d6]",
  한국사: "bg-[#f8f1ea] text-[#7b604d] border-[#e3d1c3]",
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

function taskLabel(task: SelectableTask) {
  const publisher = task.publisher ? `[${task.publisher}] ` : "";
  const material = task.materialName ? `${task.materialName} ` : "";

  return `${publisher}${material}${task.unitName} - ${task.taskName}`;
}

function makeSubjectRecord(subject = "영어", isEditingSubject = false): SubjectRecord {
  return {
    id: makeLocalId(),
    subject,
    subjectInputMode: SUBJECTS.includes(subject as BasicSubjectName) ? "preset" : "custom",
    isEditingSubject,
    progress_item_ids: [],
    homework_item_ids: [],
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

  const [examProgressList, setExamProgressList] = useState<ExamProgress[]>([]);
  const [completedPreviousHomeworkIds, setCompletedPreviousHomeworkIds] = useState<string[]>([]);

  const [subjectRecords, setSubjectRecords] = useState<SubjectRecord[]>([
    makeSubjectRecord("영어"),
  ]);

  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [draftSelectedIds, setDraftSelectedIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const totalMinutes = useMemo(
    () => calculateDurationMinutes(startTime, endTime),
    [startTime, endTime]
  );

  const durationText = useMemo(() => formatMinutes(totalMinutes), [totalMinutes]);

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

  const billableText = useMemo(() => formatMinutes(billableMinutes), [billableMinutes]);
  const extraText = useMemo(() => formatMinutes(parsedExtraMinutes), [parsedExtraMinutes]);

  const allTasks = useMemo<SelectableTask[]>(() => {
    return examProgressList.flatMap((progress) => {
      const statuses = progress.statuses || {};

      return Object.entries(statuses).map(([taskName, status]) => ({
        id: makeTaskId(progress.id, taskName),
        progressId: progress.id,
        subject: progress.subject,
        unitName: progress.unit_name,
        taskName,
        status: normalizeStatus(status as string),
        publisher: progress.publisher,
        materialName: progress.material_name,
      }));
    });
  }, [examProgressList]);

  const selectableTasks = useMemo(() => {
    return allTasks.filter((task) => SELECTABLE_STATUSES.includes(task.status));
  }, [allTasks]);

  const previousHomeworkTasks = useMemo(() => {
    return allTasks.filter((task) => task.status === PREVIOUS_HOMEWORK_STATUS);
  }, [allTasks]);

  const pickerRecord = useMemo(() => {
    if (!pickerState) return null;
    return subjectRecords.find((record) => record.id === pickerState.recordId) || null;
  }, [pickerState, subjectRecords]);

  const pickerSubject = pickerRecord?.subject || "영어";

  const pickerRows = useMemo(() => {
    return examProgressList.filter((progress) => progress.subject === pickerSubject);
  }, [examProgressList, pickerSubject]);

  const pickerTaskNames = useMemo(() => {
    const names = pickerRows.flatMap((row) => Object.keys(row.statuses || {}));
    return Array.from(new Set(names));
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
        .select("id, student_id, subject, unit_name, statuses, sort_order, publisher, material_name")
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

      const savedIsExtra = Boolean(recordData.is_extra);
      const savedHasRegularExtra = Boolean(recordData.has_regular_extra);
      const savedExtraMinutes = Number(recordData.extra_minutes || 0);

      setIsExtra(savedIsExtra);
      setHasRegularExtra(savedIsExtra ? false : savedHasRegularExtra);
      setExtraMinutes(savedIsExtra ? "0" : String(savedHasRegularExtra ? savedExtraMinutes : 0));

      const loadedSubjectRecords = Array.isArray(recordData.subject_records)
        ? recordData.subject_records.map((item: any) => {
            const subject = String(item.subject || "영어");
            const progressItems = Array.isArray(item.progress_items)
              ? item.progress_items
              : [];
            const homeworkItems = Array.isArray(item.homework_items)
              ? item.homework_items
              : [];

            return {
              id: makeLocalId(),
              subject,
              subjectInputMode: SUBJECTS.includes(subject as BasicSubjectName)
                ? "preset"
                : "custom",
              isEditingSubject: false,
              progress_item_ids: progressItems
                .map((task: any) => makeTaskId(task.progress_id, task.task_name))
                .filter(Boolean),
              homework_item_ids: homeworkItems
                .map((task: any) => makeTaskId(task.progress_id, task.task_name))
                .filter(Boolean),
            };
          })
        : [];

      setSubjectRecords(
        loadedSubjectRecords.length > 0
          ? loadedSubjectRecords
          : [makeSubjectRecord("영어", true)]
      );

      const checkedHomeworkItems = Array.isArray(recordData.checked_homework_items)
        ? recordData.checked_homework_items
        : [];

      setCompletedPreviousHomeworkIds(
        checkedHomeworkItems
          .map((task: any) => makeTaskId(task.progress_id, task.task_name))
          .filter(Boolean)
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

  function updateSubject(recordId: string, subject: string, mode: SubjectInputMode) {
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
            }
          : record
      )
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
            }
          : record
      )
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
          : record
      )
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
          : record
      )
    );
  }

  function openTaskPicker(
    recordId: string,
    field: "progress_item_ids" | "homework_item_ids",
    title: string
  ) {
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
          : record
      )
    );

    closeTaskPicker();
  }

  function toggleDraftTask(taskId: string) {
    setDraftSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  function togglePreviousHomework(taskId: string) {
    setCompletedPreviousHomeworkIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  function getSelectableTasksBySubject(subject: string) {
    return selectableTasks.filter((task) => task.subject === subject);
  }

  function getSelectedTasks(taskIds: string[]) {
    return taskIds
      .map((taskId) => allTasks.find((task) => task.id === taskId))
      .filter(Boolean) as SelectableTask[];
  }

  function findTaskById(taskId: string) {
    return allTasks.find((task) => task.id === taskId);
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
      }));
  }

  async function updateExamProgressStatuses() {
    const updatesByProgressId: Record<string, Record<string, string>> = {};

    function addUpdate(taskId: string, status: string) {
      const task = findTaskById(taskId);
      if (!task) return;

      if (!updatesByProgressId[task.progressId]) {
        const origin = examProgressList.find((item) => item.id === task.progressId);

        updatesByProgressId[task.progressId] = {
          ...(origin?.statuses || {}),
        };
      }

      updatesByProgressId[task.progressId][task.taskName] = status;
    }

    completedPreviousHomeworkIds.forEach((taskId) => {
      addUpdate(taskId, "done");
    });

    subjectRecords.forEach((record) => {
      record.progress_item_ids.forEach((taskId) => {
        addUpdate(taskId, "done");
      });

      record.homework_item_ids.forEach((taskId) => {
        addUpdate(taskId, "homework");
      });
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
      setErrorMessage("수업시간이 0분이에요. 시작시간과 종료시간을 다시 확인해줘.");
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
        const progressItems = convertToSavedTasks(record.progress_item_ids);
        const homeworkItems = convertToSavedTasks(record.homework_item_ids);

        return {
          subject: record.subject.trim(),
          progress_items: progressItems,
          homework_items: homeworkItems,
        };
      })
      .filter(
        (record) =>
          record.subject &&
          (record.progress_items.length > 0 || record.homework_items.length > 0)
      );

    const checkedHomeworkItems = convertToSavedTasks(completedPreviousHomeworkIds);

    if (
      cleanedSubjectRecords.length === 0 &&
      checkedHomeworkItems.length === 0 &&
      !content.trim() &&
      !memo.trim()
    ) {
      setErrorMessage("진도, 숙제, 저번 숙제 확인, 수업 내용, 메모 중 하나는 입력해줘.");
      return;
    }

    setLoading(true);

    try {
      await updateExamProgressStatuses();

      const regularExtraMinutes = hasRegularExtra ? parsedExtraMinutes : 0;
      const calculatedBillableMinutes = isExtra
        ? 0
        : Math.max(0, totalMinutes - regularExtraMinutes);

      const { error } = await supabase
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
        .eq("student_id", studentId);

      if (error) {
        throw new Error(error.message);
      }

      router.push(`/students/${studentId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "저장 중 오류가 발생했어.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbf7f8] px-5 py-8 text-[#3f3437]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#a87583]">수업 기록 수정</p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#3f3437]">
              {studentName ? `${studentName} 수업 기록` : "수업 기록"}
            </h1>

            
          </div>

          <div className="flex gap-2">
            <Link
              href={`/students/${studentId}`}
              className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 text-sm font-bold text-[#8f6270]"
            >
              상세보기
            </Link>

            <Link
              href="/students"
              className="rounded-2xl bg-[#4a3c40] px-4 py-3 text-sm font-bold text-white"
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

        <section className="rounded-[2rem] border border-[#ead9de] bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                수업 날짜
              </label>

              <input
                type="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                className="w-full rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                시작시간
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                종료시간
              </label>

              <input
                type="time"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
                수업시간
              </label>

              <div className="flex h-[50px] items-center rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 text-sm font-black text-[#9f6c7a]">
                {durationText || "자동 계산"}
              </div>
            </div>
          </div>


          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label
              className={`flex cursor-pointer gap-3 rounded-3xl border p-4 transition ${
                isExtra
                  ? "border-[#c995a4] bg-[#fff1f4]"
                  : "border-[#ead9de] bg-[#fdf9fa]"
              }`}
            >
              <input
                type="checkbox"
                checked={isExtra}
                onChange={(e) => handleIsExtraChange(e.target.checked)}
                className="mt-1 h-4 w-4"
              />

              <div>
                <p className="text-sm font-black text-[#3f3437]">추가수업으로 기록하기</p>
                
              </div>
            </label>

            <div
              className={`rounded-3xl border p-4 transition ${
                hasRegularExtra
                  ? "border-[#c995a4] bg-[#fff1f4]"
                  : "border-[#ead9de] bg-[#fdf9fa]"
              }`}
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  checked={hasRegularExtra}
                  onChange={(e) => handleHasRegularExtraChange(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />

                <div>
                  <p className="text-sm font-black text-[#3f3437]">정규 + 추가수업</p>
                  
                </div>
              </label>

              {hasRegularExtra && (
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-2 block text-xs font-black text-[#8f6270]">
                      추가수업 시간
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={extraMinutes}
                        onChange={(e) => setExtraMinutes(e.target.value)}
                        className="w-full rounded-2xl border border-[#e8d4da] bg-white px-4 py-3 outline-none"
                      />
                      <span className="shrink-0 text-sm font-black text-[#6f5a61]">분</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#ead9de] bg-white px-4 py-3 text-xs font-bold text-[#8b767c]">
                    정규 수업시간: <span className="text-[#9f6c7a]">{billableText || "0분"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          

          <div className="mt-8 rounded-[2rem] border border-[#ead9de] bg-[#fdf9fa] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#3f3437]">저번 숙제 확인</h2>

            
              </div>
            </div>

            {previousHomeworkTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#e5cfd6] bg-white px-5 py-5 text-sm font-semibold text-[#9a838b]">
                확인할 지난 숙제가 없어요.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {previousHomeworkTasks.map((task) => (
                  <label
                    key={task.id}
                    className={`flex cursor-pointer gap-3 rounded-3xl border p-4 transition ${
                      completedPreviousHomeworkIds.includes(task.id)
                        ? "border-[#c995a4] bg-[#fff1f4]"
                        : "border-[#e8d4da] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={completedPreviousHomeworkIds.includes(task.id)}
                      onChange={() => togglePreviousHomework(task.id)}
                      className="mt-1 h-4 w-4"
                    />

                    <div>
                      <p className="text-sm font-black text-[#3f3437]">{task.subject}</p>

                      <p className="mt-1 text-sm font-semibold text-[#6f5a61]">
                        {taskLabel(task)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-[#3f3437]">과목별 진도 / 숙제</h2>
              </div>

              <button
                type="button"
                onClick={addSubjectRecord}
                className="rounded-2xl bg-[#b98594] px-5 py-3 text-sm font-black text-white shadow-sm"
              >
                과목 추가
              </button>
            </div>

            <div className="space-y-5">
              {subjectRecords.map((record) => {
                const tasksForSubject = getSelectableTasksBySubject(record.subject);
                const selectedProgressTasks = getSelectedTasks(record.progress_item_ids);
                const selectedHomeworkTasks = getSelectedTasks(record.homework_item_ids);
                const badgeClass =
                  subjectBadgeStyle[record.subject] ||
                  "bg-[#fffafb] text-[#8f6270] border-[#ead9de]";

                return (
                  <article
                    key={record.id}
                    className="rounded-[2rem] border border-[#ead9de] bg-[#fdf9fa] p-5"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass}`}>
                          {record.subject || "과목 미입력"}
                        </span>

                        {!record.isEditingSubject && (
                          <button
                            type="button"
                            onClick={() => editSubjectName(record.id)}
                            className="rounded-full border border-[#ead9de] bg-white px-3 py-1 text-[13px] font-black text-[#8f6270]"
                          >
                            과목 수정
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSubjectRecord(record.id)}
                        className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-sm font-bold text-[#8f6270]"
                      >
                        삭제
                      </button>
                    </div>

                    {record.isEditingSubject && (
                      <div className="mb-5 rounded-3xl border border-[#ead9de] bg-white p-4">
                        <label className="mb-2 block text-sm font-bold text-[#6f5a61]">과목</label>

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select
                            value={record.subjectInputMode === "custom" ? "직접입력" : record.subject}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "직접입력") {
                                updateSubject(record.id, "", "custom");
                              } else {
                                updateSubject(record.id, value, "preset");
                              }
                            }}
                            className="w-full rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
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
                              className="rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white"
                            >
                              선택 완료
                            </button>
                          )}
                        </div>

                        {record.subjectInputMode === "custom" && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                            <input
                              value={record.subject}
                              onChange={(e) => updateCustomSubject(record.id, e.target.value)}
                              placeholder="예: 문학, 독해, 통합사회, 생명과학"
                              className="w-full rounded-2xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => saveSubjectName(record.id)}
                              className="rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white disabled:bg-[#cdbdc2]"
                              disabled={!record.subject.trim()}
                            >
                              과목 저장
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-[#e8d4da] bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-[#9f6c7a]">오늘 한 진도</p>

                          <button
                            type="button"
                            onClick={() =>
                              openTaskPicker(record.id, "progress_item_ids", `${record.subject} 진도 선택`)
                            }
                            className="rounded-2xl bg-[#4a3c40] px-4 py-2 text-xs font-black text-white disabled:bg-[#cdbdc2]"
                            disabled={!record.subject.trim()}
                          >
                            진도 선택
                          </button>
                        </div>

                        {tasksForSubject.length === 0 ? (
                          <p className="rounded-2xl bg-[#fdf9fa] px-4 py-4 text-sm font-semibold text-[#9a838b]">
                            이 과목의 미완료·진행중 항목이 없어요.
                          </p>
                        ) : selectedProgressTasks.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-[#ead9de] bg-[#fdf9fa] px-4 py-4 text-sm font-semibold text-[#9a838b]">
                            아직 선택한 진도가 없어요.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {selectedProgressTasks.map((task) => (
                              <div
                                key={task.id}
                                className="rounded-2xl border border-[#ead9de] bg-[#fdf9fa] px-4 py-3 text-sm font-bold text-[#3f3437]"
                              >
                                {taskLabel(task)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-[#e8d4da] bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-[#9f6c7a]">오늘의 숙제</p>

                          <button
                            type="button"
                            onClick={() =>
                              openTaskPicker(record.id, "homework_item_ids", `${record.subject} 숙제 선택`)
                            }
                            className="rounded-2xl bg-[#b98594] px-4 py-2 text-xs font-black text-white disabled:bg-[#d8b6c0]"
                            disabled={!record.subject.trim()}
                          >
                            숙제 선택
                          </button>
                        </div>

                        {tasksForSubject.length === 0 ? (
                          <p className="rounded-2xl bg-[#fdf9fa] px-4 py-4 text-sm font-semibold text-[#9a838b]">
                            이 과목에서 숙제로 낼 항목이 없어요.
                          </p>
                        ) : selectedHomeworkTasks.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-[#ead9de] bg-[#fdf9fa] px-4 py-4 text-sm font-semibold text-[#9a838b]">
                            아직 선택한 숙제가 없어요.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {selectedHomeworkTasks.map((task) => (
                              <div
                                key={task.id}
                                className="rounded-2xl border border-[#ead9de] bg-[#fdf9fa] px-4 py-3 text-sm font-bold text-[#3f3437]"
                              >
                                {taskLabel(task)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
              수업 내용
              <span className="ml-1 text-xs font-normal text-[#9a838b]">선택</span>
            </label>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="예: 오늘 전체적으로 다룬 내용, 학생 반응, 보충 설명한 부분"
              className="w-full resize-none rounded-3xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-bold text-[#6f5a61]">
              메모
              <span className="ml-1 text-xs font-normal text-[#9a838b]">선택</span>
            </label>

            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="예: 집중도 좋음 / 다음 수업에서 다시 확인 필요 / 학부모님께 전달할 내용"
              className="w-full resize-none rounded-3xl border border-[#e8d4da] bg-[#fdf9fa] px-4 py-3 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={saveRecord}
            disabled={loading}
            className="mt-7 w-full rounded-3xl bg-[#b98594] px-4 py-4 text-center text-sm font-black text-white shadow-sm disabled:bg-[#d8b6c0]"
          >
            {loading ? "저장 중..." : "기록 저장하기"}
          </button>
        </section>
      </div>

      {pickerState && pickerRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#ead9de] bg-[#fbf7f8] px-6 py-5">
              <div>
                <p className="text-sm font-black text-[#a87583]">{pickerState.title}</p>

                <h2 className="mt-1 text-2xl font-black text-[#3f3437]">
                  시험범위표에서 선택하기
                </h2>

                <p className="mt-2 text-sm text-[#8b767c]">
                  미완료·진행중 항목만 선택할 수 있어요. 여러 개 선택 후 선택 완료를 눌러줘.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTaskPicker}
                className="rounded-2xl border border-[#e8d4da] bg-white px-4 py-2 text-sm font-black text-[#8f6270]"
              >
                닫기
              </button>
            </div>

            <div className="max-h-[62vh] overflow-auto p-6">
              {pickerRows.length === 0 || pickerTaskNames.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#ead9de] bg-[#fdf9fa] px-5 py-8 text-center text-sm font-bold text-[#9a838b]">
                  이 과목의 시험범위 항목이 없어요.
                </div>
              ) : (
                <table className="w-full min-w-[760px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-[#ead9de] text-sm">
                  <thead>
                    <tr className="bg-[#fdf4f6] text-[#6f5a61]">
                      <th className="sticky left-0 z-10 border-b border-r border-[#ead9de] bg-[#fdf4f6] px-4 py-3 text-left font-black">
                        범위
                      </th>

                      {pickerTaskNames.map((taskName) => (
                        <th
                          key={taskName}
                          className="border-b border-r border-[#ead9de] px-4 py-3 text-center font-black last:border-r-0"
                        >
                          {taskName}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {pickerRows.map((row) => {
                      const statuses = row.statuses || {};

                      return (
                        <tr key={row.id} className="bg-white">
                          <td className="sticky left-0 z-10 border-r border-t border-[#ead9de] bg-white px-4 py-3 font-black text-[#3f3437]">
                            <div>{row.unit_name}</div>

                            {(row.publisher || row.material_name) && (
                              <div className="mt-1 text-xs font-bold text-[#9a838b]">
                                {row.publisher ? `[${row.publisher}] ` : ""}
                                {row.material_name || ""}
                              </div>
                            )}
                          </td>

                          {pickerTaskNames.map((taskName) => {
                            const rawStatus = statuses[taskName];
                            const normalizedStatus = normalizeStatus(rawStatus);
                            const taskId = makeTaskId(row.id, taskName);
                            const canSelect =
                              rawStatus !== undefined && SELECTABLE_STATUSES.includes(normalizedStatus);
                            const selected = draftSelectedIds.includes(taskId);

                            return (
                              <td
                                key={`${row.id}-${taskName}`}
                                className="border-r border-t border-[#ead9de] px-3 py-3 text-center last:border-r-0"
                              >
                                {rawStatus === undefined ? (
                                  <span className="text-xs font-bold text-[#d1c1c7]">-</span>
                                ) : canSelect ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleDraftTask(taskId)}
                                    className={`w-full rounded-2xl border px-3 py-2 text-xs font-black transition ${
                                      selected
                                        ? "border-[#b98594] bg-[#fff1f4] text-[#8f6270]"
                                        : "border-[#ead9de] bg-[#fbf7f8] text-[#6f5a61]"
                                    }`}
                                  >
                                    {selected ? "선택됨" : statusLabel(normalizedStatus)}
                                  </button>
                                ) : (
                                  <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                                      STATUS_STYLES[normalizedStatus] ||
                                      "border-[#ead9de] bg-[#fdf9fa] text-[#9a838b]"
                                    }`}
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
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#ead9de] bg-[#fbf7f8] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-[#8b767c]">
                선택한 항목 {draftSelectedIds.length}개
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeTaskPicker}
                  className="rounded-2xl border border-[#e8d4da] bg-white px-5 py-3 text-sm font-black text-[#8f6270]"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={confirmTaskPicker}
                  className="rounded-2xl bg-[#4a3c40] px-5 py-3 text-sm font-black text-white"
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
