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

// 新しい導入導線マップ（医療機関様向け 導入・お手続きガイド PDF全10ページ完全準拠）
export type IntroPhaseId = 'PHASE1' | 'PHASE2' | 'PHASE3' | 'PHASE4';

export interface PipelineMap {
  // 基本情報拡張
  corpId?: string; // 法人番号
  director?: string; // 院長
  receiptComputer?: string; // レセコン
  integrationMethod?: string; // 連携方法
  department?: string; // 診療科目
  entityType?: '医療法人（法人）' | '個人事業主'; // 法人 or 個人事業主（登記事項全部証明書の要否判定用）

  // PDF Page 2: 4つの導入フェーズ (PHASE 1〜PHASE 4)
  introPhase?: IntroPhaseId;

  // PDF Page 3-5: 7 STEP 仕様選択
  deviceType?: string; // テマサックタイプ
  bodyColor?: string; // STEP 1: 本体カラー（基本オールカラー3種 / 側面オプション6種）
  changeMachineColor?: string; // STEP 2: 釣銭機カラー（ホワイト / ダークグレー）
  screenColor?: string; // STEP 3: 画面カラー（全9色）
  signageMode?: string; // STEP 4: サイネージ選択（方式A:スライド1枚 / 方式B:スライド5枚以内 / 方式C:動画YouTube）
  signageYoutubeUrl?: string; // STEP 4: YouTube動画URL（方式Cの場合）
  stampDataSource?: string; // STEP 4: 領収印・サイネージデータ準備（弊社簡易作製[事後修正不可] / 医院様データご支給）
  triggerMethod?: string; // STEP 5: 精算開始トリガー選択（全9種）
  bmposPcOption?: string; // STEP 7: BM-POS用PC選択（選択肢①：新規購入（推奨） / 選択肢②：所有（既存PCご用意））
  bmposSpecCpuCheck?: boolean; // STEP 7: 所有PCスペック確認（Core i5 第11世代以上）
  bmposSpecRamCheck?: boolean; // STEP 7: 所有PCスペック確認（メモリ 8GB以上）
  bmposSpecDedicatedCheck?: boolean; // STEP 7: 所有PCスペック確認（BM-POS専用機・他ソフト相乗り不可）

  inquiryType?: string; // 問合種別
  purpose?: string; // 導入目的

  // PDF Page 6-7 & Page 10: デジタル化AI導入補助金 ＆ KIZASHI（kz）申請・公的書類3点＋GbizID・2回支払い管理
  subsidyName?: string; // 補助金枠（インボイス枠[インボイス対応類型]★注目 / 通常枠 等）
  subsidyNextApp?: string; // 申込回次（例：第7次申請締切 6/19 等）
  referralDeadline?: string; // 申請前準備目安日（例：〜5/12）
  applicationDeadline?: string; // 申請締切日（例：6/19）
  grantDecisionDate?: string; // 交付決定予定日・決定日（例：7/29）

  // 事前準備：3つの公的書類 ＋ 1アカウント (PDF Page 7)
  docTaxCert?: boolean; // 【書類①】前年度の納税証明書
  docTaxReturn?: boolean; // 【書類②】確定申告書（控え一式）
  docRegistryCert?: boolean; // 【書類③】登記事項全部証明書（法人のみ・個人事業主は不要）
  gbizIdPrimeStatus?: '未取得' | '申請中' | '取得済'; // 【アカウント①】GbizID（ジービズIDプライム）

  // KIZASHI（kz）リード 3 STEP (PDF Page 7)
  kzStep1ConsentSent?: boolean; // STEP 1: ②補助金同意書 署名捺印・スキャンメール送信（原本医院保管）
  kzStep2Contacted?: boolean; // STEP 2: コンサルタント（KIZASHI）からの連絡・スケジュール確認済
  kzStep3Applied?: boolean; // STEP 3: ⑤コンサルタントのリードによる補助金申請完了
  kzGrantAdopted?: boolean; // 補助金 交付決定（採択決定）済

