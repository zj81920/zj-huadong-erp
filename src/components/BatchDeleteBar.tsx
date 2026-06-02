"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import Modal from "./Modal";

interface BatchDeleteBarProps {
  businessType: string;
  selectedIds: string[];
  onDeleteSuccess: () => void;
  onClear: () => void;
}

export function BatchDeleteBar({
  businessType,
  selectedIds,
  onDeleteSuccess,
  onClear,
}: BatchDeleteBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleBatchDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, ids: selectedIds }),
      });
      if (res.ok) {
        setShowConfirm(false);
        onClear();
        onDeleteSuccess();
      } else {
        const json = await res.json();
        alert(json.error || "批量删除失败");
        setShowConfirm(false);
      }
    } catch {
      alert("网络错误，请重试");
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-4 z-10 flex items-center justify-between bg-[#6B7280] text-white rounded-2xl px-5 py-3 shadow-lg mx-1">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold">
            已选 {selectedIds.length} 项
          </span>
          <button
            className="text-white/70 hover:text-white transition-colors"
            onClick={onClear}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-[13px] font-semibold px-4 py-1.5 rounded-full transition-colors"
          onClick={() => setShowConfirm(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          批量删除
        </button>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => !deleting && setShowConfirm(false)}
        title="确认批量删除"
        maxWidth="400px"
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#6B7280]/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-[#6B7280]" />
          </div>
          <p className="text-[15px] text-[#111827] mb-1">
            确定要删除这 <span className="font-semibold">{selectedIds.length}</span> 条记录吗？
          </p>
          <p className="text-[13px] text-[#6B7280] mb-6">此操作不可撤销</p>
          <div className="flex justify-center gap-3">
            <button
              className="ios-btn ios-btn-secondary"
              onClick={() => setShowConfirm(false)}
              disabled={deleting}
            >
              取消
            </button>
            <button
              className="ios-btn ios-btn-danger"
              onClick={handleBatchDelete}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
