export type ProjectStatus = string;

export type ActionPriority = '高' | '中' | '低';

export type LostReasonType = '他社導入' | '金銭面' | 'その他';

export type QuickCallOutcome =
  | '会話'
  | '不在'
  | '折返待ち'
  | '面談設定'
  | '資料送付'
  | '初動メール'
  | '見積書送付'
  | 'オンラインデモ'
  | '訪問デモ'
  | '来社デモ'
  | '訪問'
  | 'ポスティング'
  | '相談メール'
  | '後追いメール'
  | 'kz送客'
  | '受注';

export const ACTION_POINT_RULES: Record<QuickCallOutcome, number> = {
  '会話': 3,
  '不在': 1,
  '折返待ち': 1,
  '初動メール': 5,
  '見積書送付': 5,
  'オンラインデモ': 5,
  '訪問デモ': 5,
  '来社デモ': 5,
  '訪問': 3,
  'ポスティング': 2,
  '相談メール': 3,
  '後追いメール': 2,
  'kz送客': 5,
  '受注': 10,
  '面談設定': 5,
  '資料送付': 2
};

export const SALES_PROGRESS_FLOW = [
  '問合せ',
  '初動',
  'デモ',
  '見積',
  '検討',
  '後追い',
  'kz送客',
  '受注'
] as const;

export type SalesProgressStage = typeof SALES_PROGRESS_FLOW[number];

/**
 * 案件が「ディーラー・パートナー企業（BtoB）」かどうかを判定するヘルパー
 */
export function isBtoBDealerProject(project: Project): boolean {
  const typeStr = project.clinicType || '';
  const srcStr = project.source || '';
  const nameStr = project.clinicName || '';
  if (typeStr.includes('ディーラー') || typeStr.includes('パートナー')) return true;
  if (srcStr.includes('BtoB') || srcStr.includes('ディーラー')) return true;
  if (
    nameStr.includes('コセキ') ||
    nameStr.includes('スズケン') ||
    nameStr.includes('歯科器材') ||
    nameStr.includes('メディカルサポート') ||
    nameStr.includes('株式会社三城') ||
    nameStr.includes('株式会社三櫻') ||
    nameStr.includes('株式会社フォールド')
  ) {
    return true;
  }
  return false;
}

/**
 * 既存・旧ステータス表記を進捗フロー8段階（問合せ・初動・デモ・見積・検討・後追い・kz送客・受注）に正規化するヘルパー
 * ※kz送客＝補助金コンサルタントへの送客（補助金採択後に受注）
 */
export function normalizeProgressStage(project: Project): SalesProgressStage {
  const s = project.status || '';
  if ((SALES_PROGRESS_FLOW as readonly string[]).includes(s)) {
    return s as SalesProgressStage;
  }
  if (s === 'KZ送客' || s === 'kz送客') {
    return 'kz送客';
  }
  if (s === '新規') {
    if (project.kzReferralDate || project.memo?.includes('kz送客済')) return 'kz送客';
    if (project.followupEmailDate || project.memo?.includes('後追いメール済')) return '後追い';
    if (project.consultEmailDate || project.memo?.includes('相談メール済')) return '検討';
    if (project.estimateSentDate || project.memo?.includes('見積書送付済')) return '見積';
    if (project.demoDate || project.memo?.includes('面談日:')) return 'デモ';
    if (project.initialEmailDate || project.memo?.includes('初動メール済')) return '初動';
    return '問合せ';
  }
  if (s === '商談') {
    if (project.kzReferralDate || project.memo?.includes('kz送客済')) return 'kz送客';
    if (project.followupEmailDate || project.memo?.includes('後追いメール済')) return '後追い';
    if (project.consultEmailDate || project.memo?.includes('相談メール済') || project.estimateSentDate) return '検討';
    if (project.demoDate || project.memo?.includes('面談日:')) return 'デモ';
    return '初動';
  }
  if (s === '概算見積' || s === '見積提出') return '見積';
  if (
    s === '契約' ||
    s === '楽々報告' ||
    s === 'CL希望' ||
    s === '補助受注' ||
    s === '現地調査' ||
    s === '設置日' ||
    s === '本番稼働' ||
    s === '完了'
  ) {
    return '受注';
  }
  return '問合せ';
}

