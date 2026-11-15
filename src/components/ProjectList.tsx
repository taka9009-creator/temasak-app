import React from 'react';
import type { Project, NextAction } from '../types';
import { differenceInDays, format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';

interface Props {
  projects: Project[];
  actions: NextAction[];
  onProjectClick: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export default function ProjectList({ projects, actions, onProjectClick, onDeleteProject }: Props) {
  const { deleteProject } = useProjects();

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (onDeleteProject) {
      onDeleteProject(project);
      return;
    }
    if (!window.confirm(`「${project.clinicName}」をリストから削除しますか？\n（※誤って削除した場合も、リセットボタンから初期42件に戻せます）`)) {
      return;
    }
    deleteProject(project.id);
  };
  
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
              <th>レセコン</th>
              <th>ステータス</th>
              <th>次回アクション</th>
              <th>期限</th>
              <th>最終活動</th>
              <th style={{ textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => {
              const projectActions = actions.filter(a => a.projectId === project.id && a.status === '未完了');
              const mainAction = projectActions[0];
              const healthDot = getHealthDot(project, mainAction);
              const lastAct = project.lastActivityAt || project.createdAt || new Date().toISOString();
              const diff = differenceInDays(new Date(), new Date(lastAct));
              const receconVal = project.pipelineMap?.receiptComputer || project.reservationSystem;

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
                    <span
                      style={{
                        backgroundColor: receconVal ? '#e0f2fe' : '#f1f5f9',
                        color: receconVal ? '#0369a1' : '#64748b',
                        border: receconVal ? '1px solid #7dd3fc' : '1px dashed #cbd5e1',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.18rem 0.55rem',
                        borderRadius: '0.35rem',
                        display: 'inline-block'
                      }}
                    >
                      🖥️ {receconVal || '未設定'}
                    </span>
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
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onProjectClick(project);
                        }}
                        title="内容を訂正・編集"
                        style={{
                          padding: '0.3rem 0.55rem',
                          borderRadius: '0.4rem',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Pencil size={12} /> 訂正
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, project)}
                        title="この案件を削除"
                        style={{
                          padding: '0.3rem 0.55rem',
                          borderRadius: '0.4rem',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Trash2 size={12} /> 削除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
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
                  <div style={{ fontSize: '0.76rem', color: '#0369a1', fontWeight: 700, marginTop: '0.2rem' }}>
                    🖥️ レセコン: {project.pipelineMap?.receiptComputer || project.reservationSystem || '未設定'}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span>担当: {project.salesRep || '未定'}</span>
                  <span>最終活動: {diff}日前</span>
                </div>
                <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectClick(project);
                    }}
                    title="内容を訂正・編集"
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Pencil size={12} /> 訂正
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, project)}
                    title="この案件を削除"
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #fecaca',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Trash2 size={12} /> 削除
                  </button>
                </div>
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
