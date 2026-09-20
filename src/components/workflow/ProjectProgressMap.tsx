import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Project } from '../../types';

const steps = [
  { id: '1', label: '新規・問合せ' },
  { id: '3', label: '商談・デモ' },
  { id: '4', label: '見積作成' },
  { id: '6', label: '契約・導入準備' },
  { id: '9', label: 'CL・補助金' },
  { id: '11', label: '現地調査' },
  { id: '12', label: '設置・完了' }
];

interface Props {
  project: Project;
}

export default function ProjectProgressMap({ project }: Props) {
  const getCurrentNodeId = (status: string) => {
    if (status === '新規' || status === '問合せ') return '1';
    if (status === '初動' || status === 'デモ' || status === '商談') return '3';
    if (status === '概算見積' || status === '見積' || status === '見積提出') return '4';
    if (status === '受注' || status === '契約' || status === '楽々報告' || status === '契約確認') return '6';
    if (status === 'CL希望' || status === 'キャッシュレス申込' || status === 'キャッシュレス設定' || status === 'キャッシュレス導入準備') return '9';
    if (status === '現地調査' || status === '現地調査日程調整') return '11';
    if (status === '設置日' || status === '設置準備' || status === '設置日調整' || status === '本番稼働' || status === '完了') return '12';
    if (status === '失注') return 'lost';
    return '1';
  };

  const currentNodeId = getCurrentNodeId(project.status);
  const isLost = currentNodeId === 'lost';
  
  const currentIndex = steps.findIndex(s => s.id === currentNodeId);

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
