import React, { useState } from 'react';
import ProjectList from '../components/ProjectList';
import ProjectKanban from '../components/ProjectKanban';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import ProjectCalendar from '../components/ProjectCalendar';
import { useProjects } from '../context/ProjectContext';
import { LayoutList, KanbanSquare, Archive, CalendarDays, Search, X, RotateCcw } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { SALES_PROGRESS_FLOW, normalizeProgressStage, isBtoBDealerProject } from '../types';
import type { LostReasonType, Project } from '../types';

export default function ProjectManagement() {
  const {
    projects,
    actions,
    handleStatusChange,
    archiveProjectAsLost,
    restoreArchivedProject,
    handleCompleteAction,
    updateProject,
    postponeAction
  } = useProjects();
  const { kanbanColumns } = useWorkflow();

  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'archive' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // 失注モーダル用ステート
  const [lostModalProjectId, setLostModalProjectId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState<LostReasonType>('他社導入');
  const [lostNote, setLostNote] = useState<string>('');

  const handleStatusChangeIntercept = (projectId: string, newStatus: string) => {
    if (newStatus === '失注') {
      setLostReason('他社導入');
      setLostNote('');
      setLostModalProjectId(projectId);
    } else {
      const target = projects.find(p => p.id === projectId);
      if (target && target.status === '失注') {
        restoreArchivedProject(projectId);
        if (newStatus !== '初動') {
          handleStatusChange(projectId, newStatus);
        }
      } else {
        handleStatusChange(projectId, newStatus);
      }
    }
  };

  const submitLostReason = () => {
    if (!lostModalProjectId) return;
    archiveProjectAsLost(lostModalProjectId, lostReason, lostNote.trim() || undefined);
    setLostModalProjectId(null);
    setLostNote('');
  };

  // 検索フィルタリング
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = projects.filter(p => {
    if (!normalizedQuery) return true;
    const matchClinic = p.clinicName?.toLowerCase().includes(normalizedQuery);
    const matchContact =
      p.contactPerson?.toLowerCase().includes(normalizedQuery) ||
      p.pipelineMap?.director?.toLowerCase().includes(normalizedQuery);
    const matchRep = p.salesRep?.toLowerCase().includes(normalizedQuery);
    const matchAddress = p.address?.toLowerCase().includes(normalizedQuery);
    const matchLost = p.lostReason?.toLowerCase().includes(normalizedQuery);
    return matchClinic || matchContact || matchRep || matchAddress || matchLost;
  });

  const archivedProjects = filteredProjects.filter(p => p.status === '失注');
  const activeProjects = filteredProjects.filter(p => p.status !== '失注');
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  const filterByColumn = (p: Project, columnId: string) => {
    if (columnId === '失注') {
      return p.status === '失注';
    }
    if (p.status === '失注') {
      return false;
    }
    if ((SALES_PROGRESS_FLOW as readonly string[]).includes(columnId)) {
      return normalizeProgressStage(p) === columnId;
    }
    return p.status === columnId;
  };

  return (
    <div className="project-management-page" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* 画面ヘッダー ＆ 操作ツールバー */}
      <div className="pm-header-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>案件カンバン・一覧・カレンダー管理</h2>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              全 {projects.length} 件（営業中: {activeProjects.length}件 / アーカイブ失注: {archivedProjects.length}件）
            </p>
          </div>

          {/* 切り替えタブ */}
          <div className="view-mode-tabs" style={{ display: 'flex', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', overflow: 'hidden', flexWrap: 'wrap' }}>
            <button
              style={{ minHeight: '42px', padding: '0.45rem 0.95rem', border: 'none', background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent', color: viewMode === 'kanban' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem' }}
              onClick={() => setViewMode('kanban')}
            >
              <KanbanSquare size={16} /> カンバン ({activeProjects.length})
            </button>
            <button
              style={{ minHeight: '42px', padding: '0.45rem 0.95rem', border: 'none', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem' }}
              onClick={() => setViewMode('list')}
            >
              <LayoutList size={16} /> 一覧 ({activeProjects.length})
            </button>
            <button
              style={{ minHeight: '42px', padding: '0.45rem 0.95rem', border: 'none', background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem' }}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays size={16} /> 月間カレンダー
            </button>
            <button
              style={{ minHeight: '42px', padding: '0.45rem 0.95rem', border: 'none', background: viewMode === 'archive' ? 'var(--primary)' : 'transparent', color: viewMode === 'archive' ? 'white' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem' }}
              onClick={() => setViewMode('archive')}
            >
              <Archive size={16} /> アーカイブ（失注: {archivedProjects.length}件）
            </button>
          </div>
        </div>

        {/* 検索バー */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="クリニック名・都道府県・市区町村・失注理由で絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{
              width: '100%',
              minHeight: '38px',
              paddingLeft: '36px',
              paddingRight: searchQuery ? '36px' : '12px',
              borderRadius: '0.5rem',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              fontSize: '0.88rem'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
              title="検索クリア"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'list' && (
        <ProjectList
          projects={activeProjects}
          actions={actions}
          onProjectClick={(p) => setSelectedProjectId(p.id)}
        />
      )}

      {viewMode === 'archive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderLeft: '5px solid #475569',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>
                🗄️ クリニック・BtoB アーカイブ（失注）リスト（全 {archivedProjects.length} 件）
              </div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.15rem' }}>
                失注にした案件はここに保管されます。いつでも「🔄 営業リストへ復元」ボタンで初動ステージへ戻せます。
              </div>
            </div>
          </div>

          {archivedProjects.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              現在アーカイブ（失注）に入っているクリニックはありません。<br />
              <span style={{ fontSize: '0.82rem' }}>「超かんたん司令室」または「カンバン」から失注へ移動したクリニックがここに一覧表示されます。</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {archivedProjects.map(p => {
                const isBtoB = isBtoBDealerProject(p);
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderLeft: '5px solid #64748b',
                      borderRadius: '0.75rem',
                      padding: '0.9rem 1.2rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{
                          backgroundColor: isBtoB ? '#312e81' : '#1e40af',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.12rem 0.55rem',
                          borderRadius: '999px'
                        }}>
                          {isBtoB ? '🏢 BtoB別枠' : '🏥 クリニック'}
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          {p.clinicName}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                          📍 {p.address}（{p.clinicType}）
                        </span>
                        {p.lostReason && (
                          <span style={{
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '0.14rem 0.6rem',
                            borderRadius: '0.35rem'
                          }}>
                            失注理由: {p.lostReason}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        反響日: {p.receivedAt} / 最終更新: {p.lastActivityAt}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreArchivedProject(p.id);
                      }}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #2563eb',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <RotateCcw size={14} /> 営業リストへ復元
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <ProjectCalendar
          projects={activeProjects}
          onProjectClick={(p) => setSelectedProjectId(p.id)}
        />
      )}

      {viewMode === 'kanban' && (
        <ProjectKanban
          projects={filteredProjects}
          columns={kanbanColumns}
          filterByColumn={filterByColumn}
          onDropProject={handleStatusChangeIntercept}
          onRestoreProject={restoreArchivedProject}
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
          <div className="card" style={{ padding: '2rem', width: '440px', maxWidth: '92vw', backgroundColor: 'var(--card-bg)' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--danger)' }}>🗄️ アーカイブ（失注）へ移動</h3>
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
              <input
                type="text"
                className="input-field"
                placeholder="補足メモ（任意：メーカー名など）"
                value={lostNote}
                onChange={e => setLostNote(e.target.value)}
              />
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
