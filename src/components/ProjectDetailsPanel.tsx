import React, { useState, useEffect } from 'react';
import {
  SALES_PROGRESS_FLOW,
  getClinicTotalPoints,
  inferActivityPoints,
  isBtoBDealerProject,
  normalizeProgressStage,
  syncProjectWithActivities
} from '../types';
import type { Project, NextAction, SalesProgressStage, Activity } from '../types';
import { differenceInDays, format } from 'date-fns';
import { X, CheckCircle2, AlertTriangle, Sparkles, Save, Loader2, Zap, ExternalLink, Search, Calendar, Clock, Trophy, Edit2, Trash2, Plus, Bot, RotateCcw } from 'lucide-react';
import { useMasterData } from '../context/MasterDataContext';
import ProjectProgressMap from './workflow/ProjectProgressMap';
import {
  generateSummary,
  extractClinicInfoFromUrl,
  getAISettings,
  saveAISettings,
  AI_PROMPT_PRESETS,
  defaultAIPrompt,
  type AIPromptPresetId
} from '../utils/ai';

export type ProjectDetailTab = 'basicInfo' | 'pipelineMap' | 'activities' | 'deviceInfo' | 'prepStatus' | 'cashlessStatus' | 'installation';

interface Props {
  project: Project | null;
  actions: NextAction[];
  onClose: () => void;
  onCompleteAction: (actionId: string) => void;
  onPostponeAction?: (actionId: string, days: number) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
  initialTab?: ProjectDetailTab;
}

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日', '祝'] as const;
type DayKey = typeof WEEK_DAYS[number];
type SlotState = 'open' | 'closed' | 'short';

type WeeklyMatrix = Record<DayKey, { am: SlotState; pm: SlotState }>;

/**
 * 診療時間テキストと休診日テキストから、週間カレンダーマトリクス（月〜祝 × 午前/午後）を生成する
 */
function parseScheduleFromStrings(clinicHoursStr: string, closedDaysStr: string): {
  amHours: string;
  pmHours: string;
  matrix: WeeklyMatrix;
} {
  let amHours = '09:00〜12:30';
  let pmHours = '14:00〜18:00';

  if (clinicHoursStr) {
    const timeRanges = clinicHoursStr.match(/\d{1,2}:\d{2}\s*[〜～\-~]\s*\d{1,2}:\d{2}/g);
    if (timeRanges && timeRanges.length >= 2) {
      amHours = timeRanges[0].replace(/\s+/g, '');
      pmHours = timeRanges[1].replace(/\s+/g, '');
    } else if (timeRanges && timeRanges.length === 1) {
      amHours = timeRanges[0].replace(/\s+/g, '');
    }
  }

  // デフォルト（一般的なクリニック：月火木金=全日診療、水=全日診療、土=午前のみ、日祝=休診）
  const matrix: WeeklyMatrix = {
    '月': { am: 'open', pm: 'open' },
    '火': { am: 'open', pm: 'open' },
    '水': { am: 'open', pm: 'open' },
    '木': { am: 'open', pm: 'open' },
    '金': { am: 'open', pm: 'open' },
    '土': { am: 'open', pm: 'closed' },
    '日': { am: 'closed', pm: 'closed' },
    '祝': { am: 'closed', pm: 'closed' }
  };

  if (closedDaysStr && closedDaysStr.trim()) {
    const text = closedDaysStr;
    // 一旦すべてopenに初期化してから休診日文字列を反映
    WEEK_DAYS.forEach(d => {
      matrix[d] = { am: 'open', pm: 'open' };
    });

    WEEK_DAYS.forEach(d => {
      const halfPmPattern = new RegExp(`${d}(?:曜日|曜)?\\s*(?:午後|PM|pm)`);
      const halfAmPattern = new RegExp(`${d}(?:曜日|曜)?\\s*(?:午前|AM|am)`);
      const fullDayPattern = new RegExp(`${d}(?:曜日|曜|・|$|\\s|,|、)`);

      if (halfPmPattern.test(text)) {
        matrix[d].am = 'open';
        matrix[d].pm = 'closed';
      } else if (halfAmPattern.test(text)) {
        matrix[d].am = 'closed';
        matrix[d].pm = 'open';
      } else if (fullDayPattern.test(text) || (d === '祝' && text.includes('祝')) || (d === '日' && text.includes('日祝'))) {
        matrix[d].am = 'closed';
        matrix[d].pm = 'closed';
      }
    });
  }

  return { amHours, pmHours, matrix };
}

/**
 * 週間カレンダーマトリクスから「休診日」のテキスト表現を自動生成する
 */
function buildClosedDaysString(matrix: WeeklyMatrix): string {
  const fullClosed: string[] = [];
  const halfClosed: string[] = [];

  WEEK_DAYS.forEach(d => {
    const { am, pm } = matrix[d];
    const label = d === '祝' ? '祝日' : `${d}曜`;
    if (am === 'closed' && pm === 'closed') {
      fullClosed.push(label);
    } else if (am === 'open' && pm === 'closed') {
      halfClosed.push(`${label}午後`);
    } else if (am === 'closed' && pm === 'open') {
      halfClosed.push(`${label}午前`);
    }
  });

  const parts = [...halfClosed, ...fullClosed];
  return parts.length > 0 ? parts.join('・') : '年中無休';
}