  // 2回のお支払い管理 (PDF Page 2 & Page 10)
  payment1KzFeeStatus?: '未請求' | '請求書発送済' | '支払完了'; // 1回目: ⑦KIZASHI報酬（交付決定時・本体設置前に支払必須）
  payment2TemasakStatus?: '未請求' | '請求書発送済' | '支払完了'; // 2回目: ●テマサック代金＋2年分保守料（本体設置完了時）
  orderSheetCreated?: boolean; // PHASE 3: ●テマサックご注文書作成

  // スムーズな導入スタートに向けた最初の4つのアクション (PDF Page 10: ACT 1〜ACT 4)
  act1DocsReady?: boolean; // ACT 1: GbizID・公的書類3点準備
  act2ConsentSent?: boolean; // ACT 2: 同意書・希望シート署名捺印メール送信（原本保管）
  act3SurveyReady?: boolean; // ACT 3: 現地調査日程調整・事前準備書類（レセコンIP・プロバイダ書類）用意
  act4SpecsDecided?: boolean; // ACT 4: 7 STEP 仕様・データ（サイネージ・領収印）決定

  // 各種確認・準備状況（旧互換含む）
  competitor?: string; // 競合
  triggerMethodCheck?: boolean; // トリガー方法確認
  hpsEstimateReply?: boolean; // HPS見積注文書返信
  magnetPrep?: boolean; // マグネット準備
  signageData?: boolean; // サイネージデータ
  threePieceSetPrep?: boolean; // 3点セット準備
  bmposPcPrep?: boolean; // BMPOS用PC準備
  constructionCheck?: boolean; // 工事手配確認
  shippingCheck?: boolean; // 出荷手配確認

  // STEP 6 & PDF Page 8: キャッシュレス決済選択（複数組み合わせ可）＆ ジャックス審査4ステップ
  cashlessOptions?: string[]; // ['credit', 'jcb_credit', 'emoney', 'qr']
  creditStatus?: string; // ■ クレジット (VISA / Mastercard 等の主要カード決済)
  jcbCreditStatus?: string; // ■ JCB系クレジット (JCB / American Express / Diners 等)
  emoneyStatus?: string; // ■ 電子マネー (交通系IC・iD・QUICPay・楽天Edy 等)
  qrStatus?: string; // ■ QR決済 (PayPay・楽天ペイ・d払い・au PAY 等)
  cashlessReviewStep?: '未着手' | 'STEP1_希望シート作成' | 'STEP2_署名メール送信' | 'STEP3_ジャックス連絡済' | 'STEP4_審査書類準備中' | 'クレジット審査通過（設置OK）' | '全決済審査完了';
  creditApprovedForInstall?: boolean; // 【重要】本体設置の必須前提条件：クレジット審査通過済
  qrEmoneyApproved?: boolean; // 電子マネー・QR決済審査完了（+1か月以上長期化注意）

  // PDF Page 9: ④現地調査 5つの確認チェックリスト
  surveyCheck1TemasakSpace?: boolean; // 確認1: 自動精算機テマサックの設置場所（スペース・電源・LAN）確認
  surveyCheck2BmposSpace?: boolean; // 確認2: BM-POS用PCの設置場所（主に受付内・電源・LAN）確認
  surveyCheck3RececomIp?: boolean; // 確認3: レセコンなどのIPアドレス確認【要事前準備】
  surveyCheck4Network?: boolean; // 確認4: 院内（レセコン連携）・院外（インターネット通信）ネットワーク状況確認
  surveyCheck5ProviderDoc?: boolean; // 確認5: プロバイダの申し込み内容が分かる書類の確認【要事前準備】
  rececomIpMemo?: string; // 確認3: レセコンIPアドレス・設定情報メモ
  providerDocMemo?: string; // 確認5: プロバイダ・回線種別メモ
  powerLanConstructionNeeded?: '不要（既存設備でOK）' | '要増設工事（電源・LAN手配中）' | '増設工事完了'; // 電源・LAN増設工事の要否
}

