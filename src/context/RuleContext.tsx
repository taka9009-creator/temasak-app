import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ActionPriority } from '../types';
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

export type RuleCategory =
  | '初動・架電加速'
  | 'デモ・見積・後追い'
  | 'ポイント到達連動'
  | 'BtoBディーラー別枠'
  | '失注復活・受注導入';

export type RuleTriggerType =
  | 'action_recorded' // 超かんたん司令室のワンクリックアクション実行時
  | 'status_changed'  // 7段階進捗フロー変更時（問合せ→初動→デモ→見積→検討→後追い→受注）
  | 'points_reached'  // クリニック/BtoB累計ポイント到達時（例: 10p到達）
  | 'stagnant_days'   // 最終活動日からX日間放置・停滞時
  | 'lost_archived'   // アーカイブ（失注理由別: 金銭面・他社導入・その他）移動時
  | 'task_completed'; // タスク完了時

export type RuleTargetSegment = 'all' | 'clinic_only' | 'btob_only';

export interface GlobalRule {
  id: string;
  name: string;
  category?: RuleCategory;
  description?: string;
  isActive: boolean;

  targetSegment?: RuleTargetSegment; // 🏥クリニック直販のみ / 🏢BtoBディーラー別枠のみ / すべて
  triggerType: RuleTriggerType;
  triggerValue: string;

  actionType: 'create_task';
  actionTitle: string;
  actionDaysToDeadline: number;
  actionAssignee: string;
  actionPriority: ActionPriority;
  actionMemo: string;

  // 超かんたん司令室連動オプション
  nextStage?: string;         // 進捗フローの自動シフト先（初動・デモ・見積・検討・後追い・受注）
  autoProbability?: 'A' | 'B' | 'C'; // 確度の自動引き上げ
  aiDraftHint?: string;       // 推奨AIメール/トーク下書きシーン

  // AND If Conditions
  conditionField?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'gte';
  conditionValue?: string;
}

const LOCAL_RULES_STORAGE_KEY = 'temasak_os_rules_v3';

/**
 * 「超かんたん司令室」のアクション・ポイント制・7段階フロー・BtoB別枠と完全連動した初期ルールセット
 */
