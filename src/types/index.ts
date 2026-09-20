export type ProjectStatus = string;

export type ActionPriority = '高' | '中' | '低';

// 新しい導入導線マップ（PDF準拠）
export interface PipelineMap {
  // 基本情報拡張
  corpId?: string; // 法人番号
  establishedAt?: string; // 設立年月日
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
  
  clinicHours?: string;
  closedDays?: string;
  websiteUrl?: string;
  reservationSystem?: string;

  createdAt: string;
  updatedAt: string;
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
