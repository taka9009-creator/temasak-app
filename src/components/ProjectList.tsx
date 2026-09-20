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
    <table className="data-table">
      <thead>
        <tr>
          <th>案件</th>
          <th>ステータス</th>
          <th>次アクション</th>
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
            <tr key={project.id} onClick={() => onProjectClick(project)}>
              <td>
                <span className={`status-dot ${healthDot}`}></span>
                {project.clinicName}
              </td>
              <td>{project.status}</td>
              <td>{mainAction ? mainAction.title : <span style={{ color: 'var(--danger)' }}>未設定</span>}</td>
              <td style={{ color: mainAction && new Date(mainAction.deadline) < new Date() ? 'var(--danger)' : 'inherit' }}>
                {mainAction && mainAction.deadline ? (
                  <>
                    {healthDot === 'dot-danger' && <span className="status-dot dot-danger" style={{ width: 8, height: 8 }}></span>}
                    {mainAction.deadline.length >= 5 ? mainAction.deadline.substring(5) : mainAction.deadline}
                  </>
                ) : '-'}
              </td>
              <td>
                <div>{lastAct.length >= 5 ? lastAct.substring(5, 10) : lastAct}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{diff}日経過</div>
              </td>
            </tr>
          );
        })}
        {projects.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>表示する案件がありません</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