export const DEFAULT_EASY_OS_RULES: GlobalRule[] = [
  {
    id: 'rule-easy-1',
    name: '📨 初動メール(+5p)送付 ➔ 2日後「開封確認＆デモ打診コール」自動セット',
    category: '初動・架電加速',
    description: '超かんたん司令室で「初動メール(+5p)」を押した際、進捗を【初動】へ進め、熱が冷めない2日後にフォロー架電を自動予約します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '初動メール',
    actionType: 'create_task',
    actionTitle: '📞 初動メール開封確認 ＆ 実機デモ日程の打診コール',
    actionDaysToDeadline: 2,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '初動メール(+5p)送付から2日経過。「先日メールでお送りした自動精算機の件で…」と架電し会話(+3p)・デモ(+5p)を狙う。',
    nextStage: '初動',
    aiDraftHint: '初動メール'
  },
  {
    id: 'rule-easy-2',
    name: '📞 架電:不在(+1p) ➔ 翌日「時間帯変更リベンジ架電＋不在メール」予約',
    category: '初動・架電加速',
    description: '「不在(+1p)」が記録された際、翌営業日に時間帯（昼診前12:00 または 夕方17:30）を変えた再コールタスクを自動セットします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '不在',
    actionType: 'create_task',
    actionTitle: '📞 時間帯を変えて再コール（12:00前または17:30頃）＋不在フォローメール',
    actionDaysToDeadline: 1,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '前回不在(+1p)。診療時間カレンダーの休診前時間を狙って再架電。2回連続不在なら初動メール(+5p)またはポスティング(+2p)へ切替。',
    nextStage: '初動',
    aiDraftHint: '不在フォロー'
  },
  {
    id: 'rule-easy-3',
    name: '🔥 架電:折返待ち(+1p) ➔ 確度【A】昇格＆当日「最優先・折返確認＆AI要点メール」',
    category: '初動・架電加速',
    description: '院長先生や事務長の「折返待ち(+1p)」になったら即座に確度A・優先度【高】に引き上げ、24時間以内のフォローをロックします。',
    isActive: true,
    targetSegment: 'all',
    triggerType: 'action_recorded',
    triggerValue: '折返待ち',
    actionType: 'create_task',
    actionTitle: '🔥【最優先】折り返し確認 ＆ 院長先生向けAI要点メール送信',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '先方折返待ち(+1p)。当日夕方までに折り返しがなければ、AIメール起案から「お電話のお礼と要点」をメール送信する。',
    autoProbability: 'A',
    aiDraftHint: '折返待ちフォロー'
  },
  {
    id: 'rule-easy-4',
    name: '💻 オンライン/訪問/来社デモ(+5p)決定 ➔ 進捗【デモ】＆「概算見積書＋レセコン連携表」準備',
    category: 'デモ・見積・後追い',
    description: 'いずれかのデモ(+5p)が予約された時点で進捗を【デモ】・確度【A】にし、デモ当日にその場で見積提示できる準備タスクを生成します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'status_changed',
    triggerValue: 'デモ',
    actionType: 'create_task',
    actionTitle: '💻 デモ当日：実機デモンストレーション実施 ＆ 概算見積書その場提示',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: 'デモ実施日(+5p)。医療費あと払い・釣銭間違いゼロを実演し、その場で「見積書送付(+5p)」まで一気に進める。',
    nextStage: 'デモ',
    autoProbability: 'A',
    aiDraftHint: '見積送付'
  },
  {
    id: 'rule-easy-5',
    name: '📄 見積書送付(+5p) ➔ 3日後「📨 相談メール(+3p)＆リース月額シミュレーション案内」',
    category: 'デモ・見積・後追い',
    description: '見積書送付(+5p)のあと放置せず、3日後に進捗を【検討】へ進めるための「相談メール(+3p)」または確認コールを自動セットします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '見積書送付',
    actionType: 'create_task',
    actionTitle: '📨 見積確認の「相談メール(+3p)」送付 ＆ 補助金・リース比較のご提案',
    actionDaysToDeadline: 3,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '見積書送付(+5p)から3日経過。金額面や設置スペースの疑問を解消する「相談メール(+3p)」を送り、進捗を【検討】へ進める。',
    nextStage: '見積',
    autoProbability: 'A',
    aiDraftHint: '相談メール'
  },
  {
    id: 'rule-easy-6',
    name: '📮 検討ステージから5日間停滞 ➔ 進捗【後追い】＆「後追いメール(+2p)（近隣導入事例）」',
    category: 'デモ・見積・後追い',
    description: '「相談メール(+3p)」や「見積」のあと5日間動きがないクリニックに対し、自動で「後追いメール(+2p)」タスクを生成します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'stagnant_days',
    triggerValue: '5',
    conditionField: 'status',
    conditionOperator: 'equals',
    conditionValue: '検討',
    actionType: 'create_task',
    actionTitle: '📮 後追いメール(+2p)送付：近隣クリニック導入事例＆設置枠のご案内',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '検討ステージで5日以上経過。AI起案の「後追いメール(+2p)」で同科目クリニックの導入効果をお知らせし、最終決断を後押しする。',
    nextStage: '後追い',
    aiDraftHint: '後追いメール'
  },
  {
    id: 'rule-easy-6b',
    name: '💰 kz送客(+5p / 補助金コンサル送客) ➔ 進捗【kz送客】＆「補助金採択後の🎉受注確定フォロー」',
    category: 'デモ・見積・後追い',
    description: '補助金コンサルタント（kz）へ送客したクリニックを進捗【kz送客】・確度【A】へ自動更新し、補助金採択後に「🎉受注 (+10p)」へ繋げるフォロータスクを生成します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: 'kz送客',
    actionType: 'create_task',
    actionTitle: '💰 【kz送客・補助金申請中】補助金コンサル（kz）進捗確認 ＆ 採択後の「🎉受注」確定フォロー',
    actionDaysToDeadline: 7,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '補助金コンサルタント（kz）へ送客済(+5p)。採択結果を確認し次第、速やかに「🎉受注(+10p)」へ進める。',
    nextStage: 'kz送客',
    autoProbability: 'A',
    aiDraftHint: '補助金案内'
  },
  {
    id: 'rule-easy-7',
    name: '🏆 クリニック累計ポイント【10p以上】到達 ➔ ホットリード覚醒！「院長最終クロージング」',
    category: 'ポイント到達連動',
    description: '初動メール(5p)＋会話(3p)＋訪問(3p)など、クリニック累計が10p以上に達した案件を「受注目前の最重要クリニック」として自動ロックオンします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'points_reached',
    triggerValue: '10',
    actionType: 'create_task',
    actionTitle: '🏆【累計10p突破・受注圏内】院長先生へ最終条件提示 ＆ 発注書のご案内',
    actionDaysToDeadline: 1,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '累計獲得ポイントが10p以上に到達！接触回数が十分積み上がっているため、訪問デモまたは最終見積提示で「🎉受注(+10p)」を決める。',
    autoProbability: 'A'
  },
  {
    id: 'rule-easy-8',
    name: '🏢【BtoB別枠】ディーラー・パートナー企業に「会話(+3p)/訪問(+3p)」➔ 同行デモ候補医院リストアップ',
    category: 'BtoBディーラー別枠',
    description: 'BtoB別枠のディーラー・パートナー企業と会話または訪問した際、直販とは異なる「紹介案件・同行デモクリニックの掘り起こし」タスクを生成します。',
    isActive: true,
    targetSegment: 'btob_only',
    triggerType: 'action_recorded',
    triggerValue: '会話',
    actionType: 'create_task',
    actionTitle: '🏢【BtoB連携】ディーラー担当営業と「同行デモ候補クリニック3院」のリストアップ打診',
    actionDaysToDeadline: 3,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: 'BtoBパートナー企業との会話(+3p)完了。新規開業案件や釣銭機入替ニーズのある医院を紹介いただき、合同で訪問デモ(+5p)を設定する。',
    nextStage: '初動',
    autoProbability: 'A'
  },
  {
    id: 'rule-easy-9',
    name: '💰 アーカイブ（失注理由：金銭面）移動時 ➔ 90日後「IT導入補助金・省力化補助金での再提案」',
    category: '失注復活・受注導入',
    description: '「金銭面」を理由にアーカイブ（失注）へ移動したクリニックを放置せず、補助金公募タイミングで実質負担を抑えた再アプローチを自動セットします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'lost_archived',
    triggerValue: '金銭面',
    actionType: 'create_task',
    actionTitle: '💰【金銭面失注→復活打診】新公募の補助金＆長期リース活用による実質負担1/2プラン再案内',
    actionDaysToDeadline: 90,
    actionAssignee: '松浦 貴文',
    actionPriority: '中',
    actionMemo: '失注理由【金銭面】。補助金活用またはテマサックLite（キャッシュレス専用機）の低予算プランでアーカイブから復活を狙う。',
    aiDraftHint: '補助金提案'
  },
  {
    id: 'rule-easy-10',
    name: '🎉 受注(+10p)確定 ➔ 即日「①現地調査日程 ②本体カラー確定 ③キャッシュレス申込」一括起動',
    category: '失注復活・受注導入',
    description: '超かんたん司令室で「🎉受注(+10p)」ボタンを押した瞬間、導入準備に必要な3大タスクを自動で立ち上げます。',
    isActive: true,
    targetSegment: 'all',
    triggerType: 'action_recorded',
    triggerValue: '受注',
    actionType: 'create_task',
    actionTitle: '🎉【受注後オンボーディング】①現地調査日程調整 ②本体・釣銭機カラー確認 ③キャッシュレス審査申込案内',
    actionDaysToDeadline: 1,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '受注確定(+10p)おめでとうございます！クリニック詳細カルテの「機器・補助金情報」「各種確認・準備状況」タブを入力して設置へ進める。',
    nextStage: '受注',
    autoProbability: 'A'
  }
];

