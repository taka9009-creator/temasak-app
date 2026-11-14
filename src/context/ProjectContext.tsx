import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
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
import { ACTION_POINT_RULES, SALES_PROGRESS_FLOW, getClinicTotalPoints, normalizeProgressStage } from '../types';
import type { Project, NextAction, ProjectStatus, ActionPriority, Activity, QuickCallOutcome, LostReasonType, SalesProgressStage } from '../types';
import { useWorkflow } from './WorkflowContext';
import { useRules } from './RuleContext';
import type { GlobalRule } from './RuleContext';
import { useAuth } from './AuthContext';

// 本番始動用ストレージキー（復元済みの活動履歴・失注5件・基本情報を反映）
const LOCAL_PROJECTS_KEY = 'temasak_os_projects_recovered_v2';
const LOCAL_ACTIONS_KEY = 'temasak_os_actions_recovered_v2';
const CLOUD_RECOVERED_FLAG = 'temasak_cloud_recovered_v2';

// 本番有効な案件IDかどうかの判定（旧サンプル12件やテスト用UUIDを除外）
function isValidProductionProjectId(id: string | undefined): boolean {
  if (!id) return false;
  return id.startsWith('roster-') || id.startsWith('paste-proj-') || id.startsWith('prod-');
}

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
  syncLocalToCloud: () => Promise<{ success: boolean; count: number; error?: string }>;
  isCloudSyncing: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PROJECTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validOnly = parsed.filter((p: Project) => isValidProductionProjectId(p?.id));
          if (validOnly.length >= 42) return validOnly;
        }
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
        if (Array.isArray(parsed)) {
          const validOnly = parsed.filter((a: NextAction) => isValidProductionProjectId(a?.projectId));
          if (validOnly.length > 0) return validOnly;
        }
      }
    } catch (e) {
      console.error('Failed to load local actions:', e);
    }
    return buildRoster42Dataset().actions;
  });

  const { getRulesForStatus, kanbanColumns } = useWorkflow();
  const { rules } = useRules();
  const { user } = useAuth();
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

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

  const saveProjectToFirestore = async (proj: Project) => {
    if (!user || user.id === 'demo-user-1') return;
    if (!isValidProductionProjectId(proj.id)) return;
    try {
      const projectRef = doc(db, 'projects', proj.id);
      const cleanProject: Record<string, any> = { ...proj, user_id: user.id };
      Object.keys(cleanProject).forEach(k => {
        if (cleanProject[k] === undefined) delete cleanProject[k];
      });
      await setDoc(projectRef, cleanProject, { merge: true });
    } catch (e) {
      console.error('Failed to sync project to Firestore:', e);
    }
  };

  const saveActionToFirestore = async (act: NextAction) => {
    if (!user || user.id === 'demo-user-1') return;
    if (!isValidProductionProjectId(act.projectId)) return;
    try {
      const actRef = doc(db, 'actions', act.id);
      const cleanAct: Record<string, any> = { ...act, user_id: user.id };
      Object.keys(cleanAct).forEach(k => {
        if (cleanAct[k] === undefined) delete cleanAct[k];
      });
      await setDoc(actRef, cleanAct, { merge: true });
    } catch (e) {
      console.error('Failed to sync action to Firestore:', e);
    }
  };

  // Firestore listener: 旧サンプルデータを自動削除し、名簿初期42件＋本番追加案件のみをリアルタイム同期
  useEffect(() => {
    if (!user || user.id === 'demo-user-1') {
      return;
    }

    const projectsQuery = query(collection(db, 'projects'));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      // 1. 旧サンプル案件（IDが roster- / paste-proj- / prod- 以外）をFirestoreから自動削除
      const validDocs = snapshot.docs.filter(docSnap => {
        if (!isValidProductionProjectId(docSnap.id)) {
          deleteDoc(doc(db, 'projects', docSnap.id)).catch(err =>
            console.error('Failed to purge sample project:', err)
          );
          return false;
        }
        return true;
      });

      const loadedMap = new Map<string, Project>();
      validDocs.forEach(docSnap => {
        const p = docSnap.data();
        loadedMap.set(docSnap.id, {
          id: docSnap.id,
          clinicName: p.clinicName || p.clinic_name || '',
          clinicType: p.clinicType || p.clinic_type || '',
          address: p.address || '',
          phone: p.phone || '',
          email: p.email || '',
          contactPerson: p.contactPerson || p.contact_person || '',
          contactTitle: p.contactTitle || p.contact_title || '',
          source: p.source || '',
          sourceDetail: p.sourceDetail,
          receivedAt: p.receivedAt || p.received_at || p.created_at || new Date().toISOString(),
          product: p.product || 'テマサック自動精算機',
          quantity: p.quantity || 1,
          priority: (p.priority as ActionPriority) || '中',
          status: p.status || '初動',
          salesRep: p.salesRep || p.sales_rep || '松浦 貴文',
          ballHolder: p.ballHolder || p.ball_holder || '松浦 貴文',
          lastActivityAt: p.lastActivityAt || p.last_activity_at || p.created_at || new Date().toISOString(),
          probability: p.probability as any,
          memo: p.memo || '',
          lostReason: p.lostReason || p.lost_reason,
          isImplementationProject: !!(p.isImplementationProject ?? p.is_implementation_project),
          pipelineMap: p.pipelineMap || {
            deviceType: p.device_type,
            bodyColor: p.body_color,
            subsidyName: p.subsidy_name,
            cashlessOptions: p.cashless_options,
            creditStatus: p.credit_status,
            jcbCreditStatus: p.jcb_credit_status,
            emoneyStatus: p.emoney_status,
            qrStatus: p.qr_status,
          },
          clinicPoints: typeof p.clinicPoints === 'number' ? p.clinicPoints : p.clinic_points,
          initialEmailDate: p.initialEmailDate,
          estimateSentDate: p.estimateSentDate,
          demoType: p.demoType,
          demoDate: p.demoDate,
          visitDate: p.visitDate,
          postingDate: p.postingDate,
          consultEmailDate: p.consultEmailDate,
          followupEmailDate: p.followupEmailDate,
          kzReferralDate: p.kzReferralDate,
          orderDate: p.orderDate,
          clinicHours: p.clinicHours,
          closedDays: p.closedDays,
          websiteUrl: p.websiteUrl,
          reservationSystem: p.reservationSystem,
          aiSummary: p.aiSummary,
          aiRecommendation: p.aiRecommendation,
          activities: Array.isArray(p.activities) ? p.activities : [],
          installationDate: p.installationDate || p.installation_date,
          createdAt: p.createdAt || p.created_at || new Date().toISOString(),
          updatedAt: p.updatedAt || p.updated_at || new Date().toISOString(),
        });
      });

      // 2. 過去に入力された活動履歴・失注リスト(5件)・基本情報(電話番号/診療時間/休診日/URL/予約システム/院長名)を自動復元・補完してクラウドへ保存
      const freshRoster = buildRoster42Dataset().projects;
      const isFirstRecoverySync = localStorage.getItem(CLOUD_RECOVERED_FLAG) !== 'done';

      freshRoster.forEach(rosterProj => {
        const existing = loadedMap.get(rosterProj.id);
        if (!existing) {
          loadedMap.set(rosterProj.id, rosterProj);
          saveProjectToFirestore(rosterProj);
        } else {
          const needsRecovery =
            isFirstRecoverySync ||
            (!existing.phone && !!rosterProj.phone) ||
            (!existing.clinicHours && !!rosterProj.clinicHours) ||
            (!existing.websiteUrl && !!rosterProj.websiteUrl) ||
            ((existing.activities?.length || 0) < (rosterProj.activities?.length || 0));

          if (needsRecovery) {
            const mergedProj: Project = {
              ...rosterProj,
              ...existing,
              clinicType: rosterProj.clinicType || existing.clinicType,
              address: (rosterProj.address && rosterProj.address.length > (existing.address?.length || 0))
                ? rosterProj.address
                : (existing.address || rosterProj.address),
              phone: existing.phone || rosterProj.phone || '',
              clinicHours: existing.clinicHours || rosterProj.clinicHours,
              closedDays: existing.closedDays || rosterProj.closedDays,
              websiteUrl: existing.websiteUrl || rosterProj.websiteUrl,
              reservationSystem: existing.reservationSystem || rosterProj.reservationSystem,
              status: isFirstRecoverySync ? rosterProj.status : existing.status,
              lostReason: isFirstRecoverySync ? rosterProj.lostReason : (existing.lostReason || rosterProj.lostReason),
              probability: isFirstRecoverySync ? rosterProj.probability : existing.probability,
              memo: isFirstRecoverySync ? rosterProj.memo : existing.memo,
              demoType: existing.demoType || rosterProj.demoType,
              demoDate: existing.demoDate || rosterProj.demoDate,
              initialEmailDate: existing.initialEmailDate || rosterProj.initialEmailDate,
              estimateSentDate: existing.estimateSentDate || rosterProj.estimateSentDate,
              clinicPoints: Math.max(existing.clinicPoints || 0, rosterProj.clinicPoints || 0),
              pipelineMap: {
                ...(rosterProj.pipelineMap || {}),
                ...(existing.pipelineMap || {}),
                director: existing.pipelineMap?.director || rosterProj.pipelineMap?.director
              },
              activities:
                (existing.activities?.length || 0) >= (rosterProj.activities?.length || 0)
                  ? existing.activities
                  : rosterProj.activities
            };
            loadedMap.set(rosterProj.id, mergedProj);
            saveProjectToFirestore(mergedProj);
          }
        }
      });

      if (isFirstRecoverySync) {
        localStorage.setItem(CLOUD_RECOVERED_FLAG, 'done');
      }

      const mergedList = Array.from(loadedMap.values()).sort((a, b) =>
        (b.receivedAt || '').localeCompare(a.receivedAt || '')
      );
      setProjects(mergedList);
    }, (error) => {
      console.error('Firestore projects error:', error);
    });

    const actionsQuery = query(collection(db, 'actions'));
    const unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
      // 旧サンプルタスク（△△医院など）をFirestoreから自動削除
      const validActionDocs = snapshot.docs.filter(docSnap => {
        const a = docSnap.data();
        const pid = a.projectId || a.project_id || '';
        if (!isValidProductionProjectId(pid)) {
          deleteDoc(doc(db, 'actions', docSnap.id)).catch(err =>
            console.error('Failed to purge sample action:', err)
          );
          return false;
        }
        return true;
      });

      const loadedActionMap = new Map<string, NextAction>();
      validActionDocs.forEach(docSnap => {
        const a = docSnap.data();
        loadedActionMap.set(docSnap.id, {
          id: docSnap.id,
          projectId: a.projectId || a.project_id || '',
          title: a.title || '',
          status: a.status || '未完了',
          deadline: a.deadline || '',
          assignee: a.assignee || '',
          priority: a.priority || '中',
          memo: a.memo || '',
          completedAt: a.completedAt || a.completed_at,
          createdAt: a.createdAt || a.created_at || new Date().toISOString()
        });
      });

      const freshActions = buildRoster42Dataset().actions;
      freshActions.forEach(rosterAct => {
        if (!loadedActionMap.has(rosterAct.id)) {
          loadedActionMap.set(rosterAct.id, rosterAct);
          saveActionToFirestore(rosterAct);
        }
      });

      setActions(Array.from(loadedActionMap.values()));
    }, (error) => {
      console.error('Firestore actions error:', error);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeActions();
    };
  }, [user]);

  /**
   * 現在のブラウザ内の全案件・活動履歴・アクションを一括でFirestoreクラウドへアップロード
   */
  const syncLocalToCloud = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!user || user.id === 'demo-user-1') {
      return { success: false, count: 0, error: 'Firebaseにログインしてください。' };
    }
    setIsCloudSyncing(true);
    try {
      let count = 0;
      for (const p of projects) {
        if (isValidProductionProjectId(p.id)) {
          await saveProjectToFirestore(p);
          count++;
        }
      }
      for (const a of actions) {
        if (isValidProductionProjectId(a.projectId)) {
          await saveActionToFirestore(a);
        }
      }
      return { success: true, count };
    } catch (err: any) {
      console.error('Error in syncLocalToCloud:', err);
      return { success: false, count: 0, error: err?.message || 'クラウド同期に失敗しました' };
    } finally {
      setIsCloudSyncing(false);
    }
  };

  /**
   * 名簿初期42件のデータ状態に完全初期化（ローカル＋Firestoreクラウド両方）
   */
  const resetToRoster42 = () => {
    const fresh = buildRoster42Dataset();
    setProjects(fresh.projects);
    setActions(fresh.actions);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(fresh.projects));
    localStorage.setItem(LOCAL_ACTIONS_KEY, JSON.stringify(fresh.actions));

    if (user && user.id !== 'demo-user-1') {
      fresh.projects.forEach(p => saveProjectToFirestore(p));
      fresh.actions.forEach(a => saveActionToFirestore(a));
    }
  };

  /**
   * 選択形式（他社導入・金銭面・その他）でアーカイブ（失注）へ移動（Firestore即時保存対応）
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

        const updatedTarget: Project = {
          ...p,
          status: '失注',
          lostReason: note ? `${lostReason}（${note}）` : lostReason,
          memo: updatedMemo,
          lastActivityAt: todayStr,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };

        saveProjectToFirestore(updatedTarget);
        return updatedTarget;
      })
    );

    setActions(prev => {
      const markedDone = prev.map(a => {
        if (a.projectId === projectId && a.status === '未完了') {
          const doneAct = { ...a, status: '完了' as const, completedAt: nowIso };
          saveActionToFirestore(doneAct);
          return doneAct;
        }
        return a;
      });

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

      saveActionToFirestore(followupAction);
      return [followupAction, ...markedDone];
    });
  };

  /**
   * アーカイブ（失注）から営業リストへ復元（Firestore即時保存対応）
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

        const restoredTarget: Project = {
          ...p,
          status: '初動',
          lostReason: undefined,
          memo: cleanedMemo,
          lastActivityAt: todayStr,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };

        saveProjectToFirestore({
          ...restoredTarget,
          lostReason: '' as any
        });
        return restoredTarget;
      })
    );
  };

  /**
   * ワンクリック架電・アクション記録（クリニック別ポイント制 ＆ 7段階進捗フロー連動対応）
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
        let kzReferralDate = p.kzReferralDate;
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
          if (p.status !== '受注' && p.status !== 'kz送客') newStatus = '後追い';
          followupEmailDate = targetDate;
          actType = '後追いメール (+2p)';
          actContent = `後追いメールを送付完了（実施日: ${targetDate} / +2p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('後追いメール済')) {
            updatedMemo = updatedMemo.replace(/後追いメール済\([^)]*\)/, `後追いメール済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | 後追いメール済(${targetDate})`;
          }
        } else if (callOutcome === 'kz送客') {
          if (p.status !== '受注') newStatus = 'kz送客';
          newProb = 'A';
          newPriority = '高';
          kzReferralDate = targetDate;
          actType = '💰 kz送客 (+5p)';
          actContent = `【kz送客】補助金コンサルタント（kz）へ送客完了・採択後に受注（送客日: ${targetDate} / +5p）${note ? ` - ${note}` : ''}`;
          if (updatedMemo.includes('kz送客済')) {
            updatedMemo = updatedMemo.replace(/kz送客済\([^)]*\)/, `kz送客済(${targetDate})`);
          } else {
            updatedMemo = `${updatedMemo} | kz送客済(${targetDate})`;
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

        const updatedTarget = {
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
          kzReferralDate,
          orderDate,
          lastActivityAt: targetDate,
          updatedAt: nowIso,
          activities: [newActivity, ...(p.activities || [])]
        };
        saveProjectToFirestore(updatedTarget);
        return updatedTarget;
      })
    );

    // 既存の未完了アクションを完了にし、次の最適アクションを自動セット＋Firestore保存
    setActions(prevActions => {
      const markedDone = prevActions.map(a => {
        if (a.projectId === projectId && a.status === '未完了') {
          const doneAct = { ...a, status: '完了' as const, completedAt: nowIso };
          saveActionToFirestore(doneAct);
          return doneAct;
        }
        return a;
      });

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
          saveActionToFirestore(ruleHit.nextAction);
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
        nextMemo = '後追いメール送付済（+2p / 進捗: 後追い）。導入判断の時期やご不明点を確認し、kz送客または受注へ繋げる。';
        nextDeadline = format(addDays(new Date(), 3), 'yyyy-MM-dd');
        nextPriority = '高';
      } else if (callOutcome === 'kz送客') {
        nextTitle = '【kz送客・補助金申請中】補助金コンサル（kz）進捗確認 ＆ 採択後の「🎉受注」確定フォロー';
        nextMemo = `補助金コンサルタント（kz）へ送客完了（送客日: ${targetDate} / +5p / 進捗: kz送客）。補助金採択後に「🎉受注 (+10p)」へ確定させる。`;
        nextDeadline = format(addDays(new Date(), 7), 'yyyy-MM-dd');
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

      saveActionToFirestore(newNextAction);
      return [newNextAction, ...markedDone];
    });
  };

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const currentNormalized = project.status === '失注' ? '失注' : normalizeProgressStage(project);
    if (project.status === newStatus && currentNormalized === newStatus) return;

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

    const newColumn = kanbanColumns.find(c => c.id === newStatus);
    const newIsImplementation = newColumn?.phase === 'implementation' ? true : project.isImplementationProject;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowIso = new Date().toISOString();

    if (newStatus === 'kz送客' && newActionsToInsert.length === 0) {
      const kzAction: NextAction = {
        id: uuidv4(),
        projectId: project.id,
        title: '【kz送客・補助金申請中】補助金コンサル（kz）進捗確認 ＆ 採択後の「🎉受注」確定フォロー',
        assignee: project.salesRep || '松浦 貴文',
        deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        priority: '高',
        status: '未完了',
        memo: '進捗フロー「kz送客（補助金コンサルタント送客済・採択後に受注）」へ移行。採択結果を確認し次第、受注へ進める。',
        createdAt: todayStr
      };
      newActionsToInsert = [kzAction, ...newActionsToInsert];
    }

    newActionsToInsert.forEach(a => saveActionToFirestore(a));

    setActions(prev => [...newActionsToInsert, ...prev]);
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== project.id) return p;
        const prevStage = p.status === '失注' ? '失注' : normalizeProgressStage(p);
        let nextMemo = p.memo || '';
        let nextInitialEmailDate = p.initialEmailDate;
        let nextDemoDate = p.demoDate;
        let nextEstimateDate = p.estimateSentDate;
        let nextConsultDate = p.consultEmailDate;
        let nextFollowupDate = p.followupEmailDate;
        let nextKzDate = p.kzReferralDate;
        let nextOrderDate = p.orderDate;
        let nextProb = p.probability;

        const targetStageIdx =
          newStatus === '失注' ? -1 : SALES_PROGRESS_FLOW.indexOf(newStatus as SalesProgressStage);

        // 前のステージへ戻した場合、それより後ろのステージの日付・メモタグをクリアして完全連動させる
        if (targetStageIdx >= 0) {
          if (targetStageIdx < 7) {
            nextOrderDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*受注済\([^)]*\)/g, '');
          }
          if (targetStageIdx < 6) {
            nextKzDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*kz送客済\([^)]*\)/g, '');
          }
          if (targetStageIdx < 5) {
            nextFollowupDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*後追いメール済\([^)]*\)/g, '');
          }
          if (targetStageIdx < 4) {
            nextConsultDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*相談メール済\([^)]*\)/g, '');
          }
          if (targetStageIdx < 3) {
            nextEstimateDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*見積書送付済\([^)]*\)/g, '');
          }
          if (targetStageIdx < 2) {
            nextDemoDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*面談日:\s*[^|]+/g, '');
          }
          if (targetStageIdx < 1) {
            nextInitialEmailDate = undefined;
            nextMemo = nextMemo.replace(/\s*\|\s*初動メール済\([^)]*\)/g, '');
          }
        }

        // 移動先ステージに応じた日付・確度・メモの自動セット
        if (newStatus === '初動' && !nextInitialEmailDate) {
          nextInitialEmailDate = todayStr;
        } else if (newStatus === 'デモ') {
          nextDemoDate = nextDemoDate || todayStr;
          nextProb = 'A';
        } else if (newStatus === '見積') {
          nextEstimateDate = nextEstimateDate || todayStr;
          nextProb = 'A';
        } else if (newStatus === '検討') {
          nextConsultDate = nextConsultDate || todayStr;
          nextProb = nextProb || 'B';
        } else if (newStatus === '後追い') {
          nextFollowupDate = nextFollowupDate || todayStr;
        } else if (newStatus === 'kz送客') {
          nextKzDate = nextKzDate || todayStr;
          nextProb = 'A';
          if (!nextMemo.includes('kz送客済')) {
            nextMemo = `${nextMemo} | kz送客済(${nextKzDate})`;
          }
        } else if (newStatus === '受注') {
          nextOrderDate = nextOrderDate || todayStr;
          nextProb = 'A';
          if (!nextMemo.includes('受注済')) {
            nextMemo = `${nextMemo} | 受注済(${nextOrderDate})`;
          }
        }

        // 進捗フロー・案件カンバンの移動を「活動履歴」にも自動記録して3方向完全連動
        const stageMoveActivity: Activity = {
          id: uuidv4(),
          projectId: p.id,
          date: todayStr,
          type: `🔄 進捗移動: 【${prevStage}】➔【${newStatus}】`,
          content: `進捗フロー・案件カンバンを「${prevStage}」から「${newStatus}」へ移動しました。`,
          points: 0
        };

        const updated: Project = {
          ...p,
          status: newStatus,
          probability: nextProb,
          initialEmailDate: nextInitialEmailDate,
          demoDate: nextDemoDate,
          estimateSentDate: nextEstimateDate,
          consultEmailDate: nextConsultDate,
          followupEmailDate: nextFollowupDate,
          kzReferralDate: nextKzDate,
          orderDate: nextOrderDate,
          memo: nextMemo.trim(),
          ballHolder: nextBallHolder,
          isImplementationProject: newIsImplementation,
          activities: [stageMoveActivity, ...(p.activities || [])],
          lastActivityAt: todayStr,
          updatedAt: nowIso
        };
        saveProjectToFirestore(updated);
        return updated;
      })
    );
  };

  const handleCompleteAction = async (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;
    const project = projects.find(p => p.id === action.projectId);
    if (!project) return;

    const completedAtIso = new Date().toISOString();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let updatedActions = actions.map(a => {
      if (a.id === actionId) {
        const done = { ...a, status: '完了' as const, completedAt: completedAtIso };
        saveActionToFirestore(done);
        return done;
      }
      return a;
    });
    let nextBallHolder = project.ballHolder;

    const result = generateActionsOnTaskCompletion(project, action.title, rules);
    if (result) {
      result.newActions.forEach(na => saveActionToFirestore(na));
      updatedActions = [...result.newActions, ...updatedActions];
      nextBallHolder = result.nextBallHolder;
    }

    setActions(updatedActions);
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== project.id) return p;
        const updated = { ...p, ballHolder: nextBallHolder, lastActivityAt: todayStr, updatedAt: completedAtIso };
        saveProjectToFirestore(updated);
        return updated;
      })
    );
  };

  const addProject = async (newProject: Project, initialAction?: NextAction) => {
    const prodId = isValidProductionProjectId(newProject.id) ? newProject.id : `prod-${newProject.id}`;
    const normalizedNewProject: Project = { ...newProject, id: prodId };

    let newActions: NextAction[] = [];
    let nextBallHolder = normalizedNewProject.ballHolder;

    const dynamicRules = getRulesForStatus(normalizedNewProject.status);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');

    if (enterRules.length > 0) {
      newActions = enterRules.map(r => createDynamicAction(normalizedNewProject, r));
      nextBallHolder = normalizedNewProject.salesRep;
    } else {
      const result = generateActionsOnStatusChange(normalizedNewProject, normalizedNewProject.status, rules);
      if (result) {
        newActions = result.newActions;
        nextBallHolder = result.nextBallHolder;
      }
    }

    if (initialAction) {
      const normalizedInitialAction: NextAction = { ...initialAction, projectId: prodId };
      newActions = [normalizedInitialAction, ...newActions.filter(a => a.title !== normalizedInitialAction.title)];
      nextBallHolder = normalizedInitialAction.assignee || normalizedNewProject.salesRep;
    }

    const finalProject = { ...normalizedNewProject, ballHolder: nextBallHolder };
    await saveProjectToFirestore(finalProject);
    for (const act of newActions) {
      await saveActionToFirestore(act);
    }

    setProjects(prev => [finalProject, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const addProjectsBulk = (newProjects: Project[], newActions: NextAction[]) => {
    newProjects.forEach(p => saveProjectToFirestore(p));
    newActions.forEach(a => saveActionToFirestore(a));
    setProjects(prev => [...newProjects, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const renameProjectStatus = async (oldStatus: string, newStatus: string) => {
    setProjects(prev =>
      prev.map(p => {
        if (p.status !== oldStatus) return p;
        const updated = { ...p, status: newStatus };
        saveProjectToFirestore(updated);
        return updated;
      })
    );
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    // ステータス単独変更の場合は handleStatusChange を経由させて進捗フロー・カンバン・活動履歴を完全連動させる
    if (Object.keys(updates).length === 1 && updates.status) {
      await handleStatusChange(projectId, updates.status);
      return;
    }
    setProjects(prev => {
      const next = prev.map(p =>
        p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      );
      const target = next.find(p => p.id === projectId);
      if (target) {
        saveProjectToFirestore(target);
      }
      return next;
    });
  };

  const postponeAction = async (actionId: string, days: number) => {
    setActions(prev =>
      prev.map(a => {
        if (a.id === actionId) {
          const currentDeadline = new Date(a.deadline || new Date());
          currentDeadline.setDate(currentDeadline.getDate() + days);
          const yyyy = currentDeadline.getFullYear();
          const mm = String(currentDeadline.getMonth() + 1).padStart(2, '0');
          const dd = String(currentDeadline.getDate()).padStart(2, '0');
          const updated = { ...a, deadline: `${yyyy}-${mm}-${dd}` };
          saveActionToFirestore(updated);
          return updated;
        }
        return a;
      })
    );
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
          const updated: Project = {
            ...p,
            status: rule.nextStage && p.status !== '受注' && p.status !== '失注' ? rule.nextStage : p.status,
            probability: rule.autoProbability || p.probability,
            updatedAt: nowIso
          };
          saveProjectToFirestore(updated);
          return updated;
        })
      );
    }

    setActions(prev => {
      const markedDone = prev.map(a => {
        if (matchedIds.has(a.projectId) && a.status === '未完了') {
          const done = { ...a, status: '完了' as const, completedAt: nowIso };
          saveActionToFirestore(done);
          return done;
        }
        return a;
      });
      const generated = matched.map(p => {
        const act = createActionFromGlobalRule(p, rule);
        saveActionToFirestore(act);
        return act;
      });
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
      resetToRoster42,
      syncLocalToCloud,
      isCloudSyncing
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
