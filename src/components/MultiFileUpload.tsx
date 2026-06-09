"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, Loader2, Plus } from "lucide-react";
import { deleteUploadedFile } from "@/lib/upload-helpers";

export interface FileItem {
  url: string;
  name: string;
}

interface MultiFileUploadProps {
  label: string;
  value: FileItem[];
  onChange: (files: FileItem[]) => void;
  accept?: string;
}

function extractFilename(url: string): string {
  const segments = url.split("/");
  const last = segments[segments.length - 1];
  return decodeURIComponent(last);
}

export default function MultiFileUpload({
  label,
  value,
  onChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png",
}: MultiFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();

      const result = await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url || data.data?.url || data.fileUrl);
            } catch {
              reject(new Error("响应解析失败"));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || "上传失败"));
            } catch {
              reject(new Error("上传失败"));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("网络错误")));
        xhr.addEventListener("abort", () => reject(new Error("上传已取消")));

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      const newFile: FileItem = {
        url: result,
        name: file.name || extractFilename(result),
      };
      onChange([...value, newFile]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => uploadFile(f));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((f) => uploadFile(f));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemove = async (index: number) => {
    const file = value[index];
    if (file) await deleteUploadedFile(file.url);
    const updated = [...value];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-[#1C1917]">
        {label}
      </label>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]"
            >
              <div className="w-8 h-8 rounded-lg bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#1C1917]" />
              </div>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-[13px] text-[#1C1917] hover:underline truncate"
              >
                {file.name}
              </a>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="w-6 h-6 rounded-full bg-[#78716C]/10 hover:bg-[#78716C]/20 flex items-center justify-center transition-colors duration-150 flex-shrink-0"
              >
                <X className="w-3 h-3 text-[#78716C]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1C1917]/5 border border-[#1C1917]/20">
          <Loader2 className="w-5 h-5 text-[#1C1917] animate-spin" />
          <div className="flex-1">
            <div className="text-[13px] text-[#1C1917] mb-1">上传中...</div>
            <div className="w-full max-w-[200px] h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1C1917] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="text-[12px] text-[#78716C]">{progress}%</div>
        </div>
      )}

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${uploading
            ? "border-[#1C1917]/40 bg-[#1C1917]/5 pointer-events-none"
            : dragOver
              ? "border-[#1C1917] bg-[#1C1917]/5"
              : "border-[#E7E5E4] bg-[#FAFAF9] hover:border-[#1C1917]/40 hover:bg-[#1C1917]/5"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <Plus className="w-4 h-4 text-[#78716C]" />
        <span className="text-[13px] text-[#78716C]">点击或拖拽添加文件</span>
      </div>
    </div>
  );
}
