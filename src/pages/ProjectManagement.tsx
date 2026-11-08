import React, { useState } from 'react';
import ProjectList from '../components/ProjectList';
import ProjectKanban from '../components/ProjectKanban';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import ProjectCalendar from '../components/ProjectCalendar';
import { useProjects } from '../context/ProjectContext';
import { LayoutList, KanbanSquare, Archive, CalendarDays, Search, X } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import type { LostReasonType } from '../types';

export default function ProjectManagement() {
  const { projects, actions, handleStatusChange, archiveProjectAsLost, handleCompleteAction, updateProject, postponeAction } = useProjects();
  const { kanbanColumns } = useWorkflow();
  
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'archive' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // 失注モーダル用ステート
  const [lostModalProjectId, setLostModalProjectId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<LostReasonType>('他社導入');

  const handleStatusChangeIntercept = (projectId: string, newStatus: string) => {
    if (newStatus === '失注') {
      setLostReason('他社導入');
      setLostModalProjectId(projectId);
    } else {
      handleStatusChange(projectId, newStatus);
    }
  };

  const submitLostReason = () => {
    if (!lostModalProjectId) return;
    archiveProjectAsLost(lostModalProjectId, lostReason);
    setLostModalProjectId(null);
  };

  // 検索フィルタリング
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = projects.filter(p => {
    if (!normalizedQuery) return true;
    const matchClinic = p.clinicName?.toLowerCase().includes(normalizedQuery);
    const matchContact = p.contactPerson?.toLowerCase().includes(normalizedQuery) || p.pipelineMap?.director?.toLowerCase().includes(normalizedQuery);
    const matchRep = p.salesRep?.toLowerCase().includes(normalizedQuery);
    const matchAddress = p.address?.toLowerCase().includes(normalizedQuery);
    return matchClinic || matchContact || matchRep || matchAddress;
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const filterByColumn = (p: any, columnId: string) => {
    if (columnId === '未分類') {
      return !kanbanColumns.find(c => c.id !== '未分類' && c.id === p.status);
    }
    return p.status === columnId;
  };

  return (
    <div className="project-management-page">
      {/* 画面ヘッダー ＆ 操作ツールバー */}
      <div className="pm-header-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>案件管理</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              全 {projects.length} 件中 {filteredProjects.length} 件表示
            </p>
          </div>

          {/* 切り替えタブ */}
          <div className="view-mode-tabs" style={{ display: 'flex', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden', flexWrap: 'wrap' }}>
            <button 
              style={{ minHeight: '44px', padding: '0.5rem 1rem', border: 'none', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}
              onClick={() => setViewMode('list')}
            >
              <LayoutList size={16} /> 一覧
            </button>
            <button 
              style={{ minHeight: '44px', padding: '0.5rem 1rem', border: 'none', background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent', color: viewMode === 'kanban' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}
              onClick={() => setViewMode('kanban')}
            >
              <KanbanSquare size={16} /> カンバン
            </button>
            <button 
              style={{ minHeight: '44px', padding: '0.5rem 1rem', border: 'none', background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays size={16} /> 月間カレンダー
            </button>
            <button 
              style={{ minHeight: '44px', padding: '0.5rem 1rem', border: 'none', background: viewMode === 'archive' ? 'var(--primary)' : 'transparent', color: viewMode === 'archive' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}
              onClick={() => setViewMode('archive')}
            >
              <Archive size={16} /> アーカイブ（失注）
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="クリニック名、院長名、担当営業で絞り込み..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="input-field" 
            style={{ 
              width: '100%', 
              minHeight: '44px', 
              paddingLeft: '38px', 
              paddingRight: searchQuery ? '38px' : '12px',
              borderRadius: '0.5rem', 
              backgroundColor: 'var(--card-bg)', 
              border: '1px solid var(--border-color)',
              fontSize: '0.95rem'
            }} 
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
              title="検索クリア"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'list' && (
        <ProjectList 
          projects={filteredProjects.filter(p => !p.isImplementationProject && p.status !== '失注')} 
          actions={actions} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}
      
      {viewMode === 'archive' && (
        <ProjectList 
          projects={filteredProjects.filter(p => p.status === '失注')} 
          actions={actions} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}

      {viewMode === 'calendar' && (
        <ProjectCalendar 
          projects={filteredProjects.filter(p => p.status !== '失注')} 
          onProjectClick={(p) => setSelectedProjectId(p.id)} 
        />
      )}

      {viewMode === 'kanban' && (
        <ProjectKanban 
          projects={filteredProjects.filter(p => p.status !== '失注')} 
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
          <div className="card" style={{ padding: '2rem', width: '420px', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--danger)' }}>アーカイブ（失注）へ移動</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              失注の理由を選択してください。半年後に状況確認のタスクが自動で生成されます。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <select
                className="input-field"
                value={lostReason}
                onChange={e => setLostReason(e.target.value as LostReasonType)}
              >
                <option value="他社導入">🏢 他社導入</option>
                <option value="金銭面">💰 金銭面</option>
                <option value="その他">📝 その他</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setLostModalProjectId(null)}>キャンセル</button>
              <button className="btn btn-primary" onClick={submitLostReason} style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' }}>
                アーカイブ（失注）へ移動
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
