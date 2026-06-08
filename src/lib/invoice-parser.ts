/**
 * 发票 OCR 解析工具函数
 */

export interface ParsedInvoice {
  invoiceNo: string;
  invoiceCode: string;
  invoiceType: string;
  invoiceDate: string;
  amountWithoutTax: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  sellerName: string;
  sellerTaxNo: string;
  buyerName: string;
  buyerTaxNo: string;
  remark: string;
}

/**
 * 解析 AI 返回的发票 JSON，兼容 camelCase 和 snake_case 字段名
 */
export function parseInvoiceFromAI(raw: Record<string, unknown>): ParsedInvoice {
  const taxRate = Number(raw.taxRate || raw.tax_rate || 0);
  const amountWithoutTax = Number(raw.amountWithoutTax || raw.amount_without_tax || raw.amount || 0);
  const taxAmount = Number(raw.taxAmount || raw.tax_amount || 0);
  const totalAmount = Number(raw.totalAmount || raw.total_amount || 0);

  return {
    invoiceNo: String(raw.invoiceNo || raw.invoice_no || ""),
    invoiceCode: String(raw.invoiceCode || raw.invoice_code || ""),
    invoiceType: String(raw.invoiceType || raw.invoice_type || ""),
    invoiceDate: String(raw.invoiceDate || raw.invoice_date || ""),
    amountWithoutTax,
    taxRate,
    taxAmount,
    totalAmount: totalAmount || amountWithoutTax + taxAmount,
    sellerName: String(raw.sellerName || raw.seller_name || ""),
    sellerTaxNo: String(raw.sellerTaxNo || raw.seller_tax_no || ""),
    buyerName: String(raw.buyerName || raw.buyer_name || ""),
    buyerTaxNo: String(raw.buyerTaxNo || raw.buyer_tax_no || ""),
    remark: String(raw.remark || ""),
  };
}

/**
 * 根据不含税金额和税率自动计算税额和合计
 */
export function calculateInvoiceTax(amountWithoutTax: number, taxRate: number): {
  taxAmount: number;
  totalAmount: number;
} {
  const taxAmount = Math.round(amountWithoutTax * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((amountWithoutTax + taxAmount) * 100) / 100;
  return { taxAmount, totalAmount };
}

/**
 * 从 AI 原始文本中提取 JSON
 */
export function extractInvoiceJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
