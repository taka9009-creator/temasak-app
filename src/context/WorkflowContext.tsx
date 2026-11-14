import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowRule {
  id: string;
  trigger: '進入時' | '完了時' | '期限超過時';
  actionDetail: string;
  daysToDeadline: number;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  subLabel: string;
  badge: string;
  icon: string;
  rules: WorkflowRule[];
  isKanbanColumn?: boolean;
}

export type AppNode = Node<WorkflowNodeData>;

// Default initial workflow (8段階進捗フロー: 問合せ → 初動 → デモ → 見積 → 検討 → 後追い → kz送客 → 受注)
const defaultNodes: AppNode[] = [
  { id: '1', type: 'action', position: { x: 300, y: 50 }, data: { label: '問合せ', subLabel: 'Web問い合わせ・反響', badge: 'Trigger', icon: 'trigger', rules: [], isKanbanColumn: true } },
  { id: '2', type: 'action', position: { x: 300, y: 200 }, data: { label: '初動', subLabel: '初動メール・電話アプローチ', badge: '営業', icon: 'message', rules: [], isKanbanColumn: true } },
  { id: '3', type: 'action', position: { x: 300, y: 350 }, data: { label: 'デモ', subLabel: 'オンライン・訪問・来社デモ', badge: '営業', icon: 'task', rules: [], isKanbanColumn: true } },
  { id: '4', type: 'action', position: { x: 300, y: 500 }, data: { label: '見積', subLabel: '見積書送付・金額提示', badge: '営業', icon: 'document', rules: [], isKanbanColumn: true } },
  { id: '5', type: 'action', position: { x: 300, y: 650 }, data: { label: '検討', subLabel: '相談メール・導入比較検討', badge: '営業', icon: 'message', rules: [], isKanbanColumn: true } },
  { id: '6', type: 'action', position: { x: 300, y: 800 }, data: { label: '後追い', subLabel: '後追いメール・最終フォロー', badge: '営業', icon: 'message', rules: [], isKanbanColumn: true } },
  { id: '7', type: 'action', position: { x: 300, y: 950 }, data: { label: 'kz送客', subLabel: '補助金コンサル送客・採択後受注', badge: '営業', icon: 'document', rules: [], isKanbanColumn: true } },
  { id: '8', type: 'action', position: { x: 100, y: 1100 }, data: { label: '受注', subLabel: 'ご契約・導入確定', badge: '導入', icon: 'check', rules: [], isKanbanColumn: true } },
  { id: '9', type: 'action', position: { x: 500, y: 1100 }, data: { label: '失注', subLabel: '理由ヒアリング・アーカイブ', badge: '営業', icon: 'document', rules: [], isKanbanColumn: false } }
];

const defaultEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'step' },
  { id: 'e2-3', source: '2', target: '3', type: 'step' },
  { id: 'e3-4', source: '3', target: '4', type: 'step' },
  { id: 'e4-5', source: '4', target: '5', type: 'step' },
  { id: 'e5-6', source: '5', target: '6', type: 'step' },
  { id: 'e6-7', source: '6', target: '7', type: 'step' },
  { id: 'e7-8', source: '7', target: '8', type: 'step' },
  { id: 'e6-9', source: '6', target: '9', type: 'step' }
];

export interface ColumnDef {
  id: string; // The status string (node label)
  title: string;
  icon: string;
  phase: 'sales' | 'implementation';
}

interface WorkflowContextType {
  nodes: AppNode[];
  edges: Edge[];
  kanbanColumns: ColumnDef[];
  saveWorkflow: (newNodes: AppNode[], newEdges: Edge[]) => void;
  getRulesForStatus: (status: string) => WorkflowRule[];
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

const STORAGE_KEY = 'temasak_workflow_data_prod_v2';

const STANDARD_KANBAN_COLUMNS: ColumnDef[] = [
  { id: '問合せ', title: '問合せ', icon: 'file-text', phase: 'sales' },
  { id: '初動', title: '初動', icon: 'phone-call', phase: 'sales' },
  { id: 'デモ', title: 'デモ', icon: 'video', phase: 'sales' },
  { id: '見積', title: '見積', icon: 'calculator', phase: 'sales' },
  { id: '検討', title: '検討', icon: 'message-square', phase: 'sales' },
  { id: '後追い', title: '後追い', icon: 'send', phase: 'sales' },
  { id: 'kz送客', title: 'kz送客', icon: 'coins', phase: 'sales' },
  { id: '受注', title: '受注', icon: 'check-square', phase: 'sales' },
];

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<AppNode[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
        }
      } catch (e) {
        console.error('Failed to parse saved workflow', e);
      }
    }
  }, []);

  const saveWorkflow = (newNodes: AppNode[], newEdges: Edge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: newNodes, edges: newEdges }));
    alert('ワークフローを公開（保存）しました。システム全体に反映されます。');
  };

  // Compute Kanban Columns: 常に7段階の標準進捗フロー（問合せ〜受注）を順番通りに含める
  const customColumns: ColumnDef[] = nodes
    .filter(n => n.data.isKanbanColumn !== false && n.type === 'action')
    .sort((a, b) => {
      if (Math.abs(a.position.y - b.position.y) > 30) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    })
    .map(n => ({
      id: n.data.label as string,
      title: n.data.label as string,
      icon: (n.data.icon as string) || 'circle',
      phase: ['導入', '現調', '設置'].includes(n.data.badge as string) ? 'implementation' : 'sales'
    }));

  const kanbanColumns: ColumnDef[] = [...STANDARD_KANBAN_COLUMNS];
  customColumns.forEach(col => {
    if (!kanbanColumns.some(c => c.id === col.id)) {
      kanbanColumns.push(col);
    }
  });

  const getRulesForStatus = (status: string): WorkflowRule[] => {
    const node = nodes.find(n => n.data.label === status);
    if (!node || !node.data.rules) return [];
    return node.data.rules;
  };

  return (
    <WorkflowContext.Provider value={{ nodes, edges, kanbanColumns, saveWorkflow, getRulesForStatus }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
