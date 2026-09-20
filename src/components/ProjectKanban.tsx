import React from 'react';
import type { Project, ProjectStatus, NextAction } from '../types';

interface Column {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface Props {
  projects: Project[];
  columns: Column[];
  filterByColumn: (p: Project, columnId: string) => boolean;
  onDropProject: (projectId: string, newStatus: ProjectStatus) => void;
  onProjectClick: (project: Project) => void;
  actions: NextAction[];
}

export default function ProjectKanban({ projects, columns, filterByColumn, onDropProject, onProjectClick, actions }: Props) {
  
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    
    if (targetColumnId === '未分類') {
      return; // 未分類へのドロップは無効
    }

    onDropProject(projectId, targetColumnId);
  };

  return (
    <div className="kanban-board">
      {columns.map(col => {
        const colProjects = projects.filter(p => filterByColumn(p, col.id));

        return (
          <div 
            key={col.id} 
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{col.title}</h3>
              </div>
              <span className="badge neutral">{colProjects.length}</span>
            </div>
            
            <div className="kanban-column-content">
              {projects.filter(p => {
                if (col.id === '未分類') {
                  const isValidColumn = columns.some(c => c.id === p.status);
                  return (p.status === '未分類' || !isValidColumn) && filterByColumn(p, col.id);
                }
                return p.status === col.id && filterByColumn(p, col.id);
              }).map(project => {
                const daysStalled = Math.floor((new Date().getTime() - new Date(project.lastActivityAt).getTime()) / (1000 * 3600 * 24));
                // 完了・本稼働済以外のステータスで7日以上経過している場合にアラート
                const isStalled = daysStalled >= 7 && project.status !== '本稼働済' && project.status !== '失注';
                
                const pendingTasks = actions.filter(a => a.projectId === project.id && a.status === '未完了').length;
                
                const probColor = project.probability === 'A' ? '#ef4444' : project.probability === 'B' ? '#3b82f6' : project.probability ? '#9ca3af' : 'transparent';

                return (
                  <div 
                    key={project.id}
                    className="kanban-card"
                    style={{ borderLeft: `4px solid ${probColor}` }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    onClick={() => onProjectClick(project)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge info">{project.status}</span>
                        {isStalled && (
                          <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            ⚠️ 放置警告
                          </span>
                        )}
                      </div>
                      {project.probability && (
                        <span className={`badge ${project.probability === 'A' ? 'success' : project.probability === 'B' ? 'info' : 'warning'}`}>
                          確度: {project.probability}
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {project.clinicName}
                      {project.ballHolder && (
                        <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                          🏀 {project.ballHolder}待ち
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>担当: {project.salesRep}</span>
                      {pendingTasks > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 600 }}>
                          📋 タスク: {pendingTasks}
                        </span>
                      )}
                    </div>

                    {['新規', '初動', '商談', '見積', '未分類'].includes(project.status) && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.25rem' }}
                          onClick={(e) => { e.stopPropagation(); onDropProject(project.id, '受注'); }}
                        >
                          🎉 受注
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.25rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={(e) => { e.stopPropagation(); onDropProject(project.id, '失注'); }}
                        >
                          ❌ 失注
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
