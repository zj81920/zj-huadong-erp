import React from 'react'

interface DetailGridProps {
  fields: { label: string; value: React.ReactNode }[]
  columns?: 1 | 2
}

export function DetailGrid({ fields, columns = 2 }: DetailGridProps) {
  if (fields.length === 0) return null

  return (
    <div className={`grid gap-3 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {fields.map((field, index) => (
        <div key={index} className="p-3 rounded-xl bg-[#FAFAF9]">
          <p className="text-[12px] text-[#78716C] mb-1">{field.label}</p>
          <p className="text-[14px] font-semibold truncate">{field.value != null && field.value !== '' ? field.value : '-'}</p>
        </div>
      ))}
    </div>
  )
}
