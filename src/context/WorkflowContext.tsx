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

// Default initial workflow
const defaultNodes: AppNode[] = [
  { id: '1', type: 'action', position: { x: 300, y: 50 }, data: { label: '新規', subLabel: 'Web問い合わせ・紹介', badge: 'Trigger', icon: 'trigger', rules: [], isKanbanColumn: true } },
  { id: '2', type: 'action', position: { x: 300, y: 200 }, data: { label: '初動', subLabel: '電話・メール連絡', badge: '営業', icon: 'message', rules: [], isKanbanColumn: true } },
  { id: '3', type: 'action', position: { x: 300, y: 350 }, data: { label: '商談', subLabel: 'ヒアリング実施', badge: '営業', icon: 'task', rules: [], isKanbanColumn: true } },
  { id: '4', type: 'action', position: { x: 300, y: 500 }, data: { label: '見積', subLabel: '金額提示', badge: '営業', icon: 'document', rules: [], isKanbanColumn: true } },
  { id: '5', type: 'condition', position: { x: 300, y: 650 }, data: { label: '受注判断 (If/Else)', subLabel: '契約に至ったか？', badge: 'Condition', icon: '', rules: [], isKanbanColumn: false } },
  { id: '6', type: 'action', position: { x: 100, y: 850 }, data: { label: '受注', subLabel: '担当引継ぎ', badge: '導入', icon: 'task', rules: [], isKanbanColumn: true } },
  { id: '7', type: 'action', position: { x: 500, y: 850 }, data: { label: '失注', subLabel: '理由ヒアリング', badge: '営業', icon: 'document', rules: [], isKanbanColumn: false } }, // Usually lost is not a kanban column, or it's a special one
  { id: '8', type: 'condition', position: { x: 100, y: 1000 }, data: { label: 'キャッシュレス希望?', subLabel: 'CL審査が必要か', badge: 'Condition', icon: '', rules: [], isKanbanColumn: false } },
  { id: '9', type: 'action', position: { x: -100, y: 1200 }, data: { label: 'CL希望', subLabel: '審査通過待ち', badge: '導入', icon: 'credit', rules: [], isKanbanColumn: true } },
  { id: '11', type: 'action', position: { x: 100, y: 1350 }, data: { label: '現地調査', subLabel: '設置環境確認', badge: '現調', icon: 'truck', rules: [], isKanbanColumn: true } },
  { id: '12', type: 'action', position: { x: 100, y: 1500 }, data: { label: '完了', subLabel: '納品完了', badge: '設置', icon: 'check', rules: [], isKanbanColumn: true } }
];

const defaultEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'step' },
  { id: 'e2-3', source: '2', target: '3', type: 'step' },
  { id: 'e3-4', source: '3', target: '4', type: 'step' },
  { id: 'e4-5', source: '4', target: '5', type: 'step' },
  { id: 'e5-6', source: '5', sourceHandle: 'true', target: '6', type: 'step' },
  { id: 'e5-7', source: '5', sourceHandle: 'false', target: '7', type: 'step' },
  { id: 'e6-8', source: '6', target: '8', type: 'step' },
  { id: 'e8-9', source: '8', sourceHandle: 'true', target: '9', type: 'step' },
  { id: 'e9-11', source: '9', target: '11', type: 'step' },
  { id: 'e8-11', source: '8', sourceHandle: 'false', target: '11', type: 'step' },
  { id: 'e11-12', source: '11', target: '12', type: 'step' },
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

const STORAGE_KEY = 'temasak_workflow_data';

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

  // Compute Kanban Columns based on nodes that are marked as isKanbanColumn
  const kanbanColumns: ColumnDef[] = nodes
    .filter(n => n.data.isKanbanColumn !== false && n.type === 'action') // by default action nodes are columns unless false
    .sort((a, b) => {
      // Sort primarily by Y position (top to bottom), secondarily by X
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

  // Append a fallback '未分類' column
  if (!kanbanColumns.find(c => c.id === '未分類')) {
    kanbanColumns.push({ id: '未分類', title: '未分類', icon: 'help-circle', phase: 'sales' });
  }

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
