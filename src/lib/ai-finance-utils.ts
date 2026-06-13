// ========== Types ==========

export type ChartType = 'bar' | 'pie' | 'line';

export interface BarChartConfig {
  type: 'bar';
  title: string;
  data: Record<string, any>[];
  xField: string;
  yField?: string;
  color?: string;
  bars?: { dataKey: string; fill: string; name: string }[];
}

export interface PieChartConfig {
  type: 'pie';
  title: string;
  data: Record<string, any>[];
  nameField: string;
  valueField: string;
  colors?: string[];
}

export interface LineChartConfig {
  type: 'line';
  title: string;
  data: Record<string, any>[];
  xField: string;
  lines: { dataKey: string; color: string; strokeWidth: number }[];
}

export type ChartConfig = BarChartConfig | PieChartConfig | LineChartConfig;

export type CardColor = 'red' | 'green' | 'blue' | 'amber' | 'purple';
export type CardChange = 'up' | 'down';

export interface CardConfig {
  label: string;
  value: string;
  color: CardColor;
  change?: CardChange;
}

export interface TableConfig {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface AIFinanceResponse {
  analysis: string;
  paragraphs: string[];
  chart?: ChartConfig;
  cards?: CardConfig[];
  table?: TableConfig;
}

// ========== Validation ==========

const VALID_CHART_TYPES = ['bar', 'pie', 'line'];
const VALID_CARD_COLORS = ['red', 'green', 'blue', 'amber', 'purple'];
const VALID_CARD_CHANGES = ['up', 'down'];

export function isValidChartConfig(config: unknown): config is ChartConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  if (!VALID_CHART_TYPES.includes(c.type as string)) return false;
  if (typeof c.title !== 'string' || !c.title) return false;
  if (!Array.isArray(c.data) || c.data.length === 0) return false;
  if (c.type === 'bar') {
    const bar = c as unknown as BarChartConfig;
    if (typeof bar.xField !== 'string') return false;
    const hasYField = typeof bar.yField === 'string' || Array.isArray(bar.bars);
    if (!hasYField) return false;
  }
  if (c.type === 'pie') {
    const pie = c as unknown as PieChartConfig;
    if (typeof pie.nameField !== 'string') return false;
    if (typeof pie.valueField !== 'string') return false;
  }
  if (c.type === 'line') {
    const line = c as unknown as LineChartConfig;
    if (typeof line.xField !== 'string') return false;
    if (!Array.isArray(line.lines) || line.lines.length === 0) return false;
  }
  return true;
}

export function isValidCard(card: unknown): card is CardConfig {
  if (!card || typeof card !== 'object') return false;
  const c = card as Record<string, unknown>;
  if (typeof c.label !== 'string' || !c.label) return false;
  if (typeof c.value !== 'string') return false;
  if (!VALID_CARD_COLORS.includes(c.color as string)) return false;
  if (c.change !== undefined && !VALID_CARD_CHANGES.includes(c.change as string)) return false;
  return true;
}

export function isValidFinanceResponse(resp: unknown): resp is AIFinanceResponse {
  if (!resp || typeof resp !== 'object') return false;
  const r = resp as Record<string, unknown>;
  if (typeof r.analysis !== 'string' || !r.analysis) return false;
  if (!Array.isArray(r.paragraphs)) return false;
  if (r.chart !== undefined && !isValidChartConfig(r.chart)) return false;
  if (r.cards !== undefined) {
    if (!Array.isArray(r.cards)) return false;
    if (!r.cards.every(isValidCard)) return false;
  }
  if (r.table !== undefined) {
    if (typeof r.table !== 'object' || r.table === null) return false;
    const t = r.table as Record<string, unknown>;
    if (typeof t.title !== 'string') return false;
    if (!Array.isArray(t.columns) || t.columns.length === 0) return false;
    if (!Array.isArray(t.rows)) return false;
  }
  return true;
}

// ========== Formatting ==========

export function formatAmount(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return `¥${num.toLocaleString('en-US')}`;
}
