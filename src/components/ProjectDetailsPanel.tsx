import React, { useState, useEffect } from 'react';
import {
  SALES_PROGRESS_FLOW,
  CASHLESS_PAYMENT_CATEGORIES,
  INTRO_FOUR_PHASES,
  TEMASAK_BODY_COLORS,
  TEMASAK_CHANGE_MACHINE_COLORS,
  TEMASAK_SCREEN_COLORS,
  TEMASAK_SIGNAGE_MODES,
  TEMASAK_TRIGGER_METHODS,
  TEMASAK_BMPOS_PC_OPTIONS,
  SUBSIDY_FRAME_OPTIONS,
  getProjectSpecAndGateSummary,
  getClinicTotalPoints,
  inferActivityPoints,
  isBtoBDealerProject,
  normalizeProgressStage,
  syncProjectWithActivities
} from '../types';
import type { Project, NextAction, SalesProgressStage, Activity, PipelineMap, IntroPhaseId } from '../types';
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

  // キャッシュレス決済の選択（複数組み合わせ可）ステート
  const [cashlessOptions, setCashlessOptions] = useState<string[]>([]);
  const [creditStatus, setCreditStatus] = useState('');
  const [jcbCreditStatus, setJcbCreditStatus] = useState('');
  const [emoneyStatus, setEmoneyStatus] = useState('');
  const [qrStatus, setQrStatus] = useState('');
  const [cashlessSaveMsg, setCashlessSaveMsg] = useState<string | null>(null);

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

    // キャッシュレス導入状況の復元
    const pm = project.pipelineMap || {};
    const inferredOpts = Array.isArray(pm.cashlessOptions)
      ? pm.cashlessOptions
      : [
          pm.creditStatus ? 'credit' : null,
          pm.jcbCreditStatus ? 'jcb_credit' : null,
          pm.emoneyStatus ? 'emoney' : null,
          pm.qrStatus ? 'qr' : null
        ].filter(Boolean) as string[];
    setCashlessOptions(inferredOpts);
    setCreditStatus(pm.creditStatus || '');
    setJcbCreditStatus(pm.jcbCreditStatus || '');
    setEmoneyStatus(pm.emoneyStatus || '');
    setQrStatus(pm.qrStatus || '');
    setCashlessSaveMsg(null);

    setExtractStatusMsg(null);
    setSaveSuccessFlag(false);
    setEditingActivityId(null);
    setIsAddingActivity(false);
  }, [project?.id]);

  // 外部（進捗フロー変更・他タブ操作・カンバン移動）で確度やキャッシュレス状態が更新された際も即時同期
  useEffect(() => {
    if (!project) return;
    setProbability(project.probability || '未設定');
    const pm = project.pipelineMap || {};
    const inferredOpts = Array.isArray(pm.cashlessOptions)
      ? pm.cashlessOptions
      : [
          pm.creditStatus ? 'credit' : null,
          pm.jcbCreditStatus ? 'jcb_credit' : null,
          pm.emoneyStatus ? 'emoney' : null,
          pm.qrStatus ? 'qr' : null
        ].filter(Boolean) as string[];
    setCashlessOptions(inferredOpts);
    setCreditStatus(pm.creditStatus || '');
    setJcbCreditStatus(pm.jcbCreditStatus || '');
    setEmoneyStatus(pm.emoneyStatus || '');
    setQrStatus(pm.qrStatus || '');
  }, [
    project?.probability,
    project?.pipelineMap?.creditStatus,
    project?.pipelineMap?.jcbCreditStatus,
    project?.pipelineMap?.emoneyStatus,
    project?.pipelineMap?.qrStatus,
    project?.pipelineMap?.cashlessOptions
  ]);

  if (!project) return null;

  // カレンダーセルのクリックで 診療(●) ⇔ 休診(休) ⇔ 短縮(▲) を切り替え（即時自動保存）
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
      saveBasicInfoToProject({ closedDays: nextClosedStr });
      return updated;
    });
  };

  // 曜日ヘッダークリックでその曜日丸ごと 診療(●) ⇔ 休診(休) を切り替え（即時自動保存）
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
      saveBasicInfoToProject({ closedDays: nextClosedStr });
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

          <div style={{ marginTop: '1.25rem' }}>
            <strong style={{ fontSize: '0.875rem' }}>① 営業進捗フロー（クリックで切り替え可能・カンバン＆活動履歴と自動連動）</strong>
            {renderPipeline(pipelinePhases, normalizedCurrentStage)}
          </div>

          {/* PDF Page 2: 導入4フェーズ ＆ 7 STEP仕様・公的書類・審査・現地調査 サマリーダッシュボード */}
          {(() => {
            const gate = getProjectSpecAndGateSummary(project);
            const pm = project.pipelineMap || {};
            return (
              <div style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.75rem',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                    ② 導入お手続き4フェーズ（PDF P.2準拠：申請前準備〜本番稼働まで約4か月）
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                    クリックで現在の導入フェーズを切替
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem' }}>
                  {INTRO_FOUR_PHASES.map(ph => {
                    const isCur = gate.introPhase === ph.id;
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() => {
                          onUpdateProject?.(project.id, {
                            pipelineMap: {
                              ...pm,
                              introPhase: ph.id as IntroPhaseId
                            }
                          });
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: isCur ? `2px solid ${ph.badgeColor}` : '1px solid #cbd5e1',
                          backgroundColor: isCur ? ph.headerBg : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.76rem', fontWeight: 900, color: isCur ? ph.badgeColor : '#334155', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{ph.title}</span>
                          {isCur && <span>● 現在</span>}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.15rem' }}>
                          {ph.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 4大チェック進捗ピル（クリックで該当タブへジャンプ） */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('deviceInfo')}
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid #93c5fd',
                      backgroundColor: gate.specCompletedCount === 7 ? '#dcfce7' : '#eff6ff',
                      color: gate.specCompletedCount === 7 ? '#166534' : '#1e40af',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🎨 7 STEP 仕様決定: {gate.specCompletedCount}/7 STEP
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('prepStatus')}
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid #67e8f9',
                      backgroundColor: gate.docsReadyCount === 4 ? '#dcfce7' : '#ecfeff',
                      color: gate.docsReadyCount === 4 ? '#166534' : '#0f766e',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    📄 公的書類3点＋GbizID: {gate.docsReadyCount}/4 完了
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cashlessStatus')}
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '999px',
                      border: gate.creditApproved ? '1px solid #86efac' : '1px solid #fcd34d',
                      backgroundColor: gate.creditApproved ? '#dcfce7' : '#fef3c7',
                      color: gate.creditApproved ? '#166534' : '#b45309',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    💳 クレカ審査(設置前提): {gate.creditApproved ? '✓ 通過済(設置OK)' : '審査・手続中'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('installation')}
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid #c7d2fe',
                      backgroundColor: gate.surveyReadyCount === 5 ? '#dcfce7' : '#eef2ff',
                      color: gate.surveyReadyCount === 5 ? '#166534' : '#3730a3',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🔌 現地調査5項目: {gate.surveyReadyCount}/5 確認済
                  </button>
                </div>
              </div>
            );
          })()}
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

        {/* 下段：タブエリア（PDFガイド全10ページ完全準拠） */}
        <div>
          <div className="tabs-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', paddingBottom: '0.6rem' }}>
            <button className={`tab-button ${activeTab === 'basicInfo' ? 'active' : ''}`} onClick={() => setActiveTab('basicInfo')}>📋 基本情報</button>
            <button className={`tab-button ${activeTab === 'deviceInfo' ? 'active' : ''}`} onClick={() => setActiveTab('deviceInfo')}>🎨 7 STEP 仕様選択</button>
            <button className={`tab-button ${activeTab === 'prepStatus' ? 'active' : ''}`} onClick={() => setActiveTab('prepStatus')}>💰 kz補助金・書類3点・2回支払</button>
            <button className={`tab-button ${activeTab === 'cashlessStatus' ? 'active' : ''}`} onClick={() => setActiveTab('cashlessStatus')}>💳 キャッシュレス・ジャックス審査</button>
            <button className={`tab-button ${activeTab === 'installation' ? 'active' : ''}`} onClick={() => setActiveTab('installation')}>🔌 現地調査 確認1〜5</button>
            <button className={`tab-button ${activeTab === 'activities' ? 'active' : ''}`} onClick={() => setActiveTab('activities')}>🕒 活動履歴 ({(project.activities || []).length})</button>
            <button className={`tab-button ${activeTab === 'pipelineMap' ? 'active' : ''}`} onClick={() => setActiveTab('pipelineMap')}>🗺️ 導入導線マップ</button>
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

              {/* 確度の編集エリア（変更時に即時保存＆カンバン連動） */}
              <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 700, fontSize: '0.875rem' }}>確度:</label>
                <select
                  className="mock-input"
                  style={{ width: '200px', margin: 0 }}
                  value={probability}
                  onChange={e => {
                    const nextProb = e.target.value;
                    setProbability(nextProb);
                    saveBasicInfoToProject({ probability: nextProb });
                  }}
                >
                  <option value="未設定">未設定</option>
                  <option value="A">A (高い)</option>
                  <option value="B">B (普通)</option>
                  <option value="C">C (低い)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ※変更すると即座に案件カンバン・リストに反映されます
                </span>
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
                      onBlur={e => saveBasicInfoToProject({ clinicHours: e.target.value })}
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
                      onBlur={e => saveBasicInfoToProject({ closedDays: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 基本情報フィールド（住所・電話番号・院長・診療科目・予約システム：入力確定時に自動保存） */}
              <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div className="two-col-grid" style={{ fontSize: '0.875rem', gap: '0.75rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>📍 住所:</strong>
                    <input
                      type="text"
                      className="mock-input"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      onBlur={e => saveBasicInfoToProject({ address: e.target.value })}
                    />
                  </div>
                  <div>
                    <strong>📞 電話番号:</strong>
                    <input
                      type="text"
                      className="mock-input"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onBlur={e => saveBasicInfoToProject({ phone: e.target.value })}
                      placeholder="例: 011-XXX-XXXX"
                    />
                  </div>
                  <div>
                    <strong>👨‍⚕️ 院長:</strong>
                    <input
                      type="text"
                      className="mock-input"
                      value={director}
                      onChange={e => setDirector(e.target.value)}
                      onBlur={e => saveBasicInfoToProject({ director: e.target.value })}
                      placeholder="例: 鈴木 太郎 先生"
                    />
                  </div>
                  <div>
                    <strong>🏥 診療科目:</strong>
                    <input
                      type="text"
                      className="mock-input"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      onBlur={e => saveBasicInfoToProject({ department: e.target.value })}
                      placeholder="例: 内科・消化器内科"
                    />
                  </div>
                  <div>
                    <strong>📅 予約システム:</strong>
                    <input
                      type="text"
                      className="mock-input"
                      value={reservationSystem}
                      onChange={e => setReservationSystem(e.target.value)}
                      onBlur={e => saveBasicInfoToProject({ reservationSystem: e.target.value })}
                      placeholder="例: デジスマ / Web予約あり"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    💡 各項目は入力後（フォーカス外れ時）およびカレンダー操作時に自動保存されます
                  </span>
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

              {/* 全タブ連動サマリーカード（7 STEP 仕様・キャッシュレス・kz補助金・現地調査が基本情報から一目で確認＆ジャンプ可能） */}
              {(() => {
                const pm = project.pipelineMap || {};
                const gate = getProjectSpecAndGateSummary(project);
                return (
                  <div className="card" style={{ padding: '1rem', border: '1.5px solid #93c5fd', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>
                        🔗 全タブ連動ステータス（仕様・キャッシュレス・kz補助金・現地調査）
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: '#475569' }}>
                        各カードをクリックすると該当タブへ移動して編集できます
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.65rem' }}>
                      {/* 1. 7 STEP 仕様 */}
                      <div
                        onClick={() => setActiveTab('deviceInfo')}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #bfdbfe',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#1e40af' }}>🎨 7 STEP 仕様選択</strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: gate.specCompletedCount === 7 ? '#15803d' : '#1d4ed8' }}>
                            {gate.specCompletedCount}/7 完了 ➔
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5 }}>
                          <div>・本体色: <strong>{pm.bodyColor || '未選択'}</strong> / 釣銭機: <strong>{pm.changeMachineColor || '未選択'}</strong></div>
                          <div>・画面色: <strong>{pm.screenColor || '未選択'}</strong> / トリガー: <strong>{pm.triggerMethod || '未選択'}</strong></div>
                          <div>・BM-POS用PC: <strong>{pm.bmposPcOption || '未選択'}</strong></div>
                        </div>
                      </div>

                      {/* 2. キャッシュレス・審査 */}
                      <div
                        onClick={() => setActiveTab('cashlessStatus')}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #fde68a',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#b45309' }}>💳 キャッシュレス・審査</strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: gate.creditApproved ? '#15803d' : '#b45309' }}>
                            {gate.creditApproved ? '審査通過 ✓' : '確認・編集 ➔'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5 }}>
                          <div>・クレジット: <strong>{pm.creditStatus || '未設定'}</strong></div>
                          <div>・JCB系: <strong>{pm.jcbCreditStatus || '未設定'}</strong></div>
                          <div>・電子マネー/QR: <strong>{pm.emoneyStatus || '未設定'} / {pm.qrStatus || '未設定'}</strong></div>
                        </div>
                      </div>

                      {/* 3. kz補助金・書類3点・2回支払 */}
                      <div
                        onClick={() => setActiveTab('prepStatus')}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #a7f3d0',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#047857' }}>💰 kz補助金・公的書類</strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857' }}>
                            書類 {gate.docsReadyCount}/4 ➔
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5 }}>
                          <div>・現在フェーズ: <strong>{gate.introPhase}</strong> ({pm.kzGrantAdopted ? '採択・受注済' : '進行中'})</div>
                          <div>・①KIZASHI報酬: <strong>{pm.payment1KzFeeStatus || '未請求'}</strong></div>
                          <div>・②本体代金支払: <strong>{pm.payment2TemasakStatus || '未請求'}</strong></div>
                        </div>
                      </div>

                      {/* 4. 現地調査 確認1〜5 */}
                      <div
                        onClick={() => setActiveTab('installation')}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.55rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #ddd6fe',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#6d28d9' }}>🔌 現地調査 確認1〜5</strong>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: gate.surveyReadyCount === 5 ? '#15803d' : '#6d28d9' }}>
                            {gate.surveyReadyCount}/5 完了 ➔
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#334155', lineHeight: 1.5 }}>
                          <div>・レセコン: <strong>{pm.receiptComputer || '未入力'}</strong></div>
                          <div>・現調日: <strong>{project.surveyDate || '未定'}</strong></div>
                          <div>・設置予定日: <strong>{project.installationDate || '未定'}</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'pipelineMap' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                案件の現在地（営業8段階フロー ＆ PDF準拠：導入4フェーズ 連動ワークフロー）
              </h3>
              <ProjectProgressMap
                project={project}
                onUpdateProject={onUpdateProject}
                onJumpToTab={(tab) => setActiveTab(tab)}
              />
            </div>
          )}

          {activeTab === 'deviceInfo' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {(() => {
                const pm = project.pipelineMap || {};
                const gate = getProjectSpecAndGateSummary(project);
                const saveSpecField = (updates: Partial<PipelineMap>, msg?: string) => {
                  onUpdateProject?.(project.id, {
                    pipelineMap: {
                      ...pm,
                      ...updates
                    }
                  });
                  if (msg) {
                    setCashlessSaveMsg(msg);
                    setTimeout(() => setCashlessSaveMsg(null), 2500);
                  }
                };

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          🎨 テマサック 7 STEP 仕様選択ガイド（PDF Page 3〜5 完全準拠）
                        </h3>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                          商談・お打ち合わせ中に各カードをクリックするだけで、7つの仕様がリアルタイムに決定・保存されます。
                        </div>
                      </div>
                      <span style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: gate.specCompletedCount === 7 ? '#059669' : '#1e40af',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 900
                      }}>
                        仕様決定進捗: {gate.specCompletedCount} / 7 STEP 完了
                      </span>
                    </div>

                    {cashlessSaveMsg && (
                      <div style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #6ee7b7',
                        color: '#065f46',
                        fontSize: '0.78rem',
                        fontWeight: 800
                      }}>
                        {cashlessSaveMsg}
                      </div>
                    )}

                    {/* STEP 1｜本体カラー選択（基本オールカラー3種 ／ 側面オプション6種） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#c2410c' }}>
                          STEP 1 ｜ 本体カラー選択（基本オールカラー3種 ／ 側面オプション6種）
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.bodyColor ? '#15803d' : '#64748b' }}>
                          {pm.bodyColor ? `✓ 選択中: ${pm.bodyColor}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.6rem' }}>
                        {TEMASAK_BODY_COLORS.map(c => {
                          const isSel = pm.bodyColor === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => saveSpecField({ bodyColor: c.id }, `✅ STEP 1 本体カラーを「${c.label}」に設定しました`)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '0.55rem',
                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ display: 'flex', width: '32px', height: '38px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #94a3b8', flexShrink: 0 }}>
                                <div style={{ flex: 1, backgroundColor: c.mainHex }} />
                                <div style={{ width: '11px', backgroundColor: c.sideHex, borderLeft: '1px solid #cbd5e1' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isSel ? '#1e40af' : '#0f172a' }}>{c.label}</div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: c.category === '基本オールカラー' ? '#2563eb' : '#64748b' }}>
                                  {c.category}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* STEP 2｜釣銭機カラー選択（2色から選択） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>
                          STEP 2 ｜ 釣銭機カラー選択（2色から選択）
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.changeMachineColor ? '#15803d' : '#64748b' }}>
                          {pm.changeMachineColor ? `✓ 選択中: ${pm.changeMachineColor}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                        {TEMASAK_CHANGE_MACHINE_COLORS.map(c => {
                          const isSel = pm.changeMachineColor === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => saveSpecField({ changeMachineColor: c.id }, `✅ STEP 2 釣銭機カラーを「${c.label}」に設定しました`)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 0.9rem',
                                borderRadius: '0.6rem',
                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ width: '34px', height: '34px', borderRadius: '6px', backgroundColor: c.hex, border: '1px solid #94a3b8', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 900, color: isSel ? '#1e40af' : '#0f172a' }}>{c.label}</div>
                                <div style={{ fontSize: '0.72rem', color: '#475569' }}>{c.subtitle}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* STEP 3｜画面カラー選択（全9色） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>
                          STEP 3 ｜ 患者様が触れる画面カラー選択（全9色）
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.screenColor ? '#15803d' : '#64748b' }}>
                          {pm.screenColor ? `✓ 選択中: ${pm.screenColor}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.5rem' }}>
                        {TEMASAK_SCREEN_COLORS.map(c => {
                          const isSel = pm.screenColor === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => saveSpecField({ screenColor: c.id }, `✅ STEP 3 画面カラーを「${c.label}」に設定しました`)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                padding: '0.5rem 0.7rem',
                                borderRadius: '0.5rem',
                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ width: '22px', height: '22px', borderRadius: '4px', backgroundColor: c.hex, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: isSel ? 900 : 700, color: isSel ? '#1e40af' : '#0f172a' }}>
                                {c.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* STEP 4｜サイネージ選択（3方式）＆ 領収印データのご準備 */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1d4ed8' }}>
                          STEP 4 ｜ サイネージ選択（3方式）＆ 領収印データのご準備
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.signageMode ? '#15803d' : '#64748b' }}>
                          {pm.signageMode ? `✓ 選択中: ${pm.signageMode}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                        {TEMASAK_SIGNAGE_MODES.map(m => {
                          const isSel = pm.signageMode === m.id;
                          return (
                            <div
                              key={m.id}
                              onClick={() => saveSpecField({ signageMode: m.id, signageData: true }, `✅ STEP 4 サイネージを「${m.label}」に設定しました`)}
                              style={{
                                padding: '0.75rem 0.85rem',
                                borderRadius: '0.6rem',
                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '0.84rem', fontWeight: 900, color: isSel ? '#1e40af' : '#0f172a' }}>{m.label}</div>
                              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.4 }}>{m.subtitle}</div>
                            </div>
                          );
                        })}
                      </div>

                      {pm.signageMode === '方式C：動画（YouTubeのURL）' && (
                        <div style={{ marginTop: '0.65rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>YouTube動画URL:</label>
                          <input
                            type="url"
                            className="mock-input"
                            placeholder="https://www.youtube.com/watch?v=..."
                            defaultValue={pm.signageYoutubeUrl || ''}
                            onBlur={e => saveSpecField({ signageYoutubeUrl: e.target.value }, '✅ YouTube動画URLを保存しました')}
                          />
                        </div>
                      )}

                      {/* 【重要】サイネージ・領収印データのご注意（PDF Page 3） */}
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fdba74',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <div style={{ fontSize: '0.74rem', color: '#9a3412', fontWeight: 700 }}>
                          ⚠️ 【重要】サイネージ・領収印データ：納入時は簡易作製可能（納入後の事後修正不可）。変更希望時は医院様よりデータ支給。
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {['弊社簡易作製（事後修正不可を案内済）', '医院様よりデータご支給'].map(opt => {
                            const isSel = pm.stampDataSource === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => saveSpecField({ stampDataSource: opt }, `✅ データ準備方法を「${opt}」に設定しました`)}
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '0.4rem',
                                  border: isSel ? '2px solid #ea580c' : '1px solid #fdba74',
                                  backgroundColor: isSel ? '#ea580c' : '#ffffff',
                                  color: isSel ? '#ffffff' : '#9a3412',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                {isSel ? `✓ ${opt}` : opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* STEP 5｜精算開始トリガー選択（9種・3系統） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#c2410c' }}>
                          STEP 5 ｜ 精算開始トリガー選択（全9方式）
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.triggerMethod ? '#15803d' : '#64748b' }}>
                          {pm.triggerMethod ? `✓ 選択中: ${pm.triggerMethod}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                        {(['■ 診察券・アプリ系', '■ 明細書・領収書 印字系', '■ 単票プリント出力系'] as const).map(grp => (
                          <div key={grp} style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '0.55rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', marginBottom: '0.45rem' }}>{grp}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {TEMASAK_TRIGGER_METHODS.filter(t => t.group === grp).map(t => {
                                const isSel = pm.triggerMethod === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => saveSpecField({ triggerMethod: t.id, triggerMethodCheck: true }, `✅ STEP 5 精算開始トリガーを「${t.label}」に設定しました`)}
                                    style={{
                                      textAlign: 'left',
                                      padding: '0.42rem 0.65rem',
                                      borderRadius: '0.4rem',
                                      border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                      backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                      color: isSel ? '#1e40af' : '#0f172a',
                                      fontSize: '0.78rem',
                                      fontWeight: isSel ? 900 : 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {isSel ? `● ${t.label}` : `○ ${t.label}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* STEP 6｜キャッシュレス決済の選択（複数組み合わせ可） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1e3a8a' }}>
                          STEP 6 ｜ キャッシュレス決済の選択（複数組み合わせ可）
                        </strong>
                        <button
                          type="button"
                          onClick={() => setActiveTab('cashlessStatus')}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '0.4rem',
                            border: '1px solid #2563eb',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          💳 ジャックス審査・詳細設定を開く ▸
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.55rem' }}>
                        {CASHLESS_PAYMENT_CATEGORIES.map(cat => {
                          const isSelected = cashlessOptions.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => {
                                const nextSelected = isSelected
                                  ? cashlessOptions.filter(id => id !== cat.id)
                                  : [...cashlessOptions, cat.id];
                                setCashlessOptions(nextSelected);
                                saveSpecField(
                                  {
                                    cashlessOptions: nextSelected,
                                    creditStatus: cat.id === 'credit' ? (!isSelected ? creditStatus || '導入希望' : '') : creditStatus,
                                    jcbCreditStatus: cat.id === 'jcb_credit' ? (!isSelected ? jcbCreditStatus || '導入希望' : '') : jcbCreditStatus,
                                    emoneyStatus: cat.id === 'emoney' ? (!isSelected ? emoneyStatus || '導入希望' : '') : emoneyStatus,
                                    qrStatus: cat.id === 'qr' ? (!isSelected ? qrStatus || '導入希望' : '') : qrStatus
                                  },
                                  `✅ STEP 6 キャッシュレス選択を更新しました`
                                );
                              }}
                              style={{
                                padding: '0.65rem 0.8rem',
                                borderRadius: '0.55rem',
                                border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '0.82rem', fontWeight: 900, color: isSelected ? '#1e40af' : '#0f172a' }}>
                                {isSelected ? '☑ ' : '☐ '}{cat.title}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem' }}>{cat.subtitle}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* STEP 7｜BM-POS用PC選択（新規購入 または 所有PC利用） */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#c2410c' }}>
                          STEP 7 ｜ 受付内 BM-POS用PC選択（新規購入 または 所有PC利用）
                        </strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: pm.bmposPcOption ? '#15803d' : '#64748b' }}>
                          {pm.bmposPcOption ? `✓ ${pm.bmposPcOption}` : '未選択'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
                        {TEMASAK_BMPOS_PC_OPTIONS.map(opt => {
                          const isSel = pm.bmposPcOption === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => saveSpecField({ bmposPcOption: opt.id, bmposPcPrep: true }, `✅ STEP 7 BM-POS用PCを「${opt.label}」に設定しました`)}
                              style={{
                                padding: '0.8rem 0.95rem',
                                borderRadius: '0.6rem',
                                border: isSel ? '2px solid #2563eb' : '1px solid #cbd5e1',
                                backgroundColor: isSel ? '#eff6ff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '0.86rem', fontWeight: 900, color: isSel ? '#1e40af' : '#0f172a' }}>{opt.label}</div>
                              <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.4 }}>{opt.subtitle}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 【BM-POS用PCの必須スペック要件】（PDF Page 5） */}
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.7rem 0.9rem',
                        borderRadius: '0.55rem',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fdba74'
                      }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#c2410c', marginBottom: '0.4rem' }}>
                          【BM-POS用PCの必須スペック要件】（所有PC利用時は3項目すべて必須）
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!pm.bmposSpecCpuCheck}
                              onChange={e => saveSpecField({ bmposSpecCpuCheck: e.target.checked })}
                            />
                            CPU：Intel Core i5（第11世代以上）
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!pm.bmposSpecRamCheck}
                              onChange={e => saveSpecField({ bmposSpecRamCheck: e.target.checked })}
                            />
                            メモリ：8GB以上（資料表記：8M以上）
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!pm.bmposSpecDedicatedCheck}
                              onChange={e => saveSpecField({ bmposSpecDedicatedCheck: e.target.checked })}
                            />
                            用途：BM-POS専用機（他ソフトとの相乗り不可）
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'prepStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const pm = project.pipelineMap || {};
                const gate = getProjectSpecAndGateSummary(project);
                const isIndividual = pm.entityType === '個人事業主';
                const savePrep = (updates: Partial<PipelineMap>, msg?: string) => {
                  onUpdateProject?.(project.id, {
                    pipelineMap: {
                      ...pm,
                      ...updates
                    }
                  });
                  if (msg) {
                    setCashlessSaveMsg(msg);
                    setTimeout(() => setCashlessSaveMsg(null), 2500);
                  }
                };

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>
                          💰 デジタル化AI導入補助金 ＆ KIZASHI（kz）公的書類3点・2回お支払い管理
                        </h3>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                          PDF Page 2・6・7・10 準拠：公的書類3点＋GbizID、KIZASHI申請ステップ、2回のお支払いを一元管理します。
                        </div>
                      </div>
                    </div>

                    {cashlessSaveMsg && (
                      <div style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #6ee7b7',
                        color: '#065f46',
                        fontSize: '0.78rem',
                        fontWeight: 800
                      }}>
                        {cashlessSaveMsg}
                      </div>
                    )}

                    {/* PDF Page 10: スムーズな導入スタートに向けて、まず最初にお願いしたい4つのアクション (ACT 1〜ACT 4) */}
                    <div className="card" style={{ padding: '1rem', border: '1.5px solid #2563eb', backgroundColor: '#eff6ff' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#1e40af', marginBottom: '0.65rem' }}>
                        ■ スムーズな導入スタートに向けて、まず最初にお願いしたい4つのアクション（PDF P.10）
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem' }}>
                        {[
                          {
                            key: 'act1DocsReady' as const,
                            title: 'ACT 1｜GbizID・公的書類3点',
                            desc: 'GbizID取得に加え、①前年度納税証明書、②確定申告書、③登記事項全部証明書（法人のみ）を準備'
                          },
                          {
                            key: 'act2ConsentSent' as const,
                            title: 'ACT 2｜同意書・希望シート送信',
                            desc: '②補助金同意書と③キャッシュレス導入希望シートに署名・捺印しメール送信（原本は要保管）'
                          },
                          {
                            key: 'act3SurveyReady' as const,
                            title: 'ACT 3｜現地調査日程・書類用意',
                            desc: '④現地調査の日程を調整し、当日までに「レセコン等のIPアドレス」と「プロバイダ申込書類」を用意'
                          },
                          {
                            key: 'act4SpecsDecided' as const,
                            title: 'ACT 4｜7 STEP 仕様・データ決定',
                            desc: '本体・釣銭機・画面カラーやトリガー方式を決定し、変更希望時はサイネージ・領収印データを準備'
                          }
                        ].map(act => {
                          const checked = !!pm[act.key];
                          return (
                            <div
                              key={act.key}
                              onClick={() => savePrep({ [act.key]: !checked }, `✅ ${act.title} を更新しました`)}
                              style={{
                                padding: '0.7rem 0.8rem',
                                borderRadius: '0.55rem',
                                border: checked ? '2px solid #059669' : '1px solid #93c5fd',
                                backgroundColor: checked ? '#ecfdf5' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '0.8rem', fontWeight: 900, color: checked ? '#065f46' : '#1e3a8a' }}>
                                {checked ? '☑ ' : '☐ '}{act.title}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.35 }}>
                                {act.desc}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PDF Page 7: 事前準備｜申請前にご用意いただく公的書類3点 ＋ GbizIDプライム */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#c2410c' }}>
                          📄 事前準備｜申請前にご用意いただく3つの公的書類 ＋ GbizIDプライム（PDF P.7）
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569' }}>経営形態:</span>
                          {(['医療法人（法人）', '個人事業主'] as const).map(et => {
                            const active = (pm.entityType || '医療法人（法人）') === et;
                            return (
                              <button
                                key={et}
                                type="button"
                                onClick={() => savePrep({ entityType: et }, `経営形態を「${et}」に設定しました`)}
                                style={{
                                  padding: '0.22rem 0.6rem',
                                  borderRadius: '999px',
                                  border: active ? '2px solid #0f766e' : '1px solid #cbd5e1',
                                  backgroundColor: active ? '#0f766e' : '#ffffff',
                                  color: active ? '#ffffff' : '#334155',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                {et}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                        <div
                          onClick={() => savePrep({ docTaxCert: !pm.docTaxCert }, '✅ 【書類①】前年度の納税証明書を更新しました')}
                          style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: pm.docTaxCert ? '2px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: pm.docTaxCert ? '#ecfdf5' : '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: pm.docTaxCert ? '#065f46' : '#c2410c' }}>
                            {pm.docTaxCert ? '☑ ' : '☐ '}【書類 ①】前年度の納税証明書
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
                            所轄の税務署等で発行される前年度分の納税証明書をご用意ください。
                          </div>
                        </div>

                        <div
                          onClick={() => savePrep({ docTaxReturn: !pm.docTaxReturn }, '✅ 【書類②】確定申告書を更新しました')}
                          style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: pm.docTaxReturn ? '2px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: pm.docTaxReturn ? '#ecfdf5' : '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: pm.docTaxReturn ? '#065f46' : '#c2410c' }}>
                            {pm.docTaxReturn ? '☑ ' : '☐ '}【書類 ②】確定申告書
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
                            直近分の確定申告書の控え一式をご用意ください。
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            if (isIndividual) return;
                            savePrep({ docRegistryCert: !pm.docRegistryCert }, '✅ 【書類③】登記事項全部証明書を更新しました');
                          }}
                          style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '0.55rem',
                            border: isIndividual ? '1px dashed #94a3b8' : pm.docRegistryCert ? '2px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: isIndividual ? '#f1f5f9' : pm.docRegistryCert ? '#ecfdf5' : '#ffffff',
                            cursor: isIndividual ? 'default' : 'pointer',
                            opacity: isIndividual ? 0.75 : 1
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: isIndividual ? '#64748b' : pm.docRegistryCert ? '#065f46' : '#c2410c' }}>
                            {isIndividual ? 'ー 【書類 ③】個人事業主のため不要' : `${pm.docRegistryCert ? '☑ ' : '☐ '}【書類 ③】登記事項全部証明書（法人のみ）`}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem' }}>
                            医療法人等の法人様のみ必要となります（個人事業主の医院様は不要です）。
                          </div>
                        </div>

                        <div style={{
                          padding: '0.75rem 0.85rem',
                          borderRadius: '0.55rem',
                          border: pm.gbizIdPrimeStatus === '取得済' ? '2px solid #2563eb' : '1px solid #93c5fd',
                          backgroundColor: pm.gbizIdPrimeStatus === '取得済' ? '#eff6ff' : '#ffffff'
                        }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1d4ed8' }}>
                            【アカウント ①】GbizID（ジービズIDプライム）
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                            {(['未取得', '申請中', '取得済'] as const).map(st => {
                              const isSel = (pm.gbizIdPrimeStatus || '未取得') === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => savePrep({ gbizIdPrimeStatus: st }, `✅ GbizIDプライムを「${st}」に更新しました`)}
                                  style={{
                                    flex: 1,
                                    padding: '0.25rem 0.4rem',
                                    borderRadius: '0.35rem',
                                    border: isSel ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                                    backgroundColor: isSel ? '#1d4ed8' : '#ffffff',
                                    color: isSel ? '#ffffff' : '#334155',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PDF Page 6 & 7: 補助金枠選択 ＆ KIZASHI（コンサルタント）連携 3 STEP */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f766e' }}>
                          🤝 補助金枠（最大4/5補助）＆ コンサルタント（KIZASHI）申請 3 STEP（PDF P.6〜7）
                        </strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', marginBottom: '0.85rem' }}>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>活用する補助金枠・類型:</label>
                          <select
                            className="mock-input"
                            value={pm.subsidyName || 'インボイス枠（インボイス対応類型）★注目'}
                            onChange={e => savePrep({ subsidyName: e.target.value }, `✅ 補助金枠を「${e.target.value}」に設定しました`)}
                          >
                            {SUBSIDY_FRAME_OPTIONS.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>申請前準備目安（例: 5/12）:</label>
                          <input
                            type="date"
                            className="mock-input"
                            defaultValue={pm.referralDeadline || ''}
                            onBlur={e => savePrep({ referralDeadline: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>補助金 申請締切日（例: 6/19）:</label>
                          <input
                            type="date"
                            className="mock-input"
                            defaultValue={pm.applicationDeadline || ''}
                            onBlur={e => savePrep({ applicationDeadline: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>交付決定予定・決定日（例: 7/29）:</label>
                          <input
                            type="date"
                            className="mock-input"
                            defaultValue={pm.grantDecisionDate || ''}
                            onBlur={e => savePrep({ grantDecisionDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.6rem' }}>
                        {[
                          {
                            key: 'kzStep1ConsentSent' as const,
                            title: 'STEP 1｜② 補助金同意書 署名捺印・メール送信',
                            desc: 'スキャンデータをメール受領済（※重要：同意書原本は医院様にて保管）'
                          },
                          {
                            key: 'kzStep2Contacted' as const,
                            title: 'STEP 2｜コンサルタント（KIZASHI）からの連絡',
                            desc: 'KIZASHIより医院様へメール・電話連絡済、申請スケジュール確認済'
                          },
                          {
                            key: 'kzStep3Applied' as const,
                            title: 'STEP 3｜⑤ KIZASHIリードによる補助金申請実施',
                            desc: 'KIZASHIの手順リードのもと、医院様にて補助金申請完了'
                          },
                          {
                            key: 'kzGrantAdopted' as const,
                            title: '🎉 交付決定（採択決定）➔ 受注確定',
                            desc: '補助金の交付決定（採択）通知完了！PHASE 3（注文書・設置調整）へ進行'
                          }
                        ].map(st => {
                          const done = !!pm[st.key];
                          return (
                            <div
                              key={st.key}
                              onClick={() => savePrep({ [st.key]: !done }, `✅ ${st.title} を更新しました`)}
                              style={{
                                padding: '0.7rem 0.85rem',
                                borderRadius: '0.55rem',
                                border: done ? '2px solid #0891b2' : '1px solid #cbd5e1',
                                backgroundColor: done ? '#ecfeff' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontSize: '0.8rem', fontWeight: 900, color: done ? '#0e7490' : '#0f172a' }}>
                                {done ? '☑ ' : '☐ '}{st.title}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.2rem', lineHeight: 1.35 }}>
                                {st.desc}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PDF Page 10: お支払いは「交付決定時」と「設置完了時」の2回に分かれます */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '0.75rem' }}>
                        💴 2回のお支払い管理（PDF P.10：「交付決定時」と「設置完了時」の2段階）
                      </strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
                        <div style={{ padding: '0.85rem', borderRadius: '0.6rem', backgroundColor: '#fff7ed', border: '1.5px solid #fb923c' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#c2410c' }}>
                            1回目のお支払い｜⑦ 補助金申請コンサルタント（KIZASHI）報酬
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#9a3412', marginTop: '0.2rem', fontWeight: 700 }}>
                            ■ ご請求タイミング：補助金の「交付決定（採択決定）」時点<br />
                            ※【ご注意】KIZASHIへのお支払い時期は、テマサック本体の設置前になります。
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem' }}>
                            {(['未請求', '請求書発送済', '支払完了'] as const).map(st => {
                              const isSel = (pm.payment1KzFeeStatus || '未請求') === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => savePrep({ payment1KzFeeStatus: st }, `✅ 1回目支払（KIZASHI報酬）を「${st}」に更新しました`)}
                                  style={{
                                    flex: 1,
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '0.4rem',
                                    border: isSel ? '2px solid #c2410c' : '1px solid #fdba74',
                                    backgroundColor: isSel ? '#c2410c' : '#ffffff',
                                    color: isSel ? '#ffffff' : '#9a3412',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ padding: '0.85rem', borderRadius: '0.6rem', backgroundColor: '#f8fafc', border: '1.5px solid #64748b' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#1e293b' }}>
                            2回目のお支払い｜● テマサック代金（＋2年分の保守料）
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem', fontWeight: 700 }}>
                            ■ ご請求タイミング：テマサック本体の「設置完了」時点<br />
                            ※設置後すぐに安心してお使いいただけるよう、2年分の保守料を含めたご案内です。
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem' }}>
                            {(['未請求', '請求書発送済', '支払完了'] as const).map(st => {
                              const isSel = (pm.payment2TemasakStatus || '未請求') === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => savePrep({ payment2TemasakStatus: st }, `✅ 2回目支払（テマサック代金＋2年保守料）を「${st}」に更新しました`)}
                                  style={{
                                    flex: 1,
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '0.4rem',
                                    border: isSel ? '2px solid #1e293b' : '1px solid #cbd5e1',
                                    backgroundColor: isSel ? '#1e293b' : '#ffffff',
                                    color: isSel ? '#ffffff' : '#334155',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'cashlessStatus' && (
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0f172a' }}>
                    💳 キャッシュレス導入状況 ➔ キャッシュレス決済の選択（複数組み合わせ可）
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                    導入希望・利用する決済区分をクリックして複数選択できます（選択すると即時保存されます）。
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '0.28rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#ffffff' }}
                    onClick={() => {
                      const allIds = CASHLESS_PAYMENT_CATEGORIES.map(c => c.id);
                      const nextCredit = creditStatus || '導入希望';
                      const nextJcb = jcbCreditStatus || '導入希望';
                      const nextEmoney = emoneyStatus || '導入希望';
                      const nextQr = qrStatus || '導入希望';
                      setCashlessOptions(allIds);
                      setCreditStatus(nextCredit);
                      setJcbCreditStatus(nextJcb);
                      setEmoneyStatus(nextEmoney);
                      setQrStatus(nextQr);
                      onUpdateProject?.(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          cashlessOptions: allIds,
                          creditStatus: nextCredit,
                          jcbCreditStatus: nextJcb,
                          emoneyStatus: nextEmoney,
                          qrStatus: nextQr
                        }
                      });
                      setCashlessSaveMsg('✅ 4区分すべて（フルセット）を選択・保存しました');
                      setTimeout(() => setCashlessSaveMsg(null), 3000);
                    }}
                  >
                    すべて選択（4種）
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '0.28rem 0.65rem', fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#ffffff' }}
                    onClick={() => {
                      const creditOnly = ['credit', 'jcb_credit'];
                      const nextCredit = creditStatus || '導入希望';
                      const nextJcb = jcbCreditStatus || '導入希望';
                      setCashlessOptions(creditOnly);
                      setCreditStatus(nextCredit);
                      setJcbCreditStatus(nextJcb);
                      setEmoneyStatus('');
                      setQrStatus('');
                      onUpdateProject?.(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          cashlessOptions: creditOnly,
                          creditStatus: nextCredit,
                          jcbCreditStatus: nextJcb,
                          emoneyStatus: '',
                          qrStatus: ''
                        }
                      });
                      setCashlessSaveMsg('✅ クレジット2種（主要＋JCB系）を選択・保存しました');
                      setTimeout(() => setCashlessSaveMsg(null), 3000);
                    }}
                  >
                    クレジット2種のみ
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '0.28rem 0.65rem', fontSize: '0.74rem', color: '#64748b', backgroundColor: '#ffffff' }}
                    onClick={() => {
                      setCashlessOptions([]);
                      setCreditStatus('');
                      setJcbCreditStatus('');
                      setEmoneyStatus('');
                      setQrStatus('');
                      onUpdateProject?.(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          cashlessOptions: [],
                          creditStatus: '',
                          jcbCreditStatus: '',
                          emoneyStatus: '',
                          qrStatus: ''
                        }
                      });
                      setCashlessSaveMsg('選択をクリアしました');
                      setTimeout(() => setCashlessSaveMsg(null), 3000);
                    }}
                  >
                    クリア
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.3rem 0.85rem', fontSize: '0.76rem', fontWeight: 800 }}
                    onClick={() => {
                      onUpdateProject?.(project.id, {
                        pipelineMap: {
                          ...project.pipelineMap,
                          cashlessOptions,
                          creditStatus,
                          jcbCreditStatus,
                          emoneyStatus,
                          qrStatus
                        }
                      });
                      setCashlessSaveMsg('✅ キャッシュレス導入状況を保存しました');
                      setTimeout(() => setCashlessSaveMsg(null), 3000);
                    }}
                  >
                    <Save size={14} /> 保存
                  </button>
                </div>
              </div>

              {cashlessSaveMsg && (
                <div style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #6ee7b7',
                  color: '#065f46',
                  fontSize: '0.78rem',
                  fontWeight: 800
                }}>
                  {cashlessSaveMsg}
                </div>
              )}

              {/* 4つのキャッシュレス決済選択カード（複数組み合わせ可） */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                {CASHLESS_PAYMENT_CATEGORIES.map(cat => {
                  const isSelected = cashlessOptions.includes(cat.id);
                  const statusValue =
                    cat.id === 'credit'
                      ? creditStatus
                      : cat.id === 'jcb_credit'
                      ? jcbCreditStatus
                      : cat.id === 'emoney'
                      ? emoneyStatus
                      : qrStatus;

                  const setStatusValue = (val: string) => {
                    if (cat.id === 'credit') setCreditStatus(val);
                    else if (cat.id === 'jcb_credit') setJcbCreditStatus(val);
                    else if (cat.id === 'emoney') setEmoneyStatus(val);
                    else setQrStatus(val);
                  };

                  const handleToggleCategory = () => {
                    const nextSelected = isSelected
                      ? cashlessOptions.filter(id => id !== cat.id)
                      : [...cashlessOptions, cat.id];
                    const nextStatusVal = !isSelected && !statusValue ? '導入希望' : isSelected ? '' : statusValue;

                    setCashlessOptions(nextSelected);
                    setStatusValue(nextStatusVal);

                    const nextMap = {
                      ...project.pipelineMap,
                      cashlessOptions: nextSelected,
                      creditStatus: cat.id === 'credit' ? nextStatusVal : creditStatus,
                      jcbCreditStatus: cat.id === 'jcb_credit' ? nextStatusVal : jcbCreditStatus,
                      emoneyStatus: cat.id === 'emoney' ? nextStatusVal : emoneyStatus,
                      qrStatus: cat.id === 'qr' ? nextStatusVal : qrStatus
                    };
                    onUpdateProject?.(project.id, { pipelineMap: nextMap });
                    setCashlessSaveMsg(
                      !isSelected
                        ? `✅ 「${cat.title}」を選択に追加しました`
                        : `「${cat.title}」の選択を解除しました`
                    );
                    setTimeout(() => setCashlessSaveMsg(null), 2500);
                  };

                  return (
                    <div
                      key={cat.id}
                      onClick={handleToggleCategory}
                      style={{
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                        borderRadius: '0.75rem',
                        padding: '0.95rem 1rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.65rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.96rem', fontWeight: 900, color: isSelected ? '#1e40af' : '#0f172a' }}>
                              {cat.title}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#64748b'
                          }}>
                            {isSelected ? '✓ 選択中' : '未選択'}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: isSelected ? '#1d4ed8' : '#475569',
                          marginTop: '0.4rem',
                          paddingLeft: '1.6rem'
                        }}>
                          {cat.subtitle}
                        </div>
                      </div>

                      {/* 進捗・備考欄（クリック伝播を止めて個別入力可能） */}
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          paddingTop: '0.55rem',
                          borderTop: isSelected ? '1px dashed #93c5fd' : '1px dashed #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <select
                          className="mock-input"
                          style={{
                            marginTop: 0,
                            width: '115px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            backgroundColor: '#ffffff'
                          }}
                          value={
                            ['導入希望', '申込準備中', '審査中', '導入済', '不要'].includes(statusValue)
                              ? statusValue
                              : statusValue
                              ? '導入希望'
                              : ''
                          }
                          onChange={e => {
                            const val = e.target.value;
                            setStatusValue(val);
                            const nextSelected =
                              val && val !== '不要'
                                ? Array.from(new Set([...cashlessOptions, cat.id]))
                                : cashlessOptions.filter(id => id !== cat.id);
                            setCashlessOptions(nextSelected);
                            onUpdateProject?.(project.id, {
                              pipelineMap: {
                                ...project.pipelineMap,
                                cashlessOptions: nextSelected,
                                creditStatus: cat.id === 'credit' ? val : creditStatus,
                                jcbCreditStatus: cat.id === 'jcb_credit' ? val : jcbCreditStatus,
                                emoneyStatus: cat.id === 'emoney' ? val : emoneyStatus,
                                qrStatus: cat.id === 'qr' ? val : qrStatus
                              }
                            });
                          }}
                        >
                          <option value="">状態を選択...</option>
                          <option value="導入希望">導入希望</option>
                          <option value="申込準備中">申込準備中</option>
                          <option value="審査中">審査中</option>
                          <option value="導入済">導入済</option>
                          <option value="不要">不要</option>
                        </select>
                        <input
                          type="text"
                          className="mock-input"
                          style={{ marginTop: 0, flex: 1, fontSize: '0.76rem', backgroundColor: '#ffffff' }}
                          placeholder="導入予定日・手数料・メモ..."
                          value={statusValue}
                          onChange={e => {
                            const val = e.target.value;
                            setStatusValue(val);
                          }}
                          onBlur={() => {
                            const nextSelected = statusValue.trim()
                              ? Array.from(new Set([...cashlessOptions, cat.id]))
                              : cashlessOptions;
                            setCashlessOptions(nextSelected);
                            onUpdateProject?.(project.id, {
                              pipelineMap: {
                                ...project.pipelineMap,
                                cashlessOptions: nextSelected,
                                creditStatus,
                                jcbCreditStatus,
                                emoneyStatus,
                                qrStatus
                              }
                            });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 現在の選択サマリー */}
              <div style={{
                marginTop: '0.9rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#ffffff',
                borderRadius: '0.6rem',
                border: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>
                    選択中の組み合わせ ({cashlessOptions.length} / 4区分):
                  </span>
                  {cashlessOptions.length === 0 ? (
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>未選択（上のカードをクリックして複数選択できます）</span>
                  ) : (
                    CASHLESS_PAYMENT_CATEGORIES.filter(c => cashlessOptions.includes(c.id)).map(c => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          border: '1px solid #93c5fd'
                        }}
                      >
                        {c.title}（{c.subtitle}）
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* PDF Page 8: キャッシュレス審査（ジャックス）4ステップ ＆ 本体設置の前提条件ゲート */}
              {(() => {
                const pm = project.pipelineMap || {};
                const steps = [
                  { id: 'STEP1_希望シート作成', label: 'STEP 1｜希望シートの作成', desc: '導入する決済の種類・ブランドを選択' },
                  { id: 'STEP2_署名メール送信', label: 'STEP 2｜署名捺印・メール送信', desc: 'スキャンデータをメール送信（原本は要保管）' },
                  { id: 'STEP3_ジャックス連絡済', label: 'STEP 3｜ジャックスより連絡', desc: 'ジャックス担当者よりメールまたは電話連絡' },
                  { id: 'STEP4_審査書類準備中', label: 'STEP 4｜審査情報・書類の準備', desc: '審査に必要な情報・書類をご案内・準備' },
                  { id: 'クレジット審査通過（設置OK）', label: '🎉 クレジット審査通過（本体設置OK）', desc: 'テマサック本体設置の必須前提条件クリア！' }
                ] as const;

                return (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1.5px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a' }}>
                      🔍 PDF Page 8｜キャッシュレス審査 4 STEP（ジャックス連携）＆ 本体設置の必須前提条件
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.5rem' }}>
                      {steps.map(st => {
                        const isCur = pm.cashlessReviewStep === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              const isPass = st.id === 'クレジット審査通過（設置OK）';
                              onUpdateProject?.(project.id, {
                                pipelineMap: {
                                  ...pm,
                                  cashlessReviewStep: st.id,
                                  creditApprovedForInstall: isPass ? true : pm.creditApprovedForInstall
                                }
                              });
                              setCashlessSaveMsg(`✅ 審査ステップを「${st.label}」に更新しました`);
                              setTimeout(() => setCashlessSaveMsg(null), 2500);
                            }}
                            style={{
                              padding: '0.65rem 0.75rem',
                              borderRadius: '0.55rem',
                              border: isCur ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              backgroundColor: isCur ? '#eff6ff' : '#f8fafc',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: '0.76rem', fontWeight: 900, color: isCur ? '#1e40af' : '#1e293b' }}>
                              {isCur ? '● ' : '○ '}{st.label}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.2rem' }}>{st.desc}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.55rem',
                      backgroundColor: '#fff7ed',
                      border: '1px solid #fdba74',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.6rem'
                    }}>
                      <div style={{ fontSize: '0.74rem', color: '#9a3412', lineHeight: 1.45 }}>
                        <strong>① クレジット審査（濃紺バー）：本体設置の必須前提条件</strong> — 本体を設置する前提として「クレジット審査が通っていること」が必要です。<br />
                        <strong>② 電子マネー・QR決済審査（青＋オレンジバー）：長期化に注意</strong> — 特にQR決済はクレジットより1か月以上審査に時間がかかる場合があります。
                      </div>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !pm.creditApprovedForInstall;
                            onUpdateProject?.(project.id, {
                              pipelineMap: {
                                ...pm,
                                creditApprovedForInstall: nextVal,
                                cashlessReviewStep: nextVal ? 'クレジット審査通過（設置OK）' : pm.cashlessReviewStep
                              }
                            });
                            setCashlessSaveMsg(nextVal ? '✅ クレジット審査通過（本体設置OK）を記録しました' : 'クレジット審査通過チェックを解除しました');
                            setTimeout(() => setCashlessSaveMsg(null), 2500);
                          }}
                          style={{
                            padding: '0.32rem 0.7rem',
                            borderRadius: '0.45rem',
                            border: pm.creditApprovedForInstall ? '2px solid #059669' : '1px solid #cbd5e1',
                            backgroundColor: pm.creditApprovedForInstall ? '#059669' : '#ffffff',
                            color: pm.creditApprovedForInstall ? '#ffffff' : '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          {pm.creditApprovedForInstall ? '✓ ① クレジット審査通過済（本体設置OK）' : '☐ ① クレジット審査通過にする'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !pm.qrEmoneyApproved;
                            onUpdateProject?.(project.id, {
                              pipelineMap: {
                                ...pm,
                                qrEmoneyApproved: nextVal
                              }
                            });
                            setCashlessSaveMsg(nextVal ? '✅ ② 電子マネー・QR審査完了を記録しました' : '電子マネー・QR審査完了チェックを解除しました');
                            setTimeout(() => setCashlessSaveMsg(null), 2500);
                          }}
                          style={{
                            padding: '0.32rem 0.7rem',
                            borderRadius: '0.45rem',
                            border: pm.qrEmoneyApproved ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            backgroundColor: pm.qrEmoneyApproved ? '#2563eb' : '#ffffff',
                            color: pm.qrEmoneyApproved ? '#ffffff' : '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          {pm.qrEmoneyApproved ? '✓ ② 電マネ・QR審査も完了' : '☐ ② 電マネ・QR審査完了にする'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                          <option value="初動メール (+5p)|5">初動メール (+5p) [➔ 初動]</option>
                          <option value="オンラインデモ (+5p)|5">オンラインデモ (+5p) [➔ デモ]</option>
                          <option value="訪問デモ (+5p)|5">訪問デモ (+5p) [➔ デモ]</option>
                          <option value="来社デモ (+5p)|5">来社デモ (+5p) [➔ デモ]</option>
                          <option value="見積書送付 (+5p)|5">見積書送付 (+5p) [➔ 見積]</option>
                          <option value="相談メール (+3p)|3">相談メール (+3p) [➔ 検討]</option>
                          <option value="後追いメール (+2p)|2">後追いメール (+2p) [➔ 後追い]</option>
                          <option value="💰 kz送客 (+5p)|5">💰 kz送客 (+5p) [➔ kz送客]</option>
                          <option value="🎉 受注確定 (+10p)|10">🎉 受注確定 (+10p) [➔ 受注]</option>
                          <option value="訪問 (+3p)|3">訪問 (+3p)</option>
                          <option value="ポスティング (+2p)|2">ポスティング (+2p)</option>
                          <option value="資料・メール送付 (+2p)|2">資料・メール送付 (+2p)</option>
                          <option value="🔄 ステージ移動: 問合せ|0">🔄 ステージ移動: 問合せ (0p)</option>
                          <option value="🔄 ステージ移動: 初動|0">🔄 ステージ移動: 初動 (0p)</option>
                          <option value="🔄 ステージ移動: デモ|0">🔄 ステージ移動: デモ (0p)</option>
                          <option value="🔄 ステージ移動: 見積|0">🔄 ステージ移動: 見積 (0p)</option>
                          <option value="🔄 ステージ移動: 検討|0">🔄 ステージ移動: 検討 (0p)</option>
                          <option value="🔄 ステージ移動: 後追い|0">🔄 ステージ移動: 後追い (0p)</option>
                          <option value="🔄 ステージ移動: kz送客|0">🔄 ステージ移動: kz送客 (0p)</option>
                          <option value="🔄 ステージ移動: 受注|0">🔄 ステージ移動: 受注 (0p)</option>
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
                        setActivityFeedbackMsg(`✅ 活動「${newAct.type}」を追加しました（進捗フロー・カンバン連動: 【${synced.status}】 / 累計: ${synced.clinicPoints}p）`);
                        setTimeout(() => setActivityFeedbackMsg(null), 3500);
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
                                  <option value="初動メール (+5p)|5">初動メール (+5p) [➔ 初動]</option>
                                  <option value="オンラインデモ (+5p)|5">オンラインデモ (+5p) [➔ デモ]</option>
                                  <option value="訪問デモ (+5p)|5">訪問デモ (+5p) [➔ デモ]</option>
                                  <option value="来社デモ (+5p)|5">来社デモ (+5p) [➔ デモ]</option>
                                  <option value="見積書送付 (+5p)|5">見積書送付 (+5p) [➔ 見積]</option>
                                  <option value="相談メール (+3p)|3">相談メール (+3p) [➔ 検討]</option>
                                  <option value="後追いメール (+2p)|2">後追いメール (+2p) [➔ 後追い]</option>
                                  <option value="💰 kz送客 (+5p)|5">💰 kz送客 (+5p) [➔ kz送客]</option>
                                  <option value="🎉 受注確定 (+10p)|10">🎉 受注確定 (+10p) [➔ 受注]</option>
                                  <option value="訪問 (+3p)|3">訪問 (+3p)</option>
                                  <option value="ポスティング (+2p)|2">ポスティング (+2p)</option>
                                  <option value="🔄 ステージ移動: 問合せ|0">🔄 ステージ移動: 問合せ (0p)</option>
                                  <option value="🔄 ステージ移動: 初動|0">🔄 ステージ移動: 初動 (0p)</option>
                                  <option value="🔄 ステージ移動: デモ|0">🔄 ステージ移動: デモ (0p)</option>
                                  <option value="🔄 ステージ移動: 見積|0">🔄 ステージ移動: 見積 (0p)</option>
                                  <option value="🔄 ステージ移動: 検討|0">🔄 ステージ移動: 検討 (0p)</option>
                                  <option value="🔄 ステージ移動: 後追い|0">🔄 ステージ移動: 後追い (0p)</option>
                                  <option value="🔄 ステージ移動: kz送客|0">🔄 ステージ移動: kz送客 (0p)</option>
                                  <option value="🔄 ステージ移動: 受注|0">🔄 ステージ移動: 受注 (0p)</option>
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
                                setActivityFeedbackMsg(`✅ 活動履歴を修正しました（進捗フロー・カンバン連動: 【${synced.status}】 / 累計: ${synced.clinicPoints}p）`);
                                setTimeout(() => setActivityFeedbackMsg(null), 3500);
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
                                setActivityFeedbackMsg(`🗑️ 活動「${act.type}」を削除しました（進捗フロー・カンバン連動: 【${synced.status}】 / 累計: ${synced.clinicPoints}p）`);
                                setTimeout(() => setActivityFeedbackMsg(null), 3500);
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
            <div className="drawer-section" style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const pm = project.pipelineMap || {};
                const gate = getProjectSpecAndGateSummary(project);
                const saveSurvey = (updates: Partial<PipelineMap>, msg?: string) => {
                  onUpdateProject?.(project.id, {
                    pipelineMap: {
                      ...pm,
                      ...updates
                    }
                  });
                  if (msg) {
                    setCashlessSaveMsg(msg);
                    setTimeout(() => setCashlessSaveMsg(null), 2500);
                  }
                };

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>
                          🔌 ④ 現地調査《弊社担当者》5つの確認チェックリスト（PDF Page 9 完全準拠）
                        </h3>
                        <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                          現地調査では診療の妨げにならないよう配慮し、設置スペース・電源・LAN・IPアドレス・プロバイダ書類を確認します。
                        </div>
                      </div>
                      <span style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: gate.surveyReadyCount === 5 ? '#059669' : '#1e40af',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        fontWeight: 900
                      }}>
                        現地調査確認: {gate.surveyReadyCount} / 5 項目完了
                      </span>
                    </div>

                    {cashlessSaveMsg && (
                      <div style={{
                        padding: '0.5rem 0.85rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #6ee7b7',
                        color: '#065f46',
                        fontSize: '0.78rem',
                        fontWeight: 800
                      }}>
                        {cashlessSaveMsg}
                      </div>
                    )}

                    {/* 現地調査日・設置工事日・電源LAN増設工事 */}
                    <div className="card" style={{ padding: '1rem', border: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>📅 ④ 現地調査 訪問日:</label>
                        <input
                          type="date"
                          className="mock-input"
                          defaultValue={project.surveyDate || ''}
                          onBlur={e => {
                            onUpdateProject?.(project.id, { surveyDate: e.target.value });
                            setCashlessSaveMsg('✅ 現地調査訪問日を保存しました');
                            setTimeout(() => setCashlessSaveMsg(null), 2500);
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>🚚 本体搬入・設置予定日:</label>
                        <input
                          type="date"
                          className="mock-input"
                          defaultValue={project.installationDate || ''}
                          onBlur={e => {
                            onUpdateProject?.(project.id, { installationDate: e.target.value });
                            setCashlessSaveMsg('✅ 本体搬入・設置予定日を保存しました');
                            setTimeout(() => setCashlessSaveMsg(null), 2500);
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.76rem', fontWeight: 800, color: '#334155' }}>🔌 電源・LANの事前増設工事:</label>
                        <select
                          className="mock-input"
                          value={pm.powerLanConstructionNeeded || '不要（既存設備でOK）'}
                          onChange={e => saveSurvey({ powerLanConstructionNeeded: e.target.value as PipelineMap['powerLanConstructionNeeded'], constructionCheck: true }, '✅ 電源・LAN工事区分を更新しました')}
                        >
                          <option value="不要（既存設備でOK）">不要（既存設備でOK）</option>
                          <option value="要増設工事（電源・LAN手配中）">要増設工事（電源・LAN手配中）</option>
                          <option value="増設工事完了">増設工事完了</option>
                        </select>
                      </div>
                    </div>

                    {/* PDF Page 9: 確認1〜確認5 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {[
                        {
                          key: 'surveyCheck1TemasakSpace' as const,
                          badge: '確認 1',
                          badgeBg: '#1e293b',
                          title: '自動精算機テマサックの設置場所の確認',
                          desc: '設置スペース・電源・LANの位置関係を確認します。（※設置場所によっては、事前に電源・LANの増設工事をお願いする場合があります。）',
                          urgent: false
                        },
                        {
                          key: 'surveyCheck2BmposSpace' as const,
                          badge: '確認 2',
                          badgeBg: '#1e293b',
                          title: 'BM-POS用PCの設置場所（主に受付内）の確認',
                          desc: 'だいたいは受付内への設置となります。PC周辺の電源コンセントおよびLANポートの位置関係を確認します。',
                          urgent: false
                        },
                        {
                          key: 'surveyCheck3RececomIp' as const,
                          badge: '確認 3',
                          badgeBg: '#ea580c',
                          title: 'レセコンなどのIPアドレスの確認【要事前準備】',
                          desc: '連携するレセコン等のIPアドレスを確認いたします。事前に設定情報をご用意ください。',
                          urgent: true,
                          memoKey: 'rececomIpMemo' as const,
                          memoPlaceholder: 'レセコンメーカー名・IPアドレス・サブネット等を記入...'
                        },
                        {
                          key: 'surveyCheck4Network' as const,
                          badge: '確認 4',
                          badgeBg: '#2563eb',
                          title: '院内・院外ネットワーク状況の確認',
                          desc: '院内ネットワーク（レセコン連携）および院外ネットワーク（インターネット通信）それぞれにつながることができるかを確認します。',
                          urgent: false
                        },
                        {
                          key: 'surveyCheck5ProviderDoc' as const,
                          badge: '確認 5',
                          badgeBg: '#ea580c',
                          title: 'プロバイダの申し込み内容が分かる書類の確認【要事前準備】',
                          desc: '回線環境を正確に把握するため、プロバイダの申し込み内容が分かる書類をご用意ください。',
                          urgent: true,
                          memoKey: 'providerDocMemo' as const,
                          memoPlaceholder: 'プロバイダ名・回線種別（光回線/ルーター機種等）を記入...'
                        }
                      ].map(item => {
                        const checked = !!pm[item.key];
                        return (
                          <div
                            key={item.key}
                            onClick={() => saveSurvey({ [item.key]: !checked }, `✅ ${item.badge}（${item.title}）を更新しました`)}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              borderRadius: '0.65rem',
                              overflow: 'hidden',
                              border: checked ? '2px solid #059669' : item.urgent ? '1.5px solid #fb923c' : '1px solid #cbd5e1',
                              backgroundColor: checked ? '#ecfdf5' : item.urgent ? '#fff7ed' : '#ffffff',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{
                              width: '76px',
                              backgroundColor: checked ? '#059669' : item.badgeBg,
                              color: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.82rem',
                              flexShrink: 0
                            }}>
                              <span>{item.badge}</span>
                              <span style={{ fontSize: '0.68rem', marginTop: '0.15rem' }}>{checked ? '✓ 済' : '未確認'}</span>
                            </div>
                            <div style={{ padding: '0.75rem 1rem', flex: 1 }}>
                              <div style={{ fontSize: '0.86rem', fontWeight: 900, color: checked ? '#065f46' : item.urgent ? '#c2410c' : '#0f172a' }}>
                                {checked ? '☑ ' : '☐ '}{item.title}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '0.2rem' }}>{item.desc}</div>
                              {item.memoKey && (
                                <div onClick={e => e.stopPropagation()} style={{ marginTop: '0.45rem' }}>
                                  <input
                                    type="text"
                                    className="mock-input"
                                    style={{ marginTop: 0, backgroundColor: '#ffffff', fontSize: '0.76rem' }}
                                    placeholder={item.memoPlaceholder}
                                    defaultValue={pm[item.memoKey] || ''}
                                    onBlur={e => saveSurvey({ [item.memoKey!]: e.target.value }, '✅ 現地調査メモを保存しました')}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
