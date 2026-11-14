import {
  getClinicTotalPoints,
  isBtoBDealerProject,
  normalizeProgressStage
} from '../types';
import type { ProjectStatus, NextAction, ActionPriority, Project, QuickCallOutcome } from '../types';
import type { GlobalRule } from '../context/RuleContext';
import { addDays, differenceInDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

/**
 * 期限日付を計算してISO文字列で返す
 */
const calculateDeadline = (days: number, baseDateStr?: string): string => {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  const validBase = isNaN(base.getTime()) ? new Date() : base;
  return format(addDays(validBase, days), 'yyyy-MM-dd');
};

/**
 * GlobalRuleからNextActionオブジェクトを生成する
 */
export const createActionFromGlobalRule = (
  project: Project,
  rule: GlobalRule,
  baseDateStr?: string
): NextAction => {
  const assignee =
    !rule.actionAssignee || rule.actionAssignee === '自社営業'
      ? project.salesRep || '松浦 貴文'
      : rule.actionAssignee;

  const hintSuffix = rule.aiDraftHint
    ? ` [💡AIメール推奨: ${rule.aiDraftHint}]`
    : '';

  return {
    id: uuidv4(),
    projectId: project.id,
    title: rule.actionTitle,
    assignee,
    deadline: calculateDeadline(rule.actionDaysToDeadline ?? 1, baseDateStr),
    priority: rule.actionPriority || '高',
    status: '未完了',
    memo: `${rule.actionMemo || ''}${hintSuffix}`,
    createdAt: format(new Date(), 'yyyy-MM-dd')
  };
};

export const createDynamicAction = (project: Project, rule: any): NextAction => {
  return {
    id: uuidv4(),
    projectId: project.id,
    title: rule.actionDetail,
    assignee: project.salesRep,
    deadline: calculateDeadline(Number(rule.daysToDeadline) || 3),
    priority: '中',
    status: '未完了',
    memo: 'ワークフロー自動生成',
    createdAt: format(new Date(), 'yyyy-MM-dd')
  };
};

/**
 * ルールのターゲット枠（クリニック直販枠 / BtoBディーラー別枠）およびAND条件を判定する
 */
export const evaluateRuleCondition = (project: Project, rule: GlobalRule): boolean => {
  // 1. クリニック直販枠 vs BtoBディーラー別枠 フィルタ
  if (rule.targetSegment === 'clinic_only' && isBtoBDealerProject(project)) {
    return false;
  }
  if (rule.targetSegment === 'btob_only' && !isBtoBDealerProject(project)) {
    return false;
  }

  // 2. 追加AND条件
  if (!rule.conditionField) return true;

  let projectValue = '';
  if (rule.conditionField === 'status') {
    projectValue = project.status === '失注' ? '失注' : normalizeProgressStage(project);
  } else if (rule.conditionField === 'clinicPoints') {
    projectValue = String(getClinicTotalPoints(project));
  } else if (rule.conditionField in project) {
    projectValue = String((project as any)[rule.conditionField] || '');
  } else if (project.pipelineMap && rule.conditionField in project.pipelineMap) {
    projectValue = String((project.pipelineMap as any)[rule.conditionField] || '');
  }

  const targetValue = rule.conditionValue || '';
  const op = rule.conditionOperator || 'equals';

  if (op === 'equals') {
    return projectValue === targetValue;
  }
  if (op === 'not_equals') {
    return projectValue !== targetValue;
  }
  if (op === 'contains') {
    return projectValue.toLowerCase().includes(targetValue.toLowerCase());
  }
  if (op === 'gte') {
    return Number(projectValue) >= Number(targetValue);
  }

  return true;
};

/**
 * 超かんたん司令室のワンクリックアクション実行時（またはポイント到達時）に発火するルールを評価
 */
export const evaluateRulesOnQuickAction = (
  project: Project,
  callOutcome: QuickCallOutcome,
  nextClinicPts: number,
  rules: GlobalRule[],
  actionDate?: string
): {
  matchedRule: GlobalRule;
  nextAction: NextAction;
  nextStage?: string;
  autoProbability?: 'A' | 'B' | 'C';
} | null => {
  // 1) アクション直接トリガー (`action_recorded`)
  const actionRule = rules.find(
    r =>
      r.isActive &&
      r.triggerType === 'action_recorded' &&
      r.triggerValue === callOutcome &&
      evaluateRuleCondition(project, r)
  );

  // 2) ポイント到達トリガー (`points_reached`)
  const prevPts = getClinicTotalPoints(project);
  const pointRule = rules.find(r => {
    if (!r.isActive || r.triggerType !== 'points_reached') return false;
    const threshold = parseInt(r.triggerValue, 10);
    if (isNaN(threshold)) return false;
    return prevPts < threshold && nextClinicPts >= threshold && evaluateRuleCondition(project, r);
  });

  const chosenRule = pointRule || actionRule;
  if (!chosenRule) return null;

  return {
    matchedRule: chosenRule,
    nextAction: createActionFromGlobalRule(project, chosenRule, actionDate),
    nextStage: chosenRule.nextStage,
    autoProbability: chosenRule.autoProbability
  };
};

/**
 * 現在の全案件リストに対して、指定したルールに今すぐ合致している案件をスキャンする（シミュレーター＆一括適用用）
 */
export const scanMatchingProjectsForRule = (
  projects: Project[],
  rule: GlobalRule
): Project[] => {
  return projects.filter(p => {
    if (!evaluateRuleCondition(p, rule)) return false;

    if (rule.triggerType === 'lost_archived') {
      if (p.status !== '失注') return false;
      return (p.lostReason || '').includes(rule.triggerValue);
    }

    // 失注以外の営業中案件を対象
    if (p.status === '失注') return false;

    const stage = normalizeProgressStage(p);
    const pts = getClinicTotalPoints(p);
    const memo = p.memo || '';

    if (rule.triggerType === 'status_changed') {
      return stage === rule.triggerValue || p.status === rule.triggerValue;
    }

    if (rule.triggerType === 'points_reached') {
      const threshold = parseInt(rule.triggerValue, 10) || 10;
      return pts >= threshold && stage !== '受注';
    }

    if (rule.triggerType === 'stagnant_days') {
      const minDays = parseInt(rule.triggerValue, 10) || 5;
      const diff = differenceInDays(new Date(), new Date(p.lastActivityAt || p.receivedAt || new Date()));
      return diff >= minDays && stage !== '受注';
    }

    if (rule.triggerType === 'action_recorded') {
      const tv = rule.triggerValue;
      if (tv === '初動メール') return !!(p.initialEmailDate || memo.includes('初動メール済') || memo.includes('〇メール済'));
      if (tv === '見積書送付') return !!(p.estimateSentDate || memo.includes('見積書送付済'));
      if (tv === 'オンラインデモ' || tv === '訪問デモ' || tv === '来社デモ') {
        return p.demoType === tv || memo.includes(tv);
      }
      if (tv === '訪問') return !!(p.visitDate || memo.includes('訪問済'));
      if (tv === 'ポスティング') return !!(p.postingDate || memo.includes('ポスティング済'));
      if (tv === '相談メール') return !!(p.consultEmailDate || memo.includes('相談メール済'));
      if (tv === '後追いメール') return !!(p.followupEmailDate || memo.includes('後追いメール済'));
      if (tv === 'kz送客') return !!(p.kzReferralDate || stage === 'kz送客' || memo.includes('kz送客済'));
      if (tv === '受注') return !!(p.orderDate || stage === '受注' || memo.includes('受注済'));
      if (tv === '会話') return memo.includes('架電状況: 会話');
      if (tv === '不在') return memo.includes('架電状況: 不在');
      if (tv === '折返待ち') return memo.includes('架電状況: 折返待ち');
    }

    return false;
  });
};

/**
 * ステータス変更時に発火するルールエンジン
 */
export const generateActionsOnStatusChange = (
  project: Project,
  newStatus: ProjectStatus,
  rules: GlobalRule[]
): { newActions: NextAction[]; nextBallHolder: string } | null => {
  const activeRules = rules.filter(
    r =>
      r.isActive &&
      r.triggerType === 'status_changed' &&
      r.triggerValue === newStatus &&
      evaluateRuleCondition(project, r)
  );
  if (activeRules.length === 0) return null;

  const newActions = activeRules.map(rule => createActionFromGlobalRule(project, rule));
  const nextBallHolder =
    activeRules[0].actionAssignee === '自社営業'
      ? project.salesRep
      : activeRules[0].actionAssignee;

  return { newActions, nextBallHolder };
};

/**
 * タスク完了時に発火するルールエンジン
 */
export const generateActionsOnTaskCompletion = (
  project: Project,
  completedTaskTitle: string,
  rules: GlobalRule[]
): { newActions: NextAction[]; nextBallHolder: string } | null => {
  const activeRules = rules.filter(
    r =>
      r.isActive &&
      r.triggerType === 'task_completed' &&
      r.triggerValue === completedTaskTitle &&
      evaluateRuleCondition(project, r)
  );
  if (activeRules.length === 0) return null;

  const newActions = activeRules.map(rule => createActionFromGlobalRule(project, rule));
  const nextBallHolder =
    activeRules[0].actionAssignee === '自社営業'
      ? project.salesRep
      : activeRules[0].actionAssignee;

  return { newActions, nextBallHolder };
};
