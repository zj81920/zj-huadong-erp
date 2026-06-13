"use client";

import { useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Bot, Send, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

// ========== Types ==========
type ChartType = "bar" | "pie" | "line";

interface ChartConfig {
  type: ChartType;
  title: string;
  data: Record<string, any>[];
  xField?: string;
  yField?: string;
  color?: string;
  bars?: { dataKey: string; fill: string; name: string }[];
  nameField?: string;
  valueField?: string;
  colors?: string[];
  lines?: { dataKey: string; color: string; strokeWidth: number }[];
}

interface CardConfig {
  label: string;
  value: string;
  color: "red" | "green" | "blue" | "amber" | "purple";
  change?: "up" | "down";
}

interface AIResponse {
  analysis: string;
  paragraphs: string[];
  chart?: ChartConfig;
  cards?: CardConfig[];
  table?: { title: string; columns: string[]; rows: string[][] };
}

// ========== Preset Questions ==========
const PRESETS = [
  { id: "expense", label: "近3个月支出按分类显示" },
  { id: "income", label: "今年Q1收入趋势分析" },
  { id: "receivable", label: "应收账款" },
  { id: "cashflow", label: "本月现金流状况" },
  { id: "project_cost", label: "各项目成本占比" },
];

// ========== Helpers ==========
const CARD_COLORS: Record<string, string> = {
  red: "bg-red-50 border-red-200 text-red-800",
  green: "bg-green-50 border-green-200 text-green-800",
  blue: "bg-blue-50 border-blue-200 text-blue-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  purple: "bg-purple-50 border-purple-200 text-purple-800",
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function ChartRenderer({ chart }: { chart: ChartConfig }) {
  if (chart.type === "bar") {
    const hasMultipleBars = Array.isArray(chart.bars) && chart.bars.length > 0;
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{chart.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xField || "name"} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => v != null ? `¥${Number(v).toLocaleString()}` : ""} />
            {hasMultipleBars ? (
              chart.bars!.map((b) => (
                <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} name={b.name} />
              ))
            ) : (
              <Bar dataKey={chart.yField || "value"} fill={chart.color || "#3b82f6"} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "pie") {
    const colors = chart.colors || CHART_COLORS;
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{chart.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chart.data}
              dataKey={chart.valueField || "value"}
              nameKey={chart.nameField || "name"}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          <Tooltip formatter={(v: any) => v != null ? `¥${Number(v).toLocaleString()}` : ""} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "line") {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{chart.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xField || "name"} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: any) => v != null ? `¥${Number(v).toLocaleString()}` : ""} />
            {chart.lines?.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={line.strokeWidth || 2}
                name={line.dataKey}
              />
            ))}
            {chart.lines && chart.lines.length > 1 && <Legend />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

function CardGrid({ cards }: { cards: CardConfig[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`rounded-lg border p-4 ${CARD_COLORS[card.color] || CARD_COLORS.blue}`}
        >
          <div className="text-xs opacity-75 mb-1">{card.label}</div>
          <div className="text-xl font-bold">{card.value}</div>
          {card.change && (
            <span className={`text-xs ${card.change === "up" ? "text-green-600" : "text-red-600"}`}>
              {card.change === "up" ? "↑" : "↓"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ========== Main Page Component ==========
export default function FinanceAIPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuery = async (q?: string) => {
    const text = (q || query).trim();
    if (!text || loading) return;

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const res = await fetch("/api/ai/finance-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "查询失败");
      }

      const data = await res.json();
      setResponse(data);
    } catch (e: any) {
      setError(e.message || "查询异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset: string) => {
    setQuery(preset);
    handleQuery(preset);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8" />
          <h1 className="text-2xl font-bold">AI 智能财务查询</h1>
        </div>
        <p className="text-blue-100 text-sm">用自然语言查询财务数据，自动生成图表和分析报告</p>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p.label)}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuery()}
          placeholder="输入财务查询问题，如：近3个月支出按分类显示..."
          disabled={loading}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
        />
        <button
          onClick={() => handleQuery()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          发送
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">正在查询分析中...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          {/* Analysis */}
          <div>
            <p className="text-base font-semibold text-gray-900 mb-2">{response.analysis}</p>
            {response.paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-gray-600 mt-1 leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Chart */}
          {response.chart && (
            <div className="bg-gray-50 rounded-lg p-4">
              <ChartRenderer chart={response.chart} />
            </div>
          )}

          {/* Cards */}
          {response.cards && response.cards.length > 0 && (
            <CardGrid cards={response.cards} />
          )}

          {/* Table */}
          {response.table && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={showTable}
                  onChange={(e) => setShowTable(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">显示明细表格</span>
                {showTable ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </label>
              {showTable && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {response.table.columns.map((col, i) => (
                          <th key={i} className="px-4 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {response.table.rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