// PDF Page 2: 導入4フェーズ定義
export const INTRO_FOUR_PHASES: {
  id: IntroPhaseId;
  title: string;
  subtitle: string;
  badgeColor: string;
  headerBg: string;
  items: string[];
}[] = [
  {
    id: 'PHASE1',
    title: 'PHASE 1｜申請前準備',
    subtitle: '①GbizID・②同意書・③CL希望シート・④現地調査',
    badgeColor: '#1e3a8a',
    headerBg: '#eff6ff',
    items: [
      '① GbizID取得（プライム）',
      '② 補助金申請同意書ご記入（スキャン送信・原本保管）',
      '③ キャッシュレス導入希望シート',
      '④ 現地調査（弊社担当者訪問）'
    ]
  },
  {
    id: 'PHASE2',
    title: 'PHASE 2｜申請〜交付決定前',
    subtitle: '⑤補助金申請・⑥CL申込・●7STEP仕様・●見積書',
    badgeColor: '#1d4ed8',
    headerBg: '#dbeafe',
    items: [
      '⑤ 補助金申請（KIZASHIサポート付き）',
      '⑥ キャッシュレス打合・申込（ジャックス連絡）',
      '● テマサック仕様確認（7 STEP）',
      '● お見積書作成（補助金申請用）'
    ]
  },
  {
    id: 'PHASE3',
    title: 'PHASE 3｜補助金交付決定後',
    subtitle: '⑦kz報酬支払（設置前必須）・●注文書・●設置日程調整',
    badgeColor: '#c2410c',
    headerBg: '#ffedd5',
    items: [
      '⑦ コンサルタント報酬お支払い（KIZASHI宛・設置前に支払）',
      '● テマサックご注文書作成',
      '● 搬入・設置日程の最終調整'
    ]
  },
  {
    id: 'PHASE4',
    title: 'PHASE 4｜本番稼働・ご精算',
    subtitle: '●本体設置（クレカ審査通過前提）・●本体＋2年保守精算',
    badgeColor: '#047857',
    headerBg: '#d1fae5',
    items: [
      '● 本体設置・操作説明（※クレジット審査通過が前提）',
      '● テマサック代金お支払い（本体代金＋2年分の保守料）'
    ]
  }
];

// PDF Page 3: STEP 1 本体カラー選択（基本オールカラー3種 / 側面オプション6種）
export const TEMASAK_BODY_COLORS = [
  { id: 'オールホワイト', label: 'オールホワイト', category: '基本オールカラー', mainHex: '#f8fafc', sideHex: '#f8fafc' },
  { id: 'オールブラック', label: 'オールブラック', category: '基本オールカラー', mainHex: '#1e293b', sideHex: '#1e293b' },
  { id: 'オールシルバー', label: 'オールシルバー', category: '基本オールカラー', mainHex: '#cbd5e1', sideHex: '#cbd5e1' },
  { id: 'ホワイト×シルバー', label: 'ホワイト×シルバー', category: '側面オプション', mainHex: '#f8fafc', sideHex: '#cbd5e1' },
  { id: 'ホワイト×ブラック', label: 'ホワイト×ブラック', category: '側面オプション', mainHex: '#f8fafc', sideHex: '#1e293b' },
  { id: 'ブラック×シルバー', label: 'ブラック×シルバー', category: '側面オプション', mainHex: '#1e293b', sideHex: '#cbd5e1' },
  { id: 'ブラック×ホワイト', label: 'ブラック×ホワイト', category: '側面オプション', mainHex: '#1e293b', sideHex: '#f8fafc' },
  { id: 'シルバー×ブラック', label: 'シルバー×ブラック', category: '側面オプション', mainHex: '#cbd5e1', sideHex: '#1e293b' },
  { id: 'シルバー×ホワイト', label: 'シルバー×ホワイト', category: '側面オプション', mainHex: '#cbd5e1', sideHex: '#f8fafc' }
] as const;

// PDF Page 3: STEP 2 釣銭機カラー選択（2色）
export const TEMASAK_CHANGE_MACHINE_COLORS = [
  { id: 'ホワイト', label: 'ホワイト', subtitle: '明るく清潔感のある標準カラー', hex: '#f8fafc' },
  { id: 'ダークグレー', label: 'ダークグレー', subtitle: 'シックで落ち着いた高コントラスト色', hex: '#334155' }
] as const;

