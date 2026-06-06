import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ contractType?: string; contractId?: string; edit?: string }>;
}

export default async function NewChangeOrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.contractType) params.set("contractType", sp.contractType);
  if (sp.contractId) params.set("contractId", sp.contractId);
  if (sp.edit) params.set("edit", sp.edit);
  const qs = params.toString();
  redirect(`/contracts/change-orders${qs ? `?${qs}` : ""}`);
}
