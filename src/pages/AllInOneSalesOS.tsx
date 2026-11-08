import React, { useState, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Sparkles,
  CheckCircle2,
  Search,
  MapPin,
  Calendar,
  Copy,
  Check,
  Award,
  RotateCcw,
  ExternalLink,
  FileText,
  ChevronRight,
  Zap,
  Mail,
  Plus,
  Video,
  Car,
  Building2,
  Archive,
  X,
  Trophy,
  Footprints,
  Send,
  MessageSquare
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useProjects } from '../context/ProjectContext';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import seedData from '../utils/sales_os_seed.json';
import { parsePastedRosterText, convertParsedLeadsToProjects } from '../utils/roster42Data';
import {
  ACTION_POINT_RULES,
  SALES_PROGRESS_FLOW,
  getClinicTotalPoints,
  normalizeProgressStage,
  isBtoBDealerProject
} from '../types';
import type { Project, QuickCallOutcome, LostReasonType, SalesProgressStage } from '../types';

type CallFilter = 'all' | 'callback' | 'absent' | 'uncall' | 'talked' | 'interview' | 'won' | 'archived';
type AreaFilter = 'all' | '北海道' | '宮城県' | '福島県' | '秋田県' | '岩手県';
type SortMode = 'date_desc' | 'points_desc' | 'points_asc';
type SegmentViewMode = 'split' | 'clinic_only' | 'btob_only';

const DAILY_PT_Goal = 20;
const LOST_REASONS: LostReasonType[] = ['他社導入', '金銭面', 'その他'];

interface PointLog {
  id: string;
  time: string;
  clinicName: string;
  actionLabel: string;
  pts: number;
}