export default function ProjectDetailsPanel({
  project,
  actions,
  onClose,
  onCompleteAction,
  onPostponeAction,
  onUpdateProject,
  initialTab = 'basicInfo'
}: Props) {
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>(initialTab);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [inlineAiSettings, setInlineAiSettings] = useState(getAISettings);
  const [promptSavedToast, setPromptSavedToast] = useState<string | null>(null);
  const { masterData } = useMasterData();

  // 「これまでの活動」の修正・削除・新規追加用 state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActDate, setEditActDate] = useState('');
  const [editActType, setEditActType] = useState('');
  const [editActPoints, setEditActPoints] = useState<number>(0);
  const [editActContent, setEditActContent] = useState('');
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityFeedbackMsg, setActivityFeedbackMsg] = useState<string | null>(null);

  // 基本情報フォーム state（レセコン・法人番号・連携方法・メールを削除し、視覚的診療カレンダーを搭載）
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [clinicHours, setClinicHours] = useState('');
  const [closedDays, setClosedDays] = useState('');
  const [amHours, setAmHours] = useState('09:00〜12:30');
  const [pmHours, setPmHours] = useState('14:00〜18:00');
  const [weeklyMatrix, setWeeklyMatrix] = useState<WeeklyMatrix>(() =>
    parseScheduleFromStrings('', '').matrix
  );
  const [reservationSystem, setReservationSystem] = useState('');
  const [probability, setProbability] = useState<string>('未設定');
  const [director, setDirector] = useState('');
  const [department, setDepartment] = useState('');

  // URL解析ステータス
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [extractStatusMsg, setExtractStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveSuccessFlag, setSaveSuccessFlag] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, project?.id]);

  useEffect(() => {
    if (!project) return;
    const initHours = project.clinicHours || '午前 09:00〜12:30 / 午後 14:00〜18:00';
    const initClosed = project.closedDays || '水曜・土曜午後・日曜・祝日';
    const parsedSched = parseScheduleFromStrings(initHours, initClosed);

    setWebsiteUrl(project.websiteUrl || '');
    setAddress(project.address || '');
    setPhone(project.phone || '');
    setClinicHours(initHours);
    setClosedDays(initClosed);
    setAmHours(parsedSched.amHours);
    setPmHours(parsedSched.pmHours);
    setWeeklyMatrix(parsedSched.matrix);
    setReservationSystem(project.reservationSystem || '');
    setProbability(project.probability || '未設定');
    setDirector(project.pipelineMap?.director || '');
    setDepartment(project.pipelineMap?.department || project.clinicType || '');
    setExtractStatusMsg(null);
    setSaveSuccessFlag(false);
    setEditingActivityId(null);
    setIsAddingActivity(false);
  }, [project?.id]);

  if (!project) return null;

  // カレンダーセルのクリックで 診療(●) ⇔ 休診(休) ⇔ 短縮(▲) を切り替え
  const handleToggleSlot = (day: DayKey, period: 'am' | 'pm') => {
    setWeeklyMatrix(prev => {
      const current = prev[day][period];
      const nextState: SlotState =
        current === 'open' ? 'closed' : current === 'closed' ? 'short' : 'open';
      const updated: WeeklyMatrix = {
        ...prev,
        [day]: {
          ...prev[day],
          [period]: nextState
        }
      };
      const nextClosedStr = buildClosedDaysString(updated);
      setClosedDays(nextClosedStr);
      return updated;
    });
  };

  // 曜日ヘッダークリックでその曜日丸ごと 診療(●) ⇔ 休診(休) を切り替え
  const handleToggleWholeDay = (day: DayKey) => {
    setWeeklyMatrix(prev => {
      const isCurrentlyClosed = prev[day].am === 'closed' && prev[day].pm === 'closed';
      const updated: WeeklyMatrix = {
        ...prev,
        [day]: {
          am: isCurrentlyClosed ? 'open' : 'closed',
          pm: isCurrentlyClosed ? 'open' : 'closed'
        }
      };
      const nextClosedStr = buildClosedDaysString(updated);
      setClosedDays(nextClosedStr);
      return updated;
    });
  };

  // 午前・午後の時間入力変更時に clinicHours 文字列も同期
  const handleHoursInputChange = (newAm: string, newPm: string) => {
    setAmHours(newAm);
    setPmHours(newPm);
    setClinicHours(`午前 ${newAm} / 午後 ${newPm}`);
  };

  // 基本情報の一括保存ヘルパー
  const saveBasicInfoToProject = (overrideFields?: Partial<{
    websiteUrl: string;
    address: string;
    phone: string;
    clinicHours: string;
    closedDays: string;
    reservationSystem: string;
    probability: string;
    director: string;
    department: string;
  }>) => {
    if (!onUpdateProject) return;
    const nextWebsiteUrl = overrideFields?.websiteUrl ?? websiteUrl;
    const nextAddress = overrideFields?.address ?? address;
    const nextPhone = overrideFields?.phone ?? phone;
    const nextClinicHours = overrideFields?.clinicHours ?? clinicHours;
    const nextClosedDays = overrideFields?.closedDays ?? closedDays;
    const nextReservation = overrideFields?.reservationSystem ?? reservationSystem;
    const nextProb = overrideFields?.probability ?? probability;
    const nextDirector = overrideFields?.director ?? director;
    const nextDept = overrideFields?.department ?? department;

    onUpdateProject(project.id, {
      websiteUrl: nextWebsiteUrl,
      address: nextAddress,
      phone: nextPhone,
      clinicHours: nextClinicHours,
      closedDays: nextClosedDays,
      reservationSystem: nextReservation,
      clinicType: nextDept || project.clinicType,
      probability: (nextProb === '未設定' ? undefined : nextProb) as Project['probability'],
      pipelineMap: {
        ...project.pipelineMap,
        director: nextDirector,
        department: nextDept
      }
    });

    setSaveSuccessFlag(true);
    setTimeout(() => setSaveSuccessFlag(false), 3000);
  };

  // URLから実サイトをAI解析して自動入力＆カレンダー反映＆即時保存
  const handleExtractFromWebsite = async () => {
    if (!websiteUrl.trim()) {
      alert('クリニックのホームページURLを入力してください。');
      return;
    }

    setIsExtractingUrl(true);
    setExtractStatusMsg(null);
    try {
      const extracted = await extractClinicInfoFromUrl(
        websiteUrl,
        project.clinicName,
        address || project.address
      );

      const nextWebsiteUrl = extracted.websiteUrl || websiteUrl;
      const nextAddress = extracted.address || address;
      const nextPhone = extracted.phone || phone;
      const nextClinicHours = extracted.clinicHours || clinicHours;
      const nextClosedDays = extracted.closedDays || closedDays;
      const nextDirector = extracted.director || director;
      const nextDept = extracted.department || department;
      const nextReservation = extracted.reservationSystem || reservationSystem;

      // 抽出した診療時間・休診日を週間カレンダーマトリクスへ変換
      const parsedSched = parseScheduleFromStrings(nextClinicHours, nextClosedDays);
      const formattedHours = `午前 ${parsedSched.amHours} / 午後 ${parsedSched.pmHours}`;
      const formattedClosed = nextClosedDays || buildClosedDaysString(parsedSched.matrix);

      setWebsiteUrl(nextWebsiteUrl);
      setAddress(nextAddress);
      setPhone(nextPhone);
      setAmHours(parsedSched.amHours);
      setPmHours(parsedSched.pmHours);
      setWeeklyMatrix(parsedSched.matrix);
      setClinicHours(formattedHours);
      setClosedDays(formattedClosed);
      setDirector(nextDirector);
      setDepartment(nextDept);
      setReservationSystem(nextReservation);

      // 抽出結果をそのまま案件データへ自動保存
      saveBasicInfoToProject({
        websiteUrl: nextWebsiteUrl,
        address: nextAddress,
        phone: nextPhone,
        clinicHours: formattedHours,
        closedDays: formattedClosed,
        director: nextDirector,
        department: nextDept,
        reservationSystem: nextReservation
      });

      setExtractStatusMsg({
        type: 'success',
        text: '✅ AIサイト解析が完了し、診療時間・休診日カレンダーおよび基本情報を自動保存しました！'
      });
    } catch (err: any) {
      console.error(err);
      setExtractStatusMsg({
        type: 'error',
        text: err.message || 'サイトの解析中にエラーが発生しました。URLをご確認のうえ再度お試しください。'
      });
    } finally {
      setIsExtractingUrl(false);
    }
  };

  const projectActions = actions.filter(a => a.projectId === project.id && a.status === '未完了');
  const mainAction = projectActions[0];

  const handleGenerateAISummary = async (customPromptOverride?: string) => {
    setAiLoading(true);
    setAiError('');
    try {
      const totalPts = getClinicTotalPoints(project);
      const stageLabel = project.status === '失注' ? '失注' : normalizeProgressStage(project);
      const segmentLabel = isBtoBDealerProject(project) ? 'BtoBディーラー・パートナー枠' : 'クリニック直販枠';
      const contextText = `
【案件情報】
・案件名: ${project.clinicName}
・区分: ${segmentLabel}
・ステータス: ${stageLabel}
・確度: ${project.probability || '未設定'}
・累計獲得ポイント: ${totalPts}p
・営業担当: ${project.salesRep}
・現在のボール: ${project.ballHolder || project.salesRep}
・休診日: ${closedDays || project.closedDays || '未設定'}
・予約システム: ${reservationSystem || project.reservationSystem || '未設定'}
・次回予定タスク: ${mainAction ? `${mainAction.title}（期限: ${mainAction.deadline}）` : '未設定'}

【活動履歴】
${(project.activities || []).map(a => {
  const pts = inferActivityPoints(a);
  return `[${a.date}] ${a.type}${pts > 0 ? ` (+${pts}p)` : ''} - ${a.content}`;
}).join('\n') || '活動履歴なし'}
      `.trim();

      const result = await generateSummary(contextText, customPromptOverride || inlineAiSettings.prompt);
      setGeneratedSummary(result);
    } catch (err: any) {
      setAiError(err.message || 'エラーが発生しました');
    } finally {
      setAiLoading(false);
    }
  };

  const getHealthStatus = () => {
    if (!mainAction) return { color: 'dot-danger', label: '要対応', text: '次回アクション未設定' };
    const diff = differenceInDays(new Date(), new Date(project.lastActivityAt));
    if (diff >= 7 || new Date(mainAction.deadline) < new Date(format(new Date(), 'yyyy-MM-dd'))) {
      return { color: 'dot-danger', label: '要対応', text: diff >= 7 ? `${diff}日間動きなし` : '期限超過' };
    }
    if (diff >= 4 || format(new Date(mainAction.deadline), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      return { color: 'dot-warning', label: '注意', text: '今日期限、または数日動きなし' };
    }
    return { color: 'dot-success', label: '順調', text: '順調に進行中' };
  };

  const health = getHealthStatus();
  const pipelinePhases: readonly SalesProgressStage[] = SALES_PROGRESS_FLOW;
  const normalizedCurrentStage = normalizeProgressStage(project);

  const renderPipeline = (phases: readonly SalesProgressStage[], current: SalesProgressStage) => {
    const currentIndex = phases.indexOf(current);
    const activeIndex = currentIndex === -1 ? 0 : currentIndex;

    return (
      <div className="pipeline-progress" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.45rem' }}>
        {phases.map((phase, idx) => {
          let stateClass = '';
          if (idx < activeIndex || current === '受注') stateClass = 'completed';
          if (idx === activeIndex) stateClass = 'active';
          
          return (
            <React.Fragment key={phase}>
              <div
                onClick={() => onUpdateProject?.(project.id, { status: phase })}
                title={`クリックして進捗フローを「${phase}」に切り替え`}
                className={`pipeline-step ${stateClass}`}
                style={{ minWidth: '80px', marginBottom: '0.5rem', cursor: 'pointer' }}
              >
                {stateClass === 'completed' ? '☑' : stateClass === 'active' ? '●' : '○'}
                <span style={{ fontSize: '0.75rem', fontWeight: stateClass === 'active' ? 800 : 600 }}>{phase}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // 今日の曜日ハイライト用
  const todayDayMap: Record<number, DayKey> = {
    0: '日',
    1: '月',
    2: '火',
    3: '水',
    4: '木',
    5: '金',
    6: '土'
  };
  const currentDayKey = todayDayMap[new Date().getDay()];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content" onClick={e => e.stopPropagation()}>
        
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {project.clinicName}
              {project.probability && (
                <span className={`badge ${project.probability === 'A' ? 'success' : project.probability === 'B' ? 'info' : 'warning'}`}>
                  確度: {project.probability}
                </span>
              )}
              <span style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 800,
                padding: '0.18rem 0.65rem',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Trophy size={13} /> クリニック累計: {getClinicTotalPoints(project)}p
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #fde68a', marginRight: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', marginRight: '0.25rem' }}>🏀 ボール:</span>
              <select 
                className="input-field" 
                style={{ padding: '0', fontSize: '0.75rem', border: 'none', backgroundColor: 'transparent', color: '#b45309', fontWeight: 600, outline: 'none', cursor: 'pointer', width: 'auto' }}
                value={project.ballHolder || ''}
                onChange={e => onUpdateProject?.(project.id, { ballHolder: e.target.value })}
              >
                <option value="">(未設定)</option>
                <option value={project.salesRep}>{project.salesRep} (営業)</option>
                <option value="クリニック">クリニック（確認待ち）</option>
                <option value="サポート窓口">サポート窓口</option>
                <option value="パートナー業者">パートナー業者</option>
                <option value="経理">経理</option>
              </select>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}><X size={24} color="var(--text-muted)"/></button>
          </div>
        </div>

        {/* AI要約パネル */}
        <div className="ai-summary-box" style={{ background: 'linear-gradient(to right, #f8fafc, #f0f9ff)', border: '1px solid #bae6fd', padding: '1rem', borderRadius: '0.6rem', margin: '0 1.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="ai-summary-header" style={{ margin: 0, padding: 0, background: 'none', border: 'none', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Zap size={18} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '0.98rem' }}>活動履歴からの AI 要約</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setInlineAiSettings(getAISettings());
                  setShowPromptEditor(prev => !prev);
                }}
                className="btn btn-outline"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: showPromptEditor ? '#eff6ff' : '#ffffff',
                  borderColor: '#93c5fd',
                  color: '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.28rem'
                }}
              >
                <Bot size={13} />
                {showPromptEditor ? 'プロンプト設定を閉じる' : '⚙️ 要約プロンプト設定'}
              </button>

              {!aiLoading && (
                <button
                  type="button"
                  onClick={() => handleGenerateAISummary()}
                  className="btn btn-primary"
                  style={{ padding: '0.28rem 0.8rem', fontSize: '0.76rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Sparkles size={13} />
                  {generatedSummary ? '🔄 再生成する' : '✨ AIで要約を生成する'}
                </button>
              )}
            </div>
          </div>

          {/* プリセットワンクリック切替バー */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>要約モード:</span>
            {AI_PROMPT_PRESETS.map(preset => {
              const isSelected = inlineAiSettings.presetId === preset.id || inlineAiSettings.prompt.trim() === preset.prompt.trim();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...inlineAiSettings,
                      prompt: preset.prompt,
                      presetId: preset.id as AIPromptPresetId
                    };
                    setInlineAiSettings(updated);
                    saveAISettings(updated);
                    handleGenerateAISummary(preset.prompt);
                  }}
                  style={{
                    padding: '0.18rem 0.55rem',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    fontWeight: isSelected ? 800 : 600,
                    border: isSelected ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                    color: isSelected ? '#0369a1' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* インライン要約AIプロンプト設定エディタ */}
          {showPromptEditor && (
            <div style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #60a5fa',
              borderRadius: '0.55rem',
              padding: '0.85rem',
              marginBottom: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <strong style={{ fontSize: '0.8rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Bot size={15} color="#2563eb" /> 要約AIプロンプト設定（ここで直接編集・保存できます）
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    const resetState = {
                      ...inlineAiSettings,
                      prompt: defaultAIPrompt,
                      presetId: 'easy_os_standard' as AIPromptPresetId
                    };
                    setInlineAiSettings(resetState);
                    saveAISettings(resetState);
                    setPromptSavedToast('🔄 標準プロンプトに戻しました');
                    setTimeout(() => setPromptSavedToast(null), 2500);
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.35rem',
                    padding: '0.18rem 0.5rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <RotateCcw size={12} /> 標準プロンプトに戻す
                </button>
              </div>

              <textarea
                className="mock-input"
                rows={6}
                value={inlineAiSettings.prompt}
                onChange={e => setInlineAiSettings({ ...inlineAiSettings, prompt: e.target.value, presetId: 'custom' })}
                style={{ width: '100%', fontSize: '0.78rem', lineHeight: 1.5, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.55rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#166534', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={inlineAiSettings.enableAutoFallback !== false}
                    onChange={e => {
                      const updated = { ...inlineAiSettings, enableAutoFallback: e.target.checked };
                      setInlineAiSettings(updated);
                      saveAISettings(updated);
                    }}
                  />
                  🛡️ AIサーバー混雑時(High Demand)のスマート要約自動フォールバックを有効にする
                </label>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {promptSavedToast && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16a34a' }}>{promptSavedToast}</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.28rem 0.75rem', fontSize: '0.75rem', fontWeight: 800 }}
                    onClick={() => {
                      saveAISettings(inlineAiSettings);
                      setPromptSavedToast('✅ 保存して要約を更新しました');
                      setTimeout(() => setPromptSavedToast(null), 2500);
                      handleGenerateAISummary(inlineAiSettings.prompt);
                    }}
                  >
                    <Save size={13} /> プロンプトを保存して要約生成
                  </button>
                </div>
              </div>
            </div>
          )}

          {aiLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 0', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 className="spin" size={20} />
              <span style={{ fontSize: '0.875rem' }}>AIが活動履歴と獲得ポイントを分析し、要約を生成しています...</span>
              <style>
                {`
                  @keyframes spin { 100% { transform: rotate(360deg); } }
                  .spin { animation: spin 1s linear infinite; }
                `}
              </style>
            </div>
          ) : aiError ? (
            <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '0.5rem', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <AlertTriangle size={16} /> 生成エラー
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...inlineAiSettings, enableAutoFallback: true };
                    setInlineAiSettings(updated);
                    saveAISettings(updated);
                    handleGenerateAISummary(updated.prompt);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.22rem 0.65rem', fontSize: '0.74rem' }}
                >
                  ⚡ スマート要約で即座に生成する
                </button>
              </div>
              {aiError}
            </div>
          ) : generatedSummary ? (
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.875rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#0f172a' }}>
              {generatedSummary}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', textAlign: 'center', padding: '0.45rem 0' }}>
              上の「✨ AIで要約を生成する」または要約モードボタンを押すと、これまでの活動履歴・累計ポイントから次の一手を要約します。
            </div>
          )}
        </div>

        {/* 上段：今どうなっている？ */}
        <div className="drawer-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span className={`status-dot ${health.color}`}></span>
            <span style={{ fontWeight: 600 }}>{health.label}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>（{health.text}）</span>
          </div>
          
          <div className="two-col-grid" style={{ marginBottom: '1rem', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div><strong>ステータス：</strong> {project.status === '失注' ? '失注' : normalizedCurrentStage}</div>
            <div><strong>担当：</strong> {project.salesRep}</div>
            <div><strong>最終活動：</strong> {project.lastActivityAt}</div>
            <div><strong>経過：</strong> {differenceInDays(new Date(), new Date(project.lastActivityAt))}日</div>
            <div style={{ gridColumn: 'span 2' }}>
              <strong>ボール：</strong> <span className="badge neutral">{project.ballHolder}</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <strong style={{ fontSize: '0.875rem' }}>進捗フロー（クリックで切り替え可能・アクションボタン連動）</strong>
            {renderPipeline(pipelinePhases, normalizedCurrentStage)}
          </div>
        </div>

        {/* 中段：次に何をする？ */}
        <div className="drawer-section" style={{ borderLeft: '4px solid var(--warning)' }}>
          <h3>🔥 次にやること</h3>
          {mainAction ? (
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>{mainAction.title}</div>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>期限：</strong> {mainAction.deadline}</div>
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>理由：</strong> {mainAction.memo}</div>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={() => { onCompleteAction(mainAction.id); onClose(); }}>
                  <CheckCircle2 size={16} /> 完了にする
                </button>
                <div style={{ display: 'flex', gap: '0.25rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '1rem', marginLeft: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>延期:</span>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 1)}>+1日</button>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 3)}>+3日</button>
                  <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => onPostponeAction?.(mainAction.id, 7)}>+1週</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} />
              <div>
                <strong>次回アクション未設定</strong><br/>
                <span style={{ fontSize: '0.875rem' }}>この案件が止まらないよう、次のアクションを設定してください。</span>
              </div>
            </div>
          )}
        </div>

        {/* 下段：タブエリア */}
        <div>
          <div className="tabs-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.5rem' }}>
            <button className={`tab-button ${activeTab === 'basicInfo' ? 'active' : ''}`} onClick={() => setActiveTab('basicInfo')}>基本情報</button>
            <button className={`tab-button ${activeTab === 'pipelineMap' ? 'active' : ''}`} onClick={() => setActiveTab('pipelineMap')}>進捗ロードマップ</button>
            <button className={`tab-button ${activeTab === 'activities' ? 'active' : ''}`} onClick={() => setActiveTab('activities')}>活動履歴</button>
            <button className={`tab-button ${activeTab === 'deviceInfo' ? 'active' : ''}`} onClick={() => setActiveTab('deviceInfo')}>機器・補助金情報</button>
            <button className={`tab-button ${activeTab === 'prepStatus' ? 'active' : ''}`} onClick={() => setActiveTab('prepStatus')}>各種確認・準備状況</button>
            <button className={`tab-button ${activeTab === 'cashlessStatus' ? 'active' : ''}`} onClick={() => setActiveTab('cashlessStatus')}>キャッシュレス導入状況</button>
          </div>

          {activeTab === 'basicInfo' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>基本情報</h3>
                <button 
                  className="btn btn-primary" 
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.8rem',
                    backgroundColor: saveSuccessFlag ? '#16a34a' : undefined
                  }}
                  onClick={() => saveBasicInfoToProject()}
                >
                  <Save size={14} /> {saveSuccessFlag ? '保存しました！' : '保存'}
                </button>
              </div>

              {/* 確度の編集エリア */}
              <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.875rem' }}>確度:</label>
                <select
                  className="mock-input"
                  style={{ width: '200px', margin: 0 }}
                  value={probability}
                  onChange={e => setProbability(e.target.value)}
                >
                  <option value="未設定">未設定</option>
                  <option value="A">A (高い)</option>
                  <option value="B">B (普通)</option>
                  <option value="C">C (低い)</option>
                </select>
              </div>

              {/* ホームページURL（AI自動解析＆自動保存） */}
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #bae6fd', backgroundColor: '#f0f9ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0369a1' }}>
                    🌐 ホームページURL（AIサイト解析 ＆ 自動保存）
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${project.clinicName} ${address || project.address || ''}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#0284c7',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        backgroundColor: '#ffffff',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '0.35rem',
                        border: '1px solid #bae6fd'
                      }}
                    >
                      <Search size={12} /> Googleで医院HPを検索
                    </a>
                    {websiteUrl && (
                      <a
                        href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#0369a1',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          backgroundColor: '#ffffff',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.35rem',
                          border: '1px solid #bae6fd'
                        }}
                      >
                        <ExternalLink size={12} /> サイトを開く
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="url"
                    className="mock-input"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://example-clinic.com"
                    style={{ flex: 1, marginTop: 0, padding: '0.45rem 0.65rem', borderColor: '#7dd3fc', backgroundColor: '#ffffff' }}
                  />
                  <button 
                    type="button"
                    className="btn btn-primary" 
                    disabled={isExtractingUrl}
                    style={{
                      padding: '0.45rem 1rem',
                      whiteSpace: 'nowrap',
                      backgroundColor: isExtractingUrl ? '#64748b' : '#0284c7',
                      fontWeight: 700
                    }}
                    onClick={handleExtractFromWebsite}
                  >
                    {isExtractingUrl ? '🔄 AI解析中...' : '✨ AIで解析＆保存'}
                  </button>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '0.45rem' }}>
                  ※URLを入力して「✨ AIで解析＆保存」を押すと、実際のWebサイトから住所・電話番号・診療時間・休診日カレンダーを自動抽出し、そのまま保存します。
                </div>

                {extractStatusMsg && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    backgroundColor: extractStatusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: extractStatusMsg.type === 'success' ? '#166534' : '#991b1b',
                    border: `1px solid ${extractStatusMsg.type === 'success' ? '#86efac' : '#fca5a5'}`
                  }}>
                    {extractStatusMsg.text}
                  </div>
                )}
              </div>

              {/* 視覚的な「診療時間・休診日 週間カレンダー」カード */}
              <div className="card" style={{
                padding: '1.1rem',
                marginBottom: '1rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                    <Calendar size={18} color="#2563eb" />
                    <span>診療時間・休診日カレンダー（クリックで切替可）</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.74rem', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#15803d' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} /> ● 診療
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#b45309' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} /> ▲ 短縮/特記
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} /> 休 休診
                    </span>
                  </div>
                </div>

                {/* 週間マトリクス表（月・火・水・木・金・土・日・祝） */}
                <div style={{ overflowX: 'auto', marginBottom: '0.85rem' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'center',
                    fontSize: '0.82rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', textAlign: 'left', minWidth: '135px', color: '#334155', fontWeight: 800 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={13} color="#475569" /> 時間帯 ＼ 曜日
                          </div>
                        </th>
                        {WEEK_DAYS.map(day => {
                          const isSunOrHol = day === '日' || day === '祝';
                          const isSat = day === '土';
                          const isToday = day === currentDayKey;
                          return (
                            <th
                              key={day}
                              onClick={() => handleToggleWholeDay(day)}
                              title={`${day}曜日の全日 診療/休診 を切り替え`}
                              style={{
                                padding: '0.5rem 0.4rem',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                backgroundColor: isToday ? '#dbeafe' : isSunOrHol ? '#fef2f2' : isSat ? '#eff6ff' : '#f8fafc',
                                color: isSunOrHol ? '#dc2626' : isSat ? '#1d4ed8' : '#1e293b',
                                fontWeight: 800,
                                minWidth: '42px'
                              }}
                            >
                              <div>{day}</div>
                              {isToday && (
                                <div style={{ fontSize: '0.62rem', color: '#1d4ed8', fontWeight: 800 }}>今日</div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 午前行 */}
                      <tr>
                        <td style={{ padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}>☀️ 午前診療</div>
                          <input
                            type="text"
                            value={amHours}
                            onChange={e => handleHoursInputChange(e.target.value, pmHours)}
                            style={{
                              width: '100%',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.25rem',
                              padding: '0.18rem 0.35rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              marginTop: '0.15rem'
                            }}
                          />
                        </td>
                        {WEEK_DAYS.map(day => {
                          const st = weeklyMatrix[day].am;
                          return (
                            <td
                              key={`am-${day}`}
                              onClick={() => handleToggleSlot(day, 'am')}
                              style={{
                                padding: '0.5rem 0.3rem',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                backgroundColor: st === 'open' ? '#f0fdf4' : st === 'short' ? '#fffbeb' : '#fef2f2',
                                transition: 'all 0.1s'
                              }}
                            >
                              {st === 'open' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '999px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 900,
                                  fontSize: '0.9rem'
                                }}>
                                  ●
                                </span>
                              )}
                              {st === 'short' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '999px',
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  fontWeight: 900,
                                  fontSize: '0.82rem'
                                }}>
                                  ▲
                                </span>
                              )}
                              {st === 'closed' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '0.35rem',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  fontWeight: 800,
                                  fontSize: '0.74rem'
                                }}>
                                  休
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 午後行 */}
                      <tr>
                        <td style={{ padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}>🌙 午後診療</div>
                          <input
                            type="text"
                            value={pmHours}
                            onChange={e => handleHoursInputChange(amHours, e.target.value)}
                            style={{
                              width: '100%',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.25rem',
                              padding: '0.18rem 0.35rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              marginTop: '0.15rem'
                            }}
                          />
                        </td>
                        {WEEK_DAYS.map(day => {
                          const st = weeklyMatrix[day].pm;
                          return (
                            <td
                              key={`pm-${day}`}
                              onClick={() => handleToggleSlot(day, 'pm')}
                              style={{
                                padding: '0.5rem 0.3rem',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                backgroundColor: st === 'open' ? '#f0fdf4' : st === 'short' ? '#fffbeb' : '#fef2f2',
                                transition: 'all 0.1s'
                              }}
                            >
                              {st === 'open' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '999px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 900,
                                  fontSize: '0.9rem'
                                }}>
                                  ●
                                </span>
                              )}
                              {st === 'short' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '999px',
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  fontWeight: 900,
                                  fontSize: '0.82rem'
                                }}>
                                  ▲
                                </span>
                              )}
                              {st === 'closed' && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '0.35rem',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  fontWeight: 800,
                                  fontSize: '0.74rem'
                                }}>
                                  休
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 休診日サマリーバッジ ＆ テキスト微調整欄 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.65rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                      🕒 診療時間テキスト:
                    </span>
                    <input
                      type="text"
                      className="mock-input"
                      style={{ marginTop: 0, backgroundColor: '#ffffff', fontWeight: 600 }}
                      value={clinicHours}
                      onChange={e => setClinicHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '0.2rem' }}>
                      📕 休診日（カレンダー連動）:
                    </span>
                    <input
                      type="text"
                      className="mock-input"
                      style={{ marginTop: 0, backgroundColor: '#ffffff', fontWeight: 700, color: '#b91c1c' }}
                      value={closedDays}
                      onChange={e => {
                        setClosedDays(e.target.value);
                        const parsed = parseScheduleFromStrings(clinicHours, e.target.value);
                        setWeeklyMatrix(parsed.matrix);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 基本情報フィールド（住所・電話番号・院長・診療科目・予約システム） */}
              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.75rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>📍 住所:</strong>
                    <input type="text" className="mock-input" value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div>
                    <strong>📞 電話番号:</strong>
                    <input type="text" className="mock-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="例: 011-XXX-XXXX" />
                  </div>
                  <div>
                    <strong>👨‍⚕️ 院長:</strong>
                    <input type="text" className="mock-input" value={director} onChange={e => setDirector(e.target.value)} placeholder="例: 鈴木 太郎 先生" />
                  </div>
                  <div>
                    <strong>🏥 診療科目:</strong>
                    <input type="text" className="mock-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="例: 内科・消化器内科" />
                  </div>
                  <div>
                    <strong>📅 予約システム:</strong>
                    <input type="text" className="mock-input" value={reservationSystem} onChange={e => setReservationSystem(e.target.value)} placeholder="例: デジスマ / Web予約あり" />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '0.45rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      backgroundColor: saveSuccessFlag ? '#16a34a' : undefined
                    }}
                    onClick={() => saveBasicInfoToProject()}
                  >
                    <Save size={15} /> {saveSuccessFlag ? '✅ 基本情報を保存しました' : '基本情報を保存する'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pipelineMap' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                案件の現在地（ワークフロー）
              </h3>
              <ProjectProgressMap project={project} />
            </div>
          )}

          {activeTab === 'deviceInfo' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>機器・補助金情報</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (onUpdateProject) {
                      const deviceType = (document.getElementById('edit-device-type') as HTMLSelectElement).value;
                      const bodyColor = (document.getElementById('edit-body-color') as HTMLSelectElement).value;
                      const changeMachineColor = (document.getElementById('edit-change-machine-color') as HTMLSelectElement).value;
                      const subsidyName = (document.getElementById('edit-subsidy-name') as HTMLSelectElement).value;
                      
                      onUpdateProject(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          deviceType,
                          bodyColor,
                          changeMachineColor,
                          subsidyName
                        }
                      });
                      alert('機器・補助金情報を保存しました。');
                    }
                  }}
                >
                  <Save size={14} /> 保存
                </button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                  <div>
                    <strong>タイプ:</strong> 
                    <select id="edit-device-type" className="mock-input" defaultValue={project.pipelineMap?.deviceType || 'テマサックPro スタンドタイプ'}>
                      <option value="テマサックPro スタンドタイプ">テマサックPro スタンドタイプ</option>
                      <option value="テマサックPro カウンタータイプ">テマサックPro カウンタータイプ</option>
                      <option value="テマサックLite（キャッシュレス専用タイプ）">テマサックLite（キャッシュレス専用タイプ）</option>
                    </select>
                  </div>
                  <div>
                    <strong>機器カラー:</strong> 
                    <select id="edit-body-color" className="mock-input" defaultValue={project.pipelineMap?.bodyColor || masterData.deviceColors[0]}>
                      {masterData.deviceColors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <strong>釣銭機カラー:</strong> 
                    <select id="edit-change-machine-color" className="mock-input" defaultValue={project.pipelineMap?.changeMachineColor || masterData.changeMachineColors[0]}>
                      {masterData.changeMachineColors.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <strong>補助金:</strong> 
                    <select id="edit-subsidy-name" className="mock-input" defaultValue={project.pipelineMap?.subsidyName || '希望無し'}>
                      <option value="希望">希望</option>
                      <option value="希望無し">希望無し</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prepStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>各種確認・準備状況</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (onUpdateProject) {
                      onUpdateProject(project.id, {
                        surveyDate: (document.getElementById('edit-survey-date') as HTMLInputElement).value,
                        installationDate: (document.getElementById('edit-install-date') as HTMLInputElement).value
                      });
                      alert('準備状況・日程を保存しました。');
                    }
                  }}
                >
                  <Save size={14} /> 保存
                </button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>現地調査日</label>
                    <input type="date" id="edit-survey-date" className="mock-input" defaultValue={project.surveyDate || ''} style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>設置工事日</label>
                    <input type="date" id="edit-install-date" className="mock-input" defaultValue={project.installationDate || ''} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.triggerMethodCheck} /> トリガー方法確認</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.hpsEstimateReply} /> HPS見積注文書返信</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.magnetPrep} /> マグネット準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.signageData} /> サイネージデータ</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.threePieceSetPrep} /> 3点セット準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.bmposPcPrep} /> BMPOS用PC準備</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.constructionCheck} /> 工事手配確認</label>
                  <label><input type="checkbox" defaultChecked={project.pipelineMap?.shippingCheck} /> 出荷手配確認</label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cashlessStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>キャッシュレス導入状況</h3>
                <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}><Save size={14} /> 保存</button>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                  <div><strong>クレカ:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.creditStatus} /></div>
                  <div><strong>電子マネー:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.emoneyStatus} /></div>
                  <div><strong>QR:</strong> <input type="text" className="mock-input" defaultValue={project.pipelineMap?.qrStatus} /></div>
                </div>
              </div>
            </div>
          )}

          <style>{`
            .mock-input {
              width: 100%;
              padding: 0.35rem 0.5rem;
              border: 1px solid var(--border-color);
              border-radius: 0.3rem;
              margin-top: 0.25rem;
            }
            
            .tabs-container::-webkit-scrollbar {
              display: none;
            }
            .tabs-container {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {activeTab === 'activities' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>これまでの活動（累計獲得: {getClinicTotalPoints(project)}p）</span>
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
                    各活動の「修正」「削除」を行うと、クリニック累計ポイントおよび各実施日バッジも自動同期されます
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => {
                    setEditingActivityId(null);
                    setIsAddingActivity(prev => !prev);
                    setEditActDate(format(new Date(), 'yyyy-MM-dd'));
                    setEditActType('架電: 会話 (+3p)');
                    setEditActPoints(3);
                    setEditActContent('架電結果: 【会話】ヒアリングを実施');
                  }}
                >
                  <Plus size={14} />
                  <span>{isAddingActivity ? '追加を閉じる' : '＋ 活動を手動追加'}</span>
                </button>
              </div>

              {activityFeedbackMsg && (
                <div style={{
                  marginBottom: '0.85rem',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '0.45rem',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#166534',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}>
                  {activityFeedbackMsg}
                </div>
              )}

              {/* 新規活動追加フォーム */}
              {isAddingActivity && (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #2563eb',
                  borderRadius: '0.65rem',
                  padding: '0.9rem 1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e40af' }}>
                    ➕ 新しい活動履歴を追加
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', gap: '0.5rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>実施日</label>
                      <input
                        type="date"
                        className="mock-input"
                        value={editActDate}
                        onChange={e => setEditActDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>活動種別（定型選択 または 自由入力）</label>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <select
                          className="mock-input"
                          style={{ width: '175px' }}
                          value=""
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            const [label, ptStr] = val.split('|');
                            const pNum = parseInt(ptStr, 10) || 0;
                            setEditActType(label);
                            setEditActPoints(pNum);
                            setEditActContent(`${label} を実施（実施日: ${editActDate}）`);
                          }}
                        >
                          <option value="">▼ 定型から選ぶ...</option>
                          <option value="架電: 会話 (+3p)|3">架電: 会話 (+3p)</option>
                          <option value="架電: 不在 (+1p)|1">架電: 不在 (+1p)</option>
                          <option value="架電: 折返待ち (+1p)|1">架電: 折返待ち (+1p)</option>
                          <option value="初動メール (+5p)|5">初動メール (+5p)</option>
                          <option value="見積書送付 (+5p)|5">見積書送付 (+5p)</option>
                          <option value="オンラインデモ (+5p)|5">オンラインデモ (+5p)</option>
                          <option value="訪問デモ (+5p)|5">訪問デモ (+5p)</option>
                          <option value="来社デモ (+5p)|5">来社デモ (+5p)</option>
                          <option value="訪問 (+3p)|3">訪問 (+3p)</option>
                          <option value="ポスティング (+2p)|2">ポスティング (+2p)</option>
                          <option value="相談メール (+3p)|3">相談メール (+3p)</option>
                          <option value="後追いメール (+2p)|2">後追いメール (+2p)</option>
                          <option value="🎉 受注確定 (+10p)|10">🎉 受注確定 (+10p)</option>
                          <option value="資料・メール送付 (+2p)|2">資料・メール送付 (+2p)</option>
                        </select>
                        <input
                          type="text"
                          className="mock-input"
                          style={{ flex: 1 }}
                          value={editActType}
                          onChange={e => setEditActType(e.target.value)}
                          placeholder="活動種別タイトル"
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>獲得ポイント</label>
                      <input
                        type="number"
                        className="mock-input"
                        min={0}
                        max={50}
                        value={editActPoints}
                        onChange={e => setEditActPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>詳細内容・メモ</label>
                    <input
                      type="text"
                      className="mock-input"
                      value={editActContent}
                      onChange={e => setEditActContent(e.target.value)}
                      placeholder="活動の詳細内容を入力..."
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setIsAddingActivity(false)}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.3rem 0.9rem', fontSize: '0.78rem', fontWeight: 700 }}
                      onClick={() => {
                        if (!onUpdateProject) return;
                        const newAct: Activity = {
                          id: `act-${Date.now()}`,
                          projectId: project.id,
                          date: editActDate || format(new Date(), 'yyyy-MM-dd'),
                          type: editActType || '営業活動',
                          content: editActContent || '',
                          points: editActPoints
                        };
                        const nextActs = [newAct, ...(project.activities || [])];
                        const synced = syncProjectWithActivities(project, nextActs);
                        onUpdateProject(project.id, synced);
                        setIsAddingActivity(false);
                        setActivityFeedbackMsg(`✅ 活動「${newAct.type}」を追加しました（累計: ${synced.clinicPoints}p）`);
                        setTimeout(() => setActivityFeedbackMsg(null), 3000);
                      }}
                    >
                      <Save size={13} /> 追加して保存
                    </button>
                  </div>
                </div>
              )}

              {project.activities && project.activities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {project.activities.map(act => {
                    const pts = inferActivityPoints(act);
                    const isEditing = editingActivityId === act.id;

                    if (isEditing) {
                      return (
                        <div
                          key={act.id}
                          style={{
                            backgroundColor: '#eff6ff',
                            border: '2px solid #2563eb',
                            borderRadius: '0.65rem',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem'
                          }}
                        >
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af', display: 'flex', justifyContent: 'space-between' }}>
                            <span>✏️ 活動履歴の修正</span>
                            <span style={{ fontSize: '0.72rem', color: '#475569' }}>保存すると累計ポイントと日付バッジに即時反映されます</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 95px', gap: '0.5rem', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>実施日</label>
                              <input
                                type="date"
                                className="mock-input"
                                style={{ backgroundColor: '#ffffff' }}
                                value={editActDate}
                                onChange={e => setEditActDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>活動種別</label>
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <select
                                  className="mock-input"
                                  style={{ width: '160px', backgroundColor: '#ffffff' }}
                                  value=""
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    const [label, ptStr] = val.split('|');
                                    setEditActType(label);
                                    setEditActPoints(parseInt(ptStr, 10) || 0);
                                  }}
                                >
                                  <option value="">▼ 種別変更...</option>
                                  <option value="架電: 会話 (+3p)|3">架電: 会話 (+3p)</option>
                                  <option value="架電: 不在 (+1p)|1">架電: 不在 (+1p)</option>
                                  <option value="架電: 折返待ち (+1p)|1">架電: 折返待ち (+1p)</option>
                                  <option value="初動メール (+5p)|5">初動メール (+5p)</option>
                                  <option value="見積書送付 (+5p)|5">見積書送付 (+5p)</option>
                                  <option value="オンラインデモ (+5p)|5">オンラインデモ (+5p)</option>
                                  <option value="訪問デモ (+5p)|5">訪問デモ (+5p)</option>
                                  <option value="来社デモ (+5p)|5">来社デモ (+5p)</option>
                                  <option value="訪問 (+3p)|3">訪問 (+3p)</option>
                                  <option value="ポスティング (+2p)|2">ポスティング (+2p)</option>
                                  <option value="相談メール (+3p)|3">相談メール (+3p)</option>
                                  <option value="後追いメール (+2p)|2">後追いメール (+2p)</option>
                                  <option value="🎉 受注確定 (+10p)|10">🎉 受注確定 (+10p)</option>
                                </select>
                                <input
                                  type="text"
                                  className="mock-input"
                                  style={{ flex: 1, backgroundColor: '#ffffff' }}
                                  value={editActType}
                                  onChange={e => setEditActType(e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>ポイント (p)</label>
                              <input
                                type="number"
                                className="mock-input"
                                style={{ backgroundColor: '#ffffff', fontWeight: 800 }}
                                min={0}
                                max={50}
                                value={editActPoints}
                                onChange={e => setEditActPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>活動内容・メモ</label>
                            <input
                              type="text"
                              className="mock-input"
                              style={{ backgroundColor: '#ffffff' }}
                              value={editActContent}
                              onChange={e => setEditActContent(e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '0.28rem 0.75rem', fontSize: '0.76rem', backgroundColor: '#ffffff' }}
                              onClick={() => setEditingActivityId(null)}
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '0.28rem 0.85rem', fontSize: '0.76rem', fontWeight: 700 }}
                              onClick={() => {
                                if (!onUpdateProject) return;
                                const nextActs = (project.activities || []).map(item =>
                                  item.id === act.id
                                    ? {
                                        ...item,
                                        date: editActDate,
                                        type: editActType,
                                        content: editActContent,
                                        points: editActPoints
                                      }
                                    : item
                                );
                                const synced = syncProjectWithActivities(project, nextActs);
                                onUpdateProject(project.id, synced);
                                setEditingActivityId(null);
                                setActivityFeedbackMsg(`✅ 活動履歴を修正しました（累計ポイント: ${synced.clinicPoints}p）`);
                                setTimeout(() => setActivityFeedbackMsg(null), 3000);
                              }}
                            >
                              <Save size={13} /> 修正を保存
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={act.id}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.6rem',
                          padding: '0.75rem 0.95rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: 1 }}>
                          <div style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '0.25rem 0.55rem',
                            borderRadius: '0.35rem',
                            whiteSpace: 'nowrap',
                            border: '1px solid #cbd5e1'
                          }}>
                            📅 {act.date}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: '#0f172a' }}>
                              <span>{act.type}</span>
                              {pts > 0 && (
                                <span style={{
                                  backgroundColor: '#d1fae5',
                                  color: '#065f46',
                                  border: '1px solid #6ee7b7',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '999px'
                                }}>
                                  +{pts}p
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '0.22rem' }}>
                              {act.content}
                            </div>
                          </div>
                        </div>

                        {/* 修正・削除ボタン */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingActivity(false);
                              setEditingActivityId(act.id);
                              setEditActDate(act.date);
                              setEditActType(act.type);
                              setEditActPoints(pts);
                              setEditActContent(act.content);
                            }}
                            style={{
                              padding: '0.26rem 0.55rem',
                              borderRadius: '0.38rem',
                              border: '1px solid #93c5fd',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.22rem'
                            }}
                          >
                            <Edit2 size={12} /> 修正
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!onUpdateProject) return;
                              if (window.confirm(`活動「[${act.date}] ${act.type}」を削除しますか？\n（累計ポイントや日付バッジも自動で再計算されます）`)) {
                                const nextActs = (project.activities || []).filter(item => item.id !== act.id);
                                const synced = syncProjectWithActivities(project, nextActs);
                                onUpdateProject(project.id, synced);
                                setActivityFeedbackMsg(`🗑️ 活動「${act.type}」を削除しました（累計ポイント: ${synced.clinicPoints}p）`);
                                setTimeout(() => setActivityFeedbackMsg(null), 3000);
                              }
                            }}
                            style={{
                              padding: '0.26rem 0.55rem',
                              borderRadius: '0.38rem',
                              border: '1px solid #fca5a5',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.22rem'
                            }}
                          >
                            <Trash2 size={12} /> 削除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                  活動履歴はありません。「＋ 活動を手動追加」または超かんたん司令室のアクションボタンから記録できます。
                </div>
              )}
            </div>
          )}

          {activeTab === 'installation' && (
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>現地写真</h3>
              </div>

              {project.photos && project.photos.length > 0 ? (
                <div className="photo-grid">
                  {project.photos.map(photo => (
                    <div key={photo.id} className="photo-item">
                      <img src={photo.url} alt={photo.type} />
                      <div className="photo-caption">{photo.type}</div>
                      {photo.comment && <div className="photo-comment">{photo.comment}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>登録されている写真はありません。</div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
