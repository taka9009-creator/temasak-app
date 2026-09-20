import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ActionPriority } from '../types';

export interface GlobalRule {
  id: string;
  name: string;
  isActive: boolean;
  
  triggerType: 'status_changed' | 'task_completed';
  triggerValue: string;
  
  actionType: 'create_task';
  actionTitle: string;
  actionDaysToDeadline: number;
  actionAssignee: string;
  actionPriority: ActionPriority;
  actionMemo: string;

  // AND If Conditions
  conditionField?: string;
  conditionOperator?: 'equals' | 'not_equals';
  conditionValue?: string;
}

const defaultRules: GlobalRule[] = [
  // Status Change Rules
  { id: uuidv4(), name: '資料請求フォロー', isActive: true, triggerType: 'status_changed', triggerValue: '資料請求', actionType: 'create_task', actionTitle: '初回連絡', actionDaysToDeadline: 1, actionAssignee: '自社営業', actionPriority: '高', actionMemo: '資料到着の確認とヒアリング' },
  { id: uuidv4(), name: 'アポ準備', isActive: true, triggerType: 'status_changed', triggerValue: 'アポイント取得', actionType: 'create_task', actionTitle: '商談準備', actionDaysToDeadline: 1, actionAssignee: '自社営業', actionPriority: '中', actionMemo: '提案資料・ヒアリングシートの準備' },
  { id: uuidv4(), name: '商談整理', isActive: true, triggerType: 'status_changed', triggerValue: '商談', actionType: 'create_task', actionTitle: 'ヒアリングシート整理', actionDaysToDeadline: 0, actionAssignee: '自社営業', actionPriority: '高', actionMemo: '商談内容のまとめと次のステップ検討' },
  { id: uuidv4(), name: '見積作成', isActive: true, triggerType: 'status_changed', triggerValue: '見積作成', actionType: 'create_task', actionTitle: '見積書作成・社内承認', actionDaysToDeadline: 3, actionAssignee: '自社営業', actionPriority: '高', actionMemo: '見積書作成後、上長承認' },
  { id: uuidv4(), name: '見積提出後フォロー', isActive: true, triggerType: 'status_changed', triggerValue: '見積提出', actionType: 'create_task', actionTitle: '見積フォロー電話', actionDaysToDeadline: 3, actionAssignee: '自社営業', actionPriority: '高', actionMemo: '見積提出後の状況確認' },
  { id: uuidv4(), name: '検討中フォロー', isActive: true, triggerType: 'status_changed', triggerValue: '検討中', actionType: 'create_task', actionTitle: '状況確認フォロー', actionDaysToDeadline: 7, actionAssignee: '自社営業', actionPriority: '中', actionMemo: '検討状況の定期フォロー' },
  { id: uuidv4(), name: 'CL申込案内', isActive: true, triggerType: 'status_changed', triggerValue: '契約', actionType: 'create_task', actionTitle: 'キャッシュレス申込案内', actionDaysToDeadline: 3, actionAssignee: 'お客様', actionPriority: '高', actionMemo: 'お客様へ申込URLと必要書類の案内' },
  { id: uuidv4(), name: 'カラー確認', isActive: true, triggerType: 'status_changed', triggerValue: '契約', actionType: 'create_task', actionTitle: '本体カラー確認', actionDaysToDeadline: 3, actionAssignee: 'お客様', actionPriority: '高', actionMemo: 'カラーバリエーションの案内と確定' },
  { id: uuidv4(), name: '現調日程調整', isActive: true, triggerType: 'status_changed', triggerValue: '契約', actionType: 'create_task', actionTitle: '現地調査 日程調整', actionDaysToDeadline: 3, actionAssignee: 'お客様', actionPriority: '高', actionMemo: '現調希望日のヒアリング' },
  
  // Task Completion Rules
  { id: uuidv4(), name: '初回再連絡', isActive: true, triggerType: 'task_completed', triggerValue: '初回連絡', actionType: 'create_task', actionTitle: '再連絡', actionDaysToDeadline: 3, actionAssignee: '自社営業', actionPriority: '中', actionMemo: 'アポが取れていない場合の再フォロー' },
  { id: uuidv4(), name: '現調実施', isActive: true, triggerType: 'task_completed', triggerValue: '現地調査 日程調整', actionType: 'create_task', actionTitle: '現地調査実施', actionDaysToDeadline: 7, actionAssignee: '現調担当', actionPriority: '高', actionMemo: '現地調査の実施' },
  { id: uuidv4(), name: '設置日確定', isActive: true, triggerType: 'task_completed', triggerValue: '現地調査実施', actionType: 'create_task', actionTitle: '設置条件確認・設置日確定', actionDaysToDeadline: 3, actionAssignee: '自社営業', actionPriority: '高', actionMemo: '現調結果に基づく設置日調整' },
  { id: uuidv4(), name: '機器手配', isActive: true, triggerType: 'task_completed', triggerValue: '設置条件確認・設置日確定', actionType: 'create_task', actionTitle: '設置準備（機器手配）', actionDaysToDeadline: 7, actionAssignee: '設置担当', actionPriority: '高', actionMemo: '機器の出荷準備・手配' },
  { id: uuidv4(), name: 'CL設定', isActive: true, triggerType: 'task_completed', triggerValue: '設置準備（機器手配）', actionType: 'create_task', actionTitle: 'キャッシュレス設定・動作確認', actionDaysToDeadline: 0, actionAssignee: '設置担当', actionPriority: '高', actionMemo: '設置当日の設定作業' },
  { id: uuidv4(), name: '引渡し', isActive: true, triggerType: 'task_completed', triggerValue: 'キャッシュレス設定・動作確認', actionType: 'create_task', actionTitle: '操作説明・引渡し', actionDaysToDeadline: 0, actionAssignee: '設置担当', actionPriority: '高', actionMemo: 'クリニックスタッフへの説明' },
  { id: uuidv4(), name: '完了処理', isActive: true, triggerType: 'task_completed', triggerValue: '操作説明・引渡し', actionType: 'create_task', actionTitle: '導入事例写真の確認・完了処理', actionDaysToDeadline: 3, actionAssignee: '自社営業', actionPriority: '中', actionMemo: '導入事例掲載のお願いなど' }
];

