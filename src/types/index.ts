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

  // 導入予定日・キャッシュレス決済選択（複数組み合わせ可）
  cashlessOptions?: string[]; // ['credit', 'jcb_credit', 'emoney', 'qr']
  creditStatus?: string; // ■ クレジット (VISA / Mastercard 等の主要カード決済)
  jcbCreditStatus?: string; // ■ JCB系クレジット (JCB / American Express / Diners 等)
  emoneyStatus?: string; // ■ 電子マネー (交通系IC・iD・QUICPay・楽天Edy 等)
  qrStatus?: string; // ■ QR決済 (PayPay・楽天ペイ・d払い・au PAY 等)
}

export const CASHLESS_PAYMENT_CATEGORIES = [
  {
    id: 'credit',
    title: '■ クレジット',
    subtitle: 'VISA / Mastercard 等の主要カード決済',
    shortLabel: 'クレジット(VISA/Master)',
    statusKey: 'creditStatus' as const
  },
  {
    id: 'jcb_credit',
    title: '■ JCB系クレジット',
    subtitle: 'JCB / American Express / Diners 等',
    shortLabel: 'JCB系クレジット',
    statusKey: 'jcbCreditStatus' as const
  },
  {
    id: 'emoney',
    title: '■ 電子マネー',
    subtitle: '交通系IC・iD・QUICPay・楽天Edy 等',
    shortLabel: '電子マネー',
    statusKey: 'emoneyStatus' as const
  },
  {
    id: 'qr',
    title: '■ QR決済',
    subtitle: 'PayPay・楽天ペイ・d払い・au PAY 等',
    shortLabel: 'QR決済',
    statusKey: 'qrStatus' as const
  }
] as const;

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
 * 1件の活動履歴から対応する進捗フローステージを推定するヘルパー
 * isExplicitMove: カンバン・進捗フロー移動による明示的なステージ変更かどうか
 */
