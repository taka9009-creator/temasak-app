import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

export default function ConditionNode({ data }: any) {
  const statusClass = data.progressStatus ? ` wf-node-${data.progressStatus}` : '';

  return (
    <div className={`wf-node wf-condition-node${statusClass}`}>
      <Handle type="target" position={Position.Top} className="wf-handle" />
      
      <div className="wf-node-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="wf-icon-box condition-icon">
          <GitBranch size={16} color="#ef4444" />
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

      <div className="wf-condition-branches">
        <div className="wf-branch branch-true">
          <span>is true</span>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="true" 
            className="wf-handle-branch"
            style={{ left: '25%' }}
          />
        </div>
        <div className="wf-branch branch-false">
          <span>is false</span>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false" 
            className="wf-handle-branch"
            style={{ left: '75%' }}
          />
        </div>
      </div>
    </div>
  );
}