// 新しい導入導線マップ（PDF準拠）
export interface PipelineMap {
  // 基本情報拡張
  corpId?: string; // 法人番号
  director?: string; // 院長
  receiptComputer?: string; // レセコン
  integrationMethod?: string; // 連携方法
  department?: string; // 診療科目

  // 機器・問合せ情報
  deviceType?: string; // テマサックタイプ
  bodyColor?: string; // カラー
  changeMachineColor?: string; // 釣銭機カラー
  inquiryType?: string; // 問合種別
  purpose?: string; // 導入目的

  // 補助金情報
  subsidyName?: string; // 補助金
  subsidyNextApp?: string; // 申込
  referralDeadline?: string; // 稟議送客締日
  applicationDeadline?: string; // 締切日

  // 各種確認・準備状況
  competitor?: string; // 競合
  triggerMethodCheck?: boolean; // トリガー方法確認
  hpsEstimateReply?: boolean; // HPS見積注文書返信
  magnetPrep?: boolean; // マグネット準備
  signageData?: boolean; // サイネージデータ
  threePieceSetPrep?: boolean; // 3点セット準備
  bmposPcPrep?: boolean; // BMPOS用PC準備
  constructionCheck?: boolean; // 工事手配確認
  shippingCheck?: boolean; // 出荷手配確認

  // 導入予定日（キャッシュレス）
  creditStatus?: string; // クレ
  emoneyStatus?: string; // 電マ
  qrStatus?: string; // QR
}

export interface Activity {
  id: string;
  projectId?: string;
  date: string;
  type: string;
  content: string;
  points?: number; // この活動で獲得したクリニックポイント
}

export interface InstallationInfo {
  location: string;
  powerSupply: string;
  lan: string;
  internetEnv: string;
  elevator: string;
  notes: string;
}

export interface Photo {
  id: string;
  url: string;
  type: '受付全景' | '設置予定場所' | '搬入経路' | '精算機現状' | 'その他';
  comment: string;
  uploadedAt: string;
}

export interface Project {
  id: string;
  clinicName: string;
  clinicType: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  contactTitle: string;
  memo: string;
  source: string;
  sourceDetail?: string; // 紹介元など
  receivedAt: string; // 受付日
  salesRep: string; // 担当営業
  product: string;
  quantity: number;
  status: ProjectStatus;
  priority: ActionPriority;
  lastActivityAt: string;
  ballHolder: string; // ボール所持者（誰のターンか）
  isImplementationProject: boolean; // 導入進行中の案件かどうか（タブ切り替え用）
  
  probability?: 'A' | 'B' | 'C' | 'D'; // 契約確度
  aiSummary?: string; // AIによる3行要約
  aiRecommendation?: string; // AIからの推奨アクション
  activities?: Activity[]; // 活動履歴
  installationInfo?: InstallationInfo; // 現地情報
  photos?: Photo[]; // 関連写真
  lostReason?: string; // 失注理由

  pipelineMap?: PipelineMap; // 導入導線マップ（PDF追加分）
  
  surveyDate?: string;
  installationDate?: string;

  // クリニック別ポイント制（累計獲得ポイント）
  clinicPoints?: number;

  // アクション管理用フィールド
  initialEmailDate?: string; // 初動メール送付日 (+5p)
  estimateSentDate?: string; // 見積書送付日 (+5p)
  demoType?: 'オンラインデモ' | '訪問デモ' | '来社デモ'; // デモ種別 (+5p)
  demoDate?: string; // デモ実施予定日・実施日
  visitDate?: string; // 訪問実施日 (+3p)
  postingDate?: string; // ポスティング実施日 (+2p)
  consultEmailDate?: string; // 相談メール送付日 (+3p)
  followupEmailDate?: string; // 後追いメール送付日 (+2p)
  kzReferralDate?: string; // kz送客日（補助金コンサルタント送客日 +5p）
  orderDate?: string; // 受注日 (+10p)
  
