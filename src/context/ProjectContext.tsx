import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMonths, format } from 'date-fns';
import {
  generateActionsOnStatusChange,
  generateActionsOnTaskCompletion,
  createDynamicAction,
  evaluateRulesOnQuickAction,
  scanMatchingProjectsForRule,
  createActionFromGlobalRule
} from '../utils/actionRules';
import { buildRoster42Dataset } from '../utils/roster42Data';
import { ACTION_POINT_RULES, getClinicTotalPoints } from '../types';
import type { Project, NextAction, ProjectStatus, ActionPriority, Activity, QuickCallOutcome, LostReasonType } from '../types';
import { useWorkflow } from './WorkflowContext';
import { useRules } from './RuleContext';
import type { GlobalRule } from './RuleContext';
import { useAuth } from './AuthContext';

const LOCAL_PROJECTS_KEY = 'temasak_os_projects_v2';
const LOCAL_ACTIONS_KEY = 'temasak_os_actions_v2';

interface ProjectContextType {
  projects: Project[];
  actions: NextAction[];
  handleStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
  handleCompleteAction: (actionId: string) => void;
  addProject: (newProject: Project, initialAction?: NextAction) => void;
  addProjectsBulk: (newProjects: Project[], newActions: NextAction[]) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  renameProjectStatus: (oldStatus: string, newStatus: string) => void;
  postponeAction: (actionId: string, days: number) => void;
  recordQuickCallResult: (
    projectId: string,
    callOutcome: QuickCallOutcome,
    note?: string,
    actionDate?: string
  ) => void;
  archiveProjectAsLost: (
    projectId: string,
    lostReason: LostReasonType,
    note?: string
  ) => void;
  restoreArchivedProject: (projectId: string) => void;
  applyRuleToMatchingProjects: (rule: GlobalRule) => number;
  resetToRoster42: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROJECTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load local projects:', e);
    }
    return buildRoster42Dataset().projects;
  });

  const [actions, setActions] = useState<NextAction[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_ACTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load local actions:', e);
    }
    return buildRoster42Dataset().actions;
  });

  const { getRulesForStatus, kanbanColumns } = useWorkflow();
  const { rules } = useRules();
  const { user } = useAuth();

  // Save to LocalStorage whenever projects or actions change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects to localStorage:', e);
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ACTIONS_KEY, JSON.stringify(actions));
    } catch (e) {
      console.error('Failed to save actions to localStorage:', e);
    }
  }, [actions]);

  // Firestore listener (if real Firebase user is connected and has data)
  useEffect(() => {
    if (!user || user.id === 'demo-user-1') {
      return;
    }

    const projectsQuery = query(collection(db, 'projects'), where('user_id', '==', user.id));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      if (snapshot.empty) return;
      const loadedProjects: Project[] = snapshot.docs.map(docSnap => {
        const p = docSnap.data();
        return {
          id: docSnap.id,
          clinicName: p.clinic_name || '',
          clinicType: p.clinic_type || '',
          address: p.address || '',
          phone: p.phone || '',
          email: p.email || '',
          contactPerson: p.contact_person || '',
          contactTitle: p.contact_title || '',
          source: p.source || '',
          receivedAt: p.received_at || p.created_at || new Date().toISOString(),
          product: p.product || 'テマサック自動精算機',
          quantity: p.quantity || 1,
          priority: (p.priority as ActionPriority) || '中',
          status: p.status || '新規',
          salesRep: p.sales_rep || '松浦 貴文',
          ballHolder: p.ball_holder || '松浦 貴文',
          lastActivityAt: p.last_activity_at || p.created_at || new Date().toISOString(),
          probability: p.probability as any,
          memo: p.memo || '',
          lostReason: p.lost_reason,
          isImplementationProject: !!p.is_implementation_project,
          pipelineMap: {
            deviceType: p.device_type,
            bodyColor: p.body_color,
            subsidyName: p.subsidy_name,
            creditStatus: p.credit_status,
            emoneyStatus: p.emoney_status,
            qrStatus: p.qr_status,
          },
          installationDate: p.installation_date,
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString(),
        };
      });
      setProjects(loadedProjects);
    }, (error) => {
      console.error('Firestore projects error:', error);
    });

    const actionsQuery = query(collection(db, 'actions'), where('user_id', '==', user.id));
    const unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
      if (snapshot.empty) return;
      const loadedActions: NextAction[] = snapshot.docs.map(docSnap => {
        const a = docSnap.data();
        return {
          id: docSnap.id,
          projectId: a.project_id || '',
          title: a.title || '',
          status: a.status || '未完了',
          deadline: a.deadline || '',
          assignee: a.assignee || '',
          priority: a.priority || '中',
          memo: a.memo || '',
          completedAt: a.completed_at,
          createdAt: a.created_at || new Date().toISOString()
        };
      });
      setActions(loadedActions);
    }, (error) => {
      console.error('Firestore actions error:', error);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeActions();
    };
  }, [user]);

  const resetToRoster42 = () => {
    const fresh = buildRoster42Dataset();
    setProjects(fresh.projects);
    setActions(fresh.actions);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(fresh.projects));
    localStorage.setItem(LOCAL_ACTIONS_KEY, JSON.stringify(fresh.actions));
  };

  /**
   * 選択形式（他社導入・金銭面・その他）でアーカイブ（失注）へ移動
   */
  const archiveProjectAsLost = (
    projectId: string,
    lostReason: LostReasonType,
    note?: string
  ) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowIso = new Date().toISOString();
    const followupDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd');

    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;

        const newActivity: Activity = {
          id: uuidv4(),
          projectId: p.id,
          date: todayStr,
          type: 'アーカイブ（失注）',
          content: `失注理由: 【${lostReason}】${note ? ` - ${note}` : ''}`
        };

        const reasonTag = `失注理由: ${lostReason}${note ? `(${note})` : ''}`;
        const updatedMemo = p.memo?.includes('失注理由:')
          ? p.memo.replace(/失注理由:\s*[^|]+/, `${reasonTag} `)
          : `${p.memo || ''} | ${reasonTag}`;

        return {
          ...p,
          status: '失注',
          lostReason: note ? `${lostReason}（${note}）` : lostReason,
          memo: updatedMemo,
          lastActivityAt: todayStr,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };
      })
    );

    setActions(prev => {
      const markedDone = prev.map(a =>
        a.projectId === projectId && a.status === '未完了'
          ? { ...a, status: '完了' as const, completedAt: nowIso }
          : a
      );

      const followupAction: NextAction = {
        id: uuidv4(),
        projectId,
        title: `状況伺い（失注後フォローアップ / 理由: ${lostReason}）`,
        assignee: '松浦 貴文',
        deadline: followupDate,
        priority: '低',
        status: '未完了',
        memo: `失注理由【${lostReason}】${note ? `（${note}）` : ''}から半年後の状況確認。`,
        createdAt: todayStr
      };

      return [followupAction, ...markedDone];
    });
  };

  /**
   * アーカイブ（失注）から営業リストへ復元
   */
  const restoreArchivedProject = (projectId: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowIso = new Date().toISOString();

    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;

        const newActivity: Activity = {
          id: uuidv4(),
          projectId: p.id,
          date: todayStr,
          type: '案件復活',
          content: 'アーカイブ（失注）から営業案件リストへ復元しました'
        };

        const cleanedMemo = (p.memo || '').replace(/\s*\|\s*失注理由:[^|]*/g, '');

        return {
          ...p,
          status: '初動',
          lostReason: undefined,
          memo: cleanedMemo,
          lastActivityAt: todayStr,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };
      })
    );
  };

  /**
   * ワンクリック架電・アクション記録（クリニック別ポイント制 ＆ 7段階進捗フロー連動対応）
   * 進捗フロー: 問合せ → 初動 → デモ → 見積 → 検討 → 後追い → 受注
   * 架電: 会話(+3p)・不在(+1p)・折返待ち(+1p)
   * アクション: 初動メール(+5p)・見積書送付(+5p)・オンラインデモ(+5p)・訪問デモ(+5p)・来社デモ(+5p)
   * 追加アクション: 訪問(+3p)・ポスティング(+2p)・相談メール(+3p)・後追いメール(+2p)
   */
  const recordQuickCallResult = (
    projectId: string,
    callOutcome: QuickCallOutcome,
    note?: string,
    actionDate?: string
  ) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const targetDate = actionDate || todayStr;
    const nowIso = new Date().toISOString();
    const earnedPoints = ACTION_POINT_RULES[callOutcome] ?? 1;

    setProjects(prevProjects =>
      prevProjects.map(p => {
        if (p.id !== projectId) return p;

        let newStatus = p.status;
        let newProb = p.probability || 'B';
        let newPriority = p.priority;
        let actType = `架電: ${callOutcome} (+${earnedPoints}p)`;
        let actContent = `架電結果: 【${callOutcome}】(+${earnedPoints}p)${note ? ` - ${note}` : ''}`;
        let updatedMemo = p.memo || '';

        let initialEmailDate = p.initialEmailDate;
        let estimateSentDate = p.estimateSentDate;
        let demoType = p.demoType;
        let demoDate = p.demoDate;
        let visitDate = p.visitDate;
        let postingDate = p.postingDate;
        let consultEmailDate = p.consultEmailDate;
        let followupEmailDate = p.followupEmailDate;
        let orderDate = p.orderDate;

        if (callOutcome === '会話') {
          if (p.status === '新規' || p.status === '問合せ') {
            newStatus = '初動';
          } else if (p.status === '見積') {
            newStatus = '検討';
          }
          newProb = 'B';
          actType = '架電: 会話 (+3p)';
          actContent = `架電結果: 【会話】（実施日: ${targetDate} / +3p）${note ? ` - ${note}` : ''}`;
          updatedMemo = updatedMemo.includes('架電状況:')
            ? updatedMemo.replace(/架電状況:\s*[^|]+/, `架電状況: 会話(${targetDate}) `)
            : `${updatedMemo} | 架電状況: 会話(${targetDate})`;
        } else if (callOutcome === '折返待ち') {
          if (p.status === '新規' || p.status === '問合せ') newStatus = '初動';
          newProb = 'A';
          newPriority = '高';
          actType = '架電: 折返待ち (+1p)';
          actContent = `架電結果: 【折返待ち】（実施日: ${targetDate} / +1p）${note ? ` - ${note}` : ''}`;
          updatedMemo = updatedMemo.includes('架電状況:')
            ? updatedMemo.replace(/架電状況:\s*[^|]+/, `架電状況: 折返待ち(${targetDate}) `)
            : `${updatedMemo} | 架電状況: 折返待ち(${targetDate})`;
        } else if (callOutcome === '不在') {
          if (p.status === '新規' || p.status === '問合せ') newStatus = '初動';
          actType = '架電: 不在 (+1p)';
          actContent = `架電結果: 【不在】（実施日: ${targetDate} / +1p）${note ? ` - ${note}` : ''}`;
          updatedMemo = updatedMemo.includes('架電状況:')
            ? updatedMemo.replace(/架電状況:\s*[^|]+/, `架電状況: 不在(${targetDate}) `)
            : `${updatedMemo} | 架電状況: 不在(${targetDate})`;
        } else if (callOutcome === '初動メール') {
          if (p.status === '新規' || p.status === '問合せ') newStatus = '初動';
          actType = '初動メール (+5p)';
          actContent = `初動メールを送付完了（実施日: ${targetDate} / +5p）${note ? ` - ${note}` : ''}`;
          initialEmailDate = targetDate;
          if (updatedMemo.includes('・メール未')) {
            updatedMemo = updatedMemo.replace('・メール未', '〇メール済');
          } else if (!updatedMemo.includes('〇メール済')) {
            updatedMemo = `${updatedMemo} | 〇メール済`;
          }
          if (updatedMemo.includes('初動メール済')) {
            updatedMemo = updatedMemo.replace(/初動メール済\([^)]*\)/, `初動メール済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 初動メール済(${targetDate})`;
          }
        } else if (callOutcome === '見積書送付') {
          if (p.status !== '受注') newStatus = '見積';
          newProb = 'A';
          newPriority = '高';
          actType = '見積書送付 (+5p)';
          actContent = `見積書を送付完了（実施日: ${targetDate} / +5p）${note ? ` - ${note}` : ''}`;
          estimateSentDate = targetDate;
          if (updatedMemo.includes('見積書送付済')) {
            updatedMemo = updatedMemo.replace(/見積書送付済\([^)]*\)/, `見積書送付済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 見積書送付済(${targetDate})`;
          }
        } else if (
          callOutcome === 'オンラインデモ' ||
          callOutcome === '訪問デモ' ||
          callOutcome === '来社デモ'
        ) {
          if (p.status !== '受注') {
            newStatus = 'デモ';
          }
          newProb = 'A';
          newPriority = '高';
          demoType = callOutcome;
          demoDate = targetDate;
          actType = `${callOutcome} (+5p)`;
          actContent = `【${callOutcome}】実施日: ${targetDate} に決定 (+5p)${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('架電状況:')) {
            updatedMemo = updatedMemo.replace(/架電状況:\s*[^|]+/, '架電状況: 会話 ');
          }
          const demoTag = `面談日: ${targetDate}(${callOutcome})`;
          if (updatedMemo.includes('面談日:')) {
            updatedMemo = updatedMemo.replace(/面談日:\s*[^|]+/, `${demoTag} `);
          } else {
            updatedMemo = `${updatedMemo} | ${demoTag}`;
          }
        } else if (callOutcome === '訪問') {
          if (p.status === '新規' || p.status === '問合せ') {
            newStatus = '初動';
          } else if (p.status === '見積') {
            newStatus = '検討';
          }
          newPriority = '高';
          visitDate = targetDate;
          actType = '訪問 (+3p)';
          actContent = `クリニックへの現地訪問を実施（実施日: ${targetDate} / +3p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('訪問済')) {
            updatedMemo = updatedMemo.replace(/訪問済\([^)]*\)/, `訪問済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 訪問済(${targetDate})`;
          }
        } else if (callOutcome === 'ポスティング') {
          if (p.status === '新規' || p.status === '問合せ') newStatus = '初動';
          postingDate = targetDate;
          actType = 'ポスティング (+2p)';
          actContent = `資料・チラシのポスティングを実施（実施日: ${targetDate} / +2p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('ポスティング済')) {
            updatedMemo = updatedMemo.replace(/ポスティング済\([^)]*\)/, `ポスティング済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | ポスティング済(${targetDate})`;
          }
        } else if (callOutcome === '相談メール') {
          if (p.status !== '受注') newStatus = '検討';
          consultEmailDate = targetDate;
          actType = '相談メール (+3p)';
          actContent = `相談・ヒアリングメールを送付完了（実施日: ${targetDate} / +3p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('相談メール済')) {
            updatedMemo = updatedMemo.replace(/相談メール済\([^)]*\)/, `相談メール済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 相談メール済(${targetDate})`;
          }
        } else if (callOutcome === '後追いメール') {
          if (p.status !== '受注') newStatus = '後追い';
          followupEmailDate = targetDate;
          actType = '後追いメール (+2p)';
          actContent = `後追いメールを送付完了（実施日: ${targetDate} / +2p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('後追いメール済')) {
            updatedMemo = updatedMemo.replace(/後追いメール済\([^)]*\)/, `後追いメール済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 後追いメール済(${targetDate})`;
          }
        } else if (callOutcome === '受注') {
          newStatus = '受注';
          newProb = 'A';
          newPriority = '高';
          orderDate = targetDate;
          actType = '🎉 受注確定 (+10p)';
          actContent = `【受注】ご契約・発注確定（受注日: ${targetDate} / +10p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('受注済')) {
            updatedMemo = updatedMemo.replace(/受注済\([^)]*\)/, `受注済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 受注済(${targetDate})`;
          }
        } else if (callOutcome === '面談設定') {
          newStatus = 'デモ';
          newProb = 'A';
          newPriority = '高';
          actType = '面談・商談設定 (+5p)';
          actContent = `面談・デモ実施（または日程確定: ${targetDate}）を記録 (+5p)${note ? `: ${note}` : ''}`;
          demoDate = targetDate;
          if (!updatedMemo.includes('面談日:')) {
            updatedMemo = `${updatedMemo} | 面談日: ${targetDate}`;
          }
        } else if (callOutcome === '資料送付') {
          actType = '資料・メール送付 (+2p)';
          actContent = `●資料送付・〇案内メール送付を完了 (+2p)${note ? `: ${note}` : ''}`;
        }

        const currentClinicPts = getClinicTotalPoints(p);
        const nextClinicPts = currentClinicPts + earnedPoints;

        const ruleMatched = evaluateRulesOnQuickAction(
          p,
          callOutcome,
          nextClinicPts,
          rules,
          targetDate
        );

        if (ruleMatched?.nextStage && p.status !== '受注') {
          newStatus = ruleMatched.nextStage;
        }
        if (ruleMatched?.autoProbability) {
          newProb = ruleMatched.autoProbability;
        }

        const newActivity: Activity = {
          id: uuidv4(),
          projectId: p.id,
          date: targetDate,
          type: actType,
          content: actContent,
          points: earnedPoints
        };

        return {
          ...p,
          status: newStatus,
          probability: newProb,
          priority: newPriority,
          memo: updatedMemo,
          clinicPoints: nextClinicPts,
          initialEmailDate,
          estimateSentDate,
          demoType,
          demoDate,
          visitDate,
          postingDate,
          consultEmailDate,
          followupEmailDate,
          orderDate,
          lastActivityAt: targetDate,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };
      })
    );

    // 既存の未完了アクションを完了にし、ルールエンジンまたはデフォルトから次の最適アクションを自動セット
    setActions(prevActions => {
      const markedDone = prevActions.map(a =>
        a.projectId === projectId && a.status === '未完了'
          ? { ...a, status: '完了' as const, completedAt: nowIso }
          : a
      );

      const targetProject = projects.find(p => p.id === projectId);
      if (targetProject) {
        const nextPts = getClinicTotalPoints(targetProject) + earnedPoints;
        const ruleHit = evaluateRulesOnQuickAction(
          targetProject,
          callOutcome,
          nextPts,
          rules,
          targetDate
        );
        if (ruleHit) {
          return [ruleHit.nextAction, ...markedDone];
        }
      }

      let nextTitle = '';
      let nextMemo = '';
      let nextDeadline = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      let nextPriority: ActionPriority = '中';

      if (callOutcome === '会話') {
        nextTitle = '会話後フォロー：実機デモ日程調整 ＆ 概算見積・補助金案内';
        nextMemo = '先方と会話済（+3p）。熱量が高いうちにAIナレッジからフォローメールを送信する。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '不在') {
        nextTitle = '不在のため時間帯を変えて再架電 ＋ 不在時フォローメール送信';
        nextMemo = '前回不在（+1p）。昼の休診前または夕方に再コール。';
        nextDeadline = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '折返待ち') {
        nextTitle = '【最優先】折り返し確認 ＆ AI要点メール送付';
        nextMemo = '先方折返待ち（+1p）。24時間以内に動きがなければメールで要点を送付。';
        nextDeadline = todayStr;
        nextPriority = '高';
      } else if (callOutcome === '初動メール') {
        nextTitle = '初動メール開封・資料到着確認のフォローコール';
        nextMemo = '初動メール送付済（+5p）。到着確認とあわせてレセコンメーカー・デモ希望日をヒアリング。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '見積書送付') {
        nextTitle = '見積書の内容確認フォロー ＆ 導入時期・補助金スケジュールの確定';
        nextMemo = '見積書送付済（+5p）。金額感や機器構成の疑問を解消し、検討・受注へ進める。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (
        callOutcome === 'オンラインデモ' ||
        callOutcome === '訪問デモ' ||
        callOutcome === '来社デモ'
      ) {
        nextTitle = `【${callOutcome}】実施・見積提案（予定日: ${targetDate}）`;
        nextMemo = `${targetDate} に${callOutcome}を実施予定（+5p）。レセコン連携構成図と概算見積書を準備して臨む。`;
        nextDeadline = targetDate;
        nextPriority = '高';
      } else if (callOutcome === '訪問') {
        nextTitle = '訪問後フォロー：お礼連絡 ＆ デモ・概算見積のご案内';
        nextMemo = '現地訪問実施済（+3p）。反応に合わせてデモ設定または相談メールを送付。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === 'ポスティング') {
        nextTitle = 'ポスティング後の到着確認コール';
        nextMemo = 'ポスティング実施済（+2p）。「先日資料を投函いたしました松浦です」とフォロー架電を行う。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '中';
      } else if (callOutcome === '相談メール') {
        nextTitle = '相談メールの返信確認 ＆ 検討状況ヒアリングコール';
        nextMemo = '相談メール送付済（+3p / 進捗: 検討）。検討課題やデモ希望日の返信確認を行う。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '後追いメール') {
        nextTitle = '後追いメール後の状況確認コール ＆ 最終意思決定フォロー';
        nextMemo = '後追いメール送付済（+2p / 進捗: 後追い）。導入判断の時期やご不明点を確認し受注へ繋げる。';
        nextDeadline = format(addDays(new Date(), 3), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '受注') {
        nextTitle = '【受注完了】導入準備・現地調査および設置日程の調整';
        nextMemo = `受注確定（受注日: ${targetDate} / +10p）。レセコン連携手配・キャッシュレス申込・設置スケジュールの確定を進める。`;
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === '面談設定') {
        nextTitle = '見積書・レセコン連動構成案・補助金シミュレーションの提出';
        nextMemo = '面談・商談設定済。決裁者（院長）向けの最終提案資料を準備。';
        nextDeadline = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        nextPriority = '高';
      } else {
        nextTitle = '資料到着確認のフォローコール';
        nextMemo = '送付した資料・メールの開封および到着確認。';
        nextDeadline = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        nextPriority = '中';
      }

      const newNextAction: NextAction = {
        id: uuidv4(),
        projectId,
        title: nextTitle,
        assignee: '松浦 貴文',
        deadline: nextDeadline,
        priority: nextPriority,
        status: '未完了',
        memo: nextMemo,
        createdAt: todayStr
      };

      return [newNextAction, ...markedDone];
    });
  };

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (project.status === newStatus) return;

    let updatedActions = actions;
    let nextBallHolder = project.ballHolder;
    let newActionsToInsert: NextAction[] = [];

    const dynamicRules = getRulesForStatus(newStatus);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');
    
    if (enterRules.length > 0) {
      const dynamicActions = enterRules.map(r => createDynamicAction(project, r));
      newActionsToInsert = [...newActionsToInsert, ...dynamicActions];
      nextBallHolder = project.salesRep;
    }

    const result = generateActionsOnStatusChange(project, newStatus, rules);
    if (result) {
      newActionsToInsert = [...newActionsToInsert, ...result.newActions];
      nextBallHolder = result.nextBallHolder;
    }

    if (newStatus === '失注') {
      const followupDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd');
      const followupAction: NextAction = {
        id: uuidv4(),
        projectId: project.id,
        title: '状況伺い（失注後フォローアップ）',
        assignee: project.salesRep,
        deadline: followupDate,
        priority: '低',
        status: '未完了',
        memo: '失注から半年経過。現在の状況や別件のニーズがないか確認する。',
        createdAt: new Date().toISOString()
      };
      newActionsToInsert = [...newActionsToInsert, followupAction];
    }

    updatedActions = [...newActionsToInsert, ...updatedActions];
    
    const newColumn = kanbanColumns.find(c => c.id === newStatus);
    const newIsImplementation = newColumn?.phase === 'implementation' ? true : project.isImplementationProject;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowIso = new Date().toISOString();

    if (user && user.id !== 'demo-user-1') {
      try {
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { 
          status: newStatus,
          ball_holder: nextBallHolder,
          is_implementation_project: newIsImplementation,
          last_activity_at: nowIso,
          updated_at: nowIso
        });
      } catch (e: any) {
        console.error('Error updating project status in Firestore:', e);
      }
    }

    setActions(updatedActions);
    setProjects(projects.map(p => 
      p.id === project.id ? { 
        ...p, 
        status: newStatus, 
        ballHolder: nextBallHolder, 
        isImplementationProject: newIsImplementation,
        lastActivityAt: todayStr 
      } : p
    ));
  };

  const handleCompleteAction = async (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;
    const project = projects.find(p => p.id === action.projectId);
    if (!project) return;

    const completedAtIso = new Date().toISOString();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let updatedActions = actions.map(a => 
      a.id === actionId ? { ...a, status: '完了' as const, completedAt: completedAtIso } : a
    );
    let nextBallHolder = project.ballHolder;

    const result = generateActionsOnTaskCompletion(project, action.title, rules);
    if (result) {
      updatedActions = [...result.newActions, ...updatedActions];
      nextBallHolder = result.nextBallHolder;
    }

    if (user && user.id !== 'demo-user-1') {
      try {
        const actionRef = doc(db, 'actions', actionId);
        await updateDoc(actionRef, { status: '完了', completed_at: completedAtIso });
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { ball_holder: nextBallHolder, last_activity_at: completedAtIso });
      } catch (e: any) {
        console.error('Error completing action in Firestore:', e);
      }
    }

    setActions(updatedActions);
    setProjects(projects.map(p => 
      p.id === project.id ? { ...p, ballHolder: nextBallHolder, lastActivityAt: todayStr } : p
    ));
  };

  const addProject = async (newProject: Project, initialAction?: NextAction) => {
    let newActions: NextAction[] = [];
    let nextBallHolder = newProject.ballHolder;
    
    const dynamicRules = getRulesForStatus(newProject.status);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');
    
    if (enterRules.length > 0) {
      newActions = enterRules.map(r => createDynamicAction(newProject, r));
      nextBallHolder = newProject.salesRep;
    } else {
      const result = generateActionsOnStatusChange(newProject, newProject.status, rules);
      if (result) {
        newActions = result.newActions;
        nextBallHolder = result.nextBallHolder;
      }
    }

    if (initialAction) {
      newActions = [initialAction, ...newActions.filter(a => a.title !== initialAction.title)];
      nextBallHolder = initialAction.assignee || newProject.salesRep;
    }

    const finalProject = { ...newProject, ballHolder: nextBallHolder };
    
    if (user && user.id !== 'demo-user-1') {
      try {
        const dbProject: Record<string, any> = {
          id: finalProject.id,
          clinic_name: finalProject.clinicName || '',
          status: finalProject.status || '新規',
          phase: 'sales',
          sales_rep: finalProject.salesRep || '',
          ball_holder: finalProject.ballHolder || '',
          probability: finalProject.probability || 'B',
          memo: finalProject.memo || '',
          is_implementation_project: !!finalProject.isImplementationProject,
          created_at: finalProject.createdAt || new Date().toISOString(),
          updated_at: finalProject.updatedAt || new Date().toISOString(),
          user_id: user.id
        };
        const projectRef = doc(db, 'projects', finalProject.id);
        await setDoc(projectRef, dbProject);
      } catch (projectError: any) {
        console.error('Firebase Project Insert Error:', projectError);
      }
    }

    setProjects(prev => [finalProject, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const addProjectsBulk = (newProjects: Project[], newActions: NextAction[]) => {
    setProjects(prev => [...newProjects, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const renameProjectStatus = async (oldStatus: string, newStatus: string) => {
    setProjects(prev => prev.map(p => 
      p.status === oldStatus ? { ...p, status: newStatus } : p
    ));
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
  };

  const postponeAction = async (actionId: string, days: number) => {
    setActions(actions.map(a => {
      if (a.id === actionId) {
        const currentDeadline = new Date(a.deadline || new Date());
        currentDeadline.setDate(currentDeadline.getDate() + days);
        const yyyy = currentDeadline.getFullYear();
        const mm = String(currentDeadline.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDeadline.getDate()).padStart(2, '0');
        return { ...a, deadline: `${yyyy}-${mm}-${dd}` };
      }
      return a;
    }));
  };

  /**
   * 指定した自動化ルールに現在合致する全案件（クリニック/BtoB）に対して、
   * 次回アクションおよび進捗フロー・確度更新を一括適用する
   */
  const applyRuleToMatchingProjects = (rule: GlobalRule): number => {
    const matched = scanMatchingProjectsForRule(projects, rule);
    if (matched.length === 0) return 0;

    const matchedIds = new Set(matched.map(p => p.id));
    const nowIso = new Date().toISOString();

    if (rule.nextStage || rule.autoProbability) {
      setProjects(prev =>
        prev.map(p => {
          if (!matchedIds.has(p.id)) return p;
          return {
            ...p,
            status: rule.nextStage && p.status !== '受注' && p.status !== '失注' ? rule.nextStage : p.status,
            probability: rule.autoProbability || p.probability,
            updatedAt: nowIso
          };
        })
      );
    }

    setActions(prev => {
      const markedDone = prev.map(a =>
        matchedIds.has(a.projectId) && a.status === '未完了'
          ? { ...a, status: '完了' as const, completedAt: nowIso }
          : a
      );
      const generated = matched.map(p => createActionFromGlobalRule(p, rule));
      return [...generated, ...markedDone];
    });

    return matched.length;
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      actions,
      handleStatusChange,
      handleCompleteAction,
      addProject,
      addProjectsBulk,
      updateProject,
      renameProjectStatus,
      postponeAction,
      recordQuickCallResult,
      archiveProjectAsLost,
      restoreArchivedProject,
      applyRuleToMatchingProjects,
      resetToRoster42
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