/**
 * 「超かんたん司令室」を参考にした追加ルールアイデアカタログ（ワンクリックでルールエンジンに追加可能）
 */
export const RULE_IDEA_CATALOG: Omit<GlobalRule, 'id'>[] = [
  {
    name: '📮 ポスティング(+2p)実施 ➔ 2日後「チラシご覧確認コール（会話+3p狙い）」',
    category: '初動・架電加速',
    description: 'クリニックへ現地ポスティング(+2p)した2日後に、「先日資料をポストへ投函いたしました松浦です」と突破率の高い架電タスクを自動生成します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: 'ポスティング',
    actionType: 'create_task',
    actionTitle: '📞 ポスティング資料の到着確認コール（「先日ポストに投函した資料の件で…」）',
    actionDaysToDeadline: 2,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: 'ポスティング(+2p)実施から2日後。受付突破率が通常の2倍高いタイミングのため、院長先生の在院時間を狙ってコールする。',
    nextStage: '初動'
  },
  {
    name: '🚶 現地訪問(+3p)実施 ➔ 当日「訪問お礼＋相談メール(+3p)」コンボ（計+6p獲得）',
    category: '初動・架電加速',
    description: '飛び込み・挨拶訪問(+3p)を実施した当日に、お礼の「相談メール(+3p)」を送ることで1日で6pを稼ぎつつ進捗を【検討】へ引き上げます。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '訪問',
    actionType: 'create_task',
    actionTitle: '📨 現地訪問のお礼 ＆ ヒアリング「相談メール(+3p)」送付（同日コンボ）',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '現地訪問(+3p)の記憶が新しい当日中に「相談メール(+3p)」を送付し、オンラインまたは訪問デモ(+5p)の日程候補を提示する。',
    nextStage: '検討',
    aiDraftHint: '相談メール'
  },
  {
    name: '✨【新規開業クリニック特化】新規開業案件の反響時 ➔ 即日「初動メール(+5p)＋内覧会前デモ提案」',
    category: 'デモ・見積・後追い',
    description: 'クリニック名に「新規開業」を含む案件は導入決定スピードが速いため、即日で内覧会・開院スケジュールに合わせたデモ提案タスクを生成します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'status_changed',
    triggerValue: '問合せ',
    conditionField: 'clinicName',
    conditionOperator: 'contains',
    conditionValue: '新規開業',
    actionType: 'create_task',
    actionTitle: '✨【新規開業・最優先】開院日・内覧会日程の確認 ＆ レセコン連動デモ打診',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '新規開業クリニックは開院2〜3ヶ月前に機器選定が完了するため、即日「初動メール(+5p)」と電話会話(+3p)を実施する。',
    autoProbability: 'A',
    aiDraftHint: '初動メール'
  },
  {
    name: '🦷【歯科クリニック特化】歯科医院に初動メール(+5p) ➔ 「ユニット増設・自費カード決済連動」提案',
    category: 'デモ・見積・後追い',
    description: '診療科目が「歯科」のクリニックに対しては、自費診療のカード決済・釣銭間違い防止にフォーカスした相談メールを3日後に自動セットします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'action_recorded',
    triggerValue: '初動メール',
    conditionField: 'clinicType',
    conditionOperator: 'contains',
    conditionValue: '歯科',
    actionType: 'create_task',
    actionTitle: '🦷 歯科医院向け：自費キャッシュレス決済＆受付省人化デモのご案内コール',
    actionDaysToDeadline: 3,
    actionAssignee: '松浦 貴文',
    actionPriority: '中',
    actionMemo: '歯科クリニック特化フォロー。受付スタッフ1名体制での会計負担軽減＆コンパクトなカウンター設置事例を案内する。',
    aiDraftHint: '相談メール'
  },
  {
    name: '🏢【BtoB別枠】ディーラーと「訪問デモ(+5p)」実施 ➔ 2日後「仕切見積書＆紹介パートナー条件提示」',
    category: 'BtoBディーラー別枠',
    description: 'BtoBディーラー・パートナー企業との同行デモ・実機説明会(+5p)の後、ディーラー向けの卸仕切価格・紹介手数料条件を提示するタスクを生成します。',
    isActive: true,
    targetSegment: 'btob_only',
    triggerType: 'action_recorded',
    triggerValue: '訪問デモ',
    actionType: 'create_task',
    actionTitle: '🏢【BtoB見積】ディーラー担当者へ仕切見積書送付(+5p) ＆ 紹介スキーム合意',
    actionDaysToDeadline: 2,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: 'BtoBディーラーでの実機デモ完了。各営業所メンバーが提案しやすいよう、1枚提案チラシと仕切価格表を送付する。',
    nextStage: '見積',
    autoProbability: 'A'
  },
  {
    name: '🏢【BtoB別枠】ディーラー企業が7日間未接触 ➔ 「今月の新規開業・レセコン入替情報交換コール」',
    category: 'BtoBディーラー別枠',
    description: 'BtoBパートナー企業との連絡が7日間空いた際、単なる催促ではなく「管轄エリアの新規開業・レセコン入替情報の交換」タスクを自動セットします。',
    isActive: true,
    targetSegment: 'btob_only',
    triggerType: 'stagnant_days',
    triggerValue: '7',
    actionType: 'create_task',
    actionTitle: '🏢【BtoB定期情報交換】管轄エリアの新規開業・精算機検討クリニックの情報ヒアリング',
    actionDaysToDeadline: 0,
    actionAssignee: '松浦 貴文',
    actionPriority: '中',
    actionMemo: 'BtoBディーラーは定期的な顔出し・情報交換が紹介数に直結するため、訪問(+3p)または電話会話(+3p)で最新案件を伺う。'
  },
  {
    name: '🔥 クリニック累計【15p以上】で未受注 ➔ 「上長同行・特別キャンペーン条件での最終後追い」',
    category: 'ポイント到達連動',
    description: '累計15p以上（デモ・見積・訪問・相談メール等を複数回実施）なのにまだ「受注」に至っていない案件を検出し、決裁突破アクションを起動します。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'points_reached',
    triggerValue: '15',
    actionType: 'create_task',
    actionTitle: '🔥【累計15p突破・最終決裁突破】導入時期確定のための特別条件提示 ＆ 院長直接面談',
    actionDaysToDeadline: 1,
    actionAssignee: '松浦 貴文',
    actionPriority: '高',
    actionMemo: '15p以上積み上げた超重要案件。あと一歩の障壁（設置場所・価格・スタッフ運用）を特定し、今月中の受注(+10p)を決める。',
    nextStage: '後追い',
    autoProbability: 'A'
  },
  {
    name: '🏢 アーカイブ（失注理由：他社導入）移動時 ➔ 180日後「他社機の稼働状況＆2台目・入替リサーチ」',
    category: '失注復活・受注導入',
    description: '「他社導入」で失注になった医院に対し、半年後に「他社機のサポート満足度や2台目増設ニーズ」を伺う長期フォローを自動セットします。',
    isActive: true,
    targetSegment: 'clinic_only',
    triggerType: 'lost_archived',
    triggerValue: '他社導入',
    actionType: 'create_task',
    actionTitle: '🔍【他社導入から半年経過】現在の稼働状況ヒアリング ＆ 分院・2台目増設ニーズ確認',
    actionDaysToDeadline: 180,
    actionAssignee: '松浦 貴文',
    actionPriority: '低',
    actionMemo: '失注理由【他社導入】。半年後に「その後の使い勝手はいかがでしょうか？」と状況伺いの後追いメール(+2p)を送る。'
  }
];