// PDF Page 4: STEP 3 画面カラー選択（全9色）
export const TEMASAK_SCREEN_COLORS = [
  { id: 'テマサックオレンジ', label: 'テマサックオレンジ', hex: '#ea580c' },
  { id: 'ピンク', label: 'ピンク', hex: '#ec4899' },
  { id: 'ブルー', label: 'ブルー', hex: '#2563eb' },
  { id: 'ブラウン', label: 'ブラウン', hex: '#78350f' },
  { id: 'グリーン', label: 'グリーン', hex: '#16a34a' },
  { id: 'ライトブルー', label: 'ライトブルー', hex: '#38bdf8' },
  { id: 'グレー', label: 'グレー', hex: '#64748b' },
  { id: 'サクラ', label: 'サクラ', hex: '#f472b6' },
  { id: 'ライトパープル', label: 'ライトパープル', hex: '#a855f7' }
] as const;

// PDF Page 4: STEP 4 サイネージ選択（3方式）
export const TEMASAK_SIGNAGE_MODES = [
  {
    id: '方式A：スライド（1枚）',
    label: '方式A：スライド（1枚）',
    subtitle: '静止画1枚を常時表示するシンプルな案内方式です。休診日案内や基本案内に適しています。'
  },
  {
    id: '方式B：スライド（5枚以内）',
    label: '方式B：スライド（5枚以内）',
    subtitle: '最大5枚までの静止画スライドを順番に切り替えて表示します。複数の院内告知に最適です。'
  },
  {
    id: '方式C：動画（YouTubeのURL）',
    label: '方式C：動画（YouTubeのURL）',
    subtitle: 'YouTubeにアップロードされた動画URLを指定して再生します。視覚的なPRに活用できます。'
  }
] as const;

// PDF Page 4: STEP 5 精算開始トリガー選択（3系統・全9種）
export const TEMASAK_TRIGGER_METHODS = [
  { id: '① テプラ診察券', group: '■ 診察券・アプリ系', label: '① テプラ診察券' },
  { id: '② リライトカード', group: '■ 診察券・アプリ系', label: '② リライトカード' },
  { id: '③ 診察券アプリ', group: '■ 診察券・アプリ系', label: '③ 診察券アプリ' },
  { id: '④ 明細書QR', group: '■ 明細書・領収書 印字系', label: '④ 明細書QR' },
  { id: '⑤ 明細書バーコード', group: '■ 明細書・領収書 印字系', label: '⑤ 明細書バーコード' },
  { id: '⑥ 領収書QR', group: '■ 明細書・領収書 印字系', label: '⑥ 領収書QR' },
  { id: '⑦ 領収書バーコード', group: '■ 明細書・領収書 印字系', label: '⑦ 領収書バーコード' },
  { id: '⑧ バーコードプリント', group: '■ 単票プリント出力系', label: '⑧ バーコードプリント' },
  { id: '⑨ QRプリント', group: '■ 単票プリント出力系', label: '⑨ QRプリント' }
] as const;

// PDF Page 5: STEP 7 BM-POS用PC選択（2択）
export const TEMASAK_BMPOS_PC_OPTIONS = [
  {
    id: '選択肢①：新規購入（推奨）',
    label: '選択肢①：新規購入（推奨）',
    subtitle: '動作検証済みのBM-POS専用PCをテマサックと合わせて新規手配します。'
  },
  {
    id: '選択肢②：所有（既存PCご用意）',
    label: '選択肢②：所有（既存PCご用意）',
    subtitle: '医院様でお持ちのPCを使用します（Core i5第11世代以上・メモリ8GB以上・BM-POS専用機に限ります）。'
  }
] as const;

