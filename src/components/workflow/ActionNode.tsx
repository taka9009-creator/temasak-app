import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Target, MessageSquare, Plus, FileText, CheckSquare, CreditCard, Truck, HelpCircle } from 'lucide-react';

// アイコンのマッピング
const getIcon = (iconName?: string) => {
  switch (iconName) {
    case 'trigger': return <Target size={16} color="var(--primary)" />;
    case 'message': return <MessageSquare size={16} color="#8b5cf6" />;
    case 'task': return <CheckSquare size={16} color="#0ea5e9" />;
    case 'document': return <FileText size={16} color="#f59e0b" />;
    case 'credit': return <CreditCard size={16} color="#10b981" />;
    case 'truck': return <Truck size={16} color="#64748b" />;
    case 'plus': return <Plus size={16} color="#ec4899" />;
    default: return <HelpCircle size={16} color="#94a3b8" />;
  }
};

export default function ActionNode({ data }: any) {
  const statusClass = data.progressStatus ? ` wf-node-${data.progressStatus}` : '';
  
  return (
    <div className={`wf-node wf-action-node${statusClass}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />
      
      <div className="wf-node-header">
        <div className="wf-icon-box">
          {getIcon(data.icon)}
        </div>
        <div className="wf-node-content">
          <div className="wf-node-title">{data.label}</div>
          {data.subLabel && <div className="wf-node-sublabel">{data.subLabel}</div>}
        </div>
        {data.badge && (
          <div className="wf-node-badge">
            {data.badge}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="wf-handle" />
    </div>
  );
}
