import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  SALES_PROGRESS_FLOW,
  INTRO_FOUR_PHASES,
  normalizeProgressStage,
  getProjectSpecAndGateSummary
} from '../../types';
import type { Project, IntroPhaseId } from '../../types';

const steps = SALES_PROGRESS_FLOW.map((label, idx) => ({
  id: String(idx + 1),
  label
}));

interface Props {
  project: Project;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
  onJumpToTab?: (tab: 'basicInfo' | 'activities' | 'cashlessStatus' | 'deviceInfo' | 'prepStatus' | 'installation') => void;
}

export default function ProjectProgressMap({ project, onUpdateProject, onJumpToTab }: Props) {
  const isLost = project.status === '失注';
  const normalizedStage = normalizeProgressStage(project);
  const currentIndex = SALES_PROGRESS_FLOW.indexOf(normalizedStage);
  const gate = getProjectSpecAndGateSummary(project);
  const pm = project.pipelineMap || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. 営業進捗 8段階フロー（クリックで直接切り替え可能） */}
      <div style={{ padding: '1.5rem 1.25rem', overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
            ① 営業進捗 8段階フロー（クリックでステージ移動・カンバン＆活動履歴と連動）
          </strong>
          <span style={{ fontSize: '0.75rem', color: '#475569' }}>
            現在地: <strong>{isLost ? '失注' : normalizedStage}</strong>
          </span>
        </div>

        {isLost ? (
          <div style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 0' }}>
            <AlertCircle size={24} /> この案件は「失注」としてクローズされました
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '640px', position: 'relative', paddingTop: '0.25rem' }}>
            {/* Progress Line Background */}
            <div style={{ position: 'absolute', top: '16px', left: '0', right: '0', height: '4px', backgroundColor: '#e2e8f0', zIndex: 0 }}></div>
            
            {/* Active Progress Line */}
            <div style={{ 
              position: 'absolute', top: '16px', left: '0', 
              width: currentIndex >= 0 ? `${(currentIndex / (steps.length - 1)) * 100}%` : '0%', 
              height: '4px', backgroundColor: 'var(--primary-color)', zIndex: 0, transition: 'width 0.4s ease-in-out' 
            }}></div>

            {steps.map((step, index) => {
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              
              return (
                <div
                  key={step.id}
                  onClick={() => onUpdateProject?.(project.id, { status: step.label })}
                  title={`クリックして「${step.label}」へ進捗を移動`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 1,
                    width: '80px',
                    cursor: onUpdateProject ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ 
                    width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isCompleted ? 'var(--primary-color)' : isCurrent ? 'white' : '#f8fafc',
                    border: isCurrent ? '4px solid var(--primary-color)' : isCompleted ? '2px solid var(--primary-color)' : '2px solid #cbd5e1',
                    color: isCompleted ? 'white' : 'transparent',
                    marginBottom: '0.6rem',
                    transition: 'all 0.2s ease'
                  }}>
                    {isCompleted && <CheckCircle2 size={16} />}
                  </div>
                  <div style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? 'var(--text-color)' : isCompleted ? 'var(--primary-color)' : 'var(--text-muted)',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div style={{ marginTop: '0.4rem', backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '0.65rem', padding: '0.18rem 0.5rem', borderRadius: '1rem', fontWeight: 'bold' }}>
                      現在地
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. PDF Page 2 準拠：導入お手続き 4フェーズ（申請前準備〜本番稼働まで約4か月） */}
      <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
            ② PDF準拠：導入お手続き 4フェーズ（クリックでフェーズ移動・営業進捗＆カンバンと自動連動）
          </strong>
          <span style={{ fontSize: '0.75rem', color: '#475569' }}>
            現在フェーズ: <strong>{gate.introPhase}</strong>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
          {INTRO_FOUR_PHASES.map(ph => {
            const isCur = gate.introPhase === ph.id;
            return (
              <div
                key={ph.id}
                onClick={() =>
                  onUpdateProject?.(project.id, {
                    pipelineMap: {
                      ...pm,
                      introPhase: ph.id as IntroPhaseId
                    }
                  })
                }
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.6rem',
                  border: isCur ? `2.5px solid ${ph.badgeColor}` : '1px solid #cbd5e1',
                  backgroundColor: isCur ? ph.headerBg : '#f8fafc',
                  cursor: onUpdateProject ? 'pointer' : 'default'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: isCur ? ph.badgeColor : '#1e293b' }}>{ph.title}</strong>
                  {isCur && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, backgroundColor: ph.badgeColor, color: '#fff', padding: '0.12rem 0.45rem', borderRadius: '999px' }}>
                      現在地
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>{ph.subtitle}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{ph.items.join(' ／ ')}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 4大チェックゲート＆各タブ直結ナビ */}
      <div style={{ padding: '1.25rem', backgroundColor: 'white', borderRadius: '0.65rem', border: '1px solid var(--border-color)' }}>
        <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '0.75rem' }}>
          ③ 導入4大チェックゲート進捗（クリックで各詳細タブへ移動）
        </strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => onJumpToTab?.('deviceInfo')}
            style={{
              textAlign: 'left',
              padding: '0.8rem',
              borderRadius: '0.55rem',
              border: '1.5px solid #93c5fd',
              backgroundColor: gate.specCompletedCount === 7 ? '#dcfce7' : '#eff6ff',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1e40af' }}>🎨 7 STEP 仕様決定</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>
              {gate.specCompletedCount} / 7 STEP 完了
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
              本体色: {pm.bodyColor || '未選択'} / 釣銭機: {pm.changeMachineColor || '未選択'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onJumpToTab?.('prepStatus')}
            style={{
              textAlign: 'left',
              padding: '0.8rem',
              borderRadius: '0.55rem',
              border: '1.5px solid #67e8f9',
              backgroundColor: gate.docsReadyCount === 4 ? '#dcfce7' : '#ecfeff',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0f766e' }}>📄 公的書類3点＋GbizID</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>
              {gate.docsReadyCount} / 4 取得済
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
              ACT1: {pm.act1DocsReady ? '完了 ✓' : '進行中'} / ACT2: {pm.act2ConsentSent ? '完了 ✓' : '進行中'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onJumpToTab?.('cashlessStatus')}
            style={{
              textAlign: 'left',
              padding: '0.8rem',
              borderRadius: '0.55rem',
              border: '1.5px solid #fcd34d',
              backgroundColor: gate.creditApproved ? '#dcfce7' : '#fef3c7',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#b45309' }}>💳 キャッシュレス・ジャックス審査</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>
              {gate.creditApproved ? '審査通過 ✓ (設置可)' : '審査・申込確認中'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
              クレカ: {pm.creditStatus || '未設定'} / JCB: {pm.jcbCreditStatus || '未設定'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onJumpToTab?.('installation')}
            style={{
              textAlign: 'left',
              padding: '0.8rem',
              borderRadius: '0.55rem',
              border: '1.5px solid #c4b5fd',
              backgroundColor: gate.surveyReadyCount === 5 ? '#dcfce7' : '#f5f3ff',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#6d28d9' }}>🔌 現地調査 確認1〜5</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>
              {gate.surveyReadyCount} / 5 確認済
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
              現調日: {project.surveyDate || '未定'} / 設置日: {project.installationDate || '未定'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
