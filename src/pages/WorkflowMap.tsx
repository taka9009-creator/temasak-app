import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, BackgroundVariant, addEdge, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ActionNode from '../components/workflow/ActionNode';
import ConditionNode from '../components/workflow/ConditionNode';
import Toolbox from '../components/workflow/Toolbox';
import { v4 as uuidv4 } from 'uuid';
import { useWorkflow, AppNode } from '../context/WorkflowContext';
import { useProjects } from '../context/ProjectContext';

const nodeTypes = {
  action: ActionNode,
  condition: ConditionNode,
};

function WorkflowCanvas() {
  const { nodes: savedNodes, edges: savedEdges, saveWorkflow } = useWorkflow();
  const { renameProjectStatus } = useProjects();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(savedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(savedEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Sync state if context changes (e.g. from local storage load)
  useEffect(() => {
    setNodes(savedNodes);
    setEdges(savedEdges);
  }, [savedNodes, savedEdges, setNodes, setEdges]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'step' }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      const badge = event.dataTransfer.getData('application/reactflow-badge');
      const icon = event.dataTransfer.getData('application/reactflow-icon');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: uuidv4(),
        type,
        position,
        data: { 
          label: `新しい${badge}`, 
          subLabel: '説明を入力してください', 
          badge, 
          icon,
          rules: []
        },
      };

      setNodes((nds: any) => nds.concat(newNode as any));
    },
    [screenToFlowPosition, setNodes],
  );

  const onNodeClick = (event: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  };

  const onPaneClick = () => {
    setSelectedNodeId(null);
  };

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes((nds: any) => nds.map((n: any) => {
      if (n.id === selectedNodeId) {
        return { ...n, data: { ...n.data, [field]: value } };
      }
      return n;
    }) as any);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds: any) => nds.filter((n: any) => n.id !== selectedNodeId) as any);
    setEdges((eds: any) => eds.filter((e: any) => e.source !== selectedNodeId && e.target !== selectedNodeId) as any);
    setSelectedNodeId(null);
  };

  const addRule = () => {
    if (!selectedNode) return;
    const currentRules = selectedNode.data.rules || [];
    updateNodeData('rules', [...currentRules, { id: uuidv4(), trigger: '進入時', actionDetail: '新規タスク生成' }]);
  };

  const deleteRule = (ruleId: string) => {
    if (!selectedNode) return;
    const currentRules = selectedNode.data.rules || [];
    updateNodeData('rules', currentRules.filter((r: any) => r.id !== ruleId));
  };

  const updateRule = (ruleId: string, field: string, value: any) => {
    if (!selectedNode) return;
    const currentRules = selectedNode.data.rules || [];
    updateNodeData('rules', currentRules.map((r: any) => 
      r.id === ruleId ? { ...r, [field]: value } : r
    ));
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)' }}>
      {/* メインエリア：React Flow キャンバス */}
      <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={4}
          defaultEdgeOptions={{ 
            style: { strokeWidth: 2, stroke: '#94a3b8' },
            animated: true
          }}
        >
          <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          <Controls position="bottom-center" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }} />
          <MiniMap style={{ bottom: 20, right: 20, zIndex: 5, borderRadius: '0.5rem', border: '1px solid #e2e8f0' }} />
          <Toolbox />
        </ReactFlow>
        
        {/* 上部のタイトルバー（オーバーレイ） */}
        <div className="wf-header-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ pointerEvents: 'auto' }}>
            <h1 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Workflows</span> / 進捗ロードマップ設定
            </h1>
          </div>
          <div style={{ pointerEvents: 'auto', display: 'flex', gap: '1rem' }}>
            <button className="btn btn-outline" style={{ backgroundColor: 'white' }}>Save to Draft</button>
            <button className="btn btn-primary" onClick={() => {
              // Detect renamed labels and update project statuses
              savedNodes.forEach(oldNode => {
                const newNode = nodes.find(n => n.id === oldNode.id);
                if (newNode && oldNode.data.label !== newNode.data.label) {
                  renameProjectStatus(oldNode.data.label as string, newNode.data.label as string);
                }
              });
              saveWorkflow(nodes, edges);
            }}>Published Workflow</button>
          </div>
        </div>
      </div>

      {/* 右側サイドパネル（プロパティエディタ） */}
      {selectedNode && (
        <div className="workflow-sidebar" style={{ width: '400px', backgroundColor: '#fff', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', zIndex: 20, boxShadow: '-4px 0 15px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select 
                  className="wf-node-badge" 
                  style={{ backgroundColor: selectedNode.type === 'condition' ? '#fee2e2' : '#f1f5f9', color: selectedNode.type === 'condition' ? '#ef4444' : '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', appearance: 'auto', padding: '0.25rem 0.5rem' }}
                  value={selectedNode.data.badge as string}
                  onChange={(e) => updateNodeData('badge', e.target.value)}
                >
                  <option value="Trigger">Trigger</option>
                  <option value="営業">営業</option>
                  <option value="導入">導入</option>
                  <option value="現調">現調</option>
                  <option value="設置">設置</option>
                  <option value="Condition">Condition</option>
                  <option value="Action">Action (デフォルト)</option>
                </select>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{selectedNode.type === 'condition' ? 'Condition' : 'Action'} Node</span>
              </div>
              <button 
                onClick={onPaneClick} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem' }}
                aria-label="閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>タイトル</label>
              <input 
                type="text" 
                value={selectedNode.data.label as string} 
                onChange={(e) => updateNodeData('label', e.target.value)}
                className="input-field" 
                style={{ width: '100%' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>説明文</label>
              <input 
                type="text" 
                value={(selectedNode.data.subLabel as string) || ''} 
                onChange={(e) => updateNodeData('subLabel', e.target.value)}
                className="input-field" 
                style={{ width: '100%' }}
                placeholder="No description"
              />
            </div>
            
            {selectedNode.type === 'action' && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={selectedNode.data.isKanbanColumn !== false} 
                  onChange={(e) => updateNodeData('isKanbanColumn', e.target.checked)}
                />
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>カンバンボードの列として表示する</label>
              </div>
            )}
          </div>
          
          <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                自動処理ルール (Rules)
                <button onClick={addRule} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  追加
                </button>
              </h3>
              
              {(!selectedNode.data.rules || (selectedNode.data.rules as any[]).length === 0) ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed var(--border-color)' }}>
                  ルールは設定されていません
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(selectedNode.data.rules as any[]).map((rule: any) => (
                    <div key={rule.id} style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <button onClick={() => deleteRule(rule.id)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                      
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div className="wf-node-badge" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>IF</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>この工程に</span>
                        <select className="input-field" style={{ fontSize: '0.75rem', padding: '0.1rem 0.25rem', width: 'auto' }} value={rule.trigger} onChange={(e) => updateRule(rule.id, 'trigger', e.target.value)}>
                          <option value="進入時">進入した</option>
                        </select>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>とき</span>
                      </div>
                      
                      <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div className="wf-node-badge" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>THEN</div>
                        <input type="number" className="input-field" value={rule.daysToDeadline || 3} onChange={(e) => updateRule(rule.id, 'daysToDeadline', e.target.value)} style={{ width: '40px', fontSize: '0.75rem', padding: '0.1rem 0.25rem', textAlign: 'center' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>日後に</span>
                        <input type="text" className="input-field" value={rule.actionDetail} onChange={(e) => updateRule(rule.id, 'actionDetail', e.target.value)} style={{ flex: 1, minWidth: '100px', fontSize: '0.75rem', padding: '0.1rem 0.25rem' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>を生成</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 5.43-13.14L2.5 5"/></svg>
              Refresh Block
            </button>
            <button onClick={deleteSelectedNode} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: '#fef2f2' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete Block
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowMap() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
