interface Props {
  status: "ontrack" | "delayed" | "none";
  reason: string;
}

export default function AIStatusBadge({ status, reason }: Props) {
  if (status === "ontrack") {
    return (
      <span title={reason} style={{ color: "#22C55E", fontSize: 16, fontWeight: 700 }}>✓</span>
    );
  }
  if (status === "delayed") {
    return (
      <span title={reason} style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, borderRadius: "50%",
        background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 700,
      }}>!</span>
    );
  }
  return <span style={{ color: "#D6D3D1", fontSize: 12 }}>-</span>;
}
