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
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Upload,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useProjects } from '../context/ProjectContext';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import seedData from '../utils/sales_os_seed.json';
import { parsePastedRosterText, convertParsedLeadsToProjects } from '../utils/roster42Data';
import {
  readInquiryEmlFiles,
  parseInquiryEml,
  isInquiryEmailText,
  findMatchingProjectsForEml,
  createProjectAndActionFromEml,
  buildProjectUpdatesFromEml,
  SAMPLE_EML_3543_TEXT
} from '../utils/emlParser';
import type { ParsedInquiryEml } from '../utils/emlParser';
import {
  ACTION_POINT_RULES,
  SALES_PROGRESS_FLOW,
  CASHLESS_PAYMENT_CATEGORIES,
  getProjectSpecAndGateSummary,
  getClinicTotalPoints,
  normalizeProgressStage,
  isBtoBDealerProject
} from '../types';
import type { Project, QuickCallOutcome, LostReasonType, SalesProgressStage } from '../types';
import './AllInOneSalesOS.css';

type CallFilter = 'all' | 'callback' | 'absent' | 'uncall' | 'talked' | 'interview' | 'won' | 'archived';
type AreaFilter = 'all' | '北海道' | '宮城県' | '福島県' | '秋田県' | '岩手県';
type SortMode = 'date_desc' | 'points_desc' | 'points_asc';
type SegmentViewMode = 'split' | 'clinic_only' | 'btob_only' | 'won_only' | 'archived_only';

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
    handleStatusChange,
    postponeAction,
    updateProject,
    deleteProject,
    resetToRoster42
  } = useProjects();

  // コピペ・EML新規追加ドロワー/モーダル状態
  const [isPasteBoxOpen, setIsPasteBoxOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [emlPreviewItems, setEmlPreviewItems] = useState<ParsedInquiryEml[]>([]);
  const [isEmlDragOver, setIsEmlDragOver] = useState(false);
  const [emlParseErr, setEmlParseErr] = useState('');
  const emlFileInputRef = React.useRef<HTMLInputElement>(null);

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

  // カード表示密度（standard: 標準 / compact: まとめ表示）※PC・スマホとも初期値まとめ表示
  const [cardDensity, setCardDensity] = useState<'standard' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('temasak_card_density_v2');
      if (saved === 'standard' || saved === 'compact') return saved;
    } catch (e) {}
    return 'compact';
  });
  const changeCardDensity = (d: 'standard' | 'compact') => {
    setCardDensity(d);
    try {
      localStorage.setItem('temasak_card_density_v2', d);
    } catch (e) {}
  };

  // KPIカードグリッドの表示/折りたたみ状態
  const [isKpiCardsOpen, setIsKpiCardsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('temasak_show_kpi_cards');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true;
  });
  const toggleKpiCardsOpen = () => {
    setIsKpiCardsOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('temasak_show_kpi_cards', String(next));
      } catch (e) {}
      return next;
    });
  };

  // クリニック別ポイント制（配点ルール＆バッジ）の表示/非表示切り替え状態
  const [isPointRulesOpen, setIsPointRulesOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('temasak_show_point_rules');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return false;
  });

  const togglePointRulesOpen = (nextVal?: boolean) => {
    setIsPointRulesOpen(prev => {
      const next = nextVal !== undefined ? nextVal : !prev;
      try {
        localStorage.setItem('temasak_show_point_rules', String(next));
      } catch (e) {}
      return next;
    });
  };

  // 各クリニックカード下段アクション＆詳細バー（架電: 会話 (+3p) 〜 詳細）の一括＆個別 表示/非表示切り替え状態
  const [showAllActionBars, setShowAllActionBars] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('temasak_show_all_action_bars');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return false;
  });
  const [expandedActionCardIds, setExpandedActionCardIds] = useState<Record<string, boolean>>({});

  const handleToggleAllActionBars = (showAll: boolean) => {
    setShowAllActionBars(showAll);
    setExpandedActionCardIds({});
    try {
      localStorage.setItem('temasak_show_all_action_bars', String(showAll));
    } catch (e) {}
  };

  const isCardActionBarOpen = (projectId: string): boolean => {
    if (expandedActionCardIds[projectId] !== undefined) {
      return expandedActionCardIds[projectId];
    }
    return showAllActionBars;
  };

  const toggleCardActionBar = (projectId: string) => {
    setExpandedActionCardIds(prev => {
      const current = prev[projectId] !== undefined ? prev[projectId] : showAllActionBars;
      return { ...prev, [projectId]: !current };
    });
  };

  // フィルタ＆並び替え状態
  const [callFilter, setCallFilter] = useState<CallFilter>('all');
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date_desc');
  const [segmentViewMode, setSegmentViewMode] = useState<SegmentViewMode>('split');
  const [kpiSegmentTab, setKpiSegmentTab] = useState<'clinic' | 'btob'>('clinic');

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
  const [detailInitialTab, setDetailInitialTab] = useState<'basicInfo' | 'activities' | 'cashlessStatus' | 'deviceInfo' | 'prepStatus' | 'installation'>('basicInfo');
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

  // リストのインライン訂正用状態・ハンドラ
  const [editingProject, setEditingProject] = useState<{
    id: string;
    clinicName: string;
    address: string;
    clinicType: string;
    rececon: string;
    phone: string;
    director: string;
    receivedAt: string;
    salesRep: string;
    memo: string;
  } | null>(null);

  const openQuickEdit = (p: Project) => {
    setEditingProject({
      id: p.id,
      clinicName: p.clinicName || '',
      address: p.address || '',
      clinicType: p.clinicType || '',
      rececon: p.pipelineMap?.receiptComputer || p.reservationSystem || '',
      phone: p.phone || '',
      director: p.pipelineMap?.director || p.contactPerson || '',
      receivedAt: p.receivedAt || '',
      salesRep: p.salesRep || '松浦 貴文',
      memo: p.memo || ''
    });
  };

  const handleSaveQuickEdit = (p: Project) => {
    if (!editingProject || editingProject.id !== p.id) return;
    const trimmedName = editingProject.clinicName.trim() || p.clinicName;
    updateProject(p.id, {
      clinicName: trimmedName,
      address: editingProject.address.trim(),
      clinicType: editingProject.clinicType.trim(),
      reservationSystem: editingProject.rececon.trim(),
      phone: editingProject.phone.trim(),
      contactPerson: editingProject.director.trim(),
      receivedAt: editingProject.receivedAt.trim() || p.receivedAt,
      salesRep: editingProject.salesRep.trim() || p.salesRep,
      memo: editingProject.memo,
      pipelineMap: {
        ...(p.pipelineMap || {}),
        receiptComputer: editingProject.rececon.trim(),
        director: editingProject.director.trim(),
        department: editingProject.clinicType.trim()
      }
    });
    setEditingProject(null);
    triggerToast(`✏️ 「${trimmedName}」の登録情報を訂正しました`);
  };

  const handleDeleteFromList = (p: Project) => {
    if (window.confirm(`「${p.clinicName}」をリストから削除しますか？\n（※誤って削除した場合も、右上のリセットボタンから初期42件に戻せます）`)) {
      if (detailProjectId === p.id) setDetailProjectId(null);
      if (editingProject?.id === p.id) setEditingProject(null);
      deleteProject(p.id);
      triggerToast(`🗑️ 「${p.clinicName}」をリストから削除しました`);
    }
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
    const stage = normalizeProgressStage(p);
    if (stage === '受注') {
      return {
        code: 'won',
        label: '🎉 受注確定',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        borderColor: '#f59e0b'
      };
    }
    if (stage === 'kz送客') {
      return {
        code: 'interview',
        label: '💰 kz送客済（補助金活用）',
        badgeBg: '#cffafe',
        badgeColor: '#0f766e',
        borderColor: '#67e8f9'
      };
    }
    if (
      stage === 'デモ' ||
      stage === '見積' ||
      stage === '検討' ||
      stage === '後追い'
    ) {
      return {
        code: 'interview',
        label: `🌟 デモ・見積進行（${stage}）`,
        badgeBg: '#dcfce7',
        badgeColor: '#15803d',
        borderColor: '#86efac'
      };
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
        const matchRececon = (p.pipelineMap?.receiptComputer || p.reservationSystem || '').toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchType && !matchMemo && !matchLost && !matchRececon) return false;
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

  // クリニック直販（営業中のみ・受注と失注は別枠へ分離）、BtoB別枠、クリニック受注別枠、クリニック失注別枠
  const isWonClinicOrProject = (p: Project): boolean => {
    if (p.status === '失注') return false;
    return normalizeProgressStage(p) === '受注';
  };

  const matchesCommonFilters = (p: Project): boolean => {
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
  };

  const sortProjectsList = (list: Project[]): Project[] => {
    if (sortMode === 'points_desc') {
      return [...list].sort((a, b) => getClinicTotalPoints(b) - getClinicTotalPoints(a));
    }
    if (sortMode === 'points_asc') {
      return [...list].sort((a, b) => getClinicTotalPoints(a) - getClinicTotalPoints(b));
    }
    return list;
  };

  // 1. 🏥 クリニック 営業中リスト（受注と失注を除いた純粋な営業進行中クリニックのみ）
  const clinicFilteredProjects = useMemo(
    () =>
      filteredProjects.filter(p => {
        if (isBtoBDealerProject(p)) return false;
        if (callFilter !== 'won' && callFilter !== 'archived') {
          if (isWonClinicOrProject(p) || p.status === '失注') return false;
        }
        return true;
      }),
    [filteredProjects, callFilter]
  );

  // 2. 🏢 BtoB ディーラー・パートナー企業リスト（別枠）
  const btobFilteredProjects = useMemo(
    () => filteredProjects.filter(p => isBtoBDealerProject(p)),
    [filteredProjects]
  );

  // 3. 🎉 クリニック 受注（成約済）リスト（営業中リストとは別枠）
  const wonClinicProjects = useMemo(
    () =>
      sortProjectsList(
        projects.filter(p => !isBtoBDealerProject(p) && isWonClinicOrProject(p) && matchesCommonFilters(p))
      ),
    [projects, areaFilter, selectedMonth, searchQuery, sortMode]
  );

  // 4. 🗄️ クリニック アーカイブ（失注）リスト（営業中リストとは別枠）
  const archivedClinicProjects = useMemo(
    () =>
      sortProjectsList(
        projects.filter(p => p.status === '失注' && !isBtoBDealerProject(p) && matchesCommonFilters(p))
      ),
    [projects, areaFilter, selectedMonth, searchQuery, sortMode]
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
      'kz送客': { pts: 5, label: '💰 kz送客・補助金コンサル送客 (+5p)' },
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
      'kz送客': 'kz送客（補助金活用・採択後に受注）',
      '受注': '受注（ご契約確定）'
    };
    const nextStageLabel = stageMap[outcome];

    triggerToast(
      `✅ 「${p.clinicName}」に【${outcome}${dateMsg} (+${info.pts}p)】を加算！（累計: ${nextClinicPts}p${nextStageLabel ? ` / 進捗: ${nextStageLabel}` : ''}）`
    );
  };

  // 進捗フロー（問合せ → 初動 → デモ → 見積 → 検討 → 後追い → kz送客 → 受注）クリック連動ハンドラ（案件カンバン・活動履歴と完全同期）
  const handleSelectProgressStage = (p: Project, stage: SalesProgressStage) => {
    const currentStage = normalizeProgressStage(p);
    if (currentStage === stage && p.status === stage) return;
    handleStatusChange(p.id, stage);
    triggerToast(
      stage === 'kz送客'
        ? `💰 「${p.clinicName}」を【kz送客（補助金利用時・コンサル送客）】へ更新しました（※補助金なし通常導入の場合は直接「受注」へ進めます）`
        : stage === '受注'
        ? `🎉 「${p.clinicName}」を【受注（通常ご契約 / 補助金採択）】へ更新しました（カンバン＆活動履歴と同期済）`
        : `🚀 「${p.clinicName}」の進捗フロー・カンバン・活動履歴を【${stage}】に同期更新しました`
    );
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
    } else if (actionType === 'kz送客' && p.kzReferralDate) {
      defaultDate = p.kzReferralDate;
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

  // コピペテキストからEML/問い合わせフォーム文面の自動検知
  const pastedEmlItem = useMemo(() => {
    if (!pasteInputText.trim() || !isInquiryEmailText(pasteInputText)) return null;
    const parsed = parseInquiryEml(pasteInputText);
    return parsed.clinicName || parsed.phone || parsed.email ? parsed : null;
  }, [pasteInputText]);

  const activeEmlItems = useMemo(
    () => (emlPreviewItems.length > 0 ? emlPreviewItems : pastedEmlItem ? [pastedEmlItem] : []),
    [emlPreviewItems, pastedEmlItem]
  );

  // コピペテキストのリアルタイム解析プレビュー（EML形式でない場合のみ名簿行パース）
  const parsedPreviewLeads = useMemo(() => {
    if (!pasteInputText.trim() || isInquiryEmailText(pasteInputText)) return [];
    return parsePastedRosterText(pasteInputText);
  }, [pasteInputText]);

  const handleEmlFilesSelected = async (files: FileList | File[] | undefined | null) => {
    if (!files || files.length === 0) return;
    try {
      const results = await readInquiryEmlFiles(files);
      const valid = results.filter(r => r.clinicName || r.phone || r.email);
      if (valid.length === 0) {
        setEmlParseErr('お問い合わせ項目（【貴院名】【電話番号】など）が見つかりませんでした。');
        return;
      }
      setEmlParseErr('');
      setEmlPreviewItems(valid);
    } catch (e) {
      console.error('EML read error:', e);
      setEmlParseErr('EMLファイルの読み込みに失敗しました。');
    }
  };

  const handleLoadSampleEmlInOS = () => {
    const parsed = parseInquiryEml(SAMPLE_EML_3543_TEXT);
    setEmlParseErr('');
    setEmlPreviewItems([parsed]);
  };

  const handleRegisterEmlItems = () => {
    if (activeEmlItems.length === 0) return;
    const created = activeEmlItems.map(item =>
      createProjectAndActionFromEml(item, {
        salesRep: '松浦 貴文',
        initialStatus: SALES_PROGRESS_FLOW[0]
      })
    );
    const newProjs = created.map(c => c.project);
    const newActs = created.map(c => c.action);
    addProjectsBulk(newProjs, newActs);
    addPoint(
      newProjs[0].clinicName + (newProjs.length > 1 ? ` 他${newProjs.length - 1}件` : ''),
      `EML新規反響登録 (${newProjs.length}件) (+${newProjs.length}p)`,
      newProjs.length
    );
    setEmlPreviewItems([]);
    setEmlParseErr('');
    if (pastedEmlItem) setPasteInputText('');
    setIsPasteBoxOpen(false);
    triggerToast(`📧 EMLから ${newProjs.length} 件の新規案件を名簿に追加しました！（+${newProjs.length}p）`);
  };

  const handleUpdateExistingFromEmlInOS = (target: Project, item: ParsedInquiryEml) => {
    updateProject(target.id, buildProjectUpdatesFromEml(target, item));
    setEmlPreviewItems(prev => prev.filter(x => x !== item));
    if (pastedEmlItem === item) setPasteInputText('');
    triggerToast(`🔄 既存案件「${target.clinicName}」の基本情報をEML内容で更新しました！`);
  };

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
    <div className={`sos-root ${cardDensity === 'compact' ? 'sos-compact' : ''}`} style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '4rem' }}>
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
      <div className="sos-hero" style={{
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
            <div className="sos-hero-icon" style={{
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
            <div style={{ minWidth: 0 }}>
              <h1 className="sos-hero-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                ⚡ 超かんたん司令室 <span style={{ fontSize: '1rem', color: '#93c5fd', fontWeight: 700 }}>（全{projects.length}件）</span>
              </h1>
              {/* 件数まとめチップ（ひと目で全体把握） */}
              <div className="sos-hero-chips" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                {[
                  { label: '🏥 営業中', value: projects.filter(p => p.status !== '失注' && !isBtoBDealerProject(p) && normalizeProgressStage(p) !== '受注').length, bg: 'rgba(59,130,246,0.3)', bd: 'rgba(147,197,253,0.55)', mode: 'clinic_only' },
                  { label: '🎉 受注', value: projects.filter(p => p.status !== '失注' && !isBtoBDealerProject(p) && normalizeProgressStage(p) === '受注').length, bg: 'rgba(16,185,129,0.3)', bd: 'rgba(110,231,183,0.55)', mode: 'won_only' },
                  { label: '🗄️ 失注', value: kpiStats.clinicArchivedCount, bg: 'rgba(148,163,184,0.3)', bd: 'rgba(203,213,225,0.5)', mode: 'archived_only' },
                  { label: '🏢 BtoB', value: kpiStats.btob.total, bg: 'rgba(129,140,248,0.3)', bd: 'rgba(165,180,252,0.55)', mode: 'btob_only' }
                ].map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setCallFilter('all');
                      setSegmentViewMode(segmentViewMode === chip.mode ? 'split' : (chip.mode as SegmentViewMode));
                    }}
                    title="クリックでこの枠だけ表示（もう一度で全枠表示）"
                    style={{
                      backgroundColor: segmentViewMode === chip.mode ? '#ffffff' : chip.bg,
                      color: segmentViewMode === chip.mode ? '#0f172a' : '#ffffff',
                      border: `1px solid ${chip.bd}`,
                      borderRadius: '999px',
                      padding: '0.2rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {chip.label} <span style={{ fontSize: '0.95rem' }}>{chip.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 今日の20ptミッション・ミニゲージ */}
          <div className="sos-mission" style={{
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

        {/* ポイント配点ルール一覧（日次＆クリニック別共通）バッジバー（表示/非表示切り替え対応） */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          paddingTop: '0.55rem',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          fontSize: '0.74rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#fde68a', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Trophy size={13} color="#fbbf24" /> クリニック別ポイント制:
              </span>
              {/* 表示 / 非表示 セグメンテッド切替ボタン */}
              <div style={{
                display: 'inline-flex',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                padding: '0.15rem',
                borderRadius: '0.45rem',
                border: '1px solid rgba(255,255,255,0.2)',
                gap: '0.15rem'
              }}>
                <button
                  type="button"
                  onClick={() => togglePointRulesOpen(true)}
                  style={{
                    padding: '0.16rem 0.55rem',
                    borderRadius: '0.32rem',
                    border: 'none',
                    backgroundColor: isPointRulesOpen ? '#f59e0b' : 'transparent',
                    color: isPointRulesOpen ? '#0f172a' : '#cbd5e1',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <Eye size={12} /> 表示
                </button>
                <button
                  type="button"
                  onClick={() => togglePointRulesOpen(false)}
                  style={{
                    padding: '0.16rem 0.55rem',
                    borderRadius: '0.32rem',
                    border: 'none',
                    backgroundColor: !isPointRulesOpen ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: !isPointRulesOpen ? '#ffffff' : '#cbd5e1',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}
                >
                  <EyeOff size={12} /> 非表示
                </button>
              </div>
              {!isPointRulesOpen && (
                <span
                  onClick={() => togglePointRulesOpen(true)}
                  style={{ color: '#93c5fd', fontSize: '0.71rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  （クリックで架電・メール・デモ・kz送客・受注の配点ルールを表示 ▼）
                </span>
              )}
            </div>
          </div>

          {isPointRulesOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                '💰 kz送客 +5p',
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
          )}
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

      {/* 2. KPI リアルタイム集計バー（直販枠 KPI ⇔ BtoB別枠 KPI セグメンテッドコントロール切替） */}
      <div style={{
        backgroundColor: kpiSegmentTab === 'clinic' ? '#f8fafc' : '#f5f3ff',
        border: kpiSegmentTab === 'clinic' ? '1px solid #cbd5e1' : '1px solid #a5b4fc',
        borderLeft: kpiSegmentTab === 'clinic' ? '5px solid #2563eb' : '5px solid #4338ca',
        borderRadius: '0.9rem',
        padding: '0.8rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
      }}>
        {/* セグメンテッドコントロール（直販枠 KPI ⇔ BtoB別枠 KPI） */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem'
        }}>
          <div className="sos-seg" style={{
            display: 'inline-flex',
            backgroundColor: '#e2e8f0',
            padding: '0.25rem',
            borderRadius: '0.65rem',
            border: '1px solid #cbd5e1',
            gap: '0.25rem',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={() => {
                setKpiSegmentTab('clinic');
                if (segmentViewMode === 'btob_only') setSegmentViewMode('split');
              }}
              style={{
                padding: '0.42rem 1.05rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: kpiSegmentTab === 'clinic' ? '#ffffff' : 'transparent',
                color: kpiSegmentTab === 'clinic' ? '#1d4ed8' : '#475569',
                fontWeight: 900,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: kpiSegmentTab === 'clinic' ? '0 2px 6px rgba(15, 23, 42, 0.12)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{
                backgroundColor: kpiSegmentTab === 'clinic' ? '#1d4ed8' : '#94a3b8',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '999px'
              }}>
                直販枠 KPI
              </span>
              <span>🏥 クリニック営業 KPI（{kpiStats.total}件 / 受注{kpiStats.wonCount}件）</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setKpiSegmentTab('btob');
              }}
              style={{
                padding: '0.42rem 1.05rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: kpiSegmentTab === 'btob' ? '#ffffff' : 'transparent',
                color: kpiSegmentTab === 'btob' ? '#4338ca' : '#475569',
                fontWeight: 900,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: kpiSegmentTab === 'btob' ? '0 2px 6px rgba(15, 23, 42, 0.12)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{
                backgroundColor: kpiSegmentTab === 'btob' ? '#4338ca' : '#94a3b8',
                color: '#ffffff',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '999px'
              }}>
                BtoB別枠 KPI
              </span>
              <span>🏢 ディーラー・パートナー企業 KPI（{kpiStats.btob.total}社 / 累計{kpiStats.btob.totalPts}p）</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {kpiSegmentTab === 'clinic' ? (
              <button
                type="button"
                onClick={() => setSegmentViewMode(segmentViewMode === 'clinic_only' ? 'split' : 'clinic_only')}
                style={{
                  padding: '0.28rem 0.75rem',
                  borderRadius: '999px',
                  border: segmentViewMode === 'clinic_only' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                  backgroundColor: segmentViewMode === 'clinic_only' ? '#1d4ed8' : '#ffffff',
                  color: segmentViewMode === 'clinic_only' ? '#ffffff' : '#334155',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {segmentViewMode === 'clinic_only' ? '✓ クリニックのみ表示中（全枠表示へ戻す）' : '🏥 クリニック枠のみ表示'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSegmentViewMode(segmentViewMode === 'btob_only' ? 'split' : 'btob_only')}
                style={{
                  padding: '0.28rem 0.75rem',
                  borderRadius: '999px',
                  border: segmentViewMode === 'btob_only' ? '1px solid #4338ca' : '1px solid #a5b4fc',
                  backgroundColor: segmentViewMode === 'btob_only' ? '#4338ca' : '#ffffff',
                  color: segmentViewMode === 'btob_only' ? '#ffffff' : '#3730a3',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {segmentViewMode === 'btob_only' ? '✓ BtoBリストのみ表示中（全枠表示へ戻す）' : '🏢 BtoB企業リストのみ表示'}
              </button>
            )}

            <button
              type="button"
              onClick={toggleKpiCardsOpen}
              title="KPIカード5枚の展開・折りたたみを切り替え"
              style={{
                padding: '0.28rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                backgroundColor: isKpiCardsOpen ? '#ffffff' : '#0f172a',
                color: isKpiCardsOpen ? '#334155' : '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {isKpiCardsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>{isKpiCardsOpen ? '📊 KPIカード: 折りたたみ' : '📊 KPIカード: 表示'}</span>
            </button>
          </div>
        </div>

        {/* 2-A. 🏥 直販枠 KPI コンテンツ */}
        {isKpiCardsOpen && kpiSegmentTab === 'clinic' && (
          <div className="sos-kpi-grid" style={{
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
        )}

        {/* 2-B. 🏢 BtoB別枠 KPI コンテンツ */}
        {isKpiCardsOpen && kpiSegmentTab === 'btob' && (
          <div className="sos-kpi-grid" style={{
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
        )}
      </div>

      {/* 3. かんたん検索・エリア＆月フィルタバー（コンパクト1行表示） */}
      <div className="sos-filterbar" style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '0.45rem 0.7rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.4rem 0.6rem'
      }}>
        {/* エリアワンタップピル */}
        <div className="sos-scroll-x" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <MapPin size={13} color="#64748b" />
          {(['all', '北海道', '宮城県', '福島県', '秋田県', '岩手県'] as AreaFilter[]).map(area => {
            const count = area === 'all' ? kpiStats.allActiveCount : (kpiStats.byArea[area] || 0);
            const active = areaFilter === area;
            return (
              <button
                key={area}
                onClick={() => setAreaFilter(area)}
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  border: active ? '1px solid #1e40af' : '1px solid #e2e8f0',
                  backgroundColor: active ? '#1e40af' : '#f8fafc',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {area === 'all' ? `全域 ${count}` : `${area.replace(/[県道]$/, '')} ${count}`}
              </button>
            );
          })}
        </div>

        {/* 月フィルタ・検索・追加・リセット（横一列） */}
        <div className="sos-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 360px', justifyContent: 'flex-end', minWidth: 0 }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '0.25rem 0.4rem',
              borderRadius: '0.4rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.74rem',
              backgroundColor: '#f8fafc',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            <option value="all">📅 全期間 ({kpiStats.allActiveCount})</option>
            {Object.keys(kpiStats.byMonth)
              .sort((a, b) => b.localeCompare(a))
              .map(ym => {
                const [y, m] = ym.split('-');
                return (
                  <option key={ym} value={ym}>
                    {y}/{parseInt(m, 10)}月 ({kpiStats.byMonth[ym]})
                  </option>
                );
              })}
          </select>

          <div style={{ position: 'relative', flex: '1 1 140px', minWidth: '110px', maxWidth: '240px' }}>
            <Search size={13} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="名称・市区町村・科目・レセコン"
              style={{
                width: '100%',
                padding: '0.25rem 0.5rem 0.25rem 1.6rem',
                borderRadius: '0.4rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.74rem'
              }}
            />
          </div>

          <button
            onClick={() => setIsPasteBoxOpen(prev => !prev)}
            title="コピペで新規追加"
            style={{
              padding: '0.28rem 0.6rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: isPasteBoxOpen ? '#0f172a' : 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              fontSize: '0.74rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Plus size={13} />
            <span>{isPasteBoxOpen ? '閉じる' : '新規追加'}</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('名簿42件の初期データ状態にリセットしますか？')) {
                resetToRoster42();
                triggerToast('🔄 名簿42件の初期データを再読み込みしました');
              }
            }}
            title="名簿42件を初期状態に戻す（リセット）"
            style={{
              padding: '0.28rem 0.4rem',
              borderRadius: '0.4rem',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* 3.5 EML読み込み ＆ コピペ新規追加パネル */}
      {isPasteBoxOpen && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #10b981',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.12)'
        }}>
          {/* 📧 EMLファイル読み込み（ドラッグ＆ドロップ / ファイル選択 / サンプル） */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsEmlDragOver(true);
            }}
            onDragLeave={() => setIsEmlDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsEmlDragOver(false);
              handleEmlFilesSelected(e.dataTransfer.files);
            }}
            style={{
              backgroundColor: isEmlDragOver ? '#dbeafe' : '#eff6ff',
              border: `2px ${isEmlDragOver ? 'solid' : 'dashed'} #3b82f6`,
              borderRadius: '0.75rem',
              padding: '0.9rem 1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              transition: 'background-color 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={17} />
                  <span>📧 お問い合わせメール（.eml）読み込み（ドラッグ＆ドロップ対応）</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#1d4ed8', marginTop: '0.15rem' }}>
                  「資料請求・お問い合わせフォーム」の .eml ファイルをドロップ（複数可）すると基本情報などを自動抽出します（下のボックスへメール本文を貼り付けてもOK）
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => emlFileInputRef.current?.click()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <Upload size={14} /> EMLファイルを選択（複数可）
                </button>
                <input
                  ref={emlFileInputRef}
                  type="file"
                  multiple
                  accept=".eml,.txt,message/rfc822,text/plain"
                  style={{ display: 'none' }}
                  onChange={e => {
                    handleEmlFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {emlParseErr && (
              <div style={{ padding: '0.45rem 0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '0.4rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertTriangle size={14} /> {emlParseErr}
              </div>
            )}

            {activeEmlItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {activeEmlItems.map((item, idx) => {
                  const matchedList = findMatchingProjectsForEml(projects, item);
                  const matched = matchedList[0];
                  return (
                    <div
                      key={`${item.inquiryNo}-${idx}`}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '0.55rem',
                        padding: '0.7rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                          🏥 {item.clinicName || '(貴院名なし)'} {item.inquiryNo ? `【受付番号 #${item.inquiryNo} / ${item.receivedAt}】` : `【${item.receivedAt}】`}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            if (emlPreviewItems.length > 0) {
                              setEmlPreviewItems(prev => prev.filter(x => x !== item));
                            } else {
                              setPasteInputText('');
                            }
                          }}
                          title="この候補を外す"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.25rem 0.8rem', fontSize: '0.78rem', color: '#334155' }}>
                        <div>👤 役職・担当者: <strong>{item.contactTitle || '-'} {item.contactPerson || '-'}</strong></div>
                        <div>📞 電話: <strong>{item.phone || '-'}</strong></div>
                        <div>✉️ メール: <strong>{item.email || '-'}</strong></div>
                        <div>🧾 レセコン: <strong>{item.rececon || '-'}</strong></div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          📍 住所: {item.postalCode && `〒${item.postalCode} `}{item.address || '-'}
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>🖥️ 商材: {item.products || '-'}</div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          📝 種別: {item.inquiryTypes || '-'} / 理由: {item.reason || '-'}
                          {item.content && ` / 内容: ${item.content}`}
                        </div>
                      </div>

                      {matched && (
                        <div style={{ paddingTop: '0.35rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.76rem', color: '#b45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertTriangle size={13} /> 既存案件「{matched.clinicName}」と一致しました
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateExistingFromEmlInOS(matched, item)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.45rem',
                              border: 'none',
                              backgroundColor: '#d97706',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <RefreshCw size={13} /> 既存「{matched.clinicName}」の基本情報をこのEMLで更新する
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleRegisterEmlItems}
                  style={{
                    width: '100%',
                    padding: '0.62rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    ✅ 新規案件として名簿に追加する{activeEmlItems.length > 1 ? `（${activeEmlItems.length}件）` : ''} (+{activeEmlItems.length}p)
                  </span>
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📋 コピペで超かんたん新規追加（1行〜複数行まとめてOK / メール本文ペーストも可）</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.15rem' }}>
                Excelやスプレッドシート、チャットから <strong>「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」</strong> またはお問い合わせメール本文を貼り付けてください
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
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

      {/* 4. メイン名簿カードリスト（クリニック営業中枠 ／ クリニック受注別枠 ／ クリニック失注別枠 ／ BtoB別枠 の4枠分離） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* 視認性を高めた「対象リスト件数＆別枠切替」ヘッダーバー */}
        <div className="sos-list-header" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderLeft: `5px solid ${callFilter === 'archived' ? '#475569' : callFilter === 'won' ? '#059669' : '#1e40af'}`,
          borderRadius: '0.75rem',
          padding: '0.6rem 0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div className="sos-list-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.76rem', width: '100%' }}>
            {/* リスト枠切替ピル（全枠まとめ / 営業中 / 受注 / 失注 / BtoB） */}
            <div className="sos-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#eef2ff', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #c7d2fe', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: '#3730a3', padding: '0 0.25rem', fontSize: '0.72rem' }}>表示枠:</span>
              {[
                { id: 'split', label: '📊 全枠まとめ' },
                { id: 'clinic_only', label: `🏥 営業中 (${clinicFilteredProjects.length})` },
                { id: 'won_only', label: `🎉 受注 (${wonClinicProjects.length})` },
                { id: 'archived_only', label: `🗄️ 失注 (${archivedClinicProjects.length})` },
                { id: 'btob_only', label: `🏢 BtoB (${btobFilteredProjects.length})` }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id !== 'won_only' && opt.id !== 'archived_only' && (callFilter === 'won' || callFilter === 'archived')) {
                      setCallFilter('all');
                    }
                    setSegmentViewMode(opt.id as SegmentViewMode);
                  }}
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
              {isFiltered && (
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
                    padding: '0.18rem 0.5rem',
                    borderRadius: '0.35rem',
                    border: '1px solid #fca5a5',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ✕ 解除
                </button>
              )}
            </div>

            {/* 表示スタイル切替（標準 / まとめ表示） */}
            <div className="sos-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#fff7ed', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #fdba74' }}>
              <span style={{ fontWeight: 800, color: '#9a3412', padding: '0 0.25rem', fontSize: '0.72rem' }}>表示:</span>
              {[
                { id: 'compact' as const, label: '📑 まとめ表示' },
                { id: 'standard' as const, label: '📋 標準表示' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => changeCardDensity(opt.id)}
                  style={{
                    padding: '0.18rem 0.55rem',
                    borderRadius: '0.35rem',
                    border: 'none',
                    backgroundColor: cardDensity === opt.id ? '#ea580c' : 'transparent',
                    color: cardDensity === opt.id ? '#ffffff' : '#9a3412',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* クリニックポイント順並び替えピル */}
            <div className="sos-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#f1f5f9', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #cbd5e1' }}>
              <span style={{ fontWeight: 800, color: '#475569', padding: '0 0.25rem', fontSize: '0.72rem' }}>並び順:</span>
              {[
                { id: 'date_desc', label: '📅 反響日順' },
                { id: 'points_desc', label: '🏆 ポイント順' },
                { id: 'points_asc', label: '🌱 低い順' }
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
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 架電〜詳細 アクションバー 一括 表示/非表示 切り替えピル */}
            <div className="sos-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#f0fdf4', padding: '0.2rem 0.35rem', borderRadius: '0.45rem', border: '1px solid #86efac' }}>
              <span style={{ fontWeight: 800, color: '#166534', padding: '0 0.25rem', fontSize: '0.72rem' }}>架電・詳細バー:</span>
              <button
                type="button"
                onClick={() => handleToggleAllActionBars(true)}
                style={{
                  padding: '0.18rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: showAllActionBars ? '#059669' : 'transparent',
                  color: showAllActionBars ? '#ffffff' : '#166534',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}
              >
                <Eye size={12} /> 全件表示
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllActionBars(false)}
                style={{
                  padding: '0.18rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: !showAllActionBars ? '#0f172a' : 'transparent',
                  color: !showAllActionBars ? '#ffffff' : '#166534',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem'
                }}
              >
                <EyeOff size={12} /> 全件非表示
              </button>
            </div>
          </div>
        </div>

        {[
          {
            id: 'clinic' as const,
            visible:
              callFilter !== 'archived' &&
              callFilter !== 'won' &&
              (segmentViewMode === 'split' || segmentViewMode === 'clinic_only'),
            title: '🏥 クリニック 営業中リスト（直販・進行中のみ）',
            subtitle: '現在アプローチ・商談進行中の医療機関リスト（問合せ ▸ 初動 ▸ デモ ▸ 見積 ▸ 検討 ▸ 後追い ▸ kz送客 ※受注・失注は下部別枠に分離）',
            badgeLabel: '営業進行中',
            badgeBg: '#1e40af',
            headerBg: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
            containerBg: '#f8fafc',
            borderColor: '#93c5fd',
            accentColor: '#1d4ed8',
            unit: '件',
            list: clinicFilteredProjects
          },
          {
            id: 'clinic_won' as const,
            visible:
              callFilter !== 'archived' &&
              (callFilter === 'won' || segmentViewMode === 'split' || segmentViewMode === 'won_only'),
            title: '🎉 クリニック 受注（成約確定）リスト【別枠】',
            subtitle: 'ご契約・受注が確定したクリニック専用枠（営業中リストとは別枠で管理。進捗フローのクリックで前ステージへ戻すことも可能です）',
            badgeLabel: '🎉 受注別枠',
            badgeBg: '#059669',
            headerBg: 'linear-gradient(135deg, #ecfdf5 0%, #fef3c7 100%)',
            containerBg: '#f0fdf4',
            borderColor: '#34d399',
            accentColor: '#059669',
            unit: '件',
            list: wonClinicProjects
          },
          {
            id: 'clinic_archive' as const,
            visible:
              callFilter !== 'won' &&
              (callFilter === 'archived' || segmentViewMode === 'split' || segmentViewMode === 'archived_only'),
            title: '🗄️ クリニック アーカイブ（失注）リスト【別枠】',
            subtitle: '失注理由（他社導入・金銭面・その他）とともに営業中リストから別枠保管されたクリニック一覧。いつでも「🔄 営業リストに戻す（復活）」で復帰可能です。',
            badgeLabel: '🗄️ 失注別枠',
            badgeBg: '#475569',
            headerBg: 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
            containerBg: '#f8fafc',
            borderColor: '#94a3b8',
            accentColor: '#475569',
            unit: '件',
            list: archivedClinicProjects
          },
          {
            id: 'btob' as const,
            visible:
              callFilter !== 'archived' &&
              callFilter !== 'won' &&
              (segmentViewMode === 'split' || segmentViewMode === 'btob_only'),
            title: '🏢 ディーラー・パートナー企業 営業中リスト【BtoB別枠】',
            subtitle: '医療機器ディーラー・卸・紹介パートナー企業向けのBtoBアライアンス＆同行営業リスト（※クリニック直販とは別枠でリスト化・KPI集計）',
            badgeLabel: '🏢 BtoB別枠',
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
              className="sos-section"
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
                  <div className="sos-section-sub" style={{ fontSize: '0.77rem', color: '#475569', marginTop: '0.2rem', fontWeight: 600 }}>
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
          const hasKzReferral =
            project.status === 'kz送客' ||
            project.memo?.includes('kz送客済') ||
            !!project.kzReferralDate;
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
              className="sos-card"
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
              <div className="sos-card-top" style={{
                padding: '0.95rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: '1.25fr 1fr',
                alignItems: 'center',
                gap: '1.15rem'
              }}>
                {/* 左カラム：クリニック名・クリニックポイント・エリア・送付/デモ/見積/失注理由バッジ */}
                <div className="sos-card-left" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div className="sos-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
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
                      backgroundColor: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '0.35rem'
                    }}>
                      {project.clinicType}
                    </span>

                    {/* レセコン表示バッジ（クリックで基本情報のレセコン欄を直接開く） */}
                    <span
                      onClick={() => {
                        setDetailInitialTab('basicInfo');
                        setDetailProjectId(project.id);
                      }}
                      title="クリックしてレセコン情報を入力・編集"
                      style={{
                        backgroundColor: (project.pipelineMap?.receiptComputer || project.reservationSystem) ? '#e0f2fe' : '#f8fafc',
                        color: (project.pipelineMap?.receiptComputer || project.reservationSystem) ? '#0369a1' : '#64748b',
                        border: (project.pipelineMap?.receiptComputer || project.reservationSystem) ? '1px solid #7dd3fc' : '1px dashed #cbd5e1',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.58rem',
                        borderRadius: '0.35rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.22rem'
                      }}
                    >
                      🖥️ レセコン: {project.pipelineMap?.receiptComputer || project.reservationSystem || '未設定'}
                    </span>

                    <span className="sos-meta-minor" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      反響日: {project.receivedAt}
                    </span>
                  </div>

                  <div
                    className="sos-card-name"
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
                  <div className="sos-card-badges" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem', fontSize: '0.76rem', color: '#475569', flexWrap: 'wrap' }}>
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

                    {hasKzReferral && project.pipelineMap?.subsidyName !== '補助金なし（通常導入）' && (
                      <span
                        onClick={() => openDemoDatePicker(project, 'kz送客')}
                        title="補助金利用案件：コンサルタント（kz）へ送客済（※補助金なし通常導入の場合は直接「受注」へ進めます）"
                        style={{
                          padding: '0.14rem 0.6rem',
                          borderRadius: '0.3rem',
                          backgroundColor: '#cffafe',
                          color: '#0f766e',
                          border: '1px solid #22d3ee',
                          fontWeight: 900,
                          cursor: 'pointer'
                        }}
                      >
                        💰 kz送客済{project.kzReferralDate ? ` (${project.kzReferralDate.slice(5)})` : ''}
                      </span>
                    )}

                    {hasOrder && (
                      <span
                        onClick={() => openDemoDatePicker(project, '受注')}
                        title="クリックして受注日を選択・更新（通常導入・直接ご契約／補助金採択のどちらも対応）"
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
                        🎉 受注済{project.pipelineMap?.subsidyName === '補助金なし（通常導入）' ? '（通常導入）' : ''}
                        {project.orderDate ? ` (${project.orderDate.slice(5)})` : ''}
                      </span>
                    )}

                    {(() => {
                      const gate = getProjectSpecAndGateSummary(project);
                      return (
                        <>
                          {CASHLESS_PAYMENT_CATEGORIES.filter(c => gate.selectedCashless.includes(c.id)).map(c => (
                            <span
                              key={c.id}
                              onClick={() => {
                                setDetailInitialTab('cashlessStatus');
                                setDetailProjectId(project.id);
                              }}
                              title={`キャッシュレス決済選択: ${c.title}（${c.subtitle}）— クリックで編集`}
                              style={{
                                padding: '0.14rem 0.55rem',
                                borderRadius: '0.3rem',
                                backgroundColor: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #93c5fd',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              💳 {c.shortLabel}
                            </span>
                          ))}
                          {gate.specCompletedCount > 0 && (
                            <span
                              onClick={() => {
                                setDetailInitialTab('deviceInfo');
                                setDetailProjectId(project.id);
                              }}
                              title="クリックして7 STEP 仕様選択を編集"
                              style={{
                                padding: '0.14rem 0.55rem',
                                borderRadius: '0.3rem',
                                backgroundColor: gate.specCompletedCount === 7 ? '#dcfce7' : '#fff7ed',
                                color: gate.specCompletedCount === 7 ? '#166534' : '#c2410c',
                                border: '1px solid #fdba74',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              🎨 仕様 {gate.specCompletedCount}/7 STEP
                            </span>
                          )}
                          {(currentProgressStage === 'kz送客' || currentProgressStage === '受注' || gate.docsReadyCount > 0) && (
                            <span
                              onClick={() => {
                                setDetailInitialTab('prepStatus');
                                setDetailProjectId(project.id);
                              }}
                              title="クリックして公的書類3点＋GbizID・KIZASHI申請状況を編集"
                              style={{
                                padding: '0.14rem 0.55rem',
                                borderRadius: '0.3rem',
                                backgroundColor: gate.docsReadyCount === 4 ? '#dcfce7' : '#ecfeff',
                                color: gate.docsReadyCount === 4 ? '#166534' : '#0f766e',
                                border: '1px solid #67e8f9',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              📄 公的書類 {gate.docsReadyCount}/4
                            </span>
                          )}
                        </>
                      );
                    })()}

                    <span style={{ color: '#64748b', fontWeight: 600 }}>担当: {project.salesRep}</span>
                  </div>

                  {/* 8段階 進捗フロー（問合せ → 初動 → デモ → 見積 → 検討 → 後追い → kz送客 → 受注）※案件カンバン＆アクションボタンと自動連動 */}
                  {!isArchived && (
                    <div className="sos-flow" style={{
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
                        const isKz = stage === 'kz送客';
                        return (
                          <React.Fragment key={stage}>
                            <button
                              type="button"
                              onClick={() => handleSelectProgressStage(project, stage)}
                              title={
                                isKz
                                  ? '補助金利用クリニック向け：コンサルタント（kz）送客へ変更（※補助金を使わない通常導入の場合は直接「受注」へ進めます）'
                                  : stage === '受注'
                                  ? '進捗ステージを「受注」に変更（通常導入・直接ご契約／補助金採択後のどちらも対応・カンバン連動）'
                                  : `進捗ステージを「${stage}」に変更（案件カンバン＆下のアクションボタンとも自動連動します）`
                              }
                              style={{
                                padding: '0.16rem 0.52rem',
                                borderRadius: '0.35rem',
                                border: isCurrent
                                  ? isWon
                                    ? '2px solid #059669'
                                    : isKz
                                    ? '2px solid #0891b2'
                                    : '2px solid #1d4ed8'
                                  : isPassed
                                  ? '1px solid #93c5fd'
                                  : isKz
                                  ? '1px solid #67e8f9'
                                  : '1px solid #cbd5e1',
                                backgroundColor: isCurrent
                                  ? isWon
                                    ? '#059669'
                                    : isKz
                                    ? '#0891b2'
                                    : '#1d4ed8'
                                  : isPassed
                                  ? '#dbeafe'
                                  : isKz
                                  ? '#ecfeff'
                                  : '#ffffff',
                                color: isCurrent
                                  ? '#ffffff'
                                  : isPassed
                                  ? '#1e40af'
                                  : isKz
                                  ? '#0f766e'
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

                {/* 右カラム：右上の住所表示 ＆ 次にやること（次アクション） ＆ AIアドバイス */}
                <div className="sos-card-right" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                  {/* 右上の住所表示（クリックでGoogleマップ検索） */}
                  {(() => {
                    const topAddress = project.address || (project.id === 'roster-5057' ? '064-0954 北海道札幌市中央区宮の森四条5-3-25' : '');
                    if (!topAddress) return null;
                    return (
                      <div
                        className="sos-card-address"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.25rem',
                          marginBottom: '0.15rem'
                        }}
                      >
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(topAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Googleマップで住所を確認"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '0.35rem',
                            color: '#1d4ed8',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            textDecoration: 'none',
                            cursor: 'pointer',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.08)'
                          }}
                        >
                          <MapPin size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {topAddress}
                          </span>
                        </a>
                      </div>
                    );
                  })()}

                  <div className="sos-card-next" style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '0.65rem',
                    padding: '0.7rem 0.95rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                      <span>🎯 次にやること</span>
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
                      <div className="sos-card-ai" style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem' }}>
                        <Sparkles size={13} color="#7c3aed" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{project.aiRecommendation}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 下段：ワンクリック記録アクションバー（架電: 会話 (+3p) 〜 詳細 の表示/非表示切り替え対応） */}
              {!isCardActionBarOpen(project.id) ? (
                <div className="sos-card-collapsed" style={{
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  padding: '0.4rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div
                    onClick={() => toggleCardActionBar(project.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{
                      backgroundColor: '#e2e8f0',
                      color: '#334155',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.12rem 0.5rem',
                      borderRadius: '999px'
                    }}>
                      🕒 活動履歴 ({(project.activities || []).length})
                    </span>
                    <span className="sos-collapsed-hint">
                      {isArchived
                        ? `🗄️ 失注理由: ${project.lostReason || 'その他'}（クリックで復活ボタン等を表示）`
                        : '⚡ 架電・メール・デモ・kz送客・7STEP仕様・現調・詳細メニュー（非表示中）'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => toggleCardActionBar(project.id)}
                      style={{
                        padding: '0.28rem 0.7rem',
                        borderRadius: '0.42rem',
                        border: '1px solid #93c5fd',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.22rem'
                      }}
                    >
                      <ChevronDown size={13} />
                      <span>操作ボタンを表示</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailInitialTab('basicInfo');
                        setDetailProjectId(project.id);
                      }}
                      style={{
                        padding: '0.28rem 0.6rem',
                        borderRadius: '0.42rem',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#334155',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      詳細
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editingProject?.id === project.id ? setEditingProject(null) : openQuickEdit(project)
                      }
                      title="このクリニック・企業のリスト情報（名称・住所・レセコン・電話・メモ等）を訂正"
                      style={{
                        padding: '0.28rem 0.6rem',
                        borderRadius: '0.42rem',
                        border: editingProject?.id === project.id ? '2px solid #d97706' : '1px solid #fbbf24',
                        backgroundColor: editingProject?.id === project.id ? '#fef3c7' : '#fffbeb',
                        color: '#b45309',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Pencil size={12} /> 訂正
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFromList(project)}
                      title="この案件をリストから削除"
                      style={{
                        padding: '0.28rem 0.6rem',
                        borderRadius: '0.42rem',
                        border: '1px solid #fca5a5',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <Trash2 size={12} /> 削除
                    </button>
                  </div>
                </div>
              ) : (
              <div className="sos-card-actions" style={{
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
                      onClick={() => openDemoDatePicker(project, 'kz送客')}
                      title="補助金利用クリニック向け：コンサルタント（kz）送客 (+5p) ※補助金を使わない通常導入の場合は直接「受注」へ進めます"
                      style={{
                        padding: '0.32rem 0.65rem',
                        borderRadius: '0.45rem',
                        border: isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'kz送客' ? '2px solid #0e7490' : '1px solid #06b6d4',
                        backgroundColor: hasKzReferral || (isDemoPickerOpenForThis && activeDemoPicker?.demoType === 'kz送客') ? '#cffafe' : '#ecfeff',
                        color: '#0f766e',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      💰 kz送客 (+5p)
                    </button>

                    <button
                      onClick={() => openDemoDatePicker(project, '受注')}
                      title="「受注 (+10p)」の受注日を選択して記録（通常導入・直接ご契約／補助金採択後のどちらも進捗: 受注へ連動）"
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

                {/* 右グループ：AIナレッジ文面作成 ＆ アーカイブ（失注）移動 ＆ 詳細 ＆ 非表示ボタン */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                      setDetailInitialTab('deviceInfo');
                      setDetailProjectId(project.id);
                    }}
                    title="PDF準拠：テマサック 7 STEP 仕様選択（本体・釣銭機・画面カラー・サイネージ・トリガー9種・PC）を開く"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #fdba74',
                      backgroundColor: '#fff7ed',
                      color: '#c2410c',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🎨 7STEP仕様
                  </button>

                  <button
                    onClick={() => {
                      setDetailInitialTab('prepStatus');
                      setDetailProjectId(project.id);
                    }}
                    title="ご契約ルート（通常導入／補助金活用）・kz補助金・公的書類3点＋GbizID・2回お支払い管理を開く"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #67e8f9',
                      backgroundColor: '#ecfeff',
                      color: '#0f766e',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    💰 契約・kz書類・支払
                  </button>

                  <button
                    onClick={() => {
                      setDetailInitialTab('cashlessStatus');
                      setDetailProjectId(project.id);
                    }}
                    title="キャッシュレス決済の選択（クレジット / JCB系クレジット / 電子マネー / QR決済）＆ジャックス審査を開く"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #a5b4fc',
                      backgroundColor: '#eef2ff',
                      color: '#3730a3',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    💳 キャッシュレス選択
                  </button>

                  <button
                    onClick={() => {
                      setDetailInitialTab('installation');
                      setDetailProjectId(project.id);
                    }}
                    title="PDF準拠：現地調査 5つの確認チェックリスト（設置場所・BM-POS・レセコンIP・回線書類）を開く"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🔌 現調5項目
                  </button>

                  <button
                    onClick={() => {
                      setDetailInitialTab('activities');
                      setDetailProjectId(project.id);
                    }}
                    title="これまでの活動の修正・削除を開く（進捗フロー・カンバンと自動連動）"
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

                  <button
                    type="button"
                    onClick={() =>
                      editingProject?.id === project.id ? setEditingProject(null) : openQuickEdit(project)
                    }
                    title="このクリニック・企業のリスト情報（名称・住所・レセコン・電話・メモ等）を訂正"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: editingProject?.id === project.id ? '2px solid #d97706' : '1px solid #fbbf24',
                      backgroundColor: editingProject?.id === project.id ? '#fef3c7' : '#fffbeb',
                      color: '#b45309',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                  >
                    <Pencil size={12} /> 訂正
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteFromList(project)}
                    title="この案件をリストから削除"
                    style={{
                      padding: '0.38rem 0.62rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                  >
                    <Trash2 size={12} /> 削除
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCardActionBar(project.id)}
                    title="このカードの架電・仕様・詳細ボタンバーを非表示にする"
                    style={{
                      padding: '0.38rem 0.6rem',
                      borderRadius: '0.45rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      fontSize: '0.73rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.18rem'
                    }}
                  >
                    <ChevronUp size={13} />
                    <span>非表示</span>
                  </button>
                </div>
              </div>
              )}

              {/* インライン訂正・編集パネル */}
              {editingProject?.id === project.id && (
                <div style={{
                  backgroundColor: '#fffbeb',
                  borderTop: '2px solid #f59e0b',
                  padding: '0.9rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Pencil size={15} />
                      <span>✏️ リスト情報の訂正・編集</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProject(null)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #fcd34d',
                        borderRadius: '0.35rem',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#92400e',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ 閉じる
                    </button>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '0.6rem'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        クリニック・企業名
                      </label>
                      <input
                        type="text"
                        value={editingProject.clinicName}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, clinicName: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        住所（都道府県・市区町村）
                      </label>
                      <input
                        type="text"
                        value={editingProject.address}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, address: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        診療科目・区分
                      </label>
                      <input
                        type="text"
                        value={editingProject.clinicType}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, clinicType: e.target.value } : null)}
                        placeholder="例: 内科 / 歯科 / ディーラー・BtoB"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        🖥️ レセコン
                      </label>
                      <input
                        type="text"
                        value={editingProject.rececon}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, rececon: e.target.value } : null)}
                        placeholder="例: ORCA / Medicom / PHC 等"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        📞 電話番号
                      </label>
                      <input
                        type="text"
                        value={editingProject.phone}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        👨‍⚕️ 院長・担当者名
                      </label>
                      <input
                        type="text"
                        value={editingProject.director}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, director: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        📅 反響日
                      </label>
                      <input
                        type="date"
                        value={editingProject.receivedAt}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, receivedAt: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        👤 営業担当
                      </label>
                      <input
                        type="text"
                        value={editingProject.salesRep}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, salesRep: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#78350f', marginBottom: '0.2rem' }}>
                        📝 メモ
                      </label>
                      <input
                        type="text"
                        value={editingProject.memo}
                        onChange={e => setEditingProject(prev => prev ? { ...prev, memo: e.target.value } : null)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #fbbf24', backgroundColor: '#ffffff', fontSize: '0.84rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteFromList(project)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.45rem',
                        border: '1px solid #fca5a5',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Trash2 size={13} /> この案件を削除
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setEditingProject(null)}
                        style={{
                          padding: '0.42rem 0.9rem',
                          borderRadius: '0.45rem',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveQuickEdit(project)}
                        style={{
                          padding: '0.42rem 1.1rem',
                          borderRadius: '0.45rem',
                          border: 'none',
                          backgroundColor: '#d97706',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                        }}
                      >
                        💾 訂正を保存する
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
