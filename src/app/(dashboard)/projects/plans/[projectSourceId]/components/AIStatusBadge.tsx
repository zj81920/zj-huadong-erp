interface Props {
  status: "ontrack" | "delayed" | "none" | "done";
  reason: string;
}

export default function AIStatusBadge({ status, reason }: Props) {
  if (status === "ontrack") {
    return (
      <span title={reason} style={{ fontSize: 14, color: "#7DA88E" }}>✅</span>
    );
  }
  if (status === "delayed") {
    return (
      <span title={reason} style={{ fontSize: 14, color: "#C47676" }}>⚠️</span>
    );
  }
  if (status === "done") {
    return (
      <span title={reason} style={{ fontSize: 14, color: "#5A7A9A" }}>✅</span>
    );
  }
  return <span style={{ color: "#D6D3D1", fontSize: 14 }}>—</span>;
}
