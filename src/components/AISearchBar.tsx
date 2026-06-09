"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Sparkles, FileText, Image, File, X, Loader2, MessageSquare } from "lucide-react";

interface SourceFile {
  fileKey: string;
  fileName: string;
  fileType: string;
  score: number;
  previewUrl: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <Image className="w-4 h-4 text-[#78716C]" />;
  }
  if (["pdf"].includes(ext)) {
    return <FileText className="w-4 h-4 text-[#78716C]" />;
  }
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return <FileText className="w-4 h-4 text-[#1C1917]" />;
  }
  return <File className="w-4 h-4 text-[#78716C]" />;
}

export default function AISearchBar() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doAsk = useCallback(async (q: string) => {
    if (!q.trim()) {
      setAnswer("");
      setSources([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsOpen(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).error || "问答失败");
        setAnswer("");
        setSources([]);
        return;
      }

      // 流式读取 SSE 响应
      const reader = res.body?.getReader();
      if (!reader) {
        setError("无法读取响应流");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.type === "token") {
              setAnswer((prev) => prev + parsed.data);
            } else if (parsed.type === "sources") {
              setSources(parsed.data);
            } else if (parsed.type === "error") {
              setError(parsed.data);
            }
            // type: "done" → 忽略，流自然结束
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    } catch {
      setError("网络请求失败");
      setAnswer("");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setAnswer("");
      setSources([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doAsk(value);
    }, 800);
  };

  const handleClear = () => {
    setQuery("");
    setAnswer("");
    setSources([]);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const handlePreview = (url: string) => {
    window.open(url, "_blank");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
    if (e.key === "Enter" && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doAsk(query);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* 搜索输入框 */}
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all duration-200 ${
          isOpen
            ? "border-[#1C1917]/30 bg-white shadow-[0_0_0_3px_rgba(0,122,255,0.1)]"
            : "border-[#E7E5E4] bg-[#FAFAF9] hover:bg-[#EDEDF0] hover:border-[#D1D5DB]"
        }`}
      >
        <Sparkles className="w-4 h-4 text-[#78716C] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (answer || error) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="AI 智能问答，输入问题检索文件..."
          className="flex-1 bg-transparent text-sm text-[#1C1917] placeholder-[#78716C] outline-none"
        />
        {loading && <Loader2 className="w-4 h-4 text-[#1C1917] animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={handleClear} className="p-0.5 rounded-full hover:bg-[#E7E5E4] transition-colors">
            <X className="w-3.5 h-3.5 text-[#78716C]" />
          </button>
        )}
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-[#78716C] bg-[#E7E5E4] rounded-md px-1.5 py-0.5 flex-shrink-0">
          ⌘K
        </kbd>
      </div>

      {/* 问答结果下拉 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[100]">
          {/* 头部 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F2F2F7]">
            <MessageSquare className="w-3.5 h-3.5 text-[#78716C]" />
            <span className="text-xs text-[#78716C]">
              {loading
                ? "AI 正在检索并回答..."
                : error
                ? "检索出错"
                : answer
                ? "AI 回答"
                : "等待提问..."}
            </span>
          </div>

          {/* 回答内容 */}
          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#78716C]">{error}</p>
            </div>
          ) : answer ? (
            <div className="max-h-[400px] overflow-y-auto">
              {/* AI 回答 */}
              <div className="px-4 py-3">
                <div className="text-sm text-[#1C1917] whitespace-pre-wrap leading-relaxed">
                  {answer}
                </div>
              </div>

              {/* 来源文件 */}
              {sources.length > 0 && (
                <div className="border-t border-[#F2F2F7]">
                  <div className="px-4 py-2">
                    <span className="text-[11px] text-[#A8A29E] font-medium">来源文件</span>
                  </div>
                  {sources.map((source) => (
                    <button
                      key={source.fileKey}
                      onClick={() => handlePreview(source.previewUrl)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAF9] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#F2F2F7] flex items-center justify-center flex-shrink-0">
                        {getFileIcon(source.fileName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#1C1917] truncate">
                          {source.fileName}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#78716C] flex-shrink-0">
                        {Math.round(source.score * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : !loading ? (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
              <p className="text-sm text-[#78716C]">输入问题，AI 将检索文件并回答</p>
              <p className="text-[11px] text-[#A8A29E] mt-1">
                支持 PDF、Word、Excel 等文件内容检索
              </p>
            </div>
          ) : null}

          {/* 底部提示 */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#F2F2F7] bg-[#FFFFFF]">
            <span className="text-[10px] text-[#A8A29E]">
              基于 pgvector 向量检索 + AI 问答
            </span>
            <span className="text-[10px] text-[#A8A29E]">
              点击文件可预览
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
