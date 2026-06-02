"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Sparkles, FileText, Image, File, X, Loader2 } from "lucide-react";

interface SearchResult {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  score?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <Image className="w-4 h-4 text-[#34C759]" />;
  }
  if (["pdf"].includes(ext)) {
    return <FileText className="w-4 h-4 text-[#FF3B30]" />;
  }
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return <FileText className="w-4 h-4 text-[#007AFF]" />;
  }
  return <File className="w-4 h-4 text-[#86868B]" />;
}

function getScoreColor(score?: number): string {
  if (!score) return "bg-[#86868B]";
  if (score >= 0.8) return "bg-[#34C759]";
  if (score >= 0.5) return "bg-[#FF9500]";
  return "bg-[#FF3B30]";
}

export default function AISearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const res = await fetch(`/api/file/search?q=${encodeURIComponent(q.trim())}&max=10`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "检索失败");
        setResults([]);
      } else {
        setResults(data.results || []);
        setError(null);
      }
    } catch {
      setError("网络请求失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 500);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const handlePreview = async (key: string) => {
    try {
      const res = await fetch(`/api/file/preview?key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {}
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
      doSearch(query);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* 搜索输入框 */}
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all duration-200 ${
          isOpen
            ? "border-[#007AFF]/30 bg-white shadow-[0_0_0_3px_rgba(0,122,255,0.1)]"
            : "border-[#E5E5EA] bg-[#F5F5F7] hover:bg-[#EDEDF0] hover:border-[#D1D1D6]"
        }`}
      >
        <Sparkles className="w-4 h-4 text-[#AF52DE] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || error) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="AI 智能检索文件..."
          className="flex-1 bg-transparent text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none"
        />
        {loading && <Loader2 className="w-4 h-4 text-[#007AFF] animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={handleClear} className="p-0.5 rounded-full hover:bg-[#E5E5EA] transition-colors">
            <X className="w-3.5 h-3.5 text-[#86868B]" />
          </button>
        )}
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-[#86868B] bg-[#E5E5EA] rounded-md px-1.5 py-0.5 flex-shrink-0">
          ⌘K
        </kbd>
      </div>

      {/* 搜索结果下拉 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E5E5EA] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[100]">
          {/* 结果头部 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F2F2F7]">
            <Sparkles className="w-3.5 h-3.5 text-[#AF52DE]" />
            <span className="text-xs text-[#86868B]">
              {loading
                ? "AI 正在检索..."
                : error
                ? "检索出错"
                : results.length > 0
                ? `找到 ${results.length} 个相关文件`
                : "未找到相关文件"}
            </span>
          </div>

          {/* 结果列表 */}
          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[#FF3B30]">{error}</p>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto">
              {results.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handlePreview(item.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F7] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F2F2F7] flex items-center justify-center flex-shrink-0">
                    {getFileIcon(item.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1D1D1F] truncate font-medium">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-[#86868B] mt-0.5">
                      {formatFileSize(item.size)} · {new Date(item.lastModified).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  {item.score !== undefined && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${getScoreColor(item.score)}`} />
                      <span className="text-[11px] text-[#86868B]">
                        {Math.round(item.score * 100)}%
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            !loading && (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 text-[#D1D1D6] mx-auto mb-2" />
                <p className="text-sm text-[#86868B]">输入关键词搜索文件</p>
                <p className="text-[11px] text-[#C7C7CC] mt-1">
                  支持按文件内容语义搜索
                </p>
              </div>
            )
          )}

          {/* 底部提示 */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#F2F2F7] bg-[#FAFAFA]">
            <span className="text-[10px] text-[#C7C7CC]">
              基于 OSS 语义检索
            </span>
            <span className="text-[10px] text-[#C7C7CC]">
              点击文件可预览
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
