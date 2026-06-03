"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

interface CounterpartyRecord {
  id: string;
  name: string;
  bankName: string | null;
  bankAccount: string | null;
}

interface CounterpartySearchProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (record: { bankName: string; bankAccount: string }) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CounterpartySearch({
  value,
  onChange,
  onSelect,
  placeholder = "搜索往来单位名称...",
  disabled = false,
}: CounterpartySearchProps) {
  const [results, setResults] = useState<CounterpartyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(true);

    try {
      const res = await fetch(
        `/api/counterparty?search=${encodeURIComponent(q.trim())}&pageSize=20`
      );
      const data = await res.json();

      if (res.ok && Array.isArray(data.data)) {
        setResults(data.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (v: string) => {
    onChange(v);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!v.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      doSearch(v);
    }, 300);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (record: CounterpartyRecord) => {
    onChange(record.name);
    onSelect({
      bankName: record.bankName || "",
      bankAccount: record.bankAccount || "",
    });
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[#78716C] pointer-events-none" />
        <input
          type="text"
          className="ios-input pl-9 pr-8"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
        />
        {loading && (
          <Loader2 className="absolute right-3 w-4 h-4 text-[#78716C] animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#E7E5E4] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[100]">
          {results.length > 0 ? (
            <div className="max-h-[280px] overflow-y-auto">
              {results.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF9] transition-colors text-left"
                  onClick={() => handleSelect(record)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#1C1917] truncate font-medium">
                      {record.name}
                    </p>
                    {(record.bankName || record.bankAccount) && (
                      <p className="text-[11px] text-[#78716C] mt-0.5 truncate">
                        {[record.bankName, record.bankAccount]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : !loading ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] text-[#78716C]">无匹配结果</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
