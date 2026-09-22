import React from 'react';
import type { Project, NextAction } from '../types';
import { differenceInDays, format } from 'date-fns';

interface Props {
  projects: Project[];
  actions: NextAction[];
  onProjectClick: (project: Project) => void;
}

export default function ProjectList({ projects, actions, onProjectClick }: Props) {
  
  const getHealthDot = (project: Project, mainAction?: NextAction) => {
    if (!mainAction) return 'dot-danger'; // 次回アクション未設定
    const diff = differenceInDays(new Date(), new Date(project.lastActivityAt));
    if (diff >= 7 || new Date(mainAction.deadline) < new Date(format(new Date(), 'yyyy-MM-dd'))) {
      return 'dot-danger';
    }
    if (diff >= 4 || format(new Date(mainAction.deadline), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      return 'dot-warning';
    }
    return 'dot-success';
  };

  return (
    <div className="project-list-wrapper">
      {/* PC向けテーブル表示 */}
      <div className="desktop-table-view" style={{ overflowX: 'auto', backgroundColor: 'var(--card-bg)', borderRadius: '0.5rem', boxShadow: 'var(--shadow-sm)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>クリニック・案件名</th>
              <th>ステータス</th>
              <th>次回アクション</th>
              <th>期限</th>
              <th>最終活動</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => {
              const projectActions = actions.filter(a => a.projectId === project.id && a.status === '未完了');
              const mainAction = projectActions[0];
              const healthDot = getHealthDot(project, mainAction);
              const lastAct = project.lastActivityAt || project.createdAt || new Date().toISOString();
              const diff = differenceInDays(new Date(), new Date(lastAct));

              return (
                <tr key={project.id} onClick={() => onProjectClick(project)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`status-dot ${healthDot}`}></span>
                      <strong>{project.clinicName}</strong>
                    </div>
                    {(project.contactPerson || project.pipelineMap?.director) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                        {project.contactPerson || project.pipelineMap?.director}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge neutral" style={{ fontWeight: 600 }}>{project.status}</span>
                  </td>
                  <td>
                    {mainAction ? (
                      <div style={{ fontWeight: 500 }}>{mainAction.title}</div>
                    ) : (
                      <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>⚠️ 次回アクション未設定</span>
                    )}
                  </td>
                  <td style={{ color: mainAction && new Date(mainAction.deadline) < new Date() ? 'var(--danger)' : 'inherit', fontWeight: mainAction && new Date(mainAction.deadline) < new Date() ? 700 : 400 }}>
                    {mainAction && mainAction.deadline ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {healthDot === 'dot-danger' && <span className="status-dot dot-danger" style={{ width: 8, height: 8 }}></span>}
                        {mainAction.deadline}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    <div>{lastAct.length >= 10 ? lastAct.substring(0, 10) : lastAct}</div>
                    <div style={{ fontSize: '0.75rem', color: diff >= 7 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {diff}日前 {diff >= 7 && '(停滞注意)'}
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  該当する案件がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* スマホ向けカード表示 (max-width: 768pxでCSS表示) */}
      <div className="mobile-cards-view" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
        {projects.map(project => {
          const projectActions = actions.filter(a => a.projectId === project.id && a.status === '未完了');
          const mainAction = projectActions[0];
          const healthDot = getHealthDot(project, mainAction);
          const isOverdue = mainAction && new Date(mainAction.deadline) < new Date();
          const lastAct = project.lastActivityAt || project.createdAt || new Date().toISOString();
          const diff = differenceInDays(new Date(), new Date(lastAct));

          return (
            <div 
              key={project.id}
              onClick={() => onProjectClick(project)}
              className="card"
              style={{
                padding: '1rem',
                cursor: 'pointer',
                borderLeft: `4px solid ${healthDot === 'dot-danger' ? 'var(--danger)' : healthDot === 'dot-warning' ? 'var(--warning)' : 'var(--success)'}`,
                minHeight: '44px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                    {project.clinicName}
                  </div>
                  {(project.contactPerson || project.pipelineMap?.director) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {project.contactPerson || project.pipelineMap?.director}
                    </div>
                  )}
                </div>
                <span className="badge neutral" style={{ fontWeight: 600 }}>{project.status}</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>次回アクション:</div>
                {mainAction ? (
                  <div style={{ fontWeight: 600, color: isOverdue ? 'var(--danger)' : 'var(--text-main)' }}>
                    {isOverdue && '⚠️ '}{mainAction.title}
                  </div>
                ) : (
                  <div style={{ color: 'var(--danger)', fontWeight: 600 }}>未設定（要登録）</div>
                )}
                {mainAction?.deadline && (
                  <div style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                    期限: <strong>{mainAction.deadline}</strong> {isOverdue && '(期限超過)'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>担当: {project.salesRep || '未定'}</span>
                <span>最終活動: {diff}日前</span>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            該当する案件がありません
          </div>
        )}
      </div>
    </div>
  );
}
