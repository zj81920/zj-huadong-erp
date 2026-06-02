export const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatMoney = (amount: number | null) => {
  if (!amount) return "-";
  return `¥${Number(amount).toLocaleString("zh-CN")}`;
};