// PDF Page 6: デジタル化AI導入補助金 枠・類型
export const SUBSIDY_FRAME_OPTIONS = [
  {
    id: 'インボイス枠（インボイス対応類型）★注目',
    label: 'インボイス枠（インボイス対応類型）★注目',
    rate: 'ソフト50万以下 3/4（小規模 4/5）・50万超 2/3 ／ PC〜10万(1/2) ／ 精算機〜20万(1/2)',
    target: '会計・受発注・決済ソフト、クラウド利用料(最大2年分)、導入関連費、ハード購入費'
  },
  {
    id: '通常枠',
    label: '通常枠',
    rate: '5万〜450万円以下【補助率 1/2】',
    target: 'ソフト購入費、クラウド利用料（最大2年分）、導入関連費'
  },
  {
    id: 'インボイス枠（電子取引類型）',
    label: 'インボイス枠（電子取引類型）',
    rate: '〜350万円【補助率 中小2/3・大企業1/2】',
    target: 'クラウド利用料（最大2年分）'
  },
  {
    id: '複数社連携IT導入枠',
    label: '複数社連携IT導入枠',
    rate: '最大3,000万円・事務費専門家費上限200万円(2/3)',
    target: 'インボイス対応類型経費＋消費動向分析費・事務費'
  },
  {
    id: 'セキュリティ対策推進枠',
    label: 'セキュリティ対策推進枠',
    rate: '5万〜100万円【補助率 1/2】',
    target: 'セキュリティサービス利用料（最大2年分）'
  },
  {
    id: '補助金なし（通常導入）',
    label: '補助金なし（通常導入）',
    rate: '自己資金・リース等での導入',
    target: '本体一式＋保守'
  }
] as const;

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

/**
 * 案件の「7 STEP 仕様決定率」「公的書類3点＋GbizID準備率」「現地調査5項目確認率」「導入フェーズ」「3大ストッパー」を集計するヘルパー
 */
export function getProjectSpecAndGateSummary(project: Project) {
  const pm = project.pipelineMap || {};
  const selectedCashless = Array.isArray(pm.cashlessOptions)
    ? pm.cashlessOptions
    : [
        pm.creditStatus ? 'credit' : null,
        pm.jcbCreditStatus ? 'jcb_credit' : null,
        pm.emoneyStatus ? 'emoney' : null,
        pm.qrStatus ? 'qr' : null
      ].filter(Boolean) as string[];

  // 7 STEP 完了判定
  const step1Done = !!pm.bodyColor;
  const step2Done = !!pm.changeMachineColor;
  const step3Done = !!pm.screenColor;
  const step4Done = !!pm.signageMode;
  const step5Done = !!pm.triggerMethod;
  const step6Done = selectedCashless.length > 0;
  const step7Done = !!pm.bmposPcOption;
  const specCompletedCount = [
    step1Done,
    step2Done,
    step3Done,
    step4Done,
    step5Done,
    step6Done,
    step7Done
  ].filter(Boolean).length;

  // 公的書類3点 ＋ GbizIDプライム (個人事業主の場合は登記事項全部証明書は不要＝自動クリア扱い)
  const isIndividual = pm.entityType === '個人事業主';
  const doc1Done = !!pm.docTaxCert;
  const doc2Done = !!pm.docTaxReturn;
  const doc3Done = isIndividual ? true : !!pm.docRegistryCert;
  const gbizDone = pm.gbizIdPrimeStatus === '取得済';
  const docsReadyCount = [doc1Done, doc2Done, doc3Done, gbizDone].filter(Boolean).length;

  // 現地調査 5項目
  const surveyReadyCount = [
    !!pm.surveyCheck1TemasakSpace,
    !!pm.surveyCheck2BmposSpace,
    !!pm.surveyCheck3RececomIp,
    !!pm.surveyCheck4Network,
    !!pm.surveyCheck5ProviderDoc
  ].filter(Boolean).length;

  // 導入4フェーズ判定
  let introPhase: IntroPhaseId = pm.introPhase || 'PHASE1';
  if (!pm.introPhase) {
    if (pm.payment2TemasakStatus === '支払完了' || project.installationDate) {
      introPhase = 'PHASE4';
    } else if (pm.kzGrantAdopted || normalizeProgressStage(project) === '受注') {
      introPhase = 'PHASE3';
    } else if (pm.kzStep1ConsentSent || specCompletedCount >= 4) {
      introPhase = 'PHASE2';
    } else {
      introPhase = 'PHASE1';
    }
  }

  const hasQrOrEmoney = selectedCashless.includes('qr') || selectedCashless.includes('emoney');
  const creditApproved = !!pm.creditApprovedForInstall || pm.cashlessReviewStep === 'クレジット審査通過（設置OK）' || pm.cashlessReviewStep === '全決済審査完了';
  const kzFeePaid = pm.payment1KzFeeStatus === '支払完了';

  return {
    specCompletedCount,
    docsReadyCount,
    surveyReadyCount,
    introPhase,
    selectedCashless,
    hasQrOrEmoney,
    creditApproved,
    kzFeePaid
  };
}