export function inferStageFromActivity(act: Activity): {
  stage: SalesProgressStage | '失注';
  isExplicitMove: boolean;
} | null {
  const text = `${act.type || ''} ${act.content || ''}`;

  // 1. 明示的なステージ移動ログ（例: ➔【kz送客】 / ステージ移動: 見積）
  const arrowMatch = text.match(/➔\s*【?([^】\s(]+)】?/);
  if (arrowMatch) {
    const target = arrowMatch[1].trim();
    if (target === '失注') return { stage: '失注', isExplicitMove: true };
    if ((SALES_PROGRESS_FLOW as readonly string[]).includes(target)) {
      return { stage: target as SalesProgressStage, isExplicitMove: true };
    }
  }
  const stageMoveMatch = text.match(/ステージ移動:\s*(問合せ|初動|デモ|見積|検討|後追い|kz送客|受注|失注)/);
  if (stageMoveMatch) {
    const target = stageMoveMatch[1];
    if (target === '失注') return { stage: '失注', isExplicitMove: true };
    return { stage: target as SalesProgressStage, isExplicitMove: true };
  }

  // 2. 通常の活動種別からの進捗ステージ推定
  if (text.includes('失注')) return { stage: '失注', isExplicitMove: true };
  if (text.includes('受注')) return { stage: '受注', isExplicitMove: false };
  if (text.includes('kz送客') || text.includes('KZ送客') || text.includes('補助金コンサル')) {
    return { stage: 'kz送客', isExplicitMove: false };
  }
  if (text.includes('後追いメール') || text.includes('【後追い】')) {
    return { stage: '後追い', isExplicitMove: false };
  }
  if (text.includes('相談メール') || text.includes('【検討】')) {
    return { stage: '検討', isExplicitMove: false };
  }
  if (text.includes('見積書送付') || text.includes('概算見積') || text.includes('見積提出') || text.includes('【見積】')) {
    return { stage: '見積', isExplicitMove: false };
  }
  if (
    text.includes('オンラインデモ') ||
    text.includes('訪問デモ') ||
    text.includes('来社デモ') ||
    text.includes('面談') ||
    text.includes('【デモ】')
  ) {
    return { stage: 'デモ', isExplicitMove: false };
  }
  if (
    text.includes('初動メール') ||
    text.includes('〇案内メール') ||
    text.includes('【会話】') ||
    text.includes('訪問') ||
    text.includes('ポスティング') ||
    text.includes('【折返待ち】') ||
    text.includes('【不在】') ||
    text.includes('架電')
  ) {
    return { stage: '初動', isExplicitMove: false };
  }
  if (text.includes('問合せ')) {
    return { stage: '問合せ', isExplicitMove: false };
  }
  return null;
}

/**
 * 活動履歴（これまでの活動）の修正・削除・追加後に、
 * 案件の進捗ステータス（進捗フロー・カンバン連動）・ポイント・各種アクション実施日・メモのフラグを自動同期するヘルパー
 */
export function syncProjectWithActivities(project: Project, nextActivities: Activity[]): Project {
  const totalPts = nextActivities.reduce((sum, act) => sum + inferActivityPoints(act), 0);
  const sortedDates = nextActivities
    .map(a => a.date)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  const latestDate = sortedDates[0] || project.receivedAt || project.lastActivityAt;

  // 活動履歴（index 0 が最新、末尾が最古）を時系列（最古 ➔ 最新）で走査して現在の進捗ステージを算出
  let syncedStatus: ProjectStatus = project.status === '失注' ? '失注' : '問合せ';
  if (nextActivities.length > 0) {
    const chronological = [...nextActivities].reverse();
    let stageCursor: SalesProgressStage | '失注' = '問合せ';
    for (const act of chronological) {
      const inferred = inferStageFromActivity(act);
      if (!inferred) continue;
      if (inferred.isExplicitMove) {
        // 明示的なステージ移動（後ろに戻す移動も含む）はそのステージへ直接セット
        stageCursor = inferred.stage;
      } else if (stageCursor === '失注') {
        stageCursor = inferred.stage;
      } else if (inferred.stage !== '失注') {
        // 通常の活動追加では、現在のステージより先のステージであれば前進、または最新アクションのステージへ連動
        const curIdx = SALES_PROGRESS_FLOW.indexOf(stageCursor);
        const nextIdx = SALES_PROGRESS_FLOW.indexOf(inferred.stage);
        if (inferred.stage === '初動' && curIdx > 1) {
          // 既にデモ・見積・検討以降に進んでいる状態での「架電/訪問」では初動に逆戻りさせない
          continue;
        }
        if (nextIdx >= 0) {
          stageCursor = inferred.stage;
        }
      }
    }
    syncedStatus = stageCursor;
  }

  const syncedStageIdx =
    syncedStatus === '失注' ? -1 : SALES_PROGRESS_FLOW.indexOf(syncedStatus as SalesProgressStage);

  const findLatestDateByKeyword = (keywords: string[]): string | undefined => {
    for (const act of nextActivities) {
      const text = `${act.type || ''} ${act.content || ''}`;
      // ステージ移動ログ自体は実施日キーワードから除外
      if (text.includes('進捗移動:') || text.includes('ステージ移動:')) continue;
      if (keywords.some(k => text.includes(k))) {
        return act.date;
      }
    }
    return undefined;
  };

  let initialEmailDate = findLatestDateByKeyword(['初動メール', '〇案内メール']);
  let estimateSentDate = findLatestDateByKeyword(['見積書送付']);
  const visitDate = findLatestDateByKeyword(['訪問 (+3p)', '現地訪問']);
  const postingDate = findLatestDateByKeyword(['ポスティング']);
  let consultEmailDate = findLatestDateByKeyword(['相談メール']);
  let followupEmailDate = findLatestDateByKeyword(['後追いメール']);
  let kzReferralDate = findLatestDateByKeyword(['kz送客', 'KZ送客', '補助金コンサル']);
  let orderDate = findLatestDateByKeyword(['受注']);

  let demoDate: string | undefined;
  let demoType: 'オンラインデモ' | '訪問デモ' | '来社デモ' | undefined;
  for (const act of nextActivities) {
    const text = `${act.type || ''} ${act.content || ''}`;
    if (text.includes('進捗移動:') || text.includes('ステージ移動:')) continue;
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

  // もし明示的なステージ移動で前の段階へ戻されている場合、それより後ろの段階の日付フラグをクリアして整合性を保つ
  if (syncedStageIdx >= 0) {
    if (syncedStageIdx < 7) orderDate = undefined;
    if (syncedStageIdx < 6) kzReferralDate = undefined;
    if (syncedStageIdx < 5) followupEmailDate = undefined;
    if (syncedStageIdx < 4) consultEmailDate = undefined;
    if (syncedStageIdx < 3) estimateSentDate = undefined;
    if (syncedStageIdx < 2) {
      demoDate = undefined;
      demoType = undefined;
    }
    if (syncedStageIdx < 1) initialEmailDate = undefined;
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
    status: syncedStatus,
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
