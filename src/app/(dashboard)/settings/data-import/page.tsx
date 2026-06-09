"use client";

import React, { useState, useRef } from "react";

/** 步骤枚举 */
type Step = "select" | "analyzing" | "review" | "previewing" | "preview" | "importing" | "done";

/** 模块信息 */
interface ModuleInfo {
  module: string;
  name: string;
  dependsOn: string[];
  fields: Array<{ field: string; label: string; type: string; required: boolean }>;
}

/** 分析结果 */
interface AnalyzeItem {
  module: string;
  moduleName: string;
  fileName: string;
  columns: string[];
  suggestedMappings: Array<{
    excelColumn: string;
    targetField: string;
    confidence: number;
    status: string;
  }>;
  unmatchedColumns: string[];
  rowCount: number;
}

/** 预览结果 */
interface PreviewResult {
  module: string;
  moduleName: string;
  headers: string[];
  mappings: { module: string; moduleName: string; columns: string[] } | null;
  previewRows: Array<{
    rowIndex: number;
    data: Record<string, unknown>;
    errors: Array<{ field: string; message: string; type: string }>;
  }>;
  totalRows: number;
  errorRows: number;
}

export default function DataImportPage() {
  const [step, setStep] = useState<Step>("select");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [analyzeResults, setAnalyzeResults] = useState<AnalyzeItem[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: Record<string, number>;
    errors: Array<{ module: string; row: number; message: string }>;
  } | null>(null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 加载可用模块 */
  const loadModules = async () => {
    try {
      const res = await fetch("/api/import/analyze", {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append("files", new Blob([], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
          return fd;
        })(),
      });
      const data = await res.json();
      if (data.availableModules) {
        setAvailableModules(data.availableModules);
      }
    } catch {
      // 静默失败
    }
  };

  // 进入页面时加载模块列表
  React.useEffect(() => {
    loadModules();
  }, []);

  /** 上传文件进行分析 */
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.length) {
      setError("请选择文件");
      return;
    }

    setStep("analyzing");
    setError("");

    const formData = new FormData();
    const files = fileInputRef.current.files;
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/import/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStep("select");
        return;
      }

      setAnalyzeResults(data.results || []);
      if (data.availableModules) {
        setAvailableModules(data.availableModules);
      }
      setStep("review");
    } catch {
      setError("分析请求失败");
      setStep("select");
    }
  };

  /** 预览数据 */
  const handlePreview = async (module: string) => {
    setSelectedModule(module);
    setStep("previewing");
    setError("");

    if (!fileInputRef.current?.files?.length) {
      setError("请重新选择文件");
      setStep("review");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInputRef.current.files[0]);
    formData.append("module", module);

    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStep("review");
        return;
      }

      setPreviewResult(data);
      setStep("preview");
    } catch {
      setError("预览请求失败");
      setStep("review");
    }
  };

  /** 执行导入 */
  const handleExecute = async () => {
    if (!selectedModule) return;

    setStep("importing");
    setError("");

    if (!fileInputRef.current?.files?.length) {
      setError("请重新选择文件");
      setStep("preview");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInputRef.current.files[0]);
    formData.append("module", selectedModule);

    try {
      const res = await fetch("/api/import/execute", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setStep("preview");
        return;
      }

      setImportResult(data);
      setStep("done");
    } catch {
      setError("导入请求失败");
      setStep("preview");
    }
  };

  /** 重置 */
  const handleReset = () => {
    setStep("select");
    setSelectedModule("");
    setAnalyzeResults([]);
    setPreviewResult(null);
    setImportResult(null);
    setError("");
  };

  if (step === "done" && importResult) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">数据导入 - 完成</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-4">
          <h2 className="text-lg font-semibold text-green-800 mb-2">导入成功</h2>
          {Object.entries(importResult.imported).map(([mod, count]) => (
            <p key={mod} className="text-green-700">
              模块 {mod}: 成功导入 {count} 条
            </p>
          ))}
        </div>
        {importResult.errors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              导入错误 ({importResult.errors.length})
            </h2>
            <ul className="text-sm text-yellow-700 max-h-60 overflow-auto">
              {importResult.errors.map((err, i) => (
                <li key={i}>第 {err.row} 行: {err.message}</li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={handleReset} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          继续导入其他模块
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">数据导入</h1>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-4 mb-8 text-sm">
        <StepBadge label="① 选择模块" active={step === "select"} done={step !== "select" && step !== "analyzing"} />
        <span className="text-gray-300">→</span>
        <StepBadge label="② AI 分析" active={step === "analyzing"} done={["review", "previewing", "preview", "importing", "done"].includes(step)} />
        <span className="text-gray-300">→</span>
        <StepBadge label="③ 预览确认" active={step === "previewing" || step === "preview"} done={step === "importing" || step === "done"} />
        <span className="text-gray-300">→</span>
        <StepBadge label="④ 执行导入" active={step === "importing"} done={step === "done"} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">{error}</div>
      )}

      {/* Step 1: 选择模块 + 上传 */}
      {(step === "select" || step === "analyzing") && (
        <div className="bg-white rounded-lg border p-6">
          <form onSubmit={handleAnalyze}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">上传 Excel 文件</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                className="block w-full text-sm border rounded p-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                支持 .xlsx / .xls 格式，可同时选择多个文件
              </p>
            </div>

            <button
              type="submit"
              disabled={step === "analyzing"}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {step === "analyzing" ? "正在分析..." : "开始分析"}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: AI 分析结果 */}
      {step === "review" && (
        <div>
          {analyzeResults.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4">
              <p className="text-yellow-700">未检测到可导入的数据，请检查文件内容后重试。</p>
            </div>
          ) : (
            analyzeResults.map((result, i) => (
              <div key={i} className="bg-white rounded-lg border p-6 mb-4">
                <h2 className="text-lg font-semibold mb-2">
                  {result.fileName} - 检测为: {result.moduleName}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {result.rowCount} 行数据，{result.suggestedMappings.length} 个字段已自动映射
                  {result.unmatchedColumns.length > 0 && (
                    <span className="text-orange-600">
                      ，{result.unmatchedColumns.length} 个字段无法匹配
                    </span>
                  )}
                </p>

                {/* 映射结果表格 */}
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2">Excel 列名</th>
                      <th className="text-left p-2">目标字段</th>
                      <th className="text-left p-2">置信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.suggestedMappings.map((m, j) => (
                      <tr key={j} className="border-t">
                        <td className="p-2">{m.excelColumn}</td>
                        <td className="p-2 text-blue-600">{m.targetField}</td>
                        <td className="p-2">
                          <ConfidenceBadge confidence={m.confidence} />
                        </td>
                      </tr>
                    ))}
                    {result.unmatchedColumns.map((col, j) => (
                      <tr key={`un-${j}`} className="border-t bg-red-50">
                        <td className="p-2 text-red-600">{col}</td>
                        <td className="p-2 text-red-400">无法匹配</td>
                        <td className="p-2">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  onClick={() => handlePreview(result.module)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  预览数据
                </button>
              </div>
            ))
          )}
          <button onClick={handleReset} className="mt-4 px-4 py-2 text-gray-600 hover:text-gray-800">
            重新选择
          </button>
        </div>
      )}

      {/* Step 3: 预览 */}
      {(step === "previewing" || step === "preview") && previewResult && (
        <div>
          {step === "previewing" ? (
            <div className="text-center py-12 text-gray-500">正在加载预览数据...</div>
          ) : (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-2">数据预览</h2>
              <p className="text-sm text-gray-500 mb-4">
                共 {previewResult.totalRows} 行，
                {previewResult.errorRows > 0 ? (
                  <span className="text-red-600">{previewResult.errorRows} 行有错误</span>
                ) : (
                  <span className="text-green-600">校验全部通过</span>
                )}
              </p>

              {previewResult.errorRows > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 max-h-40 overflow-auto">
                  <h3 className="text-sm font-semibold text-red-700 mb-2">错误详情</h3>
                  {previewResult.previewRows
                    .filter((r) => r.errors.length > 0)
                    .slice(0, 10)
                    .map((r, i) => (
                      <div key={i} className="text-xs text-red-600 mb-1">
                        第 {r.rowIndex} 行: {r.errors.map((e) => e.message).join("；")}
                      </div>
                    ))}
                  {previewResult.errorRows > 10 && (
                    <div className="text-xs text-red-400 mt-1">
                      以及其他 {previewResult.errorRows - 10} 行...
                    </div>
                  )}
                </div>
              )}

              {/* 数据表格（前 10 行） */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs border">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-1 border text-left">#</th>
                      {previewResult.headers.map((h, i) => (
                        <th key={i} className="p-1 border text-left whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.previewRows.slice(0, 10).map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.errors.length > 0 ? "bg-red-50" : "hover:bg-gray-50"}
                      >
                        <td className="p-1 border">{row.rowIndex}</td>
                        {previewResult.headers.map((h, i) => (
                          <td
                            key={i}
                            className={`p-1 border whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis ${
                              row.errors.some((e) => e.field === h) ? "text-red-600 font-semibold" : ""
                            }`}
                            title={String(row.data[h] ?? "")}
                          >
                            {String(row.data[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex gap-4">
                <button onClick={handleExecute} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  确认导入
                </button>
                <button onClick={handleReset} className="px-4 py-2 text-gray-600 hover:text-gray-800">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: 导入中 */}
      {step === "importing" && (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-500 text-lg">正在导入数据，请稍候...</div>
          <p className="text-sm text-gray-400 mt-2">请勿关闭页面</p>
        </div>
      )}
    </div>
  );
}

/** 步骤指示器 */
function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
      }`}
    >
      {label}
    </span>
  );
}

/** 置信度标签 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">高</span>;
  }
  if (confidence >= 0.5) {
    return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">中</span>;
  }
  return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">低</span>;
}