interface RuleContextType {
  rules: GlobalRule[];
  addRule: (rule: Omit<GlobalRule, 'id'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<GlobalRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => Promise<void>;
  resetToEasyOSDefaultRules: () => void;
}

const RuleContext = createContext<RuleContextType | undefined>(undefined);

export function RuleProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<GlobalRule[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_RULES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load rules from localStorage:', e);
    }
    return DEFAULT_EASY_OS_RULES;
  });

  const { user } = useAuth();

  // Save to localStorage whenever rules change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
      console.error('Failed to save rules to localStorage:', e);
    }
  }, [rules]);

  // Firestore sync only for real authenticated Firebase users
  useEffect(() => {
    if (!user || user.id === 'demo-user-1') {
      return;
    }

    const rulesQuery = query(collection(db, 'rules'), where('user_id', '==', user.id));
    const unsubscribe = onSnapshot(
      rulesQuery,
      snapshot => {
        if (snapshot.empty) return;
        const formattedRules: GlobalRule[] = snapshot.docs.map(docSnap => {
          const r = docSnap.data();
          return {
            id: docSnap.id,
            name: r.name || '',
            category: r.category || '初動・架電加速',
            description: r.description || '',
            isActive: !!r.is_active,
            targetSegment: (r.target_segment as RuleTargetSegment) || 'all',
            triggerType: (r.trigger_type as RuleTriggerType) || 'status_changed',
            triggerValue: r.trigger_value || '',
            actionType: 'create_task',
            actionTitle: r.action_title || '',
            actionDaysToDeadline: r.action_days_to_deadline ?? 1,
            actionAssignee: r.action_assignee || '松浦 貴文',
            actionPriority: (r.action_priority as ActionPriority) || '中',
            actionMemo: r.action_memo || '',
            nextStage: r.next_stage || undefined,
            autoProbability: r.auto_probability || undefined,
            aiDraftHint: r.ai_draft_hint || undefined,
            conditionField: r.condition_field || undefined,
            conditionOperator: (r.condition_operator as any) || undefined,
            conditionValue: r.condition_value || undefined
          };
        });
        setRules(formattedRules);
      },
      error => {
        console.error('Firestore rules error:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const resetToEasyOSDefaultRules = () => {
    setRules(DEFAULT_EASY_OS_RULES);
    localStorage.setItem(LOCAL_RULES_STORAGE_KEY, JSON.stringify(DEFAULT_EASY_OS_RULES));
  };

  const addRule = async (rule: Omit<GlobalRule, 'id'>) => {
    const newId = uuidv4();
    const newRule: GlobalRule = { ...rule, id: newId };
    setRules(prev => [newRule, ...prev]);

    if (user && user.id !== 'demo-user-1') {
      try {
        const dbRule = {
          id: newId,
          name: rule.name,
          category: rule.category || '',
          description: rule.description || '',
          is_active: rule.isActive,
          target_segment: rule.targetSegment || 'all',
          trigger_type: rule.triggerType,
          trigger_value: rule.triggerValue,
          action_type: rule.actionType,
          action_title: rule.actionTitle,
          action_days_to_deadline: rule.actionDaysToDeadline,
          action_assignee: rule.actionAssignee,
          action_priority: rule.actionPriority,
          action_memo: rule.actionMemo,
          next_stage: rule.nextStage || '',
          auto_probability: rule.autoProbability || '',
          ai_draft_hint: rule.aiDraftHint || '',
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
    setRules(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));

    if (user && user.id !== 'demo-user-1') {
      try {
        const ruleRef = doc(db, 'rules', id);
        await updateDoc(ruleRef, updates as Record<string, any>);
      } catch (e) {
        console.error('Error updating rule in Firestore:', e);
      }
    }
  };

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (user && user.id !== 'demo-user-1') {
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
    setRules(prev => prev.map(r => (r.id === id ? { ...r, isActive: newIsActive } : r)));
    if (user && user.id !== 'demo-user-1') {
      try {
        const ruleRef = doc(db, 'rules', id);
        await updateDoc(ruleRef, { is_active: newIsActive });
      } catch (e) {
        console.error('Error toggling rule in Firestore:', e);
      }
    }
  };

  return (
    <RuleContext.Provider
      value={{
        rules,
        addRule,
        updateRule,
        deleteRule,
        toggleRule,
        resetToEasyOSDefaultRules
      }}
    >
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