export default function AllInOneSalesOS() {
  const {
    projects,
    actions,
    addProjectsBulk,
    recordQuickCallResult,
    archiveProjectAsLost,
    restoreArchivedProject,
    handleCompleteAction,
    postponeAction,
    updateProject,
    resetToRoster42
  } = useProjects();

  // コピペ新規追加ドロワー/モーダル状態
  const [isPasteBoxOpen, setIsPasteBoxOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');

  // 全アクション共通：実施日選択ピッカー状態
  const [activeDemoPicker, setActiveDemoPicker] = useState<{
    projectId: string;
    demoType: QuickCallOutcome;
    date: string;
  } | null>(null);

  // アーカイブ（失注）理由選択ピッカー状態
  const [activeArchivePicker, setActiveArchivePicker] = useState<{
    projectId: string;
    reason: LostReasonType;
    note: string;
  } | null>(null);

  // ポイント履歴開閉状態
  const [isPtHistoryOpen, setIsPtHistoryOpen] = useState(false);

  // フィルタ＆並び替え状態
  const [callFilter, setCallFilter] = useState<CallFilter>('all');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date_desc');
  const [segmentViewMode, setSegmentViewMode] = useState<SegmentViewMode>('split');

  // 20pt ミッション状態 (LocalStorage永続化)
  const [pointLogs, setPointLogs] = useState<PointLog[]>(() => {
    try {
      const saved = localStorage.getItem('temasak_easy_os_pts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'pt-init-1', time: '09:30', clinicName: 'おおまがり鈴木内科医院', actionLabel: '初動メール送付 (+5pt)', pts: 5 },
      { id: 'pt-init-2', time: '10:15', clinicName: '医療法人たねだ内科クリニック', actionLabel: '電話会話・ヒアリング (+3pt)', pts: 3 }
    ];
  });

  // 詳細ドロワー / AIモーダル状態
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'basicInfo' | 'activities'>('basicInfo');
  const [aiModalProject, setAiModalProject] = useState<Project | null>(null);
  const [aiScene, setAiScene] = useState<'auto' | 'initial_email' | 'consult_email' | 'followup_email' | 'estimate' | 'absent' | 'callback' | 'talked' | 'subsidy'>('auto');
  const [customDraftSubject, setCustomDraftSubject] = useState('');
  const [customDraftBody, setCustomDraftBody] = useState('');
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const addPoint = (clinicName: string, actionLabel: string, pts: number) => {
    const nowTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const newLog: PointLog = {
      id: `pt-${Date.now()}`,
      time: nowTime,
      clinicName,
      actionLabel,
      pts
    };
    const next = [newLog, ...pointLogs];
    setPointLogs(next);
    localStorage.setItem('temasak_easy_os_pts', JSON.stringify(next));
  };

  const totalPointsToday = useMemo(() => pointLogs.reduce((acc, item) => acc + item.pts, 0), [pointLogs]);
  const ptProgressPct = Math.min(100, Math.round((totalPointsToday / DAILY_PT_Goal) * 100));

  // 各案件のデモ情報（種別・日付）抽出ヘルパー
  const extractDemoInfo = (p: Project): { type: string; date: string } | null => {
    if (p.demoDate) {
      return { type: p.demoType || '面談・デモ', date: p.demoDate };
    }
    const memo = p.memo || '';
    const matchWithKind = memo.match(/面談日:\s*([0-9-]+)\(([^)]+)\)/);
    if (matchWithKind) {
      return { date: matchWithKind[1], type: matchWithKind[2] };
    }
    const matchSimple = memo.match(/面談日:\s*([0-9-]+)/);
    if (matchSimple) {
      return { date: matchSimple[1], type: '面談・デモ' };
    }
    return null;
  };

  // 各案件の架電・進行ステータス分類ヘルパー
  const getCallState = (p: Project): {
    code: 'archived' | 'won' | 'interview' | 'callback' | 'talked' | 'absent' | 'uncall';
    label: string;
    badgeBg: string;
    badgeColor: string;
    borderColor: string;
  } => {
    if (p.status === '失注') {
      return {
        code: 'archived',
        label: `📦 アーカイブ（失注: ${p.lostReason || '未設定'}）`,
        badgeBg: '#f1f5f9',
        badgeColor: '#475569',
        borderColor: '#94a3b8'
      };
    }
    const memo = p.memo || '';
    if (p.status === '受注' || p.orderDate || memo.includes('受注済')) {
      return {
        code: 'won',
        label: '🎉 受注確定',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        borderColor: '#f59e0b'
      };
    }
    if (
      p.demoDate ||
      p.estimateSentDate ||
      memo.includes('面談日:') ||
      memo.includes('見積書送付済') ||
      p.status === 'デモ' ||
      p.status === '見積' ||
      p.status === '検討' ||
      p.status === '後追い'
    ) {
      return { code: 'interview', label: '🌟 デモ・見積進行', badgeBg: '#dcfce7', badgeColor: '#15803d', borderColor: '#86efac' };
    }
    if (memo.includes('架電状況: 折返待ち')) {
      return { code: 'callback', label: '🔥 折返待ち（最優先）', badgeBg: '#fee2e2', badgeColor: '#b91c1c', borderColor: '#fca5a5' };
    }
    if (memo.includes('架電状況: 会話') || p.status === '商談') {
      return { code: 'talked', label: '💬 会話済（商談中）', badgeBg: '#dbeafe', badgeColor: '#1d4ed8', borderColor: '#93c5fd' };
    }
    if (memo.includes('架電状況: 不在')) {
      return { code: 'absent', label: '📞 不在（再コール要）', badgeBg: '#fef3c7', badgeColor: '#b45309', borderColor: '#fcd34d' };
    }
    return { code: 'uncall', label: '📦 資料送付のみ（未架電）', badgeBg: '#f3e8ff', badgeColor: '#6d28d9', borderColor: '#d8b4fe' };
  };

  // KPIサマリー自動集計（クリニック直販KPI と ディーラー・パートナー企業 BtoB別枠KPI を完全分離）
  const kpiStats = useMemo(() => {
    const activeList = projects.filter(p => p.status !== '失注');
    const archivedList = projects.filter(p => p.status === '失注');

    const clinicActiveList = activeList.filter(p => !isBtoBDealerProject(p));
    const btobActiveList = activeList.filter(p => isBtoBDealerProject(p));
    const clinicArchivedList = archivedList.filter(p => !isBtoBDealerProject(p));
    const btobArchivedList = archivedList.filter(p => isBtoBDealerProject(p));

    // --- 1. クリニック直販KPI ---
    let total = clinicActiveList.length;
    let docSent = 0;
    let emailSent = 0;
    let estimateSent = 0;
    let talked = 0;
    let absent = 0;
    let callback = 0;
    let uncall = 0;
    let interview = 0;
    let demoCount = 0;
    let wonCount = 0;

    // --- 2. BtoB ディーラー・パートナー企業 別枠KPI ---
    let btobDocSent = 0;
    let btobEmailSent = 0;
    let btobEstimateSent = 0;
    let btobTalked = 0;
    let btobUncall = 0;
    let btobDemoCount = 0;
    let btobWonCount = 0;
    let btobTotalPts = 0;

    const byArea: Record<string, number> = {
      '北海道': 0,
      '宮城県': 0,
      '福島県': 0,
      '秋田県': 0,
      '岩手県': 0
    };
    const byMonth: Record<string, number> = {};
    const lostByReason: Record<string, number> = {
      '他社導入': 0,
      '金銭面': 0,
      'その他': 0
    };

    archivedList.forEach(p => {
      const r = p.lostReason || 'その他';
      if (r.startsWith('他社導入')) lostByReason['他社導入']++;
      else if (r.startsWith('金銭面')) lostByReason['金銭面']++;
      else lostByReason['その他']++;
    });

    // エリア・月フィルタ用件数（全営業中リスト）
    activeList.forEach(p => {
      if (p.receivedAt && p.receivedAt.length >= 7) {
        const ym = p.receivedAt.substring(0, 7);
        byMonth[ym] = (byMonth[ym] || 0) + 1;
      }
      Object.keys(byArea).forEach(pref => {
        if (p.address?.startsWith(pref)) {
          byArea[pref]++;
        }
      });
    });

    // クリニック直販のKPI集計
    clinicActiveList.forEach(p => {
      const stage = normalizeProgressStage(p);
      const stageIdx = SALES_PROGRESS_FLOW.indexOf(stage);
      if (p.memo?.includes('●資料送付済')) docSent++;
      if (p.memo?.includes('〇メール済') || p.initialEmailDate) emailSent++;
      if (p.memo?.includes('見積書送付済') || p.estimateSentDate || p.status === '見積') estimateSent++;

      // デモ到達件数（デモ・見積・検討・後追い・受注 または デモ日付あり）
      if (
        p.demoDate ||
        p.memo?.includes('面談日:') ||
        stageIdx >= SALES_PROGRESS_FLOW.indexOf('デモ')
      ) {
        demoCount++;
      }

      // 受注件数
      if (stage === '受注' || p.orderDate || p.memo?.includes('受注済')) {
        wonCount++;
      }

      const st = getCallState(p).code;
      if (st === 'won') {
        interview++;
        talked++;
      } else if (st === 'interview') {
        interview++;
        talked++;
      } else if (st === 'callback') {
        callback++;
      } else if (st === 'talked') {
        talked++;
      } else if (st === 'absent') {
        absent++;
      } else {
        uncall++;
      }
    });

    // BtoB ディーラー・パートナー企業の別枠KPI集計
    btobActiveList.forEach(p => {
      const stage = normalizeProgressStage(p);
      const stageIdx = SALES_PROGRESS_FLOW.indexOf(stage);
      btobTotalPts += getClinicTotalPoints(p);
      if (p.memo?.includes('●資料送付済')) btobDocSent++;
      if (p.memo?.includes('〇メール済') || p.initialEmailDate) btobEmailSent++;
      if (p.memo?.includes('見積書送付済') || p.estimateSentDate || p.status === '見積') btobEstimateSent++;

      if (
        p.demoDate ||
        p.memo?.includes('面談日:') ||
        stageIdx >= SALES_PROGRESS_FLOW.indexOf('デモ')
      ) {
        btobDemoCount++;
      }

      if (stage === '受注' || p.orderDate || p.memo?.includes('受注済')) {
        btobWonCount++;
      }

      const st = getCallState(p).code;
      if (st === 'won' || st === 'interview' || st === 'talked') {
        btobTalked++;
      } else if (st === 'uncall') {
        btobUncall++;
      }
    });

    const calledCount = talked + absent + callback;
    const contactRate = calledCount > 0 ? Math.round((talked / calledCount) * 100) : 0;
    const inquiryToDemoRate = total > 0 ? Math.round((demoCount / total) * 100) : 0;
    const demoToWonRate = demoCount > 0 ? Math.round((wonCount / demoCount) * 100) : 0;
    const inquiryToWonRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    const btobTotal = btobActiveList.length;
    const btobDemoRate = btobTotal > 0 ? Math.round((btobDemoCount / btobTotal) * 100) : 0;
    const btobWonRate = btobTotal > 0 ? Math.round((btobWonCount / btobTotal) * 100) : 0;

    return {
      total,
      allActiveCount: activeList.length,
      archivedCount: archivedList.length,
      clinicArchivedCount: clinicArchivedList.length,
      btobArchivedCount: btobArchivedList.length,
      lostByReason,
      docSent,
      emailSent,
      estimateSent,
      talked,
      absent,
      callback,
      uncall,
      interview,
      demoCount,
      wonCount,
      inquiryToDemoRate,
      demoToWonRate,
      inquiryToWonRate,
      calledCount,
      contactRate,
      byArea,
      byMonth,
      btob: {
        total: btobTotal,
        docSent: btobDocSent,
        emailSent: btobEmailSent,
        estimateSent: btobEstimateSent,
        talked: btobTalked,
        uncall: btobUncall,
        demoCount: btobDemoCount,
        wonCount: btobWonCount,
        totalPts: btobTotalPts,
        demoRate: btobDemoRate,
        wonRate: btobWonRate,
        archivedCount: btobArchivedList.length
      }
    };
  }, [projects]);

  // 絞り込みリスト（通常時は失注を除外し、callFilter === 'archived' の時は失注のみ表示）＋並び替え
  const filteredProjects = useMemo(() => {
    const matched = projects.filter(p => {
      const st = getCallState(p).code;
      const stage = normalizeProgressStage(p);
      if (callFilter === 'archived') {
        if (st !== 'archived') return false;
      } else if (callFilter === 'won') {
        if (st === 'archived') return false;
        if (st !== 'won' && stage !== '受注') return false;
      } else if (callFilter === 'interview') {
        if (st === 'archived') return false;
        const stageIdx = SALES_PROGRESS_FLOW.indexOf(stage);
        const isDemoOrLater =
          !!p.demoDate ||
          !!p.memo?.includes('面談日:') ||
          stageIdx >= SALES_PROGRESS_FLOW.indexOf('デモ');
        if (!isDemoOrLater && st !== 'interview') return false;
      } else {
        if (st === 'archived') return false;
        if (callFilter !== 'all' && st !== callFilter) return false;
      }

      if (areaFilter !== 'all' && !p.address?.startsWith(areaFilter)) return false;
      if (selectedMonth !== 'all' && !p.receivedAt?.startsWith(selectedMonth)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.clinicName.toLowerCase().includes(q);
        const matchAddr = (p.address || '').toLowerCase().includes(q);
        const matchType = (p.clinicType || '').toLowerCase().includes(q);
        const matchMemo = (p.memo || '').toLowerCase().includes(q);
        const matchLost = (p.lostReason || '').toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchType && !matchMemo && !matchLost) return false;
      }
      return true;
    });

    if (sortMode === 'points_desc') {
      return [...matched].sort((a, b) => getClinicTotalPoints(b) - getClinicTotalPoints(a));
    }
    if (sortMode === 'points_asc') {
      return [...matched].sort((a, b) => getClinicTotalPoints(a) - getClinicTotalPoints(b));
    }
    return matched;
  }, [projects, callFilter, areaFilter, selectedMonth, searchQuery, sortMode]);

  // クリニック直販リスト と BtoBディーラー・パートナー企業リスト に別枠分割
  const clinicFilteredProjects = useMemo(
    () => filteredProjects.filter(p => !isBtoBDealerProject(p)),
    [filteredProjects]
  );
  const btobFilteredProjects = useMemo(
    () => filteredProjects.filter(p => isBtoBDealerProject(p)),
    [filteredProjects]
  );

  const isFiltered =
    callFilter !== 'all' ||
    areaFilter !== 'all' ||
    selectedMonth !== 'all' ||
    searchQuery.trim() !== '' ||
    segmentViewMode !== 'split';

  // ワンクリック記録ハンドラ（本日の20ptミッション加算 ＋ クリニック別ポイント加算）
  const handleOneClickRecord = (
    p: Project,
    outcome: QuickCallOutcome,
    actionDate?: string
  ) => {
    const pts = ACTION_POINT_RULES[outcome] ?? 1;
    const nextClinicPts = getClinicTotalPoints(p) + pts;

    recordQuickCallResult(p.id, outcome, undefined, actionDate);

    const ptMap: Record<string, { pts: number; label: string }> = {
      '会話': { pts: 3, label: '架電: 会話 (+3p)' },
      '不在': { pts: 1, label: '架電: 不在 (+1p)' },
      '折返待ち': { pts: 1, label: '架電: 折返待ち (+1p)' },
      '初動メール': { pts: 5, label: '初動メール送付 (+5p)' },
      '見積書送付': { pts: 5, label: '見積書送付 (+5p)' },
      'オンラインデモ': { pts: 5, label: `オンラインデモ決定 [${actionDate || '日付確定'}] (+5p)` },
      '訪問デモ': { pts: 5, label: `訪問デモ決定 [${actionDate || '日付確定'}] (+5p)` },
      '来社デモ': { pts: 5, label: `来社デモ決定 [${actionDate || '日付確定'}] (+5p)` },
      '訪問': { pts: 3, label: 'クリニック現地訪問 (+3p)' },
      'ポスティング': { pts: 2, label: 'ポスティング実施 (+2p)' },
      '相談メール': { pts: 3, label: '相談メール送付 (+3p)' },
      '後追いメール': { pts: 2, label: '後追いメール送付 (+2p)' },
      '受注': { pts: 10, label: '🎉 受注確定！ (+10p)' },
      '面談設定': { pts: 5, label: '面談・実機デモ設定達成！ (+5p)' },
      '資料送付': { pts: 2, label: '資料送付 (+2p)' }
    };

    const info = ptMap[outcome] || { pts, label: `${outcome} (+${pts}p)` };
    addPoint(p.clinicName, info.label, info.pts);
    const dateMsg = actionDate ? `（日付: ${actionDate}）` : '';

    const stageMap: Partial<Record<QuickCallOutcome, string>> = {
      '初動メール': '初動',
      '不在': '初動',
      '折返待ち': '初動',
      'ポスティング': '初動',
      '会話': p.status === '見積' ? '検討' : '初動',
      '訪問': p.status === '見積' ? '検討' : '初動',
      'オンラインデモ': 'デモ',
      '訪問デモ': 'デモ',
      '来社デモ': 'デモ',
      '見積書送付': '見積',
      '相談メール': '検討',
      '後追いメール': '後追い',
      '受注': '受注'
    };
    const nextStageLabel = stageMap[outcome];

    triggerToast(
      `✅ 「${p.clinicName}」に【${outcome}${dateMsg} (+${info.pts}p)】を加算！（累計: ${nextClinicPts}p${nextStageLabel ? ` / 進捗: ${nextStageLabel}` : ''}）`
    );
  };

  // 進捗フロー（問合せ → 初動 → デモ → 見積 → 検討 → 後追い → 受注）クリック連動ハンドラ
  const handleSelectProgressStage = (p: Project, stage: SalesProgressStage) => {
    const currentStage = normalizeProgressStage(p);
    if (currentStage === stage && p.status === stage) return;
    updateProject(p.id, { status: stage });
    triggerToast(`🚀 「${p.clinicName}」の進捗フローを【${stage}】に更新しました`);
  };

  // 各アクションボタン押下時に「実施日を選択（今日 / 明日 / +3日後 / +1週間後）」ピッカーを開く
  const openDemoDatePicker = (p: Project, actionType: QuickCallOutcome) => {
    setActiveArchivePicker(null);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isDemo =
      actionType === 'オンラインデモ' ||
      actionType === '訪問デモ' ||
      actionType === '来社デモ';

    let defaultDate = todayStr;
    if (activeDemoPicker && activeDemoPicker.projectId === p.id && activeDemoPicker.date) {
      defaultDate = activeDemoPicker.date;
    } else if (isDemo) {
      const existingDemo = extractDemoInfo(p);
      defaultDate = existingDemo?.date || todayStr;
    } else if (actionType === '初動メール' && p.initialEmailDate) {
      defaultDate = p.initialEmailDate;
    } else if (actionType === '見積書送付' && p.estimateSentDate) {
      defaultDate = p.estimateSentDate;
    } else if (actionType === '訪問' && p.visitDate) {
      defaultDate = p.visitDate;
    } else if (actionType === 'ポスティング' && p.postingDate) {
      defaultDate = p.postingDate;
    } else if (actionType === '相談メール' && p.consultEmailDate) {
      defaultDate = p.consultEmailDate;
    } else if (actionType === '後追いメール' && p.followupEmailDate) {
      defaultDate = p.followupEmailDate;
    } else if (actionType === '受注' && p.orderDate) {
      defaultDate = p.orderDate;
    }

    setActiveDemoPicker({
      projectId: p.id,
      demoType: actionType,
      date: defaultDate
    });
  };

  // アクション＋実施日の確定ハンドラ
  const confirmDemoWithDate = (p: Project) => {
    if (!activeDemoPicker || activeDemoPicker.projectId !== p.id) return;
    if (!activeDemoPicker.date) {
      alert('実施日を選択してください。');
      return;
    }
    handleOneClickRecord(p, activeDemoPicker.demoType, activeDemoPicker.date);
    setActiveDemoPicker(null);
  };

  // アーカイブ（失注）ピッカーを開く
  const openArchiveReasonPicker = (p: Project) => {
    setActiveDemoPicker(null);
    setActiveArchivePicker({
      projectId: p.id,
      reason: '他社導入',
      note: ''
    });
  };

  // アーカイブ（失注）確定ハンドラ
  const confirmArchiveProject = (p: Project) => {
    if (!activeArchivePicker || activeArchivePicker.projectId !== p.id) return;
    archiveProjectAsLost(p.id, activeArchivePicker.reason, activeArchivePicker.note.trim() || undefined);
    setActiveArchivePicker(null);
    triggerToast(`📦 「${p.clinicName}」をアーカイブ（失注理由: ${activeArchivePicker.reason}）に移動しました`);
  };

  // AIナレッジ起案の自動生成ロジック
  const generateSmartAiDraft = (
    p: Project,
    forcedScene?: 'auto' | 'initial_email' | 'consult_email' | 'followup_email' | 'estimate' | 'absent' | 'callback' | 'talked' | 'subsidy'
  ) => {
    const stateCode = getCallState(p).code;
    const scene = (!forcedScene || forcedScene === 'auto') ? stateCode : forcedScene;
    const isNewOpen = p.clinicName.includes('新規開業') || p.source === '新規開業';
    const isDealer = p.clinicType?.includes('ディーラー') || p.source?.includes('ディーラー');
    const dept = p.clinicType || 'クリニック';

    let subject = '';
    let body = '';

    const recipientHeader = isDealer
      ? `${p.clinicName}\nご担当者 様`
      : `${p.clinicName}\n院長 先生 / 事務長 様`;

    if (scene === 'initial_email') {
      subject = `【テマサック】お問い合わせ御礼と資料・オンラインデモのご案内（${p.clinicName}様）`;
      body = `${recipientHeader}

突然のご連絡失礼いたします。
医療機関向け自動精算機「テマサック」担当の松浦でございます。

この度は自動精算機に関するお問い合わせ（資料請求）をいただき、誠にありがとうございます。
先日お送りいたしましたパンフレット資料はお手元に届いておりますでしょうか。

${p.address}エリアの${dept}様におかれましても、
・会計待ち時間の短縮と受付スタッフ様の負担軽減
・毎日のレジ締め作業の自動化（違算ゼロ）
・新紙幣およびクレジットカード・QRコード決済への対応
といった目的で導入いただくケースが急増しております。

■ 15分でわかる実機デモのご案内（オンライン／ご訪問／ご来社）
現在ご使用中のレセコン（ORCA・Medicom・PHC等）との連携方法や、貴院の受付スペースに設置した際の具体的なイメージを、実機をご覧いただきながらご案内可能です。

ご都合のよろしい日時や、現在お使いの「レセコンのメーカー名」を本メールへご返信いただけますと幸いです。
何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'consult_email') {
      subject = `【ご相談】${p.clinicName}様の受付・会計運用に合わせた自動精算機プランのご提案`;
      body = `${recipientHeader}

いつも大変お世話になっております。
自動精算機「テマサック」担当の松浦でございます。

貴院の受付・会計業務のさらなる効率化につきまして、現在の運用状況に合わせた最適なプランをご相談させていただきたくご連絡いたしました。

■ よくいただくご相談事項（${dept}様）
1. 現在ご使用中のレセコンとのスムーズな連携方法（バーコード連携／オンライン連携）
2. 受付カウンター周辺の省スペース設置イメージと現地確認
3. 補助金を活用した初期コスト圧縮シミュレーション

もし差し支えなければ、現在ご検討中のお悩みやご希望の導入時期などをお聞かせいただけますでしょうか。
オンラインまたは現地ご訪問にて、実機をご覧いただきながら15分ほどでご案内することも可能です。

何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'followup_email') {
      subject = `【その後のご検討状況はいかがでしょうか】自動精算機テマサックのご案内（${p.clinicName}様）`;
      body = `${recipientHeader}

いつも大変お世話になっております。
自動精算機「テマサック」担当の松浦でございます。

先日は自動精算機のご検討に際し、お時間をいただき誠にありがとうございました。
その後、院内でのご検討状況やご不明な点などはございませんでしょうか。

■ 導入をご検討中の${dept}様からよくいただくご質問への補足
1. 設置スペースや現在の運用フローに合わせた柔軟なカスタマイズが可能です
2. 医療DX・省力化補助金を活用した費用対効果シミュレーションもすぐにご用意いたします
3. 休診日を利用したスムーズな現地設置・スタッフ様向け操作レクチャーまで一貫サポートいたします

もし他社様との比較やご予算面、導入時期などで気になる点がございましたら、どのような些細なことでもお気軽にご相談ください。
引き続き何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'estimate') {
      subject = `【御見積書のご送付】自動精算機テマサック 導入プランのご案内（${p.clinicName}様）`;
      body = `${recipientHeader}

いつも大変お世話になっております。
株式会社テマサックの松浦でございます。

先日は貴重なお時間をいただき誠にありがとうございました。
ご要望をお伺いいたしました内容を元に、${p.clinicName}様向けの御見積書および導入構成案を作成いたしましたので送付いたします。

■ 今回のご提案内容のポイント
1. 貴院のレセコンとスムーズに連動する最適構成（バーコード／固定IP連携）
2. 受付スペースにすっきり収まる省スペース設計モデル
3. 医療DX・省力化補助金を適用した場合の実質負担シミュレーション

機器本体のカラーやキャッシュレス決済端末の組み合わせなど、ご予算や運用に合わせたカスタマイズも可能です。
内容をご確認いただき、ご不明な点やご調整のご希望がございましたらお気軽にお申し付けください。

何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'absent') {
      subject = `【テマサック】先ほどお電話いたしました（資料到着のご確認と${dept}様向け導入事例のご案内）`;
      body = `${recipientHeader}

いつも大変お世話になっております。
自動精算機「テマサック」担当の松浦でございます。

先ほど、先日お送りいたしました資料の到着確認でお電話させていただきましたが、ご不在でしたためメールにて失礼いたします。

${p.address}エリアの${dept}様におかれましても、
「受付の会計待ち時間をなくしたい」「毎日のレジ締め作業を15分以内に短縮したい」
というご相談を非常に多くいただいております。

■ テマサックの3大特長（トップ営業ナレッジ抜粋）
1. 主要レセコン（ORCA・Medicom・PHC等）と標準バーコード連携
2. 業界最小クラスの省スペース設計＆直感的な大画面タッチパネル
3. 医療DX補助金・IT導入補助金の申請サポート完備

もしよろしければ、現在お使いの「レセコンのメーカー名」を本メールへのご返信でお教えいただけないでしょうか？
貴院にぴったりの連携構成図と概算費用シミュレーションをすぐにお送りいたします。

お忙しいところ恐縮ですが、何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'callback') {
      subject = `【重要・テマサック】お電話の件（折り返し不要・メールにて要点をご案内いたします）`;
      body = `${recipientHeader}

お世話になっております。自動精算機「テマサック」の松浦です。
先日はお忙しい中お電話のご対応をいただきありがとうございました。
折り返しをお待ちしておりましたが、先生・スタッフ様のご負担にならぬよう、要点のみメールにてお送りいたします。

${isNewOpen ? '【新規ご開業向けの特別サポート】\nご開業前の内装・LAN配線段階から、レセコンメーカー様との連動テスト・設置位置のアドバイスを無償で承っております。' : '【既存クリニック様でのスムーズな導入】\n現在の院内ルーター（固定IP環境）を活かしたまま、休診日1日で設置・稼働が可能です。'}

■ ご確認いただきたい点（1点のみ）
・現在ご使用中（または導入予定）の「レセコン・電子カルテ名」
・ご希望の精算方法（現金のみ ／ クレジット・QRキャッシュレス併用）

上記を一行返信いただけますと、最短即日で御見積書と補助金スケジュールをご提示可能です。
ご不明な点がございましたら、いつでもお気軽にお申し付けください。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else if (scene === 'subsidy') {
      subject = `【補助金活用のご案内】${p.clinicName}様向け 自動精算機テマサック費用シミュレーション`;
      body = `${recipientHeader}

いつもお世話になっております。テマサック担当の松浦です。

現在、北海道・東北エリアの${dept}様で非常にご好評いただいている「補助金を活用した自動精算機導入プラン」のご案内です。

■ 補助金活用のポイント
・IT導入補助金／省力化投資補助金等の対象機器として登録済
・実質負担を大幅に抑えて最新モデル（新紙幣・キャッシュレス対応）を導入可能
・煩雑な申請書類の作成も弊社の専任スタッフが完全伴走サポート

次回の公募締切に間に合わせるため、まずは「15分でわかるオンライン実機デモ」または「概算見積書の送付」をご案内しております。
来週のご都合はいかがでしょうか？

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    } else {
      subject = `【御礼と次ステップのご案内】自動精算機テマサック レセコン連携・デモのご提案（${p.clinicName}様）`;
      body = `${recipientHeader}

いつも大変お世話になっております。
株式会社テマサックの松浦でございます。

先日はお忙しい中、お電話にて貴重なお時間をいただき誠にありがとうございました。
お話しさせていただきました通り、テマサックは${dept}様の受付業務負担を劇的に軽減できる自動精算機です。

■ 今後の進め方（トップ営業推奨ステップ）
1. レセコン連携方式の確認（中継PC「BM-POS」の固定IP接続確認）
2. 設置スペース（受付カウンター横・待合室）の寸法確認
3. 実機デモンストレーション（オンライン・訪問・来社）＆ 補助金適用のお見積り提示

つきましては、実機の画面動作や現金・キャッシュレス決済のスピードをご覧いただきたく、15分ほどのオンラインデモ（または現地ご訪問・ご来社デモ）をご提案いたします。
ご都合のよろしい曜日・時間帯（休診時間など）を2〜3候補いただけますと幸いです。

引き続き何卒よろしくお願い申し上げます。

--------------------------------------------------
株式会社テマサック 営業担当：松浦 貴文
--------------------------------------------------`;
    }

    setCustomDraftSubject(subject);
    setCustomDraftBody(body);
  };

  const openAiAssistant = (p: Project, initialScene: 'auto' | 'initial_email' | 'estimate' = 'auto') => {
    setAiModalProject(p);
    setAiScene(initialScene);
    generateSmartAiDraft(p, initialScene);
    setCopiedFlag(false);
  };

  // 関連するトップ営業ナレッジ（276件のシードデータから自動抽出）
  const matchedKnowledgeItems = useMemo(() => {
    const allK = (seedData as any).knowledge || [];
    if (!aiModalProject) return allK.slice(0, 3);
    const dept = aiModalProject.clinicType || '';
    const isNew = aiModalProject.clinicName.includes('新規開業');
    const matched = allK.filter((k: any) => {
      if (isNew && (k.stage === '導入準備' || k.category === '設置')) return true;
      if (dept.includes('歯科') && (k.clinic_name?.includes('歯科') || k.category === '価格・見積')) return true;
      return k.reusability_score >= 5;
    });
    return (matched.length > 0 ? matched : allK).slice(0, 3);
  }, [aiModalProject]);

  const detailProject = projects.find(p => p.id === detailProjectId) || null;

  // コピペテキストのリアルタイム解析プレビュー
  const parsedPreviewLeads = useMemo(() => {
    if (!pasteInputText.trim()) return [];
    return parsePastedRosterText(pasteInputText);
  }, [pasteInputText]);

  const handleRegisterPastedLeads = () => {
    if (parsedPreviewLeads.length === 0) {
      alert('貼り付けられたデータから顧客名を読み取れませんでした。「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」の形式で貼り付けてください。');
      return;
    }
    const { projects: newProjs, actions: newActs } = convertParsedLeadsToProjects(parsedPreviewLeads);
    addProjectsBulk(newProjs, newActs);
    addPoint(
      newProjs[0].clinicName + (newProjs.length > 1 ? ` 他${newProjs.length - 1}件` : ''),
      `コピペ新規反響登録 (${newProjs.length}件) (+${newProjs.length}p)`,
      newProjs.length
    );
    setPasteInputText('');
    setIsPasteBoxOpen(false);
    triggerToast(`🎉 コピペから ${newProjs.length} 件の新規案件を一括追加しました！（+${newProjs.length}p）`);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '4rem' }}>
      {/* トースト通知 */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '0.9rem 1.4rem',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: 600,
          fontSize: '0.95rem',
          borderLeft: '4px solid #10b981'
        }}>
          <Sparkles size={18} color="#34d399" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. 最上部オールインワン・ヘッダーバナー */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #312e81 100%)',
        borderRadius: '1rem',
        padding: '1.35rem 1.75rem',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.35)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '0.85rem',
              backgroundColor: 'rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <Zap size={28} color="#fbbf24" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{
                  backgroundColor: '#f59e0b',
                  color: '#0f172a',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  letterSpacing: '0.04em'
                }}>
                  超かんたん統合版
                </span>
                <span style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 600 }}>
                  KPI集計 × 営業案件管理（松浦様名簿 {projects.length}件） × AIナレッジ変換
                </span>
              </div>
              <h1 style={{ margin: '0.2rem 0 0 0', fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                テマサック営業OS ワンクリック司令室 ({kpiStats.total}件 / アーカイブ{kpiStats.archivedCount}件)
              </h1>
            </div>
          </div>

          {/* 今日の20ptミッション・ミニゲージ */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '0.85rem',
            padding: '0.75rem 1.25rem',
            minWidth: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fde68a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                🔥 今日の20ptミッション
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  {totalPointsToday} <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>/ {DAILY_PT_Goal} pt</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPtHistoryOpen(prev => !prev)}
                  style={{
                    padding: '0.18rem 0.5rem',
                    borderRadius: '0.35rem',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    color: '#e2e8f0',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isPtHistoryOpen ? '履歴を閉じる' : '獲得履歴'}
                </button>
              </div>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${ptProgressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #10b981)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* ポイント配点ルール一覧（日次＆クリニック別共通）バッジバー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          flexWrap: 'wrap',
          paddingTop: '0.55rem',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          fontSize: '0.74rem'
        }}>
          <span style={{ color: '#fde68a', fontWeight: 800, marginRight: '0.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Trophy size={13} color="#fbbf24" /> クリニック別ポイント制:
          </span>
          <span style={{
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            border: '1px solid rgba(147, 197, 253, 0.45)',
            color: '#eff6ff',
            padding: '0.16rem 0.55rem',
            borderRadius: '999px',
            fontWeight: 700
          }}>
            📞 架電：会話 +3p / 不在 +1p / 折返待ち +1p
          </span>
          {[
            '✉️ 初動メール +5p',
            '📄 見積書送付 +5p',
            '💻 オンラインデモ +5p',
            '🚗 訪問デモ +5p',
            '🏢 来社デモ +5p'
          ].map(badge => (
            <span
              key={badge}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.22)',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                color: '#ecfdf5',
                padding: '0.16rem 0.55rem',
                borderRadius: '999px',
                fontWeight: 700
              }}
            >
              {badge}
            </span>
          ))}
          {[
            '🚶 訪問 +3p',
            '📮 ポスティング +2p',
            '📩 相談メール +3p',
            '📨 後追いメール +2p',
            '🎉 受注 +10p'
          ].map(badge => (
            <span
              key={badge}
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.24)',
                border: '1px solid rgba(252, 211, 77, 0.5)',
                color: '#fef3c7',
                padding: '0.16rem 0.55rem',
                borderRadius: '999px',
                fontWeight: 700
              }}
            >
              {badge}
            </span>
          ))}
        </div>

        {/* 獲得ポイント履歴ドロワー */}
        {isPtHistoryOpen && (
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fde68a' }}>
                📊 本日の獲得ポイント履歴（計 {totalPointsToday} pt）
              </span>
              <button
                type="button"
                onClick={() => {
                  setPointLogs([]);
                  localStorage.setItem('temasak_easy_os_pts', JSON.stringify([]));
                  triggerToast('本日のポイントを 0pt にリセットしました');
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#cbd5e1',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.3rem',
                  cursor: 'pointer'
                }}
              >
                0ptにリセット
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '110px', overflowY: 'auto' }}>
              {pointLogs.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>まだ本日の記録はありません。各顧客カードのボタンを押すと自動加算されます。</span>
              ) : (
                pointLogs.map(log => (
                  <span
                    key={log.id}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.74rem',
                      color: '#f8fafc'
                    }}
                  >
                    <strong style={{ color: '#34d399' }}>+{log.pts}p</strong> {log.clinicName}（{log.actionLabel} / {log.time}）
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. KPI リアルタイム集計バー（クリニック直販KPI ＆ BtoBディーラー別枠KPI の2枠分離） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* 2-A. 🏥 クリニック直販 KPI枠 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderLeft: '5px solid #2563eb',
          borderRadius: '0.9rem',
          padding: '0.75rem 0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px'
              }}>
                直販枠 KPI
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                🏥 クリニック営業 KPI（医療機関・直販のみ集計 / BtoB除外）
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSegmentViewMode(segmentViewMode === 'clinic_only' ? 'split' : 'clinic_only')}
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                border: segmentViewMode === 'clinic_only' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                backgroundColor: segmentViewMode === 'clinic_only' ? '#1d4ed8' : '#ffffff',
                color: segmentViewMode === 'clinic_only' ? '#ffffff' : '#334155',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {segmentViewMode === 'clinic_only' ? '✓ クリニックのみ表示中（2枠表示へ戻す）' : '🏥 クリニック枠のみ表示'}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.65rem'
          }}>
            {/* クリニック営業中総数 */}
            <div
              onClick={() => {
                setCallFilter('all');
                if (segmentViewMode === 'btob_only') setSegmentViewMode('split');
              }}
              style={{
                backgroundColor: callFilter === 'all' ? '#eff6ff' : '#ffffff',
                border: callFilter === 'all' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span>🏥 クリニック営業中リスト</span>
                <span style={{ color: '#2563eb' }}>全表示</span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', marginTop: '0.1rem' }}>
                {kpiStats.total} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>件</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.15rem' }}>
                ●資料: <strong>{kpiStats.docSent}</strong> / 〇メール: <strong>{kpiStats.emailSent}</strong>
              </div>
            </div>

            {/* 未架電（資料送付のみ） */}
            <div
              onClick={() => setCallFilter('uncall')}
              style={{
                backgroundColor: callFilter === 'uncall' ? '#faf5ff' : '#ffffff',
                border: callFilter === 'uncall' ? '2px solid #7c3aed' : '1px solid #e9d5ff',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', display: 'flex', justifyContent: 'space-between' }}>
                <span>📦 資料送付済・未架電</span>
                <span>絞り込む</span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.1rem' }}>
                {kpiStats.uncall} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>件</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#5b21b6', marginTop: '0.15rem' }}>
                初動メール5p・初回コール対象
              </div>
            </div>

            {/* 会話済・デモ・見積進行 */}
            <div
              onClick={() => setCallFilter('interview')}
              style={{
                backgroundColor: callFilter === 'interview' ? '#f0fdf4' : '#ffffff',
                border: callFilter === 'interview' ? '2px solid #16a34a' : '1px solid #bbf7d0',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', display: 'flex', justifyContent: 'space-between' }}>
                <span>🌟 デモ・見積進行</span>
                <span>デモ率 {kpiStats.inquiryToDemoRate}%</span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#16a34a', marginTop: '0.1rem' }}>
                {kpiStats.demoCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>件</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: '0.15rem' }}>
                会話済: <strong>{kpiStats.talked}</strong>件 / 見積: <strong>{kpiStats.estimateSent}</strong>件
              </div>
            </div>

            {/* 受注 */}
            <div
              onClick={() => setCallFilter('won')}
              style={{
                backgroundColor: callFilter === 'won' ? '#fffbeb' : '#ffffff',
                border: callFilter === 'won' ? '2px solid #d97706' : '1px solid #fde68a',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                <span>🎉 受注（クリニック）</span>
                <span>絞り込む</span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#d97706', marginTop: '0.1rem' }}>
                {kpiStats.wonCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>件</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.15rem' }}>
                デモ→受注率: <strong>{kpiStats.demoToWonRate}%</strong> / 受注率: <strong>{kpiStats.inquiryToWonRate}%</strong>
              </div>
            </div>

            {/* アーカイブ（失注）カード */}
            <div
              onClick={() => setCallFilter(callFilter === 'archived' ? 'all' : 'archived')}
              style={{
                backgroundColor: callFilter === 'archived' ? '#f1f5f9' : '#ffffff',
                border: callFilter === 'archived' ? '2px solid #475569' : '1px solid #cbd5e1',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>🗄️ アーカイブ（失注）</span>
                <span>{callFilter === 'archived' ? '営業中へ戻る' : '一覧を見る'}</span>
              </div>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#334155', marginTop: '0.1rem' }}>
                {kpiStats.clinicArchivedCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>件</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '0.15rem' }}>
                他社:{kpiStats.lostByReason['他社導入']} / 金銭:{kpiStats.lostByReason['金銭面']} / 他:{kpiStats.lostByReason['その他']}
              </div>
            </div>
          </div>
        </div>

        {/* 2-B. 🏢 ディーラー・パートナー企業（BtoB別枠）KPI枠 */}
        <div style={{
          background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
          border: '1px solid #a5b4fc',
          borderLeft: '5px solid #4338ca',
          borderRadius: '0.9rem',
          padding: '0.75rem 0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                backgroundColor: '#4338ca',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px'
              }}>
                BtoB別枠 KPI
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e1b4b' }}>
                🏢 ディーラー・パートナー企業 KPI（BtoBアライアンス・卸・紹介パートナー別枠集計）
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSegmentViewMode(segmentViewMode === 'btob_only' ? 'split' : 'btob_only')}
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                border: segmentViewMode === 'btob_only' ? '1px solid #4338ca' : '1px solid #a5b4fc',
                backgroundColor: segmentViewMode === 'btob_only' ? '#4338ca' : '#ffffff',
                color: segmentViewMode === 'btob_only' ? '#ffffff' : '#3730a3',
                fontSize: '0.73rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {segmentViewMode === 'btob_only' ? '✓ BtoBリストのみ表示中（2枠表示へ戻す）' : '🏢 BtoB企業リストのみ表示'}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.65rem'
          }}>
            <div
              onClick={() => {
                setCallFilter('all');
                setSegmentViewMode(segmentViewMode === 'btob_only' ? 'split' : 'btob_only');
              }}
              style={{
                backgroundColor: '#ffffff',
                border: segmentViewMode === 'btob_only' ? '2px solid #4338ca' : '1px solid #c7d2fe',
                borderRadius: '0.8rem',
                padding: '0.75rem 0.95rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4338ca', display: 'flex', justifyContent: 'space-between' }}>
                <span>🏢 BtoB パートナー企業数</span>
                <span>クリックで切替</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e1b4b', marginTop: '0.1rem' }}>
                {kpiStats.btob.total} <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>社</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '0.15rem' }}>
                ●資料: <strong>{kpiStats.btob.docSent}</strong>社 / 〇メール: <strong>{kpiStats.btob.emailSent}</strong>社
              </div>
            </div>

            <div
              onClick={() => {
                setCallFilter('uncall');
                setSegmentViewMode('btob_only');
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #c7d2fe',
                borderRadius: '0.8rem',
                padding: '0.75rem 0.95rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#6d28d9', display: 'flex', justifyContent: 'space-between' }}>
                <span>📦 BtoB 未架電・打診前</span>
                <span>絞り込む</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.1rem' }}>
                {kpiStats.btob.uncall} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>社</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: '#5b21b6', marginTop: '0.15rem' }}>
                パートナー提携・同行打診対象
              </div>
            </div>

            <div
              onClick={() => {
                setCallFilter('interview');
                setSegmentViewMode('btob_only');
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #c7d2fe',
                borderRadius: '0.8rem',
                padding: '0.75rem 0.95rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d', display: 'flex', justifyContent: 'space-between' }}>
                <span>🤝 同行デモ・見積進行 (BtoB)</span>
                <span>進行率 {kpiStats.btob.demoRate}%</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a', marginTop: '0.1rem' }}>
                {kpiStats.btob.demoCount} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>社</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: '#166534', marginTop: '0.15rem' }}>
                会話済: <strong>{kpiStats.btob.talked}</strong>社 / 見積: <strong>{kpiStats.btob.estimateSent}</strong>社
              </div>
            </div>

            <div
              onClick={() => {
                setCallFilter('won');
                setSegmentViewMode('btob_only');
              }}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fde68a',
                borderRadius: '0.8rem',
                padding: '0.75rem 0.95rem',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                <span>🎉 BtoB受注・提携成約</span>
                <span>成約率 {kpiStats.btob.wonRate}%</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: '0.1rem' }}>
                {kpiStats.btob.wonCount} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>社</span>
              </div>
              <div style={{ fontSize: '0.71rem', color: '#92400e', marginTop: '0.15rem' }}>
                BtoB累計ポイント: <strong>{kpiStats.btob.totalPts}p</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. かんたん検索・エリア＆月フィルタバー */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.85rem',
        padding: '0.9rem 1.15rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem'
      }}>
        {/* エリアワンタップピル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <MapPin size={15} /> エリア:
          </span>
          {(['all', '北海道', '宮城県', '福島県', '秋田県', '岩手県'] as AreaFilter[]).map(area => {
            const count = area === 'all' ? kpiStats.allActiveCount : (kpiStats.byArea[area] || 0);
            const active = areaFilter === area;
            return (
              <button
                key={area}
                onClick={() => setAreaFilter(area)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: active ? '1px solid #1e40af' : '1px solid #cbd5e1',
                  backgroundColor: active ? '#1e40af' : '#f8fafc',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {area === 'all' ? `全域 (${count})` : `${area} (${count})`}
              </button>
            );
          })}
        </div>

        {/* キーワード検索 ＆ 月フィルタ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              backgroundColor: '#f8fafc',
              fontWeight: 600
            }}
          >
            <option value="all">📅 全期間 ({kpiStats.allActiveCount}件)</option>
            {Object.keys(kpiStats.byMonth)
              .sort((a, b) => b.localeCompare(a))
              .map(ym => {
                const [y, m] = ym.split('-');
                return (
                  <option key={ym} value={ym}>
                    {y}年{parseInt(m, 10)}月反響 ({kpiStats.byMonth[ym]}件)
                  </option>
                );
              })}
          </select>

          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="クリニック名・市区町村・科目で検索..."
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <button
            onClick={() => setIsPasteBoxOpen(prev => !prev)}
            style={{
              padding: '0.5rem 0.95rem',
              borderRadius: '0.55rem',
              border: 'none',
              background: isPasteBoxOpen ? '#0f172a' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Plus size={16} />
            <span>{isPasteBoxOpen ? '閉じる' : '📋 コピペで新規追加'}</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('名簿42件の初期データ状態にリセットしますか？')) {
                resetToRoster42();
                triggerToast('🔄 名簿42件の初期データを再読み込みしました');
              }
            }}
            title="名簿42件を初期状態に戻す"
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} /> リセット
          </button>
        </div>
      </div>

      {/* 3.5 コピペ新規追加パネル */}
      {isPasteBoxOpen && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #10b981',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📋 コピペで超かんたん新規追加（1行〜複数行まとめてOK）</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.15rem' }}>
                Excelやスプレッドシート、チャットから <strong>「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」</strong> をそのまま貼り付けてください
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const sampleText = `2026-11-07 / 医療法人さくら歯科クリニック / 北海道札幌市中央区 / 松浦\n2026-11-07\tあおぞら整形外科医院\t宮城県\t仙台市青葉区\t松浦`;
                  setPasteInputText(sampleText);
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #6ee7b7',
                  backgroundColor: '#ffffff',
                  color: '#047857',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                💡 サンプルを入れる
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const clip = await navigator.clipboard.readText();
                    if (clip) setPasteInputText(prev => (prev ? `${prev}\n${clip}` : clip));
                  } catch (e) {
                    alert('テキストボックス内で Ctrl+V（または右クリック→貼り付け）してください。');
                  }
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #059669',
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📋 クリップボードから貼付
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <textarea
                rows={4}
                value={pasteInputText}
                onChange={e => setPasteInputText(e.target.value)}
                placeholder={`ここにコピペしてください（例）：\n2026-11-07 / おおぞら内科クリニック / 北海道札幌市北区 / 松浦\n2026-11-07\tみなみ歯科医院\t福島県\t郡山市\t松浦`}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.6rem',
                  border: '1px solid #34d399',
                  backgroundColor: '#ffffff',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #a7f3d0',
              borderRadius: '0.6rem',
              padding: '0.75rem 0.9rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.6rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065f46', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>🔍 自動認識プレビュー ({parsedPreviewLeads.length}件)</span>
                  <span style={{ color: '#059669' }}>科目・次回タスクも自動付与</span>
                </div>

                {parsedPreviewLeads.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '0.8rem 0', textAlign: 'center' }}>
                    左のボックスに貼り付けると、ここに自動認識結果が表示されます
                  </div>
                ) : (
                  <div style={{ maxHeight: '105px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {parsedPreviewLeads.map(item => (
                      <div
                        key={item.id}
                        style={{
                          fontSize: '0.78rem',
                          backgroundColor: '#f8fafc',
                          padding: '0.3rem 0.55rem',
                          borderRadius: '0.35rem',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ color: '#64748b', fontWeight: 600 }}>📅 {item.receivedDate}</span>
                        <strong style={{ color: '#0f172a' }}>{item.clinicName}</strong>
                        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📍 {item.address}</span>
                        <span style={{ color: '#047857', marginLeft: 'auto', fontWeight: 700 }}>👤 {item.salesRep}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={parsedPreviewLeads.length === 0}
                onClick={handleRegisterPastedLeads}
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: parsedPreviewLeads.length > 0 ? '#059669' : '#cbd5e1',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: parsedPreviewLeads.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <CheckCircle2 size={16} />
                <span>この {parsedPreviewLeads.length} 件を名簿にワンクリック追加する (+{parsedPreviewLeads.length}p)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. メイン名簿カードリスト（クリニック直販枠 ＆ BtoBディーラー・パートナー別枠 の2枠リスト化） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* 視認性を高めた「対象リスト件数＆2枠切替＆アーカイブ切替」ヘッダーバー */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderLeft: `5px solid ${callFilter === 'archived' ? '#475569' : '#1e40af'}`,
          borderRadius: '0.75rem',
          padding: '0.75rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              {callFilter === 'archived' ? '🗄️ アーカイブ（失注）リスト' : '📋 営業中リスト（2枠別枠管理）'}
            </span>
            <span style={{
              backgroundColor: callFilter === 'archived' ? '#475569' : '#1e40af',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 800,
              padding: '0.2rem 0.7rem',
              borderRadius: '999px'
            }}>
              🏥 クリニック {clinicFilteredProjects.length}件
            </span>
            <span style={{
              backgroundColor: '#4338ca',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 800,
              padding: '0.2rem 0.7rem',
              borderRadius: '999px'
            }}>
              🏢 BtoBパートナー {btobFilteredProjects.length}社
            </span>
            {isFiltered && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCallFilter('all');
                    setAreaFilter('all');
                    setSelectedMonth('all');
                    setSearchQuery('');
                    setSegmentViewMode('split');
                  }}
                  style={{
                    padding: '0.22rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #fca5a5',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ✕ 全件（2枠表示）へ戻す
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
            {/* リスト枠切替ピル（2枠別々で全表示 / クリニック枠のみ / BtoB枠のみ） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#eef2ff', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #c7d2fe' }}>
              <span style={{ fontWeight: 800, color: '#3730a3', padding: '0 0.25rem', fontSize: '0.72rem' }}>表示枠:</span>
              {[
                { id: 'split', label: `📊 2枠別々で全表示` },
                { id: 'clinic_only', label: `🏥 クリニック枠 (${clinicFilteredProjects.length}件)` },
                { id: 'btob_only', label: `🏢 BtoB別枠 (${btobFilteredProjects.length}社)` }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSegmentViewMode(opt.id as SegmentViewMode)}
                  style={{
                    padding: '0.18rem 0.55rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor: segmentViewMode === opt.id ? '#4338ca' : 'transparent',
                    color: segmentViewMode === opt.id ? '#ffffff' : '#312e81',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* クリニックポイント順並び替えピル */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #cbd5e1' }}>
              <span style={{ fontWeight: 800, color: '#475569', padding: '0 0.25rem', fontSize: '0.73rem' }}>並び順:</span>
              {[
                { id: 'date_desc', label: '📅 反響日順' },
                { id: 'points_desc', label: '🏆 ポイント高い順' },
                { id: 'points_asc', label: '🌱 ポイント低い順' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortMode(opt.id as SortMode)}
                  style={{
                    padding: '0.18rem 0.55rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor: sortMode === opt.id ? '#1e40af' : 'transparent',
                    color: sortMode === opt.id ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.73rem',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCallFilter(callFilter === 'archived' ? 'all' : 'archived')}
              style={{
                padding: '0.25rem 0.7rem',
                borderRadius: '0.4rem',
                border: callFilter === 'archived' ? '1px solid #1e40af' : '1px solid #94a3b8',
                backgroundColor: callFilter === 'archived' ? '#eff6ff' : '#f8fafc',
                color: callFilter === 'archived' ? '#1d4ed8' : '#334155',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <Archive size={13} />
              <span>
                {callFilter === 'archived'
                  ? `📋 営業中リストに戻る`
                  : `🗄️ アーカイブ・失注一覧 (${kpiStats.archivedCount}件)`}
              </span>
            </button>
          </div>
        </div>

        {[
          {
            id: 'clinic' as const,
            visible: segmentViewMode !== 'btob_only',
            title:
              callFilter === 'archived'
                ? '🏥 クリニック アーカイブ（失注）リスト'
                : '🏥 クリニック 営業中リスト（直販枠）',
            subtitle: '医療機関（医科・歯科・薬局）への直販アプローチ対象リスト',
            badgeLabel: '直販枠',
            badgeBg: '#1e40af',
            headerBg: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
            containerBg: '#f8fafc',
            borderColor: '#93c5fd',
            accentColor: '#1d4ed8',
            unit: '件',
            list: clinicFilteredProjects
          },
          {
            id: 'btob' as const,
            visible: segmentViewMode !== 'clinic_only',
            title:
              callFilter === 'archived'
                ? '🏢 ディーラー・パートナー企業 アーカイブ（BtoB別枠）'
                : '🏢 ディーラー・パートナー企業 営業中リスト（BtoB別枠リスト）',
            subtitle: '医療機器ディーラー・卸・紹介パートナー企業向けのBtoBアライアンス＆同行営業リスト（※クリニック直販とは別枠でリスト化・KPI集計）',
            badgeLabel: 'BtoB別枠',
            badgeBg: '#4338ca',
            headerBg: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
            containerBg: '#f5f7ff',
            borderColor: '#a5b4fc',
            accentColor: '#4338ca',
            unit: '社',
            list: btobFilteredProjects
          }
        ]
          .filter(sec => sec.visible)
          .map(section => (
            <div
              key={section.id}
              style={{
                backgroundColor: section.containerBg,
                border: `2px solid ${section.borderColor}`,
                borderRadius: '1rem',
                padding: '1rem 1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                boxShadow: '0 3px 10px rgba(15, 23, 42, 0.04)'
              }}
            >
              {/* 各枠のセクション見出しヘッダー */}
              <div
                style={{
                  background: section.headerBg,
                  border: `1px solid ${section.borderColor}`,
                  borderLeft: `6px solid ${section.accentColor}`,
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.05rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.6rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        backgroundColor: section.badgeBg,
                        color: '#ffffff',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        padding: '0.16rem 0.6rem',
                        borderRadius: '999px'
                      }}
                    >
                      {section.badgeLabel}
                    </span>
                    <span style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a' }}>
                      {section.title}
                    </span>
                    <span
                      style={{
                        backgroundColor: '#ffffff',
                        color: section.accentColor,
                        border: `1px solid ${section.borderColor}`,
                        fontSize: '0.86rem',
                        fontWeight: 900,
                        padding: '0.15rem 0.7rem',
                        borderRadius: '999px'
                      }}
                    >
                      {section.list.length} {section.unit}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.77rem', color: '#475569', marginTop: '0.2rem', fontWeight: 600 }}>
                    {section.subtitle}
                  </div>
                </div>

                {section.id === 'btob' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
                    <span style={{ backgroundColor: '#ffffff', border: '1px solid #c7d2fe', color: '#3730a3', padding: '0.22rem 0.6rem', borderRadius: '0.4rem', fontWeight: 800 }}>
                      🤝 BtoB会話済: {kpiStats.btob.talked}社
                    </span>
                    <span style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', color: '#15803d', padding: '0.22rem 0.6rem', borderRadius: '0.4rem', fontWeight: 800 }}>
                      🌟 同行デモ・見積: {kpiStats.btob.demoCount}社
                    </span>
                    <span style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', color: '#b45309', padding: '0.22rem 0.6rem', borderRadius: '0.4rem', fontWeight: 800 }}>
                      🏆 BtoB累計: {kpiStats.btob.totalPts}p
                    </span>
                  </div>
                )}
              </div>

              {section.list.length === 0 && (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '0.75rem',
                  padding: '1.75rem 1.25rem',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600
                }}>
                  この枠（{section.title}）に一致する案件はありません。
                </div>
              )}

              {section.list.map(project => {
          const isBtoB = isBtoBDealerProject(project);
          const callSt = getCallState(project);
          const nextAct = actions.find(a => a.projectId === project.id && a.status === '未完了');
          const clinicPts = getClinicTotalPoints(project);
          const hasDoc = project.memo?.includes('●資料送付済');
          const hasEmail = project.memo?.includes('〇メール済') || !!project.initialEmailDate;
          const hasInitialEmail = project.memo?.includes('初動メール済') || !!project.initialEmailDate;
          const hasEstimate = project.memo?.includes('見積書送付済') || !!project.estimateSentDate;
          const hasVisit = project.memo?.includes('訪問済') || !!project.visitDate;
          const hasPosting = project.memo?.includes('ポスティング済') || !!project.postingDate;
          const hasConsultEmail = project.memo?.includes('相談メール済') || !!project.consultEmailDate;
          const hasFollowupEmail = project.memo?.includes('後追いメール済') || !!project.followupEmailDate;
          const hasOrder = project.status === '受注' || project.memo?.includes('受注済') || !!project.orderDate;
          const demoInfo = extractDemoInfo(project);
          const isDemoPickerOpenForThis = activeDemoPicker?.projectId === project.id;
          const isArchivePickerOpenForThis = activeArchivePicker?.projectId === project.id;
          const isArchived = project.status === '失注';
          const currentProgressStage = normalizeProgressStage(project);
          const currentProgressIdx = SALES_PROGRESS_FLOW.indexOf(currentProgressStage);

          return (
            <div
              key={project.id}
              style={{
                backgroundColor: isArchived ? '#f8fafc' : '#ffffff',
                border: `1px solid ${callSt.code === 'callback' ? '#fca5a5' : isBtoB ? '#a5b4fc' : '#cbd5e1'}`,
                borderLeft: `6px solid ${
                  isArchived
                    ? '#64748b'
                    : isBtoB
                    ? '#4338ca'
                    : callSt.code === 'callback'
                    ? '#ef4444'
                    : callSt.code === 'absent'
                    ? '#f59e0b'
                    : callSt.code === 'uncall'
                    ? '#8b5cf6'
                    : callSt.code === 'interview'
                    ? '#10b981'
                    : '#3b82f6'
                }`,
                borderRadius: '0.85rem',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 2px 5px rgba(15, 23, 42, 0.04)'
              }}
            >
              {/* 上段：顧客基本情報（左） ＆ 次にやること（右） のゆったり2カラム */}
              <div style={{
                padding: '0.95rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: '1.25fr 1fr',
                alignItems: 'center',
                gap: '1.15rem'
              }}>
                {/* 左カラム：クリニック名・クリニックポイント・エリア・送付/デモ/見積/失注理由バッジ */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    {isBtoB && (
                      <span
                        style={{
                          backgroundColor: '#312e81',
                          color: '#ffffff',
                          fontSize: '0.73rem',
                          fontWeight: 900,
                          padding: '0.16rem 0.6rem',
                          borderRadius: '999px'
                        }}
                      >
                        🏢 BtoBパートナー枠
                      </span>
                    )}
                    {/* クリニック/BtoB別累積ポイントバッジ */}
                    <span
                      title="この顧客に対して積み上げた営業アクションの累計ポイント"
                      style={{
                        background:
                          clinicPts >= 10
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : clinicPts >= 5
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : clinicPts >= 1
                            ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                            : '#e2e8f0',
                        color: clinicPts >= 1 ? '#ffffff' : '#475569',
                        fontSize: '0.78rem',
                        fontWeight: 900,
                        padding: '0.16rem 0.65rem',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        boxShadow: clinicPts >= 5 ? '0 2px 6px rgba(16, 185, 129, 0.25)' : 'none'
                      }}
                    >
                      <Trophy size={12} />
                      <span>{isBtoB ? `BtoB企業 ${clinicPts}p` : `クリニック ${clinicPts}p`}</span>
                    </span>

                    <span style={{
                      backgroundColor: callSt.badgeBg,
                      color: callSt.badgeColor,
                      border: `1px solid ${callSt.borderColor}`,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.65rem',
                      borderRadius: '999px'
                    }}>
                      {callSt.label}
                    </span>

                    <span style={{
                      backgroundColor: '#f1f5f9',
                      color: '#1e293b',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '0.35rem'
                    }}>
                      📍 {project.address}
                    </span>

                    <span style={{
                      backgroundColor: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '0.35rem'
                    }}>
                      {project.clinicType}
                    </span>

                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      反響日: {project.receivedAt}
                    </span>
                  </div>

                  <div
                    onClick={() => setDetailProjectId(project.id)}
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      lineHeight: 1.3
                    }}
                  >
                    <span>{project.clinicName}</span>
                    <ChevronRight size={17} color="#64748b" />
                  </div>

                  {/* ステータス・送付・デモ日付・訪問・ポスティング・相談メール・失注理由バッジ列 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem', fontSize: '0.76rem', color: '#475569', flexWrap: 'wrap' }}>
                    {isArchived && project.lostReason && (
                      <span style={{
                        padding: '0.15rem 0.6rem',
                        borderRadius: '0.3rem',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fca5a5',
                        fontWeight: 800
                      }}>
                        🗄️ 失注理由: {project.lostReason}
                      </span>
                    )}

                    <span style={{
                      padding: '0.14rem 0.5rem',
                      borderRadius: '0.3rem',
                      backgroundColor: hasDoc ? '#dcfce7' : '#f1f5f9',
                      color: hasDoc ? '#166534' : '#94a3b8',
                      fontWeight: 700
                    }}>
                      {hasDoc ? '● 資料送付済' : '・資料未'}
                    </span>
                    <span
                      onClick={() => openDemoDatePicker(project, '初動メール')}
                      title="クリックして初動メールの実施日を選択・更新"
                      style={{
                        padding: '0.14rem 0.5rem',
                        borderRadius: '0.3rem',
                        backgroundColor: hasEmail ? '#dbeafe' : '#f1f5f9',
                        color: hasEmail ? '#1e40af' : '#94a3b8',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {hasInitialEmail
                        ? `✉️ 初動メール済${project.initialEmailDate ? ` (${project.initialEmailDate.slice(5)})` : ''}`
                        : hasEmail
                        ? '〇 メール送付済'
                        : '・メール未'}
                    </span>

                    {hasEstimate && (
                      <span
                        onClick={() => openDemoDatePicker(project, '見積書送付')}
                        title="クリックして見積書送付の実施日を選択・更新"
                        style={{
                          padding: '0.14rem 0.55rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📄 見積書送付済{project.estimateSentDate ? ` (${project.estimateSentDate.slice(5)})` : ''}
                      </span>
                    )}

                    {demoInfo && (
                      <span
                        onClick={() => openDemoDatePicker(
                          project,
                          (demoInfo.type === 'オンラインデモ' || demoInfo.type === '訪問デモ' || demoInfo.type === '来社デモ')
                            ? demoInfo.type
                            : 'オンラインデモ'
                        )}
                        title="クリックしてデモ日付・種別を変更"
                        style={{
                          padding: '0.14rem 0.6rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#d1fae5',
                          color: '#065f46',
                          border: '1px solid #6ee7b7',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        🗓️ {demoInfo.type}: {demoInfo.date}
                      </span>
                    )}

                    {hasVisit && (
                      <span
                        onClick={() => openDemoDatePicker(project, '訪問')}
                        title="クリックして訪問の実施日を選択・更新"
                        style={{
                          padding: '0.14rem 0.55rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          border: '1px solid #c7d2fe',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        🚶 訪問済{project.visitDate ? ` (${project.visitDate.slice(5)})` : ''}
                      </span>
                    )}

                    {hasPosting && (
                      <span
                        onClick={() => openDemoDatePicker(project, 'ポスティング')}
                        title="クリックしてポスティングの実施日を選択・更新"
                        style={{
                          padding: '0.14rem 0.55rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#fce7f3',
                          color: '#9d174d',
                          border: '1px solid #fbcfe8',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📮 ポスティング済{project.postingDate ? ` (${project.postingDate.slice(5)})` : ''}
                      </span>
                    )}

                    {hasConsultEmail && (
                      <span
                        onClick={() => openDemoDatePicker(project, '相談メール')}
                        title="クリックして相談メールの実施日を選択・更新"
                        style={{
                          padding: '0.14rem 0.55rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          border: '1px solid #e9d5ff',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📩 相談メール済{project.consultEmailDate ? ` (${project.consultEmailDate.slice(5)})` : ''}
                      </span>
                    )}

                    {hasFollowupEmail && (
                      <span
                        onClick={() => openDemoDatePicker(project, '後追いメール')}
                        title="クリックして後追いメールの実施日を選択・更新"
                        style={{
                          padding: '0.14rem 0.55rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          border: '1px solid #bae6fd',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📨 後追いメール済{project.followupEmailDate ? ` (${project.followupEmailDate.slice(5)})` : ''}
                      </span>
                    )}

                    {hasOrder && (
                      <span
                        onClick={() => openDemoDatePicker(project, '受注')}
                        title="クリックして受注日を選択・更新"
                        style={{
                          padding: '0.14rem 0.6rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #f59e0b',
                          fontWeight: 900,
                          cursor: 'pointer'
                        }}
                      >
                        🎉 受注済{project.orderDate ? ` (${project.orderDate.slice(5)})` : ''}
                      </span>
                    )}

                    <span style={{ color: '#64748b', fontWeight: 600 }}>担当: {project.salesRep}</span>
                  </div>

                  {/* 7段階 進捗フロー（問合せ → 初動 → デモ → 見積 → 検討 → 後追い → 受注）※アクションボタンと自動連動＆クリック切替可 */}
                  {!isArchived && (
                    <div style={{
                      marginTop: '0.55rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.28rem',
                      flexWrap: 'wrap',
                      backgroundColor: '#f8fafc',
                      padding: '0.32rem 0.55rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e2e8f0'
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', marginRight: '0.15rem' }}>
                        進捗フロー:
                      </span>
                      {SALES_PROGRESS_FLOW.map((stage, idx) => {
                        const isCurrent = idx === currentProgressIdx;
                        const isPassed = idx < currentProgressIdx;
                        const isWon = stage === '受注' && isCurrent;
                        return (
                          <React.Fragment key={stage}>
                            <button
                              type="button"
                              onClick={() => handleSelectProgressStage(project, stage)}
                              title={`進捗ステージを「${stage}」に変更（下のアクションボタンとも自動連動します）`}
                              style={{
                                padding: '0.16rem 0.52rem',
                                borderRadius: '0.35rem',
                                border: isCurrent
                                  ? isWon
                                    ? '2px solid #059669'
                                    : '2px solid #1d4ed8'
                                  : isPassed
                                  ? '1px solid #93c5fd'
                                  : '1px solid #cbd5e1',
                                backgroundColor: isCurrent
                                  ? isWon
                                    ? '#059669'
                                    : '#1d4ed8'
                                  : isPassed
                                  ? '#dbeafe'
                                  : '#ffffff',
                                color: isCurrent
                                  ? '#ffffff'
                                  : isPassed
                                  ? '#1e40af'
                                  : '#64748b',
                                fontSize: '0.72rem',
                                fontWeight: isCurrent ? 900 : 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.18rem',
                                lineHeight: 1.2,
                                boxShadow: isCurrent ? '0 1px 4px rgba(29, 78, 216, 0.25)' : 'none'
                              }}
                            >
                              <span>{isPassed ? '✓' : isCurrent ? '●' : `${idx + 1}.`}</span>
                              <span>{stage}</span>
                            </button>
                            {idx < SALES_PROGRESS_FLOW.length - 1 && (
                              <span style={{ fontSize: '0.68rem', color: isPassed ? '#3b82f6' : '#cbd5e1', fontWeight: 800 }}>
                                ▸
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 右カラム：次にやること（次アクション）＆ AIアドバイス */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.65rem',
                  padding: '0.7rem 0.95rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🎯 次にやること（自動セット）</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {nextAct?.deadline && (
                        <span style={{ color: '#0f766e', fontWeight: 800 }}>
                          📅 {nextAct.deadline}
                        </span>
                      )}
                      <span style={{
                        backgroundColor: isArchived ? '#e2e8f0' : currentProgressStage === '受注' ? '#d1fae5' : '#dbeafe',
                        color: isArchived ? '#475569' : currentProgressStage === '受注' ? '#065f46' : '#1e40af',
                        padding: '0.08rem 0.45rem',
                        borderRadius: '0.25rem',
                        fontWeight: 800
                      }}>
                        {isArchived ? '失注' : currentProgressStage}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                    {nextAct ? nextAct.title : 'フォローアップ完了'}
                  </div>
                  {project.aiRecommendation && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
                      <Sparkles size={13} color="#7c3aed" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{project.aiRecommendation}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 下段：ワンクリック記録アクションバー */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '0.55rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.55rem'
              }}>
                {isArchived ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                      🗄️ アーカイブ（失注）保管中 — 理由: <strong style={{ color: '#b91c1c' }}>{project.lostReason || 'その他'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        restoreArchivedProject(project.id);
                        triggerToast(`🔄 「${project.clinicName}」を営業中リストへ戻しました`);
                      }}
                      style={{
                        padding: '0.35rem 0.8rem',
                        borderRadius: '0.45rem',
                        border: '1px solid #2563eb',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      🔄 営業リストに戻す（復活）
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginRight: '0.05rem' }}>
                      架電:
                    </span>
                    <button
                      onClick={() => openDemoDatePicker(project, '会話')}
                      title="「会話 (+3p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '会話' ? '2px solid #1d4ed8' : '1px solid #93c5fd',
                        backgroundColor: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '会話' ? '#dbeafe' : '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Phone size={12} /> 会話 (+3p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '不在')}
                      title="「不在 (+1p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '不在' ? '2px solid #b45309' : '1px solid #fcd34d',
                        backgroundColor: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '不在' ? '#fde68a' : '#fffbeb',
                        color: '#b45309',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <PhoneOff size={12} /> 不在 (+1p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '折返待ち')}
                      title="「折返待ち (+1p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '折返待ち' ? '2px solid #b91c1c' : '1px solid #fca5a5',
                        backgroundColor: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '折返待ち' ? '#fecaca' : '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <PhoneIncoming size={12} /> 折返待ち (+1p)
                    </button>

                    {/* 区切り線 */}
                    <span style={{ width: '1px', height: '18px', backgroundColor: '#cbd5e1', margin: '0 0.15rem' }} />

                    <button
                      onClick={() => openDemoDatePicker(project, '初動メール')}
                      title="「初動メール (+5p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '初動メール' ? '2px solid #1e40af' : '1px solid #60a5fa',
                        backgroundColor: hasInitialEmail || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '初動メール') ? '#dbeafe' : '#ffffff',
                        color: '#1e40af',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Mail size={12} /> 初動メール (+5p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '見積書送付')}
                      title="「見積書送付 (+5p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '見積書送付' ? '2px solid #b45309' : '1px solid #f59e0b',
                        backgroundColor: hasEstimate || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '見積書送付') ? '#fef3c7' : '#ffffff',
                        color: '#b45309',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <FileText size={12} /> 見積書送付 (+5p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, 'オンラインデモ')}
                      title="「オンラインデモ (+5p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'オンラインデモ' ? '2px solid #065f46' : '1px solid #34d399',
                        backgroundColor: demoInfo?.type === 'オンラインデモ' || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'オンラインデモ') ? '#d1fae5' : '#ffffff',
                        color: '#065f46',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Video size={12} /> オンラインデモ (+5p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '訪問デモ')}
                      title="「訪問デモ (+5p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '訪問デモ' ? '2px solid #0f766e' : '1px solid #2dd4bf',
                        backgroundColor: demoInfo?.type === '訪問デモ' || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '訪問デモ') ? '#ccfbf1' : '#ffffff',
                        color: '#0f766e',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Car size={12} /> 訪問デモ (+5p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '来社デモ')}
                      title="「来社デモ (+5p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '来社デモ' ? '2px solid #5b21b6' : '1px solid #a78bfa',
                        backgroundColor: demoInfo?.type === '来社デモ' || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '来社デモ') ? '#ede9fe' : '#ffffff',
                        color: '#5b21b6',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Building2 size={12} /> 来社デモ (+5p)
                    </button>

                    {/* 区切り線 */}
                    <span style={{ width: '1px', height: '18px', backgroundColor: '#cbd5e1', margin: '0 0.15rem' }} />

                    {/* 新規追加: 訪問 (+3p) / ポスティング (+2p) / 相談メール (+3p) */}
                    <button
                      onClick={() => openDemoDatePicker(project, '訪問')}
                      title="「訪問 (+3p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '訪問' ? '2px solid #3730a3' : '1px solid #818cf8',
                        backgroundColor: hasVisit || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '訪問') ? '#e0e7ff' : '#ffffff',
                        color: '#3730a3',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Footprints size={12} /> 訪問 (+3p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, 'ポスティング')}
                      title="「ポスティング (+2p)」の実施日を選択して記録"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'ポスティング' ? '2px solid #9d174d' : '1px solid #f472b6',
                        backgroundColor: hasPosting || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'ポスティング') ? '#fce7f3' : '#ffffff',
                        color: '#9d174d',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Send size={12} /> ポスティング (+2p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '相談メール')}
                      title="「相談メール (+3p)」の実施日を選択して記録（進捗: 検討へ連動）"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '相談メール' ? '2px solid #6b21a8' : '1px solid #c084fc',
                        backgroundColor: hasConsultEmail || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '相談メール') ? '#f3e8ff' : '#ffffff',
                        color: '#6b21a8',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <MessageSquare size={12} /> 相談メール (+3p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '後追いメール')}
                      title="「後追いメール (+2p)」の実施日を選択して記録（進捗: 後追いへ連動）"
                      style={{
                        padding: '0.32rem 0.6rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '後追いメール' ? '2px solid #0369a1' : '1px solid #38bdf8',
                        backgroundColor: hasFollowupEmail || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '後追いメール') ? '#e0f2fe' : '#ffffff',
                        color: '#0369a1',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Mail size={12} /> 後追いメール (+2p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '受注')}
                      title="「受注 (+10p)」の受注日を選択して記録（進捗: 受注へ連動）"
                      style={{
                        padding: '0.32rem 0.7rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === '受注' ? '2px solid #047857' : '2px solid #10b981',
                        background: hasOrder || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '受注')
                          ? 'linear-gradient(135deg, #059669, #047857)'
                          : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                        color: hasOrder || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === '受注') ? '#ffffff' : '#065f46',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.22rem',
                        boxShadow: '0 1px 4px rgba(16, 185, 129, 0.25)'
                      }}
                    >
                      <Trophy size={12} /> 受注 (+10p)
                    </button>
                  </div>
                )}

                {/* 右グループ：AIナレッジ文面作成 ＆ アーカイブ（失注）移動 ＆ 詳細 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => openAiAssistant(project, 'auto')}
                    style={{
                      padding: '0.38rem 0.8rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      boxShadow: '0 1px 4px rgba(124, 58, 237, 0.25)'
                    }}
                  >
                    <Sparkles size={13} /> AIナレッジ文面
                  </button>

                  {!isArchived && (
                    <button
                      type="button"
                      onClick={() =>
                        isArchivePickerOpenForThis
                          ? setActiveArchivePicker(null)
                          : openArchiveReasonPicker(project)
                      }
                      title="理由（他社導入・金銭面・その他）を選択してアーカイブ（失注）へ移動"
                      style={{
                        padding: '0.38rem 0.68rem',
                        borderRadius: '0.45rem',
                        border: isArchivePickerOpenForThis ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        backgroundColor: isArchivePickerOpenForThis ? '#fef2f2' : '#ffffff',
                        color: isArchivePickerOpenForThis ? '#dc2626' : '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Archive size={13} /> アーカイブ(失注)
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setDetailInitialTab('activities');
                      setDetailProjectId(project.id);
                    }}
                    title="これまでの活動の修正・削除を開く"
                    style={{
                      padding: '0.38rem 0.65rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #93c5fd',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🕒 活動履歴・修正 ({(project.activities || []).length})
                  </button>

                  <button
                    onClick={() => {
                      setDetailInitialTab('basicInfo');
                      setDetailProjectId(project.id);
                    }}
                    style={{
                      padding: '0.38rem 0.65rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    詳細
                  </button>
                </div>
              </div>

              {/* 全11アクション共通：実施日を選択（今日 / 明日 / +3日後 / +1週間後）インライン入力バー */}
              {isDemoPickerOpenForThis && activeDemoPicker && (
                <div style={{
                  backgroundColor: '#ecfdf5',
                  borderTop: '2px solid #10b981',
                  padding: '0.65rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      padding: '0.22rem 0.65rem',
                      borderRadius: '0.35rem'
                    }}>
                      📅 {activeDemoPicker.demoType}（+{ACTION_POINT_RULES[activeDemoPicker.demoType] ?? 1}p）
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46' }}>
                      実施日を選択:
                    </span>
                    <input
                      type="date"
                      value={activeDemoPicker.date}
                      onChange={e =>
                        setActiveDemoPicker(prev =>
                          prev ? { ...prev, date: e.target.value } : null
                        )
                      }
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.4rem',
                        border: '1px solid #059669',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        backgroundColor: '#ffffff',
                        color: '#0f172a'
                      }}
                    />

                    {[
                      { label: '今日', offset: 0 },
                      { label: '明日', offset: 1 },
                      { label: '+3日後', offset: 3 },
                      { label: '+1週間後', offset: 7 }
                    ].map(preset => {
                      const dStr = format(addDays(new Date(), preset.offset), 'yyyy-MM-dd');
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            setActiveDemoPicker(prev =>
                              prev ? { ...prev, date: dStr } : null
                            )
                          }
                          style={{
                            padding: '0.28rem 0.65rem',
                            borderRadius: '0.35rem',
                            border: activeDemoPicker.date === dStr ? '1px solid #047857' : '1px solid #a7f3d0',
                            backgroundColor: activeDemoPicker.date === dStr ? '#047857' : '#ffffff',
                            color: activeDemoPicker.date === dStr ? '#ffffff' : '#065f46',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => confirmDemoWithDate(project)}
                      style={{
                        padding: '0.42rem 0.95rem',
                        borderRadius: '0.45rem',
                        border: 'none',
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                      }}
                    >
                      <Calendar size={14} />
                      <span>
                        {activeDemoPicker.date} で「{activeDemoPicker.demoType} (+{ACTION_POINT_RULES[activeDemoPicker.demoType] ?? 1}p)」を記録
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDemoPicker(null)}
                      style={{
                        padding: '0.35rem 0.5rem',
                        borderRadius: '0.4rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* アーカイブ（失注）理由の選択バー（他社導入・金銭面・その他） */}
              {isArchivePickerOpenForThis && activeArchivePicker && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  borderTop: '2px solid #ef4444',
                  padding: '0.7rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.35rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Archive size={13} /> アーカイブ（失注）へ移動
                    </span>

                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991b1b' }}>
                      失注理由を選択:
                    </span>

                    {/* 3つの選択ボタン（他社導入・金銭面・その他） */}
                    {LOST_REASONS.map(reasonOption => {
                      const selected = activeArchivePicker.reason === reasonOption;
                      return (
                        <button
                          key={reasonOption}
                          type="button"
                          onClick={() =>
                            setActiveArchivePicker(prev =>
                              prev ? { ...prev, reason: reasonOption } : null
                            )
                          }
                          style={{
                            padding: '0.35rem 0.85rem',
                            borderRadius: '999px',
                            border: selected ? '2px solid #b91c1c' : '1px solid #fca5a5',
                            backgroundColor: selected ? '#dc2626' : '#ffffff',
                            color: selected ? '#ffffff' : '#991b1b',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {reasonOption === '他社導入' && '🏢 '}
                          {reasonOption === '金銭面' && '💰 '}
                          {reasonOption === 'その他' && '📝 '}
                          {reasonOption}
                        </button>
                      );
                    })}

                    <input
                      type="text"
                      value={activeArchivePicker.note}
                      onChange={e =>
                        setActiveArchivePicker(prev =>
                          prev ? { ...prev, note: e.target.value } : null
                        )
                      }
                      placeholder="補足メモ（任意：メーカー名など）"
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.4rem',
                        border: '1px solid #fca5a5',
                        fontSize: '0.8rem',
                        backgroundColor: '#ffffff',
                        minWidth: '190px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => confirmArchiveProject(project)}
                      style={{
                        padding: '0.42rem 0.95rem',
                        borderRadius: '0.45rem',
                        border: 'none',
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                      }}
                    >
                      <Archive size={14} />
                      <span>「{activeArchivePicker.reason}」でアーカイブへ移動</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveArchivePicker(null)}
                      style={{
                        padding: '0.35rem 0.5rem',
                        borderRadius: '0.4rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
            </div>
          ))}
      </div>

      {/* 5. テマサック営業OS - AIナレッジ変換＆ワンクリックメール起案モーダル */}
      {aiModalProject && (
        <div
          onClick={() => setAiModalProject(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              width: '960px',
              maxWidth: '100%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{
              padding: '1.1rem 1.5rem',
              background: 'linear-gradient(135deg, #4c1d95, #1e3a8a)',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={24} color="#fbbf24" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#ddd6fe', fontWeight: 600 }}>
                    テマサック営業OS - トップ営業ナレッジ自動変換エンジン
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    {aiModalProject.clinicName}（{aiModalProject.address}）向け 最適アプローチ起案
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setAiModalProject(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            <div style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                💡 シーン別ナレッジ変換:
              </span>
              {[
                { id: 'auto', label: '⚡ 現在の状況に最適化' },
                { id: 'initial_email', label: '✉️ 初動メール文面 (+5p対応)' },
                { id: 'consult_email', label: '📩 相談メール文面 (+3p対応)' },
                { id: 'followup_email', label: '📨 後追いメール文面 (+2p対応)' },
                { id: 'estimate', label: '📄 見積書送付文面 (+5p対応)' },
                { id: 'absent', label: '📞 不在時のフォロー文面' },
                { id: 'callback', label: '🔥 折返待ちの要点お伝え' },
                { id: 'talked', label: '💬 会話後の御礼・デモ打診' },
                { id: 'subsidy', label: '💰 補助金シミュレーション案内' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAiScene(tab.id as any);
                    generateSmartAiDraft(aiModalProject, tab.id as any);
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    border: aiScene === tab.id ? '1px solid #6d28d9' : '1px solid #cbd5e1',
                    backgroundColor: aiScene === tab.id ? '#6d28d9' : '#ffffff',
                    color: aiScene === tab.id ? '#ffffff' : '#334155',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    件名（そのまま編集可能）
                  </label>
                  <input
                    type="text"
                    value={customDraftSubject}
                    onChange={e => setCustomDraftSubject(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 700
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    AI起案メール本文（名簿情報 ＆ トップ営業のキラーフレーズ反映済）
                  </label>
                  <textarea
                    rows={14}
                    value={customDraftBody}
                    onChange={e => setCustomDraftBody(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      lineHeight: 1.6,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`件名: ${customDraftSubject}\n\n${customDraftBody}`);
                      setCopiedFlag(true);
                      if (aiScene === 'initial_email') {
                        handleOneClickRecord(aiModalProject, '初動メール');
                      } else if (aiScene === 'consult_email') {
                        handleOneClickRecord(aiModalProject, '相談メール');
                      } else if (aiScene === 'followup_email') {
                        handleOneClickRecord(aiModalProject, '後追いメール');
                      } else if (aiScene === 'estimate') {
                        handleOneClickRecord(aiModalProject, '見積書送付');
                      } else {
                        addPoint(aiModalProject.clinicName, 'AIナレッジ文面起案・コピー (+2p)', 2);
                        triggerToast(`📋 文面をコピーし、+2p 獲得しました！`);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.7rem 1rem',
                      borderRadius: '0.6rem',
                      border: 'none',
                      backgroundColor: copiedFlag ? '#059669' : '#4f46e5',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    {copiedFlag ? <Check size={18} /> : <Copy size={18} />}
                    {copiedFlag
                      ? 'コピー＆ポイント記録完了！'
                      : aiScene === 'initial_email'
                      ? 'コピーして「初動メール (+5p)」を記録'
                      : aiScene === 'consult_email'
                      ? 'コピーして「相談メール (+3p)」を記録'
                      : aiScene === 'followup_email'
                      ? 'コピーして「後追いメール (+2p)」を記録'
                      : aiScene === 'estimate'
                      ? 'コピーして「見積書送付 (+5p)」を記録'
                      : '件名＋本文をワンクリックコピー (+2p)'}
                  </button>

                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(customDraftSubject)}&body=${encodeURIComponent(customDraftBody)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (aiScene === 'initial_email') {
                        handleOneClickRecord(aiModalProject, '初動メール');
                      } else if (aiScene === 'consult_email') {
                        handleOneClickRecord(aiModalProject, '相談メール');
                      } else if (aiScene === 'followup_email') {
                        handleOneClickRecord(aiModalProject, '後追いメール');
                      } else if (aiScene === 'estimate') {
                        handleOneClickRecord(aiModalProject, '見積書送付');
                      } else {
                        addPoint(aiModalProject.clinicName, 'Gmail起案オープン (+2p)', 2);
                      }
                    }}
                    style={{
                      padding: '0.7rem 1rem',
                      borderRadius: '0.6rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#1e293b',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <ExternalLink size={16} /> Gmailで開く
                  </a>
                </div>
              </div>

              <div style={{
                backgroundColor: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#581c87', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Award size={18} color="#7c3aed" />
                  <span>参照されたトップ営業ナレッジ（根拠）</span>
                </div>

                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  border: '1px solid #d8b4fe',
                  fontSize: '0.8rem',
                  color: '#334155'
                }}>
                  <div style={{ fontWeight: 700, color: '#6d28d9', marginBottom: '0.25rem' }}>
                    🎯 この顧客（{aiModalProject.clinicType} / {getCallState(aiModalProject).label}）の攻略ポイント
                  </div>
                  <div>{aiModalProject.aiRecommendation}</div>
                </div>

                {matchedKnowledgeItems.map((k: any, idx: number) => (
                  <div
                    key={k.id || idx}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        backgroundColor: '#ede9fe',
                        color: '#5b21b6',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '0.25rem',
                        fontWeight: 700,
                        fontSize: '0.7rem'
                      }}>
                        {k.category || '営業ノウハウ'}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                        担当: {k.sales_person || '杉田 建治'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      Q: {k.customer_question}
                    </div>
                    <div style={{ color: '#475569' }}>
                      <strong>必勝パターン:</strong> {k.success_pattern || k.sales_answer}
                    </div>
                    {k.distinctive_phrasing && (
                      <div style={{
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '0.35rem',
                        fontWeight: 600,
                        marginTop: '0.15rem'
                      }}>
                        💬 キラーフレーズ: 「{k.distinctive_phrasing}」
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 案件詳細ドロワー */}
      <ProjectDetailsPanel
        project={detailProject}
        actions={actions}
        onClose={() => setDetailProjectId(null)}
        onCompleteAction={handleCompleteAction}
        onPostponeAction={postponeAction}
        onUpdateProject={updateProject}
        initialTab={detailInitialTab}
      />
    </div>
  );
}
