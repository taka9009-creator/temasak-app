import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { SALES_PROGRESS_FLOW, normalizeProgressStage } from '../../types';
import type { Project } from '../../types';

const steps = SALES_PROGRESS_FLOW.map((label, idx) => ({
  id: String(idx + 1),
  label
}));

interface Props {
  project: Project;
}

export default function ProjectProgressMap({ project }: Props) {
  const isLost = project.status === '失注';
  const normalizedStage = normalizeProgressStage(project);
  const currentIndex = SALES_PROGRESS_FLOW.indexOf(normalizedStage);

  return (
    <div style={{ padding: '2rem 1rem', overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
      {isLost ? (
        <div style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <AlertCircle size={24} /> この案件は「失注」としてクローズされました
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '600px', position: 'relative' }}>
          {/* Progress Line Background */}
          <div style={{ position: 'absolute', top: '12px', left: '0', right: '0', height: '4px', backgroundColor: '#e2e8f0', zIndex: 0 }}></div>
          
          {/* Active Progress Line */}
          <div style={{ 
            position: 'absolute', top: '12px', left: '0', 
            width: currentIndex >= 0 ? `${(currentIndex / (steps.length - 1)) * 100}%` : '0%', 
            height: '4px', backgroundColor: 'var(--primary-color)', zIndex: 0, transition: 'width 0.5s ease-in-out' 
          }}></div>

          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '80px' }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isCompleted ? 'var(--primary-color)' : isCurrent ? 'white' : '#f8fafc',
                  border: isCurrent ? '4px solid var(--primary-color)' : isCompleted ? '2px solid var(--primary-color)' : '2px solid #cbd5e1',
                  color: isCompleted ? 'white' : 'transparent',
                  marginBottom: '0.75rem',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted && <CheckCircle2 size={16} />}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--text-color)' : isCompleted ? 'var(--primary-color)' : 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  {step.label}
                </div>
                {isCurrent && (
                  <div style={{ marginTop: '0.5rem', backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 'bold' }}>
                    現在地
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
