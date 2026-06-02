"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Modal from "./Modal";

export interface ProjectLeadItem {
  projectSourceId: string;
  projectName: string;
  customerId: string;
  customer: { id: string; name: string };
  currentStatus: string;
  project: { id: string; projectCode: string; name: string; status: string } | null;
}

interface ProjectPickerProps {
  projectLeads: ProjectLeadItem[];
  value: string;
  onChange: (projectSourceId: string, lead: ProjectLeadItem) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  showCustomer?: boolean;
}

export default function ProjectPicker({
  projectLeads,
  value,
  onChange,
  label = "关联项目",
  placeholder = "不关联项目",
  allowEmpty = true,
  emptyLabel = "不关联项目",
  required = false,
  showCustomer = true,
}: ProjectPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [searchText, setSearchText] = useState("");

  const selectedLead = projectLeads.find((l) => l.projectSourceId === value);

  const displayText = selectedLead
    ? (() => {
        const code = selectedLead.project?.projectCode;
        const name = selectedLead.project?.name || selectedLead.projectName;
        return code ? `${code} - ${name}` : `${selectedLead.projectSourceId} - ${name}`;
      })()
    : "";

  const filteredLeads = projectLeads.filter((l) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      l.projectSourceId.toLowerCase().includes(q) ||
      (l.project?.projectCode?.toLowerCase().includes(q) ?? false) ||
      (l.project?.name?.toLowerCase().includes(q) ?? false) ||
      l.projectName.toLowerCase().includes(q) ||
      l.customer.name.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div>
        {label && (
          <label className="block text-[13px] font-semibold text-[#1D1D1F] mb-1.5">
            {label} {required && <span className="text-[#FF3B30]">*</span>}
          </label>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center ios-input min-h-[40px]">
            {selectedLead ? (
              <>
                <span className="flex-1 truncate text-[13px]">
                  {selectedLead.project?.projectCode ? (
                    <span className="font-mono font-semibold text-[#007AFF]">{selectedLead.project.projectCode}</span>
                  ) : (
                    <span className="font-mono font-semibold text-[#007AFF]">{selectedLead.projectSourceId}</span>
                  )}
                  <span className="mx-1">-</span>
                  <span>{selectedLead.project?.name || selectedLead.projectName}</span>
                </span>
                {!required && (
                  <button
                    type="button"
                    className="ml-1"
                    onClick={() => onChange("", {} as ProjectLeadItem)}
                  >
                    <svg className="w-4 h-4 text-[#86868B] hover:text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <span className="flex-1 text-[13px] text-[#86868B]">{placeholder}</span>
            )}
          </div>
          <button
            type="button"
            className="ios-btn ios-btn-ghost ios-btn-sm text-[#007AFF] whitespace-nowrap"
            onClick={() => {
              setSearchText("");
              setShowPicker(true);
            }}
          >
            <Search className="w-3.5 h-3.5" />
            选择项目
          </button>
        </div>
      </div>

      <Modal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        title="选择关联项目"
        maxWidth="720px"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input
              type="text"
              className="ios-input pl-10"
              placeholder="搜索项目源ID、立项编号、项目名称、客户名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-xl border border-[#E5E5EA]">
            <table className="ios-table">
              <thead>
                <tr>
                  <th>项目源ID</th>
                  <th>立项编号</th>
                  <th>项目名称</th>
                  {showCustomer && <th>客户</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((l) => (
                  <tr key={l.projectSourceId}>
                    <td>
                      <span className="font-mono text-[13px] font-semibold text-[#007AFF]">
                        {l.projectSourceId}
                      </span>
                    </td>
                    <td className="font-mono text-[13px]">
                      {l.project?.projectCode || "-"}
                    </td>
                    <td className="font-semibold">
                      {l.project?.name || l.projectName}
                    </td>
                    {showCustomer && <td>{l.customer.name}</td>}
                    <td>
                      <button
                        className={`ios-btn ios-btn-sm ${
                          value === l.projectSourceId
                            ? "ios-btn-primary"
                            : "ios-btn-secondary"
                        }`}
                        onClick={() => {
                          onChange(l.projectSourceId, l);
                          setShowPicker(false);
                          setSearchText("");
                        }}
                      >
                        {value === l.projectSourceId ? "已选择" : "选择"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={showCustomer ? 5 : 4} className="text-center py-8 text-[#86868B]">
                      无匹配项目
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
              关闭
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
