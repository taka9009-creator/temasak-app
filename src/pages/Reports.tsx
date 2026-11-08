import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Calendar,
  Award,
  Trophy,
  Filter,
  ArrowRight,
  Stethoscope,
  Video,
  Archive,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  FileText
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useProjects } from '../context/ProjectContext';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import {
  SALES_PROGRESS_FLOW,
  getClinicTotalPoints,
  normalizeProgressStage,
  inferActivityPoints,
  isBtoBDealerProject
} from '../types';
import type { Project, SalesProgressStage } from '../types';

type AreaOption = 'all' | '北海道' | '宮城県' | '福島県' | '秋田県' | '岩手県' | 'その他';
type StageDrillFilter = 'all' | 'inquiry' | 'demo' | 'won' | 'lost' | SalesProgressStage;

const PREF_LIST = ['北海道', '宮城県', '福島県', '秋田県', '岩手県'] as const;

export default function Reports() {
  const {
    projects,
    actions,
    handleCompleteAction,
    postponeAction,
    updateProject
  } = useProjects();

  const [selectedArea, setSelectedArea] = useState<AreaOption>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [drillStage, setDrillStage] = useState<StageDrillFilter>('all');
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // 都道府県抽出ヘルパー
  const extractPref = (addr?: string): string => {
    if (!addr) return 'その他';
    for (const p of PREF_LIST) {
      if (addr.startsWith(p)) return p;
    }
    return 'その他';
  };

  // 全データの月一覧・診療科目一覧
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.receivedAt && p.receivedAt.length >= 7) {
        set.add(p.receivedAt.substring(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.clinicType) set.add(p.clinicType);
    });
    return Array.from(set);
  }, [projects]);

  // 案件が「デモ到達済」「見積到達済」「受注済」か判定するヘルパー
  const isReachedDemo = (p: Project): boolean => {
    if (p.status === '失注') {
      return !!(p.demoDate || p.memo?.includes('面談日:'));
    }
    const st = normalizeProgressStage(p);
    const idx = SALES_PROGRESS_FLOW.indexOf(st);
    return !!(p.demoDate || p.memo?.includes('面談日:') || idx >= SALES_PROGRESS_FLOW.indexOf('デモ'));
  };

  const isReachedEstimate = (p: Project): boolean => {
    if (p.status === '失注') {
      return !!(p.estimateSentDate || p.memo?.includes('見積書送付済'));
    }
    const st = normalizeProgressStage(p);
    const idx = SALES_PROGRESS_FLOW.indexOf(st);
    return !!(
      p.estimateSentDate ||
      p.memo?.includes('見積書送付済') ||
      idx >= SALES_PROGRESS_FLOW.indexOf('見積')
    );
  };

  const isReachedWon = (p: Project): boolean => {
    if (p.status === '失注') return false;
    const st = normalizeProgressStage(p);
    return st === '受注' || !!p.orderDate || !!p.memo?.includes('受注済');
  };

  // グローバルフィルタ適用後のベース案件リスト
  const baseProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedArea !== 'all' && extractPref(p.address) !== selectedArea) return false;
      if (selectedMonth !== 'all' && !p.receivedAt?.startsWith(selectedMonth)) return false;
      if (selectedDept !== 'all' && p.clinicType !== selectedDept) return false;
      return true;
    });
  }, [projects, selectedArea, selectedMonth, selectedDept]);

  // コアKPI＆ファネル集計（クリニック直販KPI と BtoBディーラー・パートナー別枠KPI を完全分離）
  const analytics = useMemo(() => {
    const clinicBase = baseProjects.filter(p => !isBtoBDealerProject(p));
    const btobBase = baseProjects.filter(p => isBtoBDealerProject(p));

    const activeList = clinicBase.filter(p => p.status !== '失注');
    const lostList = clinicBase.filter(p => p.status === '失注');

    const btobActiveList = btobBase.filter(p => p.status !== '失注');
    const btobLostList = btobBase.filter(p => p.status === '失注');

    const totalAll = clinicBase.length;
    const inquiryCount = activeList.length;
    const demoCount = activeList.filter(p => isReachedDemo(p)).length;
    const estimateCount = activeList.filter(p => isReachedEstimate(p)).length;
    const wonCount = activeList.filter(p => isReachedWon(p)).length;

    const inquiryToDemoRate = inquiryCount > 0 ? Math.round((demoCount / inquiryCount) * 100) : 0;
    const demoToEstimateRate = demoCount > 0 ? Math.round((estimateCount / demoCount) * 100) : 0;
    const demoToWonRate = demoCount > 0 ? Math.round((wonCount / demoCount) * 100) : 0;
    const inquiryToWonRate = inquiryCount > 0 ? Math.round((wonCount / inquiryCount) * 100) : 0;

    // BtoB ディーラー・パートナー企業の別枠KPI集計
    const btobTotal = btobActiveList.length;
    const btobTalked = btobActiveList.filter(
      p =>
        SALES_PROGRESS_FLOW.indexOf(normalizeProgressStage(p)) >= 1 ||
        !!p.initialEmailDate ||
        p.memo?.includes('架電状況: 会話')
    ).length;
    const btobDemo = btobActiveList.filter(p => isReachedDemo(p)).length;
    const btobEstimate = btobActiveList.filter(p => isReachedEstimate(p)).length;
    const btobWon = btobActiveList.filter(p => isReachedWon(p)).length;
    const btobTotalPts = btobActiveList.reduce((s, p) => s + getClinicTotalPoints(p), 0);
    const btobDemoRate = btobTotal > 0 ? Math.round((btobDemo / btobTotal) * 100) : 0;
    const btobWonRate = btobTotal > 0 ? Math.round((btobWon / btobTotal) * 100) : 0;

    // 7段階進捗フロー別件数（現在地ベース ＆ 到達累積ベース）
    const stageCounts: Record<SalesProgressStage, { current: number; cumulative: number; avgPts: number }> = {
      '問合せ': { current: 0, cumulative: 0, avgPts: 0 },
      '初動': { current: 0, cumulative: 0, avgPts: 0 },
      'デモ': { current: 0, cumulative: 0, avgPts: 0 },
      '見積': { current: 0, cumulative: 0, avgPts: 0 },
      '検討': { current: 0, cumulative: 0, avgPts: 0 },
      '後追い': { current: 0, cumulative: 0, avgPts: 0 },
      '受注': { current: 0, cumulative: 0, avgPts: 0 }
    };

    const stagePtsSum: Record<SalesProgressStage, number> = {
      '問合せ': 0,
      '初動': 0,
      'デモ': 0,
      '見積': 0,
      '検討': 0,
      '後追い': 0,
      '受注': 0
    };

    let totalPointsAll = 0;

    activeList.forEach(p => {
      const st = normalizeProgressStage(p);
      const stIdx = SALES_PROGRESS_FLOW.indexOf(st);
      const pts = getClinicTotalPoints(p);
      totalPointsAll += pts;

      stageCounts[st].current++;
      stagePtsSum[st] += pts;

      SALES_PROGRESS_FLOW.forEach((flowStage, flowIdx) => {
        if (stIdx >= flowIdx) {
          stageCounts[flowStage].cumulative++;
        }
      });
    });

    SALES_PROGRESS_FLOW.forEach(st => {
      const cnt = stageCounts[st].current;
      stageCounts[st].avgPts = cnt > 0 ? Math.round((stagePtsSum[st] / cnt) * 10) / 10 : 0;
    });

    const avgClinicPoints = inquiryCount > 0 ? Math.round((totalPointsAll / inquiryCount) * 10) / 10 : 0;

    // 地域別（北海道・宮城・福島・秋田・岩手）ファネル＆ポイント分析
    const byRegion = PREF_LIST.map(pref => {
      const regionProjs = projects.filter(
        p =>
          extractPref(p.address) === pref &&
          (selectedMonth === 'all' || p.receivedAt?.startsWith(selectedMonth)) &&
          (selectedDept === 'all' || p.clinicType === selectedDept)
      );
      const activeReg = regionProjs.filter(p => p.status !== '失注');
      const lostReg = regionProjs.filter(p => p.status === '失注');
      const inq = activeReg.length;
      const initialDone = activeReg.filter(
        p => SALES_PROGRESS_FLOW.indexOf(normalizeProgressStage(p)) >= 1 || !!p.initialEmailDate
      ).length;
      const demo = activeReg.filter(p => isReachedDemo(p)).length;
      const est = activeReg.filter(p => isReachedEstimate(p)).length;
      const won = activeReg.filter(p => isReachedWon(p)).length;
      const pts = activeReg.reduce((s, p) => s + getClinicTotalPoints(p), 0);

      return {
        pref,
        total: regionProjs.length,
        inquiry: inq,
        initialDone,
        demo,
        estimate: est,
        won,
        lost: lostReg.length,
        demoRate: inq > 0 ? Math.round((demo / inq) * 100) : 0,
        wonRate: inq > 0 ? Math.round((won / inq) * 100) : 0,
        totalPts: pts,
        avgPts: inq > 0 ? Math.round((pts / inq) * 10) / 10 : 0
      };
    });

    // 月別コホート（反響月ごとの 問い合わせ → 初動 → デモ → 見積 → 受注 推移）
    const byMonthCohort = availableMonths.map(ym => {
      const mProjs = projects.filter(
        p =>
          p.receivedAt?.startsWith(ym) &&
          (selectedArea === 'all' || extractPref(p.address) === selectedArea) &&
          (selectedDept === 'all' || p.clinicType === selectedDept)
      );
      const activeM = mProjs.filter(p => p.status !== '失注');
      const lostM = mProjs.filter(p => p.status === '失注');
      const inq = activeM.length;
      const initialDone = activeM.filter(
        p => SALES_PROGRESS_FLOW.indexOf(normalizeProgressStage(p)) >= 1 || !!p.initialEmailDate
      ).length;
      const demo = activeM.filter(p => isReachedDemo(p)).length;
      const est = activeM.filter(p => isReachedEstimate(p)).length;
      const won = activeM.filter(p => isReachedWon(p)).length;
      const pts = activeM.reduce((s, p) => s + getClinicTotalPoints(p), 0);

      return {
        ym,
        total: mProjs.length,
        inquiry: inq,
        initialDone,
        demo,
        estimate: est,
        won,
        lost: lostM.length,
        demoRate: inq > 0 ? Math.round((demo / inq) * 100) : 0,
        wonRate: inq > 0 ? Math.round((won / inq) * 100) : 0,
        totalPts: pts
      };
    });

    // 診療科目・ターゲット別分析（内科・歯科・整形外科・新規開業・ディーラー等）
    const deptMap: Record<string, Project[]> = {};
    baseProjects.forEach(p => {
      const key = p.clinicName.includes('新規開業')
        ? '✨ 新規開業クリニック'
        : p.clinicType || '一般クリニック';
      if (!deptMap[key]) deptMap[key] = [];
      deptMap[key].push(p);
    });
    const byDepartment = Object.entries(deptMap)
      .map(([dept, list]) => {
        const act = list.filter(p => p.status !== '失注');
        const inq = act.length;
        const demo = act.filter(p => isReachedDemo(p)).length;
        const est = act.filter(p => isReachedEstimate(p)).length;
        const won = act.filter(p => isReachedWon(p)).length;
        const pts = act.reduce((s, p) => s + getClinicTotalPoints(p), 0);
        return {
          dept,
          inquiry: inq,
          demo,
          estimate: est,
          won,
          demoRate: inq > 0 ? Math.round((demo / inq) * 100) : 0,
          wonRate: inq > 0 ? Math.round((won / inq) * 100) : 0,
          avgPts: inq > 0 ? Math.round((pts / inq) * 10) / 10 : 0
        };
      })
      .sort((a, b) => b.inquiry - a.inquiry);

    // デモ種別分析（オンラインデモ / 訪問デモ / 来社デモ）
    const demoTypes: Record<'オンラインデモ' | '訪問デモ' | '来社デモ', { count: number; won: number }> = {
      'オンラインデモ': { count: 0, won: 0 },
      '訪問デモ': { count: 0, won: 0 },
      '来社デモ': { count: 0, won: 0 }
    };
    activeList.forEach(p => {
      const memo = p.memo || '';
      let dt: 'オンラインデモ' | '訪問デモ' | '来社デモ' | null = p.demoType || null;
      if (!dt) {
        if (memo.includes('オンラインデモ')) dt = 'オンラインデモ';
        else if (memo.includes('訪問デモ')) dt = '訪問デモ';
        else if (memo.includes('来社デモ')) dt = '来社デモ';
      }
      if (dt) {
        demoTypes[dt].count++;
        if (isReachedWon(p)) demoTypes[dt].won++;
      }
    });

    // アクションポイント内訳分析
    const actionBreakdown: Record<string, { count: number; pts: number }> = {
      '初動メール (+5p)': { count: 0, pts: 0 },
      '見積書送付 (+5p)': { count: 0, pts: 0 },
      '各種デモ決定 (+5p)': { count: 0, pts: 0 },
      '架電: 会話 (+3p)': { count: 0, pts: 0 },
      '現地訪問 (+3p)': { count: 0, pts: 0 },
      '相談メール (+3p)': { count: 0, pts: 0 },
      'ポスティング (+2p)': { count: 0, pts: 0 },
      '後追いメール (+2p)': { count: 0, pts: 0 },
      '架電: 不在・折返 (+1p)': { count: 0, pts: 0 },
      '受注確定 (+10p)': { count: 0, pts: 0 }
    };

    baseProjects.forEach(p => {
      (p.activities || []).forEach(act => {
        const t = `${act.type} ${act.content}`;
        const pVal = inferActivityPoints(act);
        if (pVal <= 0) return;
        if (t.includes('受注')) {
          actionBreakdown['受注確定 (+10p)'].count++;
          actionBreakdown['受注確定 (+10p)'].pts += pVal;
        } else if (t.includes('初動メール') || t.includes('〇案内メール')) {
          actionBreakdown['初動メール (+5p)'].count++;
          actionBreakdown['初動メール (+5p)'].pts += pVal;
        } else if (t.includes('見積書送付')) {
          actionBreakdown['見積書送付 (+5p)'].count++;
          actionBreakdown['見積書送付 (+5p)'].pts += pVal;
        } else if (t.includes('デモ') || t.includes('面談')) {
          actionBreakdown['各種デモ決定 (+5p)'].count++;
          actionBreakdown['各種デモ決定 (+5p)'].pts += pVal;
        } else if (t.includes('相談メール')) {
          actionBreakdown['相談メール (+3p)'].count++;
          actionBreakdown['相談メール (+3p)'].pts += pVal;
        } else if (t.includes('後追いメール')) {
          actionBreakdown['後追いメール (+2p)'].count++;
          actionBreakdown['後追いメール (+2p)'].pts += pVal;
        } else if (t.includes('ポスティング')) {
          actionBreakdown['ポスティング (+2p)'].count++;
          actionBreakdown['ポスティング (+2p)'].pts += pVal;
        } else if (t.includes('訪問')) {
          actionBreakdown['現地訪問 (+3p)'].count++;
          actionBreakdown['現地訪問 (+3p)'].pts += pVal;
        } else if (t.includes('【会話】')) {
          actionBreakdown['架電: 会話 (+3p)'].count++;
          actionBreakdown['架電: 会話 (+3p)'].pts += pVal;
        } else {
          actionBreakdown['架電: 不在・折返 (+1p)'].count++;
          actionBreakdown['架電: 不在・折返 (+1p)'].pts += pVal;
        }
      });
    });

    // 失注（アーカイブ）理由内訳
    const lostReasons = {
      '他社導入': 0,
      '金銭面': 0,
      'その他': 0
    };
    lostList.forEach(p => {
      const r = p.lostReason || 'その他';
      if (r.startsWith('他社導入')) lostReasons['他社導入']++;
      else if (r.startsWith('金銭面')) lostReasons['金銭面']++;
      else lostReasons['その他']++;
    });

    // 高ポイント獲得クリニック TOP5 ＆ 要フォロー（停滞）クリニック
    const topPointClinics = [...activeList]
      .sort((a, b) => getClinicTotalPoints(b) - getClinicTotalPoints(a))
      .slice(0, 6);

    const needFollowupClinics = activeList
      .filter(p => !isReachedWon(p))
      .map(p => ({
        project: p,
        daysIdle: differenceInDays(new Date(), new Date(p.lastActivityAt || p.receivedAt || new Date())),
        pts: getClinicTotalPoints(p),
        stage: normalizeProgressStage(p)
      }))
      .sort((a, b) => b.daysIdle - a.daysIdle)
      .slice(0, 6);

    return {
      totalAll,
      inquiryCount,
      demoCount,
      estimateCount,
      wonCount,
      lostCount: lostList.length,
      inquiryToDemoRate,
      demoToEstimateRate,
      demoToWonRate,
      inquiryToWonRate,
      totalPointsAll,
      avgClinicPoints,
      stageCounts,
      byRegion,
      byMonthCohort,
      byDepartment,
      demoTypes,
      actionBreakdown,
      lostReasons,
      topPointClinics,
      needFollowupClinics,
      btob: {
        total: btobTotal,
        talked: btobTalked,
        demo: btobDemo,
        estimate: btobEstimate,
        won: btobWon,
        lost: btobLostList.length,
        totalPts: btobTotalPts,
        demoRate: btobDemoRate,
        wonRate: btobWonRate,
        companies: btobActiveList
      }
    };
  }, [baseProjects, projects, selectedArea, selectedMonth, selectedDept, availableMonths]);

  // ドリルダウン対象案件リスト
  const drilledProjects = useMemo(() => {
    return baseProjects.filter(p => {
      if (drillStage === 'all') return p.status !== '失注';
      if (drillStage === 'lost') return p.status === '失注';
      if (p.status === '失注') return false;
      if (drillStage === 'inquiry') return true;
      if (drillStage === 'demo') return isReachedDemo(p);
      if (drillStage === 'won') return isReachedWon(p);
      return normalizeProgressStage(p) === drillStage;
    });
  }, [baseProjects, drillStage]);

  const detailProject = projects.find(p => p.id === detailProjectId) || null;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.35rem', paddingBottom: '4rem' }}>
      {/* 1. ヘッダーバナー */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)',
        borderRadius: '1rem',
        padding: '1.35rem 1.75rem',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '0.85rem',
            backgroundColor: 'rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.22)'
          }}>
            <BarChart3 size={28} color="#34d399" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{
                backgroundColor: '#10b981',
                color: '#0f172a',
                fontSize: '0.72rem',
                fontWeight: 900,
                padding: '0.15rem 0.6rem',
                borderRadius: '999px'
              }}>
                リアルタイム連動
              </span>
              <span style={{ fontSize: '0.82rem', color: '#a7f3d0', fontWeight: 600 }}>
                問い合わせ → デモ → 受注 × 月別・地域別・診療科別・ポイント相関分析
              </span>
            </div>
            <h1 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 800 }}>
              📈 KPI・ファネル分析ダッシュボード（対象 {analytics.inquiryCount}件 / 累計 {analytics.totalPointsAll}p）
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedArea('all');
              setSelectedMonth('all');
              setSelectedDept('all');
              setDrillStage('all');
            }}
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: '0.55rem',
              border: '1px solid rgba(255,255,255,0.28)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <RotateCcw size={14} /> フィルタ解除
          </button>

          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            style={{
              padding: '0.55rem 1.05rem',
              borderRadius: '0.55rem',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0f172a',
              fontSize: '0.82rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
            }}
          >
            <FileText size={15} /> 会議用サマリー出力
          </button>
        </div>
      </div>

      {/* 2. インタラクティブ絞り込みバー（地域別 × 月別 × 診療科別） */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '0.85rem',
        padding: '0.9rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.2rem' }}>
            <MapPin size={15} color="#2563eb" /> 地域別フィルタ:
          </span>
          {(['all', ...PREF_LIST] as AreaOption[]).map(area => {
            const active = selectedArea === area;
            return (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedArea(area)}
                style={{
                  padding: '0.32rem 0.75rem',
                  borderRadius: '999px',
                  border: active ? '2px solid #1e40af' : '1px solid #cbd5e1',
                  backgroundColor: active ? '#1e40af' : '#f8fafc',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {area === 'all' ? '🌐 全エリア' : area}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={15} color="#059669" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#0f172a'
              }}
            >
              <option value="all">📅 全期間（月別すべて）</option>
              {availableMonths.map(ym => {
                const [y, m] = ym.split('-');
                return (
                  <option key={ym} value={ym}>
                    {y}年{parseInt(m, 10)}月反響
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Stethoscope size={15} color="#7c3aed" />
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#0f172a'
              }}
            >
              <option value="all">🏥 全診療科目・ターゲット</option>
              {availableDepts.map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. メインKPI：「問い合わせ → デモ → 受注」ゴールデンファネル ＆ 7段階進捗フロー分析 */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
        border: '2px solid #93c5fd',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        boxShadow: '0 4px 15px rgba(30, 58, 138, 0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📈 KPI: 問い合わせ → デモ → 受注（クリックで対象案件を絞り込み）</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
              各ボックスをクリックすると、画面下部の案件リストが該当ステージのクリニックに連動して切り替わります
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              padding: '0.3rem 0.8rem',
              borderRadius: '999px',
              fontSize: '0.82rem',
              fontWeight: 900
            }}>
              デモ移行率: {analytics.inquiryToDemoRate}%
            </span>
            <span style={{
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '0.3rem 0.8rem',
              borderRadius: '999px',
              fontSize: '0.82rem',
              fontWeight: 900
            }}>
              デモ→受注率: {analytics.demoToWonRate}%
            </span>
            <span style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              color: '#b45309',
              padding: '0.3rem 0.9rem',
              borderRadius: '999px',
              fontSize: '0.85rem',
              fontWeight: 900
            }}>
              🏆 通算受注率: {analytics.inquiryToWonRate}%
            </span>
          </div>
        </div>

        {/* 3大ゴールデンKPIファネル（問い合わせ ➔ デモ ➔ 受注） */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          {/* Step 1: 問い合わせ */}
          <div
            onClick={() => setDrillStage('inquiry')}
            style={{
              backgroundColor: drillStage === 'inquiry' || drillStage === 'all' ? '#eff6ff' : '#ffffff',
              border: drillStage === 'inquiry' ? '2px solid #2563eb' : '1px solid #93c5fd',
              borderRadius: '0.85rem',
              padding: '1rem 1.25rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#1e40af' }}>1. 問い合わせ（営業中総数）</span>
              <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>100%</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>
              {analytics.inquiryCount} <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>件</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>
              平均獲得ポイント: <strong>{analytics.avgClinicPoints}p</strong> / 失注アーカイブ: {analytics.lostCount}件
            </div>
          </div>

          {/* 矢印 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', padding: '0 0.25rem' }}>
            <span style={{
              backgroundColor: '#059669',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 900,
              padding: '0.18rem 0.55rem',
              borderRadius: '999px'
            }}>
              {analytics.inquiryToDemoRate}%
            </span>
            <ArrowRight size={24} color="#059669" />
            <span style={{ fontSize: '0.68rem', color: '#065f46', fontWeight: 800 }}>デモ移行</span>
          </div>

          {/* Step 2: デモ */}
          <div
            onClick={() => setDrillStage('demo')}
            style={{
              backgroundColor: drillStage === 'demo' ? '#dcfce7' : '#ffffff',
              border: drillStage === 'demo' ? '2px solid #16a34a' : '1px solid #86efac',
              borderRadius: '0.85rem',
              padding: '1rem 1.25rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#15803d' }}>2. デモ到達（オンライン・訪問・来社）</span>
              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>対問合 {analytics.inquiryToDemoRate}%</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#166534', lineHeight: 1.15 }}>
              {analytics.demoCount} <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>件</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
              うち見積書送付済: <strong>{analytics.estimateCount}件</strong>（デモ→見積 {analytics.demoToEstimateRate}%）
            </div>
          </div>

          {/* 矢印 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', padding: '0 0.25rem' }}>
            <span style={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 900,
              padding: '0.18rem 0.55rem',
              borderRadius: '999px'
            }}>
              {analytics.demoToWonRate}%
            </span>
            <ArrowRight size={24} color="#d97706" />
            <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 800 }}>受注決定</span>
          </div>

          {/* Step 3: 受注 */}
          <div
            onClick={() => setDrillStage('won')}
            style={{
              backgroundColor: drillStage === 'won' ? '#fef3c7' : '#ffffff',
              border: drillStage === 'won' ? '2px solid #d97706' : '1px solid #fcd34d',
              borderRadius: '0.85rem',
              padding: '1rem 1.25rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#b45309' }}>3. 🎉 受注（ご契約確定）</span>
              <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 800 }}>通算 {analytics.inquiryToWonRate}%</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#b45309', lineHeight: 1.15 }}>
              {analytics.wonCount} <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>件</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
              カードの「🎉 受注 (+10p)」ボタン記録とリアルタイム連動
            </div>
          </div>
        </div>

        {/* 7段階 進捗フロー（問合せ → 初動 → デモ → 見積 → 検討 → 後追い → 受注）完全内訳バー */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.9rem 1.1rem',
          border: '1px solid #dbeafe'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔄 7段階 進捗フロー別 分布（ステージをクリックで該当案件を表示）</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              現在地件数 ／ 通過累計件数 ／ ステージ平均ポイント
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))', gap: '0.5rem', overflowX: 'auto' }}>
            {SALES_PROGRESS_FLOW.map((stage, idx) => {
              const info = analytics.stageCounts[stage];
              const isSelected = drillStage === stage;
              const isWon = stage === '受注';
              return (
                <div
                  key={stage}
                  onClick={() => setDrillStage(isSelected ? 'all' : stage)}
                  style={{
                    backgroundColor: isSelected
                      ? isWon
                        ? '#fef3c7'
                        : '#dbeafe'
                      : '#f8fafc',
                    border: isSelected
                      ? isWon
                        ? '2px solid #d97706'
                        : '2px solid #1d4ed8'
                      : '1px solid #e2e8f0',
                    borderRadius: '0.6rem',
                    padding: '0.6rem 0.7rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontWeight: 800, color: isWon ? '#b45309' : '#1e40af' }}>
                    <span>{idx + 1}. {stage}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>通過:{info.cumulative}</span>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                    {info.current} <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>件</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>
                    平均 {info.avgPts}p
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3.5 BtoB別枠：「ディーラー・パートナー企業」KPI・ファネル ＆ パートナー企業営業中リスト */}
      <div style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
        border: '2px solid #a5b4fc',
        borderRadius: '1rem',
        padding: '1.2rem 1.45rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 4px 14px rgba(67, 56, 202, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                backgroundColor: '#4338ca',
                color: '#ffffff',
                fontSize: '0.73rem',
                fontWeight: 900,
                padding: '0.16rem 0.6rem',
                borderRadius: '999px'
              }}>
                BtoB別枠 KPI
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1e1b4b' }}>
                🏢 ディーラー・パートナー企業 KPI・ファネル＆営業中リスト（BtoB別枠管理）
              </span>
            </div>
            <div style={{ fontSize: '0.77rem', color: '#475569', marginTop: '0.18rem', fontWeight: 600 }}>
              ディーラー・卸・紹介パートナー企業はBtoBのため、クリニック直販KPIとは別枠で集計・リスト化しています
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: '#ffffff', border: '1px solid #a5b4fc', color: '#3730a3', padding: '0.28rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 900 }}>
              🏢 パートナー企業数: {analytics.btob.total}社
            </span>
            <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.28rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 900 }}>
              同行デモ移行率: {analytics.btob.demoRate}%
            </span>
            <span style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', padding: '0.28rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 900 }}>
              🏆 BtoB累計ポイント: {analytics.btob.totalPts}p
            </span>
          </div>
        </div>

        {/* BtoB 4ステップKPIカード */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #c7d2fe', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca' }}>1. BtoB パートナー企業数</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#1e1b4b', marginTop: '0.15rem' }}>
              {analytics.btob.total} <span style={{ fontSize: '0.82rem', color: '#64748b' }}>社</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
              医療機器ディーラー・卸・サポート企業
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #c7d2fe', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1d4ed8' }}>2. 初動・会話・提携打診済</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#1e3a8a', marginTop: '0.15rem' }}>
              {analytics.btob.talked} <span style={{ fontSize: '0.82rem', color: '#64748b' }}>社</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.15rem' }}>
              案内メール送付・担当者会話済
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d' }}>3. 同行デモ・見積進行 (BtoB)</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#166534', marginTop: '0.15rem' }}>
              {analytics.btob.demo} <span style={{ fontSize: '0.82rem', color: '#64748b' }}>社</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '0.15rem' }}>
              うち見積提示済: <strong>{analytics.btob.estimate}社</strong>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b45309' }}>4. 🎉 BtoB受注・提携成約</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#d97706', marginTop: '0.15rem' }}>
              {analytics.btob.won} <span style={{ fontSize: '0.82rem', color: '#64748b' }}>社</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.15rem' }}>
              成約率: <strong>{analytics.btob.wonRate}%</strong> / 失注アーカイブ: {analytics.btob.lost}社
            </div>
          </div>
        </div>

        {/* BtoB ディーラー・パートナー企業 別枠リスト一覧 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #c7d2fe',
          borderRadius: '0.75rem',
          padding: '0.85rem 1.05rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#312e81', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 ディーラー・パートナー企業（BtoB営業中リスト: {analytics.btob.companies.length}社）</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>クリックで企業詳細カルテを開きます</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.55rem' }}>
            {analytics.btob.companies.map(comp => {
              const st = normalizeProgressStage(comp);
              const pts = getClinicTotalPoints(comp);
              return (
                <div
                  key={comp.id}
                  onClick={() => setDetailProjectId(comp.id)}
                  style={{
                    border: '1px solid #c7d2fe',
                    borderLeft: '5px solid #4338ca',
                    borderRadius: '0.55rem',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>🏢 {comp.clinicName}</span>
                      <ChevronRight size={14} color="#4338ca" />
                    </div>
                    <div style={{ fontSize: '0.71rem', color: '#475569', marginTop: '0.15rem' }}>
                      📍 {comp.address} | 📅 {comp.receivedAt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                    <span style={{
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '0.25rem'
                    }}>
                      {st}
                    </span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#4338ca' }}>
                      🏆 {pts}p
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. 地域別（北海道・東北5道県）× 月別コホートの2カラム詳細分析 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.25rem' }}>
        {/* 4-A. 地域別（都道府県別）ファネル＆ポイント分析 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={18} color="#2563eb" />
                <span>地域別（北海道・東北エリア）KPI・ファネル比較</span>
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                行をクリックすると該当道県でダッシュボード全体を絞り込みます
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '0.55rem 0.6rem' }}>地域</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>問い合わせ</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>初動済</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>デモ</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>見積</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>受注</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>デモ率 / 受注率</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>累計Pt (平均)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byRegion.map(row => {
                  const isSelected = selectedArea === row.pref;
                  return (
                    <tr
                      key={row.pref}
                      onClick={() => setSelectedArea(isSelected ? 'all' : (row.pref as AreaOption))}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '0.6rem', fontWeight: 800, color: '#1e3a8a' }}>
                        📍 {row.pref}
                        {row.lost > 0 && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.3rem' }}>
                            (失注{row.lost})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{row.inquiry}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#1d4ed8', fontWeight: 700 }}>{row.initialDone}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#15803d', fontWeight: 800 }}>{row.demo}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>{row.estimate}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#d97706', fontWeight: 900 }}>{row.won}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        <span style={{
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          marginRight: '0.25rem'
                        }}>
                          {row.demoRate}%
                        </span>
                        <span style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          fontWeight: 800,
                          fontSize: '0.72rem'
                        }}>
                          {row.wonRate}%
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                        {row.totalPts}p <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({row.avgPts}p)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4-B. 月別（反響月コホート）ファネル推移分析 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={18} color="#059669" />
              <span>月別（反響月コホート）問い合わせ → デモ → 受注 推移</span>
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
              反響月ごとの進捗の進み具合・デモ転換率・獲得ポイントを比較します（クリックで月絞り込み）
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '0.55rem 0.6rem' }}>反響年月</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>問い合わせ</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>初動済</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>デモ</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>見積</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>受注</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>デモ率 / 受注率</th>
                  <th style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>獲得Pt</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byMonthCohort.map(row => {
                  const [y, m] = row.ym.split('-');
                  const isSelected = selectedMonth === row.ym;
                  return (
                    <tr
                      key={row.ym}
                      onClick={() => setSelectedMonth(isSelected ? 'all' : row.ym)}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '0.6rem', fontWeight: 800, color: '#065f46' }}>
                        📅 {y}年{parseInt(m, 10)}月
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{row.inquiry}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#1d4ed8', fontWeight: 700 }}>{row.initialDone}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#15803d', fontWeight: 800 }}>{row.demo}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>{row.estimate}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#d97706', fontWeight: 900 }}>{row.won}件</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        <span style={{
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          marginRight: '0.25rem'
                        }}>
                          {row.demoRate}%
                        </span>
                        <span style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.25rem',
                          fontWeight: 800,
                          fontSize: '0.72rem'
                        }}>
                          {row.wonRate}%
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                        {row.totalPts}p
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. 多角アイデア分析セクション（診療科別 × デモ種別＆失注理由 × アクションポイント内訳） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* 5-A. 診療科目・ターゲット別（新規開業・歯科・内科等）転換率 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Stethoscope size={18} color="#7c3aed" />
            <span>診療科目・開業属性別 ファネル分析</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analytics.byDepartment.map(item => (
              <div
                key={item.dept}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.6rem',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <strong style={{ color: '#1e293b' }}>{item.dept}</strong>
                  <span style={{ fontSize: '0.74rem', color: '#047857', fontWeight: 800 }}>
                    平均 {item.avgPts}p
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569' }}>
                  <span>問合: <strong>{item.inquiry}</strong>件</span>
                  <span>➔ デモ: <strong style={{ color: '#15803d' }}>{item.demo}</strong>件 ({item.demoRate}%)</span>
                  <span>➔ 見積: <strong style={{ color: '#b45309' }}>{item.estimate}</strong>件</span>
                  <span>➔ 受注: <strong style={{ color: '#d97706' }}>{item.won}</strong>件 ({item.wonRate}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5-B. デモ手法別（オンライン・訪問・来社）＆ アーカイブ（失注理由）分析 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Video size={18} color="#059669" />
              <span>デモ種別（オンライン / 訪問 / 来社）実績</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.6rem' }}>
              {(['オンラインデモ', '訪問デモ', '来社デモ'] as const).map(dtype => {
                const d = analytics.demoTypes[dtype];
                const rate = d.count > 0 ? Math.round((d.won / d.count) * 100) : 0;
                return (
                  <div
                    key={dtype}
                    style={{
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '0.6rem',
                      padding: '0.6rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#065f46' }}>{dtype}</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#047857', margin: '0.15rem 0' }}>
                      {d.count}<span style={{ fontSize: '0.72rem' }}>件</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#065f46', fontWeight: 700 }}>
                      受注 {d.won}件 ({rate}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Archive size={17} color="#dc2626" />
                <span>アーカイブ（失注）理由の傾向（計 {analytics.lostCount}件）</span>
              </h3>
              <button
                type="button"
                onClick={() => setDrillStage('lost')}
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: '1px solid #fca5a5',
                  backgroundColor: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                失注一覧を表示
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(['他社導入', '金銭面', 'その他'] as const).map(reason => {
                const cnt = analytics.lostReasons[reason];
                return (
                  <div
                    key={reason}
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '0.6rem',
                      padding: '0.55rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#991b1b' }}>
                      {reason === '他社導入' ? '🏢 他社導入' : reason === '金銭面' ? '💰 金銭面' : '📝 その他'}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>
                      {cnt}<span style={{ fontSize: '0.72rem' }}>件</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5-C. アクション別ポイント獲得貢献度 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={18} color="#f59e0b" />
            <span>営業アクション別 実施回数＆獲得ポイント内訳</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
            {Object.entries(analytics.actionBreakdown).map(([label, stat]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.38rem 0.65rem',
                  backgroundColor: stat.pts > 0 ? '#f8fafc' : '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.45rem',
                  fontSize: '0.78rem'
                }}
              >
                <span style={{ fontWeight: 700, color: '#334155' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{stat.count}回</span>
                  <strong style={{
                    backgroundColor: stat.pts > 0 ? '#dcfce7' : '#f1f5f9',
                    color: stat.pts > 0 ? '#166534' : '#94a3b8',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    minWidth: '48px',
                    textAlign: 'center'
                  }}>
                    +{stat.pts}p
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. クリニック別ポイントランキング TOP6 ＆ 要後追い（長期未接触）アラート */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* 高ポイント獲得クリニック TOP6 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={18} color="#d97706" />
            <span>🏆 クリニック別 累積ポイントランキング TOP6（受注候補）</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {analytics.topPointClinics.map((p, idx) => {
              const pts = getClinicTotalPoints(p);
              const st = normalizeProgressStage(p);
              return (
                <div
                  key={p.id}
                  onClick={() => setDetailProjectId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '0.55rem',
                    border: '1px solid #e2e8f0',
                    backgroundColor: idx === 0 ? '#fffbeb' : '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: idx < 3 ? '#f59e0b' : '#cbd5e1',
                      color: idx < 3 ? '#ffffff' : '#334155',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>{p.clinicName}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>📍 {p.address} / {p.clinicType}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.3rem'
                    }}>
                      {st}
                    </span>
                    <span style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      padding: '0.16rem 0.6rem',
                      borderRadius: '999px'
                    }}>
                      {pts}p
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 要フォロー（停滞日数順）クリニック */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.9rem',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={18} color="#ea580c" />
            <span>⏰ 後追い推奨リスト（最終アクションからの経過日数順）</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {analytics.needFollowupClinics.map(({ project: p, daysIdle, pts, stage }) => (
              <div
                key={p.id}
                onClick={() => setDetailProjectId(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.8rem',
                  borderRadius: '0.55rem',
                  border: '1px solid #fed7aa',
                  backgroundColor: '#fff7ed',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>{p.clinicName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    📍 {p.address} / 最終活動: {p.lastActivityAt}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '0.12rem 0.45rem',
                    borderRadius: '0.3rem'
                  }}>
                    {stage} ({pts}p)
                  </span>
                  <span style={{
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    padding: '0.16rem 0.55rem',
                    borderRadius: '999px'
                  }}>
                    {daysIdle}日経過
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. ファネル連動ドリルダウン案件一覧 */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '0.9rem',
        padding: '1.15rem 1.35rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Filter size={18} color="#1e40af" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
              選択ステージの該当案件リスト（{drilledProjects.length}件）
            </h3>
            <span style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              padding: '0.15rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.76rem',
              fontWeight: 800
            }}>
              表示中: {drillStage === 'all' || drillStage === 'inquiry'
                ? '1. 問い合わせ（営業中すべて）'
                : drillStage === 'demo'
                ? '2. デモ到達案件'
                : drillStage === 'won'
                ? '3. 🎉 受注案件'
                : drillStage === 'lost'
                ? '🗄️ アーカイブ（失注）'
                : `進捗フロー: ${drillStage}`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `全件 (${analytics.inquiryCount})` },
              { id: 'demo', label: `デモ到達 (${analytics.demoCount})` },
              { id: 'won', label: `🎉 受注 (${analytics.wonCount})` },
              { id: 'lost', label: `失注 (${analytics.lostCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDrillStage(tab.id as StageDrillFilter)}
                style={{
                  padding: '0.28rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: drillStage === tab.id ? '1px solid #1e40af' : '1px solid #cbd5e1',
                  backgroundColor: drillStage === tab.id ? '#1e40af' : '#f8fafc',
                  color: drillStage === tab.id ? '#ffffff' : '#334155',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.65rem' }}>
          {drilledProjects.map(p => {
            const st = normalizeProgressStage(p);
            const pts = getClinicTotalPoints(p);
            return (
              <div
                key={p.id}
                onClick={() => setDetailProjectId(p.id)}
                style={{
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${st === '受注' ? '#d97706' : st === 'デモ' || st === '見積' ? '#10b981' : '#3b82f6'}`,
                  borderRadius: '0.6rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>{p.clinicName}</span>
                    <ChevronRight size={14} color="#64748b" />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                    📍 {p.address} | 📅 {p.receivedAt}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <span style={{
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '0.25rem'
                  }}>
                    {p.status === '失注' ? `失注(${p.lostReason || '他'})` : st}
                  </span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#047857' }}>
                    🏆 {pts}p
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. 会議用サマリーモーダル */}
      {showSummaryModal && (
        <div
          onClick={() => setShowSummaryModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
              width: '680px',
              maxWidth: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="#d97706" />
                <span>営業会議用 KPI・ファネル分析サマリー</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <pre style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '0.65rem',
              padding: '1rem',
              fontSize: '0.82rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}>
{`【テマサック営業OS KPI・ファネル分析レポート】
対象エリア: ${selectedArea === 'all' ? '北海道・東北全域' : selectedArea} / 期間: ${selectedMonth === 'all' ? '全期間' : selectedMonth}

■ ゴールデンKPI（問い合わせ → デモ → 受注）
・1. 問い合わせ（営業中）: ${analytics.inquiryCount} 件
・2. デモ到達            : ${analytics.demoCount} 件（デモ移行率: ${analytics.inquiryToDemoRate}%）
・3. 見積書送付済        : ${analytics.estimateCount} 件（デモ→見積率: ${analytics.demoToEstimateRate}%）
・4. 受注確定            : ${analytics.wonCount} 件（デモ→受注率: ${analytics.demoToWonRate}% / 通算受注率: ${analytics.inquiryToWonRate}%）
・アーカイブ（失注）     : ${analytics.lostCount} 件（他社:${analytics.lostReasons['他社導入']} / 金銭:${analytics.lostReasons['金銭面']} / 他:${analytics.lostReasons['その他']}）

■ 7段階 進捗フロー内訳
${SALES_PROGRESS_FLOW.map((s, i) => `  ${i + 1}. ${s}: 現在 ${analytics.stageCounts[s].current}件（通過累計 ${analytics.stageCounts[s].cumulative}件 / 平均 ${analytics.stageCounts[s].avgPts}p）`).join('\n')}

■ 地域別（北海道・東北5道県）実績
${analytics.byRegion.map(r => `  ・${r.pref}: 問合${r.inquiry}件 → デモ${r.demo}件(${r.demoRate}%) → 受注${r.won}件(${r.wonRate}%) / 計${r.totalPts}p`).join('\n')}
`}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `【KPI: 問い合わせ→デモ→受注】問合:${analytics.inquiryCount}件 → デモ:${analytics.demoCount}件(${analytics.inquiryToDemoRate}%) → 受注:${analytics.wonCount}件(通算${analytics.inquiryToWonRate}%)`
                  );
                  alert('会議用サマリーをクリップボードにコピーしました！');
                }}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#1e40af',
                  color: '#ffffff',
                  fontWeight: 800,
                  cursor: 'pointer',
                   display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <CheckCircle2 size={16} /> テキストをコピー
              </button>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                閉じる
              </button>
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
      />
    </div>
  );
}
