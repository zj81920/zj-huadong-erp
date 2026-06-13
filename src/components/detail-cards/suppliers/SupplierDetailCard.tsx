import { DetailGrid } from '../DetailGrid'

interface Props {
  data: any
}

export function SupplierDetailCard({ data }: Props) {
  const fields = [
    { label: "供应商名称", value: data?.name },
    { label: "供应商性质", value: data?.supplierType },
    { label: "联系人", value: data?.contactPerson },
    { label: "电话", value: data?.phone },
    { label: "邮箱", value: data?.email },
    { label: "地址", value: data?.address },
    { label: "开户行", value: data?.bankName },
    { label: "银行账号", value: data?.bankAccount },
    { label: "状态", value: data?.status },
    {
      label: "附件",
      value: data?.attachmentUrls && Array.isArray(data.attachmentUrls) && data.attachmentUrls.length > 0 ? (
        <div className="space-y-1">
          {(data.attachmentUrls as string[]).map((url: string, idx: number) => (
            <div key={idx}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline text-[13px] break-all">
                {decodeURIComponent(url.split('/').pop() || `文件${idx + 1}`)}
              </a>
            </div>
          ))}
        </div>
      ) : null,
    },
  ];
  return <DetailGrid fields={fields} />;
}
