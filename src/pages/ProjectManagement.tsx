import React, { useState } from 'react';
import ProjectList from '../components/ProjectList';
import ProjectKanban from '../components/ProjectKanban';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import ProjectGantt from '../components/ProjectGantt';
import ProjectCalendar from '../components/ProjectCalendar';
import { useProjects } from '../context/ProjectContext';
import { LayoutList, KanbanSquare, Archive, Calendar as CalendarIcon, Calendar, CalendarDays, AlignLeft } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';

export default function ProjectManagement() {
  const { projects, actions, handleStatusChange, handleCompleteAction, updateProject, postponeAction } = useProjects();
  const { kanbanColumns } = useWorkflow();
  
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'gantt' | 'archive' | 'calendar'>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // 失注モーダル用ステート
  const [lostModalProjectId, setLostModalProjectId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<string>('');

  const handleStatusChangeIntercept = (projectId: string, newStatus: string) => {
    if (newStatus === '失注') {
      setLostModalProjectId(projectId);
    } else {
      handleStatusChange(projectId, newStatus);
    }
  };

  const submitLostReason = () => {
    if (!lostModalProjectId) return;
    updateProject(lostModalProjectId, { lostReason: lostReason || 'その他' });
    handleStatusChange(lostModalProjectId, '失注');
    setLostModalProjectId(null);
    setLostReason('');
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const filterByColumn = (p: any, columnId: string) => {
    if (columnId === '未分類') {
      return !kanbanColumns.find(c => c.id !== '未分類' && c.id === p.status);
    }
    return p.status === columnId;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>案件管理</h2>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <button 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setViewMode('list')}
            >
              <LayoutList size={16} /> 一覧
            </button>
            <button 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent', color: viewMode === 'kanban' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setViewMode('kanban')}
            >
              <KanbanSquare size={16} /> カンバン
            </button>
            <button 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'gantt' ? 'var(--primary)' : 'transparent', color: viewMode === 'gantt' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setViewMode('gantt')}
            >
              <Calendar size={16} /> ガントチャート
            </button>
            <button 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays size={16} /> 月間カレンダー
            </button>
            <button 
              style={{ padding: '0.5rem 1rem', border: 'none', background: viewMode === 'archive' ? 'var(--primary)' : 'transparent', color: viewMode === 'archive' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setViewMode('archive')}
            >
              <Archive size={16} /> アーカイブ
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' && (
        <ProjectList 
          projects={projects.filter(p => !p.isImplementationProject && p.status !== '失注')} 
          actions={actions} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}
      
      {viewMode === 'archive' && (
        <ProjectList 
          projects={projects.filter(p => p.status === '失注')} 
          actions={actions} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}

      {viewMode === 'gantt' && (
        <ProjectGantt
          projects={projects.filter(p => p.status !== '失注')}
          onProjectClick={(p) => setSelectedProjectId(p.id)}
        />
      )}

      {viewMode === 'calendar' && (
        <ProjectCalendar 
          projects={projects.filter(p => p.status !== '失注')} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}

      {viewMode === 'kanban' && (
        <ProjectKanban 
          projects={projects.filter(p => p.status !== '失注')} 
          columns={kanbanColumns}
          filterByColumn={filterByColumn}
          onDropProject={handleStatusChangeIntercept}
          onProjectClick={(p) => setSelectedProjectId(p.id)}
          actions={actions}
        />
      )}

      {selectedProjectId && (
        <ProjectDetailsPanel 
          project={selectedProject}
          actions={actions}
          onClose={() => setSelectedProjectId(null)}
          onCompleteAction={handleCompleteAction}
          onPostponeAction={postponeAction}
          onUpdateProject={updateProject}
        />
      )}

      {lostModalProjectId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', width: '400px', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>失注理由の登録</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              今後の分析と改善のため、失注の主な理由を選択してください。半年後に状況確認のタスクが自動で生成されます。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <select className="input-field" value={lostReason} onChange={e => setLostReason(e.target.value)}>
                <option value="">選択してください...</option>
                <option value="金額が高い">金額が高い</option>
                <option value="他社競合（製品力）">他社競合（製品力）</option>
                <option value="他社競合（価格）">他社競合（価格）</option>
                <option value="時期尚早">時期尚早</option>
                <option value="連絡がつかない">連絡がつかない</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setLostModalProjectId(null)}>キャンセル</button>
              <button className="btn btn-primary" onClick={submitLostReason} disabled={!lostReason} style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }}>
                失注として確定する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
