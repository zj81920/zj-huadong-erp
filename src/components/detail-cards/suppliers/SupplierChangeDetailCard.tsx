import { DetailGrid } from '../DetailGrid'

interface Props {
  data: any
}

export function SupplierChangeDetailCard({ data }: Props) {
  const fields = [
    { label: "供应商名称", value: data?.name },
    { label: "供应商性质", value: data?.supplierType },
    { label: "状态", value: data?.status },
    { label: "联系人", value: data?.contactPerson },
    { label: "电话", value: data?.phone },
    { label: "邮箱", value: data?.email },
    { label: "地址", value: data?.address },
    { label: "开户行", value: data?.bankName },
    { label: "银行账号", value: data?.bankAccount },
    { label: "审批状态", value: data?.approvalStatus },
    { label: "备注", value: data?.remark },
    {
      label: "附件",
      value: data?.attachmentUrl ? (
        <a href={data.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all">
          {decodeURIComponent(data.attachmentUrl.split('/').pop() || '查看附件')}
        </a>
      ) : null,
    },
  ];
  return <DetailGrid fields={fields} />;
}
