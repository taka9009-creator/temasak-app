import type { Project, NextAction } from '../types';
import { addDays, format } from 'date-fns';

const today = new Date();
const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const initialProjects: Project[] = [
  {
    id: 'p-1',
    clinicName: 'テストクリニック',
    clinicType: '内科',
    address: '東京都新宿区',
    phone: '03-1111-2222',
    email: 'info@test.com',
    contactPerson: '松浦 貴文',
    contactTitle: '院長',
    memo: '',
    source: 'Web',
    receivedAt: formatDate(addDays(today, -10)),
    salesRep: '松浦 貴文',
    product: '自動精算機',
    quantity: 1,
    status: '見積提出',
    priority: '高',
    lastActivityAt: formatDate(addDays(today, -8)),
    ballHolder: '自社営業',
    isImplementationProject: false,
    probability: 'B',
    aiSummary: '見積提出済み',
    aiRecommendation: 'フォローコール推奨',
    createdAt: formatDate(addDays(today, -10)),
    updatedAt: formatDate(addDays(today, -8))
  }
];

export const initialActions: NextAction[] = [
  {
    id: 'a-1',
    projectId: 'p-1',
    title: '見積フォロー',
    assignee: '松浦 貴文',
    deadline: formatDate(addDays(today, 2)),
    priority: '高',
    status: '未完了',
    memo: '',
    createdAt: formatDate(addDays(today, -8))
  }
];