interface RuleContextType {
  rules: GlobalRule[];
  addRule: (rule: Omit<GlobalRule, 'id'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<GlobalRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
}

const RuleContext = createContext<RuleContextType | undefined>(undefined);

import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

export function RuleProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<GlobalRule[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setRules([]);
      return;
    }

    const rulesQuery = query(collection(db, 'rules'), where('user_id', '==', user.id));
    const unsubscribe = onSnapshot(rulesQuery, (snapshot) => {
      const formattedRules: GlobalRule[] = snapshot.docs.map(docSnap => {
        const r = docSnap.data();
        return {
          id: docSnap.id,
          name: r.name || '',
          isActive: !!r.is_active,
          triggerType: r.trigger_type as any,
          triggerValue: r.trigger_value || '',
          actionType: r.action_type as any,
          actionTitle: r.action_title || '',
          actionDaysToDeadline: r.action_days_to_deadline ?? 1,
          actionAssignee: r.action_assignee || '',
          actionPriority: (r.action_priority as any) || '中',
          actionMemo: r.action_memo || '',
          conditionField: r.condition_field,
          conditionOperator: r.condition_operator as any,
          conditionValue: r.condition_value
        };
      });
      setRules(formattedRules);
    }, (error) => {
      console.error('Firestore rules error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const addRule = async (rule: Omit<GlobalRule, 'id'>) => {
    const newId = uuidv4();
    const newRule = { ...rule, id: newId };
    setRules(prev => [...prev, newRule]);
    
    if (user) {
      try {
        const dbRule = {
          id: newId,
          name: rule.name,
          is_active: rule.isActive,
          trigger_type: rule.triggerType,
          trigger_value: rule.triggerValue,
          action_type: rule.actionType,
          action_title: rule.actionTitle,
          action_days_to_deadline: rule.actionDaysToDeadline,
          action_assignee: rule.actionAssignee,
          action_priority: rule.actionPriority,
          action_memo: rule.actionMemo,
          condition_field: rule.conditionField || '',
          condition_operator: rule.conditionOperator || '',
          condition_value: rule.conditionValue || '',
          user_id: user.id
        };
        const ruleRef = doc(db, 'rules', newId);
        await setDoc(ruleRef, dbRule);
      } catch (e) {
        console.error('Error adding rule in Firestore:', e);
      }
    }
  };

  const updateRule = async (id: string, updates: Partial<GlobalRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    
    if (user) {
      try {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
        if (updates.triggerType !== undefined) dbUpdates.trigger_type = updates.triggerType;
        if (updates.triggerValue !== undefined) dbUpdates.trigger_value = updates.triggerValue;
        if (updates.actionType !== undefined) dbUpdates.action_type = updates.actionType;
        if (updates.actionTitle !== undefined) dbUpdates.action_title = updates.actionTitle;
        if (updates.actionDaysToDeadline !== undefined) dbUpdates.action_days_to_deadline = updates.actionDaysToDeadline;
        if (updates.actionAssignee !== undefined) dbUpdates.action_assignee = updates.actionAssignee;
        if (updates.actionPriority !== undefined) dbUpdates.action_priority = updates.actionPriority;
        if (updates.actionMemo !== undefined) dbUpdates.action_memo = updates.actionMemo;
        if (updates.conditionField !== undefined) dbUpdates.condition_field = updates.conditionField;
        if (updates.conditionOperator !== undefined) dbUpdates.condition_operator = updates.conditionOperator;
        if (updates.conditionValue !== undefined) dbUpdates.condition_value = updates.conditionValue;

        const ruleRef = doc(db, 'rules', id);
        await updateDoc(ruleRef, dbUpdates);
      } catch (e) {
        console.error('Error updating rule in Firestore:', e);
      }
    }
  };

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (user) {
      try {
        const ruleRef = doc(db, 'rules', id);
        await deleteDoc(ruleRef);
      } catch (e) {
        console.error('Error deleting rule in Firestore:', e);
      }
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    const newIsActive = !rule.isActive;
    
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: newIsActive } : r));
    if (user) {
      try {
        const ruleRef = doc(db, 'rules', id);
        await updateDoc(ruleRef, { is_active: newIsActive });
      } catch (e) {
        console.error('Error toggling rule in Firestore:', e);
      }
    }
  };

  return (
    <RuleContext.Provider value={{ rules, addRule, updateRule, deleteRule, toggleRule }}>
      {children}
    </RuleContext.Provider>
  );
}

export function useRules() {
  const context = useContext(RuleContext);
  if (context === undefined) {
    throw new Error('useRules must be used within a RuleProvider');
  }
  return context;
}
