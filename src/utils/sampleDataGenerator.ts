import { v4 as uuidv4 } from 'uuid';
import { format, subDays, addDays } from 'date-fns';
import type { Project, NextAction } from '../types';

export function generateFieldTestSamples(userName: string = '松浦 貴文') {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(now, 2), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(now, 5), 'yyyy-MM-dd');

  // 1. さくら内科クリニック（本日対応の最優先商談）
  const id1 = uuidv4();
  const project1: Project = {
    id: id1,
    clinicName: 'さくら内科クリニック',
    clinicType: '内科',
    address: '東京都世田谷区桜新町1-2-3',
    phone: '03-3456-7890',
    email: 'info@sakura-naika.jp',
    contactPerson: '桜井 健太 院長',
    contactTitle: '院長',
    memo: '自動釣銭機とレセコン連携を検討中。会計待ち時間の解消が最重要課題。',
    source: 'LP反響',
    receivedAt: todayStr,
    salesRep: userName,
    product: 'テマサック自動精算機 (卓上モデル)',
    quantity: 1,
    status: '新規',
    priority: '高',
    lastActivityAt: todayStr,
    ballHolder: userName,
    isImplementationProject: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const action1: NextAction = {
    id: uuidv4(),
    projectId: id1,
    title: '初回電話ヒアリング（レセコン型番確認）',
    assignee: userName,
    deadline: todayStr,
    priority: '高',
    status: '未完了',
    memo: '午前中の休診時間（12:30〜13:30）に院長先生宛てにTEL',
    createdAt: new Date().toISOString()
  };

  // 2. 中央整形外科クリニック（⚠️ 2日超過アラート案件）
  const id2 = uuidv4();
  const project2: Project = {
    id: id2,
    clinicName: '中央整形外科クリニック',
    clinicType: '整形外科',
    address: '神奈川県横浜市西区みなとみらい2-4',
    phone: '045-123-4567',
    email: 'chuo-ortho@clinic.com',
    contactPerson: '中村 事務長',
    contactTitle: '事務長',
    memo: 'リハビリ患者が多く混雑緩和のため2台導入を検討。見積書の提示待ち。',
    source: 'BtoB紹介',
    receivedAt: format(subDays(now, 5), 'yyyy-MM-dd'),
    salesRep: userName,
    product: 'テマサック自動精算機 (独立型)',
    quantity: 2,
    status: '提案中',
    priority: '高',
    lastActivityAt: yesterdayStr,
    ballHolder: userName,
    isImplementationProject: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const action2: NextAction = {
    id: uuidv4(),
    projectId: id2,
    title: '見積書・概算ROI試算表の送付',
    assignee: userName,
    deadline: yesterdayStr, // 期限切れテスト用
    priority: '高',
    status: '未完了',
    memo: '至急作成してPDFメール送信。2台同時導入割引を適用',
    createdAt: new Date().toISOString()
  };

  // 3. ひまわり小児科医院（明日アポイント）
  const id3 = uuidv4();
  const project3: Project = {
    id: id3,
    clinicName: 'ひまわり小児科医院',
    clinicType: '小児科',
    address: '東京都杉並区荻窪3-10',
    phone: '03-5555-8888',
    email: 'himawari-pediatrics@gmail.com',
    contactPerson: '日向 陽子 院長',
    contactTitle: '院長',
    memo: 'キャッシュレス決済（QR・電子マネー）と非接触会計を希望。',
    source: '展示会',
    receivedAt: todayStr,
    salesRep: userName,
    product: 'テマサック自動精算機',
    quantity: 1,
    status: '商談中',
    priority: '中',
    lastActivityAt: todayStr,
    ballHolder: userName,
    isImplementationProject: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const action3: NextAction = {
    id: uuidv4(),
    projectId: id3,
    title: '14:00 訪問デモ・実機実演（カタログ・決済端末持参）',
    assignee: userName,
    deadline: tomorrowStr,
    priority: '中',
    status: '未完了',
    memo: '荻窪駅前。デモ機の動作確認・スタッフへの操作説明',
    createdAt: new Date().toISOString()
  };

  // 4. 緑が丘眼科クリニック（現地調査・先方ボール）
  const id4 = uuidv4();
  const project4: Project = {
    id: id4,
    clinicName: '緑が丘眼科クリニック',
    clinicType: '眼科',
    address: '千葉県船橋市本町1-5',
    phone: '047-999-0000',
    email: 'midori-eye@net.jp',
    contactPerson: '緑川 院長',
    contactTitle: '院長',
    memo: '受付カウンターの設置寸法・LAN配線ルートの確認が必要。',
    source: '直接受付',
    receivedAt: todayStr,
    salesRep: userName,
    product: 'テマサック自動精算機',
    quantity: 1,
    status: '現調調整中',
    priority: '中',
    lastActivityAt: todayStr,
    ballHolder: 'クリニック（先方）',
    isImplementationProject: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const action4: NextAction = {
    id: uuidv4(),
    projectId: id4,
    title: '現地調査日程の回答受領・確認',
    assignee: userName,
    deadline: nextWeekStr,
    priority: '中',
    status: '未完了',
    memo: '院長が工務店と図面確認後に連絡予定',
    createdAt: new Date().toISOString()
  };

  return {
    projects: [project1, project2, project3, project4],
    actions: [action1, action2, action3, action4]
  };
}
