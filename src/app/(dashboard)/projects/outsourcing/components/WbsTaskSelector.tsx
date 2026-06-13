"use client";

import { useEffect, useState } from "react";

interface WbsTask {
  id: string;
  name: string;
  level: number;
  planEndDate: string | null;
  isAvailable: boolean;
  hasResponsible: boolean;
  lockedByOutsourcing: string | null;
}

interface Props {
  projectSourceId: string;
  selectedIds: string[];
  onChange: (selected: string[]) => void;
  excludeOutsourcingId?: string;
  disabled?: boolean;
}

export default function WbsTaskSelector({
  projectSourceId,
  selectedIds,
  onChange,
  excludeOutsourcingId,
  disabled,
}: Props) {
  const [tasks, setTasks] = useState<WbsTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectSourceId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (excludeOutsourcingId) params.set("excludeOutsourcingId", excludeOutsourcingId);
    fetch(`/api/projects/plans/${projectSourceId}/available-tasks?${params}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectSourceId, excludeOutsourcingId]);

  const handleToggle = (taskId: string) => {
    if (disabled) return;
    const next = selectedIds.includes(taskId)
      ? selectedIds.filter((id) => id !== taskId)
      : [...selectedIds, taskId];
    onChange(next);
  };

  if (loading) return <div className="text-sm text-gray-400 p-4">加载中...</div>;
  if (tasks.length === 0) return <div className="text-sm text-gray-400 p-4">无可用的 WBS 任务</div>;

  const availableCount = tasks.filter((t) => t.isAvailable).length;

  return (
    <div className="border rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
      <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
        设计阶段任务 · 可外包 {availableCount} 个
      </div>
      {tasks
        .filter((t) => t.level === 4)
        .map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-2 px-3 py-2 border-b text-xs cursor-pointer transition-colors ${
              selectedIds.includes(task.id)
                ? "bg-blue-50 border-blue-200"
                : task.isAvailable
                ? "hover:bg-gray-50"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={() => task.isAvailable && handleToggle(task.id)}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(task.id)}
              disabled={!task.isAvailable || disabled}
              className="accent-blue-600"
              readOnly
            />
            <span className="flex-1">{task.name}</span>
            {task.planEndDate && (
              <span className="text-gray-400">截止: {task.planEndDate.split("T")[0].slice(5)}</span>
            )}
            {task.lockedByOutsourcing && (
              <span className="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">已被关联</span>
            )}
            {task.isAvailable && !task.hasResponsible && (
              <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px]">无责任人</span>
            )}
          </div>
        ))}
    </div>
  );
}