/**
 * pipelineMap や surveyDate / installationDate などの更新時に、
 * ACT1〜4・導入4フェーズ(PHASE1〜4)・営業8段階ステータス(kz送客/受注)・活動履歴を双方向で自動連動させるヘルパー
 */
export function autoSyncProjectUpdates(project: Project, updates: Partial<Project>): Project {
  const todayStr = new Date().toISOString().slice(0, 10);
  const prevPm = project.pipelineMap || {};
  const incomingPm = updates.pipelineMap ? { ...prevPm, ...updates.pipelineMap } : { ...prevPm };

  // 1. キャッシュレス選択配列と各ステータス文字列の相互同期
  let cashlessOptions = Array.isArray(incomingPm.cashlessOptions)
    ? [...incomingPm.cashlessOptions]
    : [
        incomingPm.creditStatus ? 'credit' : null,
        incomingPm.jcbCreditStatus ? 'jcb_credit' : null,
        incomingPm.emoneyStatus ? 'emoney' : null,
        incomingPm.qrStatus ? 'qr' : null
      ].filter(Boolean) as string[];

  if (updates.pipelineMap) {
    // もし個別ステータスが入力されていて cashlessOptions が明示指定されていなければ自動追加
    if (!('cashlessOptions' in updates.pipelineMap)) {
      if (incomingPm.creditStatus && incomingPm.creditStatus !== '不要' && !cashlessOptions.includes('credit')) {
        cashlessOptions.push('credit');
      }
      if (incomingPm.jcbCreditStatus && incomingPm.jcbCreditStatus !== '不要' && !cashlessOptions.includes('jcb_credit')) {
        cashlessOptions.push('jcb_credit');
      }
      if (incomingPm.emoneyStatus && incomingPm.emoneyStatus !== '不要' && !cashlessOptions.includes('emoney')) {
        cashlessOptions.push('emoney');
      }
      if (incomingPm.qrStatus && incomingPm.qrStatus !== '不要' && !cashlessOptions.includes('qr')) {
        cashlessOptions.push('qr');
      }
    }
  }
  incomingPm.cashlessOptions = cashlessOptions;

  // 2. 7 STEP・書類3点＋GbizID・現地調査5項目の達成度から ACT 1〜ACT 4 を自動連動
  const isIndividual = incomingPm.entityType === '個人事業主';
  const allDocsDone =
    !!incomingPm.docTaxCert &&
    !!incomingPm.docTaxReturn &&
    (isIndividual ? true : !!incomingPm.docRegistryCert) &&
    incomingPm.gbizIdPrimeStatus === '取得済';

  const all7StepsDone =
    !!incomingPm.bodyColor &&
    !!incomingPm.changeMachineColor &&
    !!incomingPm.screenColor &&
    !!incomingPm.signageMode &&
    !!incomingPm.triggerMethod &&
    cashlessOptions.length > 0 &&
    !!incomingPm.bmposPcOption;

  const nextSurveyDate = updates.surveyDate !== undefined ? updates.surveyDate : project.surveyDate;
  const nextInstallDate = updates.installationDate !== undefined ? updates.installationDate : project.installationDate;

  const surveyPrepDone =
    (!!incomingPm.surveyCheck3RececomIp && !!incomingPm.surveyCheck5ProviderDoc) ||
    [
      incomingPm.surveyCheck1TemasakSpace,
      incomingPm.surveyCheck2BmposSpace,
      incomingPm.surveyCheck3RececomIp,
      incomingPm.surveyCheck4Network,
      incomingPm.surveyCheck5ProviderDoc
    ].filter(Boolean).length >= 3;

  if (updates.pipelineMap && !('act1DocsReady' in updates.pipelineMap) && allDocsDone) {
    incomingPm.act1DocsReady = true;
  }
  if (
    updates.pipelineMap &&
    !('act2ConsentSent' in updates.pipelineMap) &&
    incomingPm.kzStep1ConsentSent &&
    cashlessOptions.length > 0
  ) {
    incomingPm.act2ConsentSent = true;
  }
  if (updates.pipelineMap && !('act3SurveyReady' in updates.pipelineMap) && surveyPrepDone) {
    incomingPm.act3SurveyReady = true;
  }
  if (updates.pipelineMap && !('act4SpecsDecided' in updates.pipelineMap) && all7StepsDone) {
    incomingPm.act4SpecsDecided = true;
  }

  // 3. KIZASHIステップ・交付決定・2回支払い・導入4フェーズ ⇔ 営業8段階ステータス（kz送客 / 受注）＆活動履歴の双方向連動
  let nextStatus: ProjectStatus = updates.status !== undefined ? updates.status : project.status;
  let nextKzReferralDate = updates.kzReferralDate !== undefined ? updates.kzReferralDate : project.kzReferralDate;
  let nextOrderDate = updates.orderDate !== undefined ? updates.orderDate : project.orderDate;
  let nextMemo = updates.memo !== undefined ? updates.memo : project.memo || '';
  let nextActivities = updates.activities !== undefined ? [...updates.activities] : [...(project.activities || [])];
  let nextProb = updates.probability !== undefined ? updates.probability : project.probability;

  const explicitIntroPhaseChange = updates.pipelineMap && 'introPhase' in updates.pipelineMap;
  const explicitKzAdoptedChange = updates.pipelineMap && 'kzGrantAdopted' in updates.pipelineMap;
  const explicitPayment2Change = updates.pipelineMap && 'payment2TemasakStatus' in updates.pipelineMap;
  const explicitKzStepChange =
    updates.pipelineMap &&
    ('kzStep1ConsentSent' in updates.pipelineMap ||
      'kzStep2Contacted' in updates.pipelineMap ||
      'kzStep3Applied' in updates.pipelineMap);

  if (explicitKzAdoptedChange) {
    if (incomingPm.kzGrantAdopted) {
      // 交付決定（採択）ON ➔ 営業ステータス「受注」＆ 導入フェーズ「PHASE 3」へ自動連動
      nextStatus = '受注';
      incomingPm.introPhase = 'PHASE3';
      nextOrderDate = nextOrderDate || todayStr;
      nextProb = 'A';
      if (!nextMemo.includes('受注済')) {
        nextMemo = `${nextMemo} | 受注済(${nextOrderDate})`.trim();
      }
      nextActivities = [
        {
          id: `act-sync-${Date.now()}`,
          projectId: project.id,
          date: todayStr,
          type: '🎉 補助金交付決定（採択）➔【受注】',
          content: '補助金の交付決定（採択）に伴い、進捗フロー・カンバンを「受注（PHASE 3｜補助金交付決定後）」へ自動連動しました。',
          points: project.orderDate ? 0 : 10
        },
        ...nextActivities
      ];
    } else if (nextStatus === '受注') {
      // 交付決定をOFFに戻した場合 ➔ 「kz送客（PHASE 2）」へ戻す
      nextStatus = 'kz送客';
      incomingPm.introPhase = 'PHASE2';
      nextOrderDate = undefined;
      nextMemo = nextMemo.replace(/\s*\|\s*受注済\([^)]*\)/g, '').trim();
      nextActivities = [
        {
          id: `act-sync-${Date.now()}`,
          projectId: project.id,
          date: todayStr,
          type: '🔄 進捗移動: 【受注】➔【kz送客】',
          content: '交付決定チェックの解除に伴い、進捗フロー・カンバンを「kz送客（PHASE 2）」へ連動しました。',
          points: 0
        },
        ...nextActivities
      ];
    }
  } else if (explicitIntroPhaseChange && incomingPm.introPhase) {
    const targetPh = incomingPm.introPhase;
    if (targetPh === 'PHASE3' || targetPh === 'PHASE4') {
      incomingPm.kzGrantAdopted = true;
      if (nextStatus !== '受注') {
        const prevSt = normalizeProgressStage(project);
        nextStatus = '受注';
        nextOrderDate = nextOrderDate || todayStr;
        nextProb = 'A';
        if (!nextMemo.includes('受注済')) {
          nextMemo = `${nextMemo} | 受注済(${nextOrderDate})`.trim();
        }
        nextActivities = [
          {
            id: `act-sync-${Date.now()}`,
            projectId: project.id,
            date: todayStr,
            type: `🔄 進捗移動: 【${prevSt}】➔【受注】`,
            content: `導入フェーズを「${targetPh}」へ変更したため、営業進捗・カンバンも「受注」へ連動しました。`,
            points: 0
          },
          ...nextActivities
        ];
      }
    } else if (targetPh === 'PHASE1' || targetPh === 'PHASE2') {
      if (nextStatus === '受注') {
        incomingPm.kzGrantAdopted = false;
        nextStatus = 'kz送客';
        nextOrderDate = undefined;
        nextMemo = nextMemo.replace(/\s*\|\s*受注済\([^)]*\)/g, '').trim();
        nextKzReferralDate = nextKzReferralDate || todayStr;
        nextActivities = [
          {
            id: `act-sync-${Date.now()}`,
            projectId: project.id,
            date: todayStr,
            type: '🔄 進捗移動: 【受注】➔【kz送客】',
            content: `導入フェーズを「${targetPh}」へ戻したため、営業進捗・カンバンも「kz送客」へ連動しました。`,
            points: 0
          },
          ...nextActivities
        ];
      }
    }
  } else if (explicitKzStepChange) {
    if (incomingPm.kzStep3Applied) {
      incomingPm.introPhase = incomingPm.kzGrantAdopted ? 'PHASE3' : 'PHASE2';
    }
    const curIdx = SALES_PROGRESS_FLOW.indexOf(normalizeProgressStage(project));
    if (
      (incomingPm.kzStep1ConsentSent || incomingPm.kzStep2Contacted || incomingPm.kzStep3Applied) &&
      curIdx >= 0 &&
      curIdx < 6 &&
      nextStatus !== '受注'
    ) {
      const prevSt = normalizeProgressStage(project);
      nextStatus = 'kz送客';
      nextKzReferralDate = nextKzReferralDate || todayStr;
      nextProb = 'A';
      if (!nextMemo.includes('kz送客済')) {
        nextMemo = `${nextMemo} | kz送客済(${nextKzReferralDate})`.trim();
      }
      nextActivities = [
        {
          id: `act-sync-${Date.now()}`,
          projectId: project.id,
          date: todayStr,
          type: `🔄 進捗移動: 【${prevSt}】➔【kz送客】`,
          content: 'KIZASHI（補助金コンサルタント）申請ステップの進行に伴い、進捗フロー・カンバンを「kz送客」へ自動連動しました。',
          points: 0
        },
        ...nextActivities
      ];
    }
  }

  if (explicitPayment2Change && incomingPm.payment2TemasakStatus === '支払完了') {
    incomingPm.introPhase = 'PHASE4';
  }

  const nextTotalPts = nextActivities.reduce((sum, act) => sum + inferActivityPoints(act), 0);

  return {
    ...project,
    ...updates,
    status: nextStatus,
    probability: nextProb,
    surveyDate: nextSurveyDate,
    installationDate: nextInstallDate,
    kzReferralDate: nextKzReferralDate,
    orderDate: nextOrderDate,
    memo: nextMemo,
    pipelineMap: incomingPm,
    activities: nextActivities,
    clinicPoints: updates.clinicPoints !== undefined ? updates.clinicPoints : nextTotalPts,
    updatedAt: new Date().toISOString()
  };
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
