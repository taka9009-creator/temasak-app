import React, { useState, useRef, useEffect } from 'react';
import type { Project, ProjectStatus, NextAction } from '../types';
import { SALES_PROGRESS_FLOW, normalizeProgressStage, getClinicTotalPoints, isBtoBDealerProject } from '../types';
import { ChevronLeft, ChevronRight, RotateCcw, Trophy, Columns, Maximize2, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
  onRestoreProject?: (projectId: string) => void;
  onProjectClick: (project: Project) => void;
  actions: NextAction[];
}

const STAGE_COLORS: Record<string, { bg: string; headerBg: string; border: string; text: string; badgeBg: string }> = {
  '問合せ': { bg: '#f8fafc', headerBg: '#f1f5f9', border: '#cbd5e1', text: '#334155', badgeBg: '#64748b' },
  '初動':   { bg: '#eff6ff', headerBg: '#dbeafe', border: '#93c5fd', text: '#1e40af', badgeBg: '#2563eb' },
  'デモ':   { bg: '#f0fdf4', headerBg: '#dcfce7', border: '#86efac', text: '#166534', badgeBg: '#16a34a' },
  '見積':   { bg: '#fffbeb', headerBg: '#fef3c7', border: '#fcd34d', text: '#92400e', badgeBg: '#d97706' },
  '検討':   { bg: '#f5f3ff', headerBg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6', badgeBg: '#7c3aed' },
  '後追い': { bg: '#fff1f2', headerBg: '#ffe4e6', border: '#fda4af', text: '#9f1239', badgeBg: '#e11d48' },
  'kz送客': { bg: '#ecfeff', headerBg: '#cffafe', border: '#67e8f9', text: '#0f766e', badgeBg: '#0891b2' },
  '受注':   { bg: '#ecfdf5', headerBg: '#a7f3d0', border: '#34d399', text: '#065f46', badgeBg: '#059669' },
  '失注':   { bg: '#f8fafc', headerBg: '#e2e8f0', border: '#94a3b8', text: '#475569', badgeBg: '#475569' }
};

export default function ProjectKanban({
  projects,
  columns,
  filterByColumn,
  onDropProject,
  onRestoreProject,
  onProjectClick,
  actions
}: Props) {
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [compactFit, setCompactFit] = useState<boolean>(false);
  const [showArchivedCol, setShowArchivedCol] = useState<boolean>(true);

  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isSyncingScroll = useRef<boolean>(false);
  const [scrollWidthPx, setScrollWidthPx] = useState<number>(2200);

  // 標準8段階フロー＋失注カラムを確実に構築
  const displayColumns: Column[] = React.useMemo(() => {
    const baseCols: Column[] = SALES_PROGRESS_FLOW.map(stage => ({
      id: stage,
      title: stage,
      icon: null
    }));
    columns.forEach(c => {
      if (c.id !== '未分類' && c.id !== '失注' && !baseCols.some(b => b.id === c.id)) {
        baseCols.push(c);
      }
    });
    if (showArchivedCol) {
      baseCols.push({ id: '失注', title: '🗄️ アーカイブ(失注)', icon: null });
    }
    return baseCols;
  }, [columns, showArchivedCol]);

  // カンバン外枠内の横スクロール幅を計測し、上部スクロールバーと同期
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const updateWidth = () => {
      setScrollWidthPx(el.scrollWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [displayColumns.length, compactFit, projects.length]);

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && boardScrollRef.current) {
      isSyncingScroll.current = true;
      boardScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleBoardScroll = () => {
    if (isSyncingScroll.current) return;
    if (topScrollRef.current && boardScrollRef.current) {
      isSyncingScroll.current = true;
      topScrollRef.current.scrollLeft = boardScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const scrollHorizontalBy = (delta: number) => {
    if (!boardScrollRef.current) return;
    boardScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToColumn = (colId: string) => {
    const targetEl = colRefs.current[colId];
    if (targetEl && boardScrollRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggedProjectId(projectId);
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId') || e.dataTransfer.getData('text/plain') || draggedProjectId;
    setDraggedProjectId(null);
    setDragOverColId(null);

    if (!projectId || targetColumnId === '未分類') return;
    onDropProject(projectId, targetColumnId);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      backgroundColor: '#f1f5f9',
      border: '2px solid #cbd5e1',
      borderRadius: '0.9rem',
      overflow: 'hidden',
      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)'
    }}>
      {/* 1. カンバン外枠（うわく）上部ヘッダー＆横スクロール操作バー */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.65rem 0.95rem',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #cbd5e1'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {/* 左側：横スクロール操作ボタン＋ステージ直接ジャンプバー */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {!compactFit && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => scrollHorizontalBy(-360)}
                  title="カンバンを左へ横スクロール"
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #2563eb',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <ChevronsLeft size={14} /> 左へ
                </button>
                <button
                  type="button"
                  onClick={() => scrollHorizontalBy(360)}
                  title="カンバンを右へ横スクロール"
                  style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #2563eb',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  右へ <ChevronsRight size={14} />
                </button>
              </div>
            )}

            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569' }}>
              ステージ移動:
            </span>
            {displayColumns.map((col, idx) => {
              const count = projects.filter(p => filterByColumn(p, col.id)).length;
              const theme = STAGE_COLORS[col.id] || STAGE_COLORS['問合せ'];
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => scrollToColumn(col.id)}
                  title={`クリックで「${col.title}」列へスクロール移動`}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.headerBg,
                    color: theme.text,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.22rem'
                  }}
                >
                  <span>{col.id === '失注' ? '🗄️失注' : `${idx + 1}.${col.id}`}</span>
                  <span style={{
                    backgroundColor: '#ffffff',
                    padding: '0 0.32rem',
                    borderRadius: '999px',
                    fontSize: '0.68rem',
                    fontWeight: 900
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 右側：表示モード切替（横スクロール標準 ⇔ 全列一画面フィット）＆ 失注列切替 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowArchivedCol(prev => !prev)}
              style={{
                padding: '0.28rem 0.65rem',
                borderRadius: '0.45rem',
                border: showArchivedCol ? '1px solid #475569' : '1px solid #cbd5e1',
                backgroundColor: showArchivedCol ? '#f1f5f9' : '#ffffff',
                color: '#334155',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {showArchivedCol ? '🗄️ 失注列: 表示中' : '🗄️ 失注列を表示'}
            </button>

            <button
              type="button"
              onClick={() => setCompactFit(prev => !prev)}
              style={{
                padding: '0.28rem 0.75rem',
                borderRadius: '0.45rem',
                border: '1px solid #2563eb',
                backgroundColor: compactFit ? '#2563eb' : '#ffffff',
                color: compactFit ? '#ffffff' : '#1d4ed8',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              {compactFit ? <Columns size={13} /> : <Maximize2 size={13} />}
              <span>
                {compactFit
                  ? '↔️ 横スクロール表示（標準幅）に戻す'
                  : '🖥️ 全ステージを外枠内に一画面フィット'}
              </span>
            </button>
          </div>
        </div>

        {/* 上部連動横スクロールバー（外枠の上端でもすぐに左右スクロール可能） */}
        {!compactFit && (
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              height: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '999px',
              border: '1px solid #e2e8f0'
            }}
            title="ここを左右にドラッグしてカンバン全体を横スクロールできます"
          >
            <div style={{ width: `${scrollWidthPx}px`, height: '1px' }} />
          </div>
        )}
      </div>

      {/* 2. カンバン外枠内のボード本体（外枠の高さを画面内に収め、下部の横スクロールバーも常時表示＆各列の中だけ縦スクロール） */}
      <div
        ref={boardScrollRef}
        onScroll={handleBoardScroll}
        style={{
          display: compactFit ? 'grid' : 'flex',
          gridTemplateColumns: compactFit
            ? `repeat(${displayColumns.length}, minmax(0, 1fr))`
            : undefined,
          gap: compactFit ? '0.45rem' : '0.75rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          overflowX: compactFit ? 'hidden' : 'auto',
          overflowY: 'hidden',
          padding: compactFit ? '0.6rem' : '0.75rem',
          height: 'calc(100vh - 235px)',
          minHeight: '500px',
          alignItems: 'stretch'
        }}
      >
        {displayColumns.map((col, colIndex) => {
          const colProjects = projects.filter(p => filterByColumn(p, col.id));
          const theme = STAGE_COLORS[col.id] || STAGE_COLORS['問合せ'];
          const isDragOver = dragOverColId === col.id;

          return (
            <div
              key={col.id}
              ref={el => {
                colRefs.current[col.id] = el;
              }}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => {
                if (dragOverColId === col.id) setDragOverColId(null);
              }}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                flex: compactFit ? undefined : '0 0 245px',
                minWidth: compactFit ? 0 : '245px',
                maxWidth: compactFit ? '100%' : '245px',
                height: '100%',
                backgroundColor: isDragOver ? '#eff6ff' : theme.bg,
                borderRadius: '0.7rem',
                padding: compactFit ? '0.45rem' : '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: isDragOver ? '2px dashed #2563eb' : `1px solid ${theme.border}`,
                boxSizing: 'border-box',
                transition: 'background-color 0.15s ease, border-color 0.15s ease'
              }}
            >
              {/* カラムヘッダー（上部固定） */}
              <div
                style={{
                  backgroundColor: theme.headerBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '0.5rem',
                  padding: compactFit ? '0.38rem 0.45rem' : '0.45rem 0.65rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                  {col.id !== '失注' && colIndex < SALES_PROGRESS_FLOW.length && (
                    <span style={{
                      backgroundColor: theme.badgeBg,
                      color: '#ffffff',
                      fontSize: '0.66rem',
                      fontWeight: 900,
                      width: '18px',
                      height: '18px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {colIndex + 1}
                    </span>
                  )}
                  <h3 style={{
                    margin: 0,
                    fontSize: compactFit ? '0.78rem' : '0.9rem',
                    fontWeight: 900,
                    color: theme.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {col.title}
                  </h3>
                </div>
                <span style={{
                  backgroundColor: '#ffffff',
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  fontWeight: 900,
                  fontSize: compactFit ? '0.68rem' : '0.74rem',
                  padding: '0.08rem 0.42rem',
                  borderRadius: '999px',
                  flexShrink: 0
                }}>
                  {colProjects.length}件
                </span>
              </div>

              {/* カード一覧（各列の内部で独立して縦スクロール） */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                paddingRight: '0.15rem'
              }}>
                {colProjects.length === 0 && (
                  <div style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: '0.5rem',
                    padding: '1.25rem 0.5rem',
                    textAlign: 'center',
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    fontWeight: 600
                  }}>
                    ここにドロップして移動
                  </div>
                )}

                {colProjects.map(project => {
                  const isArchived = project.status === '失注';
                  const currentStage = isArchived ? '失注' : normalizeProgressStage(project);
                  const stageIdx = SALES_PROGRESS_FLOW.indexOf(currentStage as any);
                  const prevStage = !isArchived && stageIdx > 0 ? SALES_PROGRESS_FLOW[stageIdx - 1] : null;
                  const nextStage = !isArchived && stageIdx >= 0 && stageIdx < SALES_PROGRESS_FLOW.length - 1
                    ? SALES_PROGRESS_FLOW[stageIdx + 1]
                    : null;

                  const clinicPts = getClinicTotalPoints(project);
                  const isBtoB = isBtoBDealerProject(project);
                  const pendingTasks = actions.filter(a => a.projectId === project.id && a.status === '未完了').length;
                  const probColor = project.probability === 'A' ? '#ef4444' : project.probability === 'B' ? '#3b82f6' : '#94a3b8';

                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, project.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onProjectClick(project)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderLeft: `4px solid ${isArchived ? '#64748b' : probColor}`,
                        borderRadius: '0.6rem',
                        padding: compactFit ? '0.6rem' : '0.8rem',
                        boxShadow: '0 2px 4px rgba(15,23,42,0.05)',
                        cursor: 'grab',
                        opacity: draggedProjectId === project.id ? 0.5 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      {/* 上段バッジ */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: isBtoB ? '#312e81' : '#eff6ff',
                            color: isBtoB ? '#ffffff' : '#1d4ed8',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.25rem'
                          }}>
                            {isBtoB ? '🏢 BtoB' : '🏥 クリニック'}
                          </span>
                          <span style={{
                            backgroundColor: clinicPts >= 5 ? '#10b981' : '#e2e8f0',
                            color: clinicPts >= 5 ? '#ffffff' : '#334155',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.15rem'
                          }}>
                            <Trophy size={10} /> {clinicPts}p
                          </span>
                          {(currentStage === 'kz送客' || project.kzReferralDate || project.memo?.includes('kz送客済')) && !isArchived && (
                            <span style={{
                              backgroundColor: '#cffafe',
                              color: '#0f766e',
                              border: '1px solid #67e8f9',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              padding: '0.08rem 0.35rem',
                              borderRadius: '0.25rem'
                            }} title="補助金コンサルタント（kz）送客済・採択後に受注">
                              💰 kz送客済
                            </span>
                          )}
                        </div>

                        {project.probability && !isArchived && (
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '0.08rem 0.38rem',
                            borderRadius: '0.25rem',
                            backgroundColor: project.probability === 'A' ? '#fee2e2' : '#dbeafe',
                            color: project.probability === 'A' ? '#b91c1c' : '#1e40af'
                          }}>
                            確度{project.probability}
                          </span>
                        )}
                      </div>

                      {/* クリニック名 */}
                      <div style={{
                        fontWeight: 800,
                        fontSize: compactFit ? '0.8rem' : '0.88rem',
                        color: '#0f172a',
                        lineHeight: 1.3
                      }}>
                        {project.clinicName}
                      </div>

                      {/* エリア＆失注理由またはタスク数 */}
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.2rem'
                      }}>
                        <span>📍 {project.address || 'エリア未設定'}</span>
                        {pendingTasks > 0 && !isArchived && (
                          <span style={{ color: '#d97706', fontWeight: 800 }}>
                            📋 ToDo:{pendingTasks}
                          </span>
                        )}
                      </div>

                      {isArchived && project.lostReason && (
                        <div style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#991b1b',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '0.3rem',
                          padding: '0.15rem 0.4rem'
                        }}>
                          失注理由: {project.lostReason}
                        </div>
                      )}

                      {/* ワンクリックステージ移動コントロール（ドラッグ不要でも即移動可能） */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          marginTop: '0.25rem',
                          paddingTop: '0.35rem',
                          borderTop: '1px dashed #e2e8f0'
                        }}
                      >
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onRestoreProject) {
                                onRestoreProject(project.id);
                              } else {
                                onDropProject(project.id, '初動');
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.25rem 0.4rem',
                              borderRadius: '0.35rem',
                              border: '1px solid #2563eb',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <RotateCcw size={11} /> 営業リストへ復元
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={!prevStage}
                              title={prevStage ? `「${prevStage}」へ戻す` : '最初のステージです'}
                              onClick={() => prevStage && onDropProject(project.id, prevStage)}
                              style={{
                                padding: '0.2rem 0.35rem',
                                borderRadius: '0.3rem',
                                border: '1px solid #cbd5e1',
                                backgroundColor: prevStage ? '#f8fafc' : '#f1f5f9',
                                color: prevStage ? '#0f172a' : '#cbd5e1',
                                cursor: prevStage ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <ChevronLeft size={13} />
                            </button>

                            <select
                              value={currentStage}
                              onChange={(e) => onDropProject(project.id, e.target.value)}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '0.18rem 0.25rem',
                                borderRadius: '0.3rem',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: '#1e293b',
                                backgroundColor: '#f8fafc',
                                cursor: 'pointer'
                              }}
                            >
                              {SALES_PROGRESS_FLOW.map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                              <option value="失注">🗄️ 失注(アーカイブ)</option>
                            </select>

                            <button
                              type="button"
                              disabled={!nextStage}
                              title={nextStage ? `「${nextStage}」へ進める` : '最終ステージです'}
                              onClick={() => nextStage && onDropProject(project.id, nextStage)}
                              style={{
                                padding: '0.2rem 0.35rem',
                                borderRadius: '0.3rem',
                                border: nextStage ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: nextStage ? '#eff6ff' : '#f1f5f9',
                                color: nextStage ? '#1d4ed8' : '#cbd5e1',
                                cursor: nextStage ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <ChevronRight size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