  clinicHours?: string;
  closedDays?: string;
  websiteUrl?: string;
  reservationSystem?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * 活動履歴1件あたりのポイントを推定・取得するヘルパー
 */
export function inferActivityPoints(act: Activity): number {
  if (typeof act.points === 'number') return act.points;
  const text = `${act.type || ''} ${act.content || ''}`;
  const explicitMatch = text.match(/\+(\d+)\s*p/i);
  if (explicitMatch) {
    return parseInt(explicitMatch[1], 10);
  }
  if (text.includes('初動メール') || text.includes('〇案内メール')) return 5;
  if (text.includes('見積書送付')) return 5;
  if (text.includes('kz送客') || text.includes('KZ送客') || text.includes('補助金コンサル')) return 5;
  if (text.includes('オンラインデモ') || text.includes('訪問デモ') || text.includes('来社デモ') || text.includes('面談')) return 5;
  if (text.includes('相談メール')) return 3;
  if (text.includes('後追いメール')) return 2;
  if (text.includes('受注')) return 10;
  if (text.includes('訪問')) return 3;
  if (text.includes('ポスティング')) return 2;
  if (text.includes('【会話】')) return 3;
  if (text.includes('【折返待ち】')) return 1;
  if (text.includes('【不在】')) return 1;
  return 0;
}

/**
 * クリニック（Project）の累計獲得ポイントを計算するヘルパー
 */
export function getClinicTotalPoints(project: Project): number {
  if (Array.isArray(project.activities)) {
    const sumFromActs = project.activities.reduce((sum, act) => sum + inferActivityPoints(act), 0);
    if (project.activities.length > 0 || project.clinicPoints !== undefined) {
      return sumFromActs;
    }
  }
  if (typeof project.clinicPoints === 'number') {
    return project.clinicPoints;
  }
  return 0;
}

/**
 * 活動履歴（これまでの活動）の修正・削除・追加後に、
 * 案件のポイント・各種アクション実施日・メモのフラグを自動同期するヘルパー
 */
export function syncProjectWithActivities(project: Project, nextActivities: Activity[]): Project {
  const totalPts = nextActivities.reduce((sum, act) => sum + inferActivityPoints(act), 0);
  const sortedDates = nextActivities
    .map(a => a.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  const latestDate = sortedDates[0] || project.receivedAt || project.lastActivityAt;

  const findLatestDateByKeyword = (keywords: string[]): string | undefined => {
    for (const act of nextActivities) {
      const text = `${act.type || ''} ${act.content || ''}`;
      if (keywords.some(k => text.includes(k))) {
        return act.date;
      }
    }
    return undefined;
  };

  const initialEmailDate = findLatestDateByKeyword(['初動メール', '〇案内メール']);
  const estimateSentDate = findLatestDateByKeyword(['見積書送付']);
  const visitDate = findLatestDateByKeyword(['訪問 (+3p)', '現地訪問']);
  const postingDate = findLatestDateByKeyword(['ポスティング']);
  const consultEmailDate = findLatestDateByKeyword(['相談メール']);
  const followupEmailDate = findLatestDateByKeyword(['後追いメール']);
  const kzReferralDate = findLatestDateByKeyword(['kz送客', 'KZ送客', '補助金コンサル']);
  const orderDate = findLatestDateByKeyword(['受注']);

  let demoDate: string | undefined;
  let demoType: 'オンラインデモ' | '訪問デモ' | '来社デモ' | undefined;
  for (const act of nextActivities) {
    const text = `${act.type || ''} ${act.content || ''}`;
    if (text.includes('オンラインデモ')) {
      demoDate = act.date;
      demoType = 'オンラインデモ';
      break;
    }
    if (text.includes('訪問デモ')) {
      demoDate = act.date;
      demoType = '訪問デモ';
      break;
    }
    if (text.includes('来社デモ')) {
      demoDate = act.date;
      demoType = '来社デモ';
      break;
    }
  }

  // メモ内のアクションタグも同期更新
  let memo = project.memo || '';
  if (!initialEmailDate) {
    memo = memo.replace(/\s*\|\s*初動メール済\([^)]*\)/g, '');
  } else if (memo.includes('初動メール済(')) {
    memo = memo.replace(/初動メール済\([^)]*\)/g, `初動メール済(${initialEmailDate})`);
  }
  if (!estimateSentDate) {
    memo = memo.replace(/\s*\|\s*見積書送付済\([^)]*\)/g, '');
  } else if (memo.includes('見積書送付済(')) {
    memo = memo.replace(/見積書送付済\([^)]*\)/g, `見積書送付済(${estimateSentDate})`);
  }
  if (!visitDate) {
    memo = memo.replace(/\s*\|\s*訪問済\([^)]*\)/g, '');
  } else if (memo.includes('訪問済(')) {
    memo = memo.replace(/訪問済\([^)]*\)/g, `訪問済(${visitDate})`);
  }
  if (!postingDate) {
    memo = memo.replace(/\s*\|\s*ポスティング済\([^)]*\)/g, '');
  } else if (memo.includes('ポスティング済(')) {
    memo = memo.replace(/ポスティング済\([^)]*\)/g, `ポスティング済(${postingDate})`);
  }
  if (!consultEmailDate) {
    memo = memo.replace(/\s*\|\s*相談メール済\([^)]*\)/g, '');
  } else if (memo.includes('相談メール済(')) {
    memo = memo.replace(/相談メール済\([^)]*\)/g, `相談メール済(${consultEmailDate})`);
  }
  if (!followupEmailDate) {
    memo = memo.replace(/\s*\|\s*後追いメール済\([^)]*\)/g, '');
  } else if (memo.includes('後追いメール済(')) {
    memo = memo.replace(/後追いメール済\([^)]*\)/g, `後追いメール済(${followupEmailDate})`);
  }
  if (!kzReferralDate) {
    memo = memo.replace(/\s*\|\s*kz送客済\([^)]*\)/g, '');
  } else if (memo.includes('kz送客済(')) {
    memo = memo.replace(/kz送客済\([^)]*\)/g, `kz送客済(${kzReferralDate})`);
  }
  if (!orderDate) {
    memo = memo.replace(/\s*\|\s*受注済\([^)]*\)/g, '');
  } else if (memo.includes('受注済(')) {
    memo = memo.replace(/受注済\([^)]*\)/g, `受注済(${orderDate})`);
  }
  if (!demoDate) {
    memo = memo.replace(/\s*\|\s*面談日:\s*[^|]+/g, '');
  } else if (memo.includes('面談日:')) {
    memo = memo.replace(/面談日:\s*[^|]+/, `面談日: ${demoDate}(${demoType || '面談・デモ'}) `);
  }

  return {
    ...project,
    activities: nextActivities,
    clinicPoints: totalPts,
    lastActivityAt: latestDate,
    initialEmailDate,
    estimateSentDate,
    demoDate,
    demoType,
    visitDate,
    postingDate,
    consultEmailDate,
    followupEmailDate,
    kzReferralDate,
    orderDate,
    memo: memo.trim(),
    updatedAt: new Date().toISOString()
  };
}

export interface NextAction {
  id: string;
  projectId: string;
  title: string;
  assignee: string; // 担当者
  deadline: string; // 期限
  priority: ActionPriority;
  status: '未完了' | '完了' | '延期';
  memo: string; // なぜこのアクションが必要か等のメモ
  completedAt?: string;
  createdAt: string;
}

export type LaneType = '営業' | '導入担当' | '現調担当' | '設置担当';

export interface WorkflowRule {
  id: string;
  type: 'タスク生成' | '通知' | 'ステータス変更';
  trigger: '進入時' | '完了時' | '期限超過時';
  actionDetail: string; // 例：「初回連絡タスクを生成」
}

export interface WorkflowNode {
  id: string;
  title: string;
  lane: LaneType;
  standardDays: number;
  assigneeRole: string; // デフォルト担当者ロール
  rules: WorkflowRule[];
  nextNodes: string[]; // 分岐対応（複数可）
  isParallel?: boolean; // キャッシュレスやカラーなど並行して進むタスク用
}
