export interface ProgressData {
  plannedPct: number;
  actualPct: number;
}

export interface WbsNodeInput extends ProgressData {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  sortOrder: number;
  [key: string]: unknown;
}

export interface WbsTreeNode extends WbsNodeInput {
  children: WbsTreeNode[];
}

export function calcAlertStatus(plannedPct: number, actualPct: number): string {
  return actualPct < plannedPct ? "滞后" : "正常";
}

export function summarizeProgress(children: ProgressData[]) {
  if (children.length === 0) {
    return { plannedPct: 0, actualPct: 0, alertStatus: "正常" };
  }
  const totalPlanned = children.reduce((s, c) => s + c.plannedPct, 0);
  const totalActual = children.reduce((s, c) => s + c.actualPct, 0);
  const plannedPct = Math.floor(totalPlanned / children.length);
  const actualPct = Math.floor(totalActual / children.length);
  return { plannedPct, actualPct, alertStatus: calcAlertStatus(plannedPct, actualPct) };
}

export function buildWbsTree<T extends WbsNodeInput>(nodes: T[]): WbsTreeNode[] {
  const map = new Map<string, WbsTreeNode>();
  const roots: WbsTreeNode[] = [];
  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] } as unknown as WbsTreeNode);
  }
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortChildren = (ns: WbsTreeNode[]) => {
    ns.sort((a, b) => a.sortOrder - b.sortOrder);
    ns.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}
