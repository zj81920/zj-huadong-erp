"use client";

import { useState } from "react";
import { Search, Building2, X, Check } from "lucide-react";
import Modal from "./Modal";

export interface SupplierItem {
  id: string;
  name: string;
  supplierType?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  approvalStatus?: string | null;
}

interface SupplierPickerSingleProps {
  suppliers: SupplierItem[];
  value: string;
  onChange: (supplierId: string, supplier: SupplierItem) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  multiple?: false;
}

interface SupplierPickerMultiProps {
  suppliers: SupplierItem[];
  value: string[];
  onChange: (supplierIds: string[]) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  multiple: true;
}

type SupplierPickerProps = SupplierPickerSingleProps | SupplierPickerMultiProps;

export default function SupplierPicker(props: SupplierPickerProps) {
  const {
    suppliers,
    value,
    onChange,
    label = "供应商",
    placeholder = "请选择供应商",
    required = false,
    multiple = false,
  } = props;

  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState("");

  const selectedIds: string[] = multiple ? (value as string[]) : (value ? [value as string] : []);

  const selectedSuppliers = suppliers.filter((s) => selectedIds.includes(s.id));

  const filtered = suppliers.filter((s) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.supplierType?.toLowerCase().includes(q) ?? false) ||
      (s.contactPerson?.toLowerCase().includes(q) ?? false) ||
      (s.phone?.includes(q) ?? false)
    );
  });

  const handleSelect = (id: string) => {
    if (multiple) {
      const current = selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id];
      (onChange as (ids: string[]) => void)(current);
    } else {
      (onChange as (id: string, s: SupplierItem) => void)(id, suppliers.find((s) => s.id === id)!);
      setShowPicker(false);
      setSearchText("");
    }
  };

  const handleRemove = (id: string) => {
    if (multiple) {
      (onChange as (ids: string[]) => void)(selectedIds.filter((i) => i !== id));
    } else {
      (onChange as (id: string, s: SupplierItem) => void)("", {} as SupplierItem);
    }
  };

  return (
    <>
      <div>
        {label && (
          <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
            {label} {required && <span className="text-[#78716C]">*</span>}
          </label>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center ios-input min-h-[40px] flex-wrap gap-1 py-1.5 px-3">
            {selectedSuppliers.length > 0 ? (
              <>
                {selectedSuppliers.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1C1917]/10 rounded-lg text-[12px] font-medium text-[#1C1917]"
                  >
                    <Building2 className="w-3 h-3 text-[#78716C]" />
                    {s.name}
                    {!required && (
                      <button
                        type="button"
                        className="w-3.5 h-3.5 rounded-full hover:bg-[#1C1917]/20 flex items-center justify-center"
                        onClick={() => handleRemove(s.id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-[13px] text-[#78716C]">{placeholder}</span>
            )}
          </div>
          <button
            type="button"
            className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917] whitespace-nowrap"
            onClick={() => {
              setSearchText("");
              setShowPicker(true);
            }}
          >
            <Search className="w-3.5 h-3.5" />
            选择供应商
          </button>
        </div>
      </div>

      <Modal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        title={multiple ? `选择供应商（已选 ${selectedIds.length} 家）` : "选择供应商"}
        maxWidth="640px"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索供应商名称、性质、联系人、电话..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-[#E7E5E4]">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>供应商名称</th>
                  <th>性质</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <tr key={s.id} className={isSelected ? "bg-[#1C1917]/5" : ""}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                          <span className="font-semibold text-[#1C1917]">
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        {s.supplierType ? (
                          <span className="ios-badge ios-badge-gray text-[11px]">
                            {s.supplierType}
                          </span>
                        ) : (
                          <span className="text-[#78716C]">-</span>
                        )}
                      </td>
                      <td className="text-[#78716C]">
                        {s.contactPerson || "-"}
                      </td>
                      <td className="text-[#78716C] font-mono text-[12px]">
                        {s.phone || "-"}
                      </td>
                      <td>
                        <button
                          className={`ios-btn ios-btn-sm ${
                            isSelected
                              ? "ios-btn-primary"
                              : "ios-btn-secondary"
                          }`}
                          onClick={() => handleSelect(s.id)}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3 h-3" />
                              已选择
                            </>
                          ) : (
                            "选择"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-[#78716C]"
                    >
                      {searchText
                        ? "无匹配供应商"
                        : "暂无供应商，请先在供应商管理中添加"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowPicker(false)}
            >
              {multiple ? "完成" : "关闭"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
