import type { ProjectStatus, NextAction, ActionPriority, Project } from '../types';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

type GeneratedActionInfo = {
  title: string;
  daysToDeadline: number;
  ballHolder: string;
  priority: ActionPriority;
  memo: string;
};

// ステータス変更時のルール定義
const statusChangeRules: Partial<Record<ProjectStatus, GeneratedActionInfo[]>> = {
  '資料請求': [
    { title: '初回連絡', daysToDeadline: 1, ballHolder: '自社営業', priority: '高', memo: '資料到着の確認とヒアリング' }
  ],
  'アポイント取得': [
    { title: '商談準備', daysToDeadline: 1, ballHolder: '自社営業', priority: '中', memo: '提案資料・ヒアリングシートの準備' }
  ],
  '商談': [
    { title: 'ヒアリングシート整理', daysToDeadline: 0, ballHolder: '自社営業', priority: '高', memo: '商談内容のまとめと次のステップ検討' }
  ],
  '見積作成': [
    { title: '見積書作成・社内承認', daysToDeadline: 3, ballHolder: '自社営業', priority: '高', memo: '見積書作成後、上長承認' }
  ],
  '見積提出': [
    { title: '見積フォロー電話', daysToDeadline: 3, ballHolder: '自社営業', priority: '高', memo: '見積提出後の状況確認' }
  ],
  '検討中': [
    { title: '状況確認フォロー', daysToDeadline: 7, ballHolder: '自社営業', priority: '中', memo: '検討状況の定期フォロー' }
  ],
  '契約': [
    { title: 'キャッシュレス申込案内', daysToDeadline: 3, ballHolder: 'お客様', priority: '高', memo: 'お客様へ申込URLと必要書類の案内' },
    { title: '本体カラー確認', daysToDeadline: 3, ballHolder: 'お客様', priority: '高', memo: 'カラーバリエーションの案内と確定' },
    { title: '現地調査 日程調整', daysToDeadline: 3, ballHolder: 'お客様', priority: '高', memo: '現調希望日のヒアリング' }
  ]
};

// タスク完了時のルール定義（特定のタスクが終わったら次を生成する）
const taskCompletionRules: Record<string, GeneratedActionInfo[]> = {
  '初回連絡': [
    { title: '再連絡', daysToDeadline: 3, ballHolder: '自社営業', priority: '中', memo: 'アポが取れていない場合の再フォロー' }
  ],
  '現地調査 日程調整': [
    { title: '現地調査実施', daysToDeadline: 7, ballHolder: '現調担当', priority: '高', memo: '現地調査の実施' }
  ],
  '現地調査実施': [
    { title: '設置条件確認・設置日確定', daysToDeadline: 3, ballHolder: '自社営業', priority: '高', memo: '現調結果に基づく設置日調整' }
  ],
  '設置条件確認・設置日確定': [
    { title: '設置準備（機器手配）', daysToDeadline: 7, ballHolder: '設置担当', priority: '高', memo: '機器の出荷準備・手配' }
  ],
  '設置準備（機器手配）': [
    { title: 'キャッシュレス設定・動作確認', daysToDeadline: 0, ballHolder: '設置担当', priority: '高', memo: '設置当日の設定作業' }
  ],
  'キャッシュレス設定・動作確認': [
    { title: '操作説明・引渡し', daysToDeadline: 0, ballHolder: '設置担当', priority: '高', memo: 'クリニックスタッフへの説明' }
  ],
  '操作説明・引渡し': [
    { title: '導入事例写真の確認・完了処理', daysToDeadline: 3, ballHolder: '自社営業', priority: '中', memo: '導入事例掲載のお願いなど' }
  ]
};

/**
 * 期限日付を計算してISO文字列で返す
 */
const calculateDeadline = (days: number): string => {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
};

/**
 * GlobalRuleからNextActionオブジェクトを生成する
 */
export const createActionFromGlobalRule = (project: Project, rule: any): NextAction => {
  return {
    id: uuidv4(),
    projectId: project.id,
    title: rule.actionTitle,
    assignee: rule.actionAssignee === '自社営業' ? project.salesRep : rule.actionAssignee,
    deadline: calculateDeadline(rule.actionDaysToDeadline),
    priority: rule.actionPriority,
    status: '未完了',
    memo: rule.actionMemo,
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
  };
};

const evaluateRuleCondition = (project: Project, rule: any): boolean => {
  if (!rule.conditionField) return true;

  let projectValue = '';
  // `project` オブジェクト直下の項目か、`pipelineMap` 内の項目かを自動判定して取得
  if (rule.conditionField in project) {
    projectValue = String((project as any)[rule.conditionField] || '');
  } else if (project.pipelineMap && rule.conditionField in project.pipelineMap) {
    projectValue = String((project.pipelineMap as any)[rule.conditionField] || '');
  }

  const targetValue = rule.conditionValue || '';

  if (rule.conditionOperator === 'equals') {
    return projectValue === targetValue;
  } else if (rule.conditionOperator === 'not_equals') {
    return projectValue !== targetValue;
  }

  return true;
};

/**
 * ステータス変更時に発火するルールエンジン
 */
export const generateActionsOnStatusChange = (project: Project, newStatus: ProjectStatus, rules: any[]): { newActions: NextAction[], nextBallHolder: string } | null => {
  const activeRules = rules.filter(r => 
    r.isActive && 
    r.triggerType === 'status_changed' && 
    r.triggerValue === newStatus &&
    evaluateRuleCondition(project, r)
  );
  if (activeRules.length === 0) return null;

  const newActions = activeRules.map(rule => createActionFromGlobalRule(project, rule));
  
  // ボール保持者は最初に生成されるアクションのものを優先
  const nextBallHolder = activeRules[0].actionAssignee === '自社営業' ? project.salesRep : activeRules[0].actionAssignee;
  
  return { newActions, nextBallHolder };
};

/**
 * タスク完了時に発火するルールエンジン
 */
export const generateActionsOnTaskCompletion = (project: Project, completedTaskTitle: string, rules: any[]): { newActions: NextAction[], nextBallHolder: string } | null => {
  const activeRules = rules.filter(r => 
    r.isActive && 
    r.triggerType === 'task_completed' && 
    r.triggerValue === completedTaskTitle &&
    evaluateRuleCondition(project, r)
  );
  if (activeRules.length === 0) return null;

  const newActions = activeRules.map(rule => createActionFromGlobalRule(project, rule));
  
  const nextBallHolder = activeRules[0].actionAssignee === '自社営業' ? project.salesRep : activeRules[0].actionAssignee;

  return { newActions, nextBallHolder };
};
