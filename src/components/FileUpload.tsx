"use client";

import { useState, useRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface FileUploadProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
}

function extractFilename(url: string): string {
  const segments = url.split("/");
  const last = segments[segments.length - 1];
  return decodeURIComponent(last);
}

export default function FileUpload({
  label,
  value,
  onChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png",
}: FileUploadProps) {
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

      onChange(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-[#1C1917]">
        {label}
      </label>

      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAF9] border border-[#E7E5E4]">
          <div className="w-9 h-9 rounded-lg bg-[#1C1917]/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4.5 h-4.5 text-[#1C1917]" />
          </div>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-sm text-[#1C1917] hover:underline truncate"
          >
            {extractFilename(value)}
          </a>
          <button
            type="button"
            onClick={handleRemove}
            className="w-7 h-7 rounded-full bg-[#78716C]/10 hover:bg-[#78716C]/20 flex items-center justify-center transition-colors duration-150 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5 text-[#78716C]" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
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
            onChange={handleFileChange}
            className="hidden"
          />

          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-[#1C1917] animate-spin" />
              <div className="text-sm text-[#78716C]">上传中...</div>
              <div className="w-full max-w-[200px] h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1C1917] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-[#78716C]">{progress}%</div>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-[#78716C]" />
              <div className="text-sm text-[#78716C]">
                点击或拖拽文件到此处上传
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
