"use client";

interface WbsAlertBarProps {
  totalTasks: number;
  delayedTasks: number;
  aheadTasks: number;
  overallProgress: number;
}

export default function WbsAlertBar({ totalTasks, delayedTasks, aheadTasks, overallProgress }: WbsAlertBarProps) {
  if (totalTasks === 0) return null;

  const normalTasks = totalTasks - delayedTasks;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "10px 20px", background: delayedTasks > 0 ? "#FFF5F5" : "#F6FAF7",
      borderBottom: "1px solid #DFE3E8", fontSize: 13,
    }}>
      <span style={{ fontWeight: 600, color: "#1C1917" }}>预警摘要</span>
      {delayedTasks > 0 ? (
        <span style={{ color: "#C47676" }}>
          ⚠️ 延误 <b>{delayedTasks}</b> 项
        </span>
      ) : (
        <span style={{ color: "#7DA88E" }}>✅ 无延误</span>
      )}
      {aheadTasks > 0 && (
        <span style={{ color: "#7DA88E" }}>🚀 提前 <b>{aheadTasks}</b> 项</span>
      )}
      <span style={{ color: "#57534E" }}>正常 <b>{normalTasks}</b> 项</span>
      <span style={{ marginLeft: "auto", fontWeight: 600, color: "#1C1917" }}>
        整体进度 {overallProgress}%
      </span>
    </div>
  );
}
