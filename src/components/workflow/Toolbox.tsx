import React from 'react';
import { Target, GitBranch } from 'lucide-react';

export default function Toolbox() {
  const onDragStart = (event: React.DragEvent, nodeType: string, badge: string, icon: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-badge', badge);
    event.dataTransfer.setData('application/reactflow-icon', icon);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="workflow-toolbox">
      <h3 style={{ fontSize: '0.875rem', margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Nodes</h3>
      
      <div 
        className="toolbox-node" 
        draggable 
        onDragStart={(e) => onDragStart(e, 'action', 'Action', 'task')}
      >
        <div className="wf-icon-box" style={{ width: '24px', height: '24px' }}>
          <Target size={14} color="var(--primary)" />
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Action Node</span>
      </div>

      <div 
        className="toolbox-node" 
        draggable 
        onDragStart={(e) => onDragStart(e, 'condition', 'Condition', 'none')}
      >
        <div className="wf-icon-box condition-icon" style={{ width: '24px', height: '24px' }}>
          <GitBranch size={14} color="#ef4444" />
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Condition Node</span>
      </div>
    </div>
  );
}
