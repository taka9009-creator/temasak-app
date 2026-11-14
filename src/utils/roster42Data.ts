import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import { getClinicTotalPoints } from '../types';
import type { Project, NextAction, Activity } from '../types';
import recoveredRosterData from './recovered_user_roster42.json';

export interface RosterRawRecord {
  serialNo: number;          // 通し番号 (4580〜5177)
  receivedDate: string;      // 反響日 (YYYY-MM-DD)
  inquiryNo: number;         // 反響番号 (3066〜3663)
  dayOfWeek: string;         // 曜日
  rawName: string;           // 顧客名（タグ含む）
  prefecture: string;        // 都道府県
  city: string;              // 市区町村
  salesRep: string;          // 担当者 (松浦)
  docSentFlag: boolean;      // ● (資料送付)
  emailSentFlag: boolean;    // 〇 (メール送付)
  docSentDate?: string;      // 資料送付日
  call1Date?: string;        // 1回目架電日
  call1Result?: '会話' | '不在' | '折返待ち' | ''; // 1回目架電結果
  interviewDate?: string;    // 面談・アポ日
  call2Date?: string;        // 2回目架電日
  call2Result?: '会話' | ''; // 2回目架電結果
}

/**
 * 顧客管理.xlsx から抽出した全42件のリアル名簿データ（Excelシリアル値から正確な日付へ変換済）
 */
export const ROSTER_42_RAW: RosterRawRecord[] = [
  { serialNo: 4580, receivedDate: '2026-01-19', inquiryNo: 3066, dayOfWeek: '月', rawName: '医療法人半田整形外科', prefecture: '福島県', city: '郡山市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-01-19', interviewDate: '2026-01-19' },
  { serialNo: 4587, receivedDate: '2026-01-22', inquiryNo: 3073, dayOfWeek: '水', rawName: 'コセキ株式会社　いわき出張所', prefecture: '福島県', city: 'いわき市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, call1Date: '2026-01-23', call1Result: '会話' },
  { serialNo: 4609, receivedDate: '2026-02-03', inquiryNo: 3095, dayOfWeek: '火', rawName: 'DAISUKE DENTAL CLINIC二十四軒院【医療法人社団建志会】', prefecture: '北海道', city: '札幌市西区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-02-03', call1Date: '2026-02-03', call1Result: '会話' },
  { serialNo: 4616, receivedDate: '2026-02-05', inquiryNo: 3102, dayOfWeek: '木', rawName: '医療法人ナチュール歯科', prefecture: '福島県', city: '福島市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-02-06' },
  { serialNo: 4624, receivedDate: '2026-02-10', inquiryNo: 3110, dayOfWeek: '火', rawName: '有限会社昭和動物病院', prefecture: '北海道', city: '函館市', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-02-10' },
  { serialNo: 4656, receivedDate: '2026-02-22', inquiryNo: 3142, dayOfWeek: '日', rawName: 'すがさわ外科内科クリニック【医療法人はるひこ会】', prefecture: '岩手県', city: '花巻市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-02-24' },
  { serialNo: 4664, receivedDate: '2026-02-27', inquiryNo: 3150, dayOfWeek: '金', rawName: '医療法人王心会　新田東クリニック', prefecture: '宮城県', city: '仙台市宮城野区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-02-27', call1Date: '2026-02-27', call1Result: '会話' },
  { serialNo: 4728, receivedDate: '2026-03-31', inquiryNo: 3214, dayOfWeek: '火', rawName: '医療法人社団皓歯会　スワンデンタルクリニック【既存見込み】', prefecture: '北海道', city: '札幌市西区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-03-31', call1Date: '2026-03-31', call1Result: '不在', call2Date: '2026-03-31', call2Result: '会話' },
  { serialNo: 4729, receivedDate: '2026-03-31', inquiryNo: 3215, dayOfWeek: '火', rawName: '株式会社三城', prefecture: '北海道', city: '札幌市中央区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-04-01', call1Date: '2026-04-01', call1Result: '会話' },
  { serialNo: 4742, receivedDate: '2026-04-09', inquiryNo: 3228, dayOfWeek: '木', rawName: '医療法人ライブフォレスト　桑園メンタルクリニック', prefecture: '北海道', city: '札幌市中央区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-04-10', call1Date: '2026-04-10', call1Result: '不在' },
  { serialNo: 4756, receivedDate: '2026-04-15', inquiryNo: 3242, dayOfWeek: '水', rawName: 'わきもと歯科医院', prefecture: '秋田県', city: '男鹿市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-04-16', call1Date: '2026-04-21', call1Result: '会話' },
  { serialNo: 4765, receivedDate: '2026-04-18', inquiryNo: 3251, dayOfWeek: '土', rawName: '医療法人仁友会　日之出歯科真駒内診療所', prefecture: '北海道', city: '札幌市南区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-04-20' },
  { serialNo: 4784, receivedDate: '2026-04-28', inquiryNo: 3270, dayOfWeek: '火', rawName: 'フォーシーズンズデンタルクリニック ようてい【医療法人社団四季の会】', prefecture: '北海道', city: '虻田郡倶知安町', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-04-28', call1Date: '2026-04-28', call1Result: '不在' },
  { serialNo: 4807, receivedDate: '2026-05-08', inquiryNo: 3293, dayOfWeek: '金', rawName: '医療法人大庚会　今整形外科', prefecture: '北海道', city: '函館市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-05-08', call1Date: '2026-05-08', call1Result: '不在' },
  { serialNo: 4812, receivedDate: '2026-05-11', inquiryNo: 3298, dayOfWeek: '月', rawName: '新規開業　南仙台よしだ耳鼻咽喉科クリニック', prefecture: '宮城県', city: '仙台市太白区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-05-12', call1Date: '2026-05-12', call1Result: '不在' },
  { serialNo: 4862, receivedDate: '2026-06-02', inquiryNo: 3348, dayOfWeek: '火', rawName: '新規開業　もとまち内科リウマチクリニック', prefecture: '北海道', city: '札幌市北区', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-06-03', call1Date: '2026-06-19', call1Result: '折返待ち' },
  { serialNo: 4869, receivedDate: '2026-06-04', inquiryNo: 3355, dayOfWeek: '木', rawName: '医療法人神交会　鈴木内科外科クリニック', prefecture: '北海道', city: '函館市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-04', call1Date: '2026-06-22', call1Result: '会話' },
  { serialNo: 4870, receivedDate: '2026-06-04', inquiryNo: 3356, dayOfWeek: '木', rawName: 'おきつ歯科医院', prefecture: '北海道', city: '小樽市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-04', call1Date: '2026-06-19', call1Result: '会話' },
  { serialNo: 4875, receivedDate: '2026-06-06', inquiryNo: 3361, dayOfWeek: '土', rawName: '医療法人社団千風会　ちあき呼吸器内科クリニック【既存リード】', prefecture: '北海道', city: '札幌市中央区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true },
  { serialNo: 4878, receivedDate: '2026-06-07', inquiryNo: 3364, dayOfWeek: '日', rawName: '有限会社イチフジ　イチフジ薬局【540と同一】', prefecture: '北海道', city: '札幌市白石区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-08', call1Date: '2026-06-08', call1Result: '会話' },
  { serialNo: 4885, receivedDate: '2026-06-09', inquiryNo: 3371, dayOfWeek: '火', rawName: '新規開業　織田 晃央　様', prefecture: '北海道', city: '札幌市西区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-09', call1Date: '2026-06-10', call1Result: '会話' },
  { serialNo: 4912, receivedDate: '2026-06-20', inquiryNo: 3398, dayOfWeek: '土', rawName: '医療法人社団久仁会　白川整形外科内科', prefecture: '北海道', city: '北見市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-20', call1Date: '2026-06-23', call1Result: '会話' },
  { serialNo: 4913, receivedDate: '2026-06-21', inquiryNo: 3399, dayOfWeek: '日', rawName: '医療法人ととのふ　向島医院', prefecture: '秋田県', city: '秋田市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-22', call1Date: '2026-06-22', call1Result: '会話' },
  { serialNo: 4914, receivedDate: '2026-06-22', inquiryNo: 3400, dayOfWeek: '月', rawName: '医療法人まつもり耳鼻咽喉科【既存リード】', prefecture: '宮城県', city: '仙台市泉区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-06-22' },
  { serialNo: 4942, receivedDate: '2026-07-02', inquiryNo: 3428, dayOfWeek: '木', rawName: '札幌歯科器材（株）函館営業所【2529と同一】', prefecture: '北海道', city: '函館市', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, call1Date: '2026-07-02', call1Result: '不在' },
  { serialNo: 4955, receivedDate: '2026-07-10', inquiryNo: 3441, dayOfWeek: '金', rawName: '株式会社フォールド【既存】', prefecture: '福島県', city: '郡山市', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-07-10', call1Date: '2026-07-10', call1Result: '会話' },
  { serialNo: 4972, receivedDate: '2026-07-19', inquiryNo: 3458, dayOfWeek: '日', rawName: '麻生レディースクリニック【医療法人社団ちぇりこ会】', prefecture: '北海道', city: '札幌市北区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-07-21', call1Date: '2026-07-21', call1Result: '会話' },
  { serialNo: 4974, receivedDate: '2026-07-22', inquiryNo: 3460, dayOfWeek: '月', rawName: '医療法人たねだ内科クリニック', prefecture: '福島県', city: 'いわき市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-07-22', call1Date: '2026-07-22', call1Result: '折返待ち' },
  { serialNo: 4980, receivedDate: '2026-07-26', inquiryNo: 3466, dayOfWeek: '日', rawName: '村岡産婦人科医院【医療法人栄真会】', prefecture: '福島県', city: 'いわき市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-07-27', call1Date: '2026-07-27', call1Result: '会話' },
  { serialNo: 4990, receivedDate: '2026-07-30', inquiryNo: 3476, dayOfWeek: '木', rawName: 'いまいメディカルサポート株式会社', prefecture: '宮城県', city: '仙台市太白区', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-07-31', call1Date: '2026-07-31', call1Result: '不在' },
  { serialNo: 4991, receivedDate: '2026-07-31', inquiryNo: 3477, dayOfWeek: '金', rawName: '株式会社スズケン　北仙台支店', prefecture: '宮城県', city: '仙台市泉区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-07-31', call1Date: '2026-07-31', call1Result: '会話' },
  { serialNo: 5038, receivedDate: '2026-08-24', inquiryNo: 3524, dayOfWeek: '月', rawName: '医療法人cocoro　こころメンタルクリニック【345と同一】', prefecture: '北海道', city: '札幌市北区', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-08-24', call1Date: '2026-08-24', call1Result: '会話' },
  { serialNo: 5055, receivedDate: '2026-08-29', inquiryNo: 3541, dayOfWeek: '土', rawName: 'さっぽろ大通内分泌クリニック【医療法人NAGI】', prefecture: '北海道', city: '札幌市中央区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-08-30', call1Date: '2026-08-30', call1Result: '不在' },
  { serialNo: 5057, receivedDate: '2026-08-30', inquiryNo: 3543, dayOfWeek: '日', rawName: '株式会社あみたに動物病院', prefecture: '北海道', city: '札幌市中央区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-08-30', call1Date: '2026-08-30', call1Result: '不在' },
  { serialNo: 5065, receivedDate: '2026-09-03', inquiryNo: 3551, dayOfWeek: '木', rawName: '医療法人社団新生会　佐藤徹内科クリニック【既存リード】', prefecture: '宮城県', city: '本吉郡南三陸町', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-09-03', call1Date: '2026-09-03', call1Result: '会話' },
  { serialNo: 5075, receivedDate: '2026-09-09', inquiryNo: 3561, dayOfWeek: '水', rawName: '株式会社三櫻', prefecture: '岩手県', city: '盛岡市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-09-09' },
  { serialNo: 5094, receivedDate: '2026-09-18', inquiryNo: 3580, dayOfWeek: '金', rawName: '大曲皮フ科', prefecture: '北海道', city: '北広島市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-09-18', call1Date: '2026-09-18', call1Result: '会話' },
  { serialNo: 5125, receivedDate: '2026-10-04', inquiryNo: 3611, dayOfWeek: '日', rawName: 'ひらつか歯科医院', prefecture: '宮城県', city: '仙台市青葉区', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-10-05', interviewDate: '2026-10-15' },
  { serialNo: 5132, receivedDate: '2026-10-07', inquiryNo: 3618, dayOfWeek: '水', rawName: '医療法人社団同楽会　札幌西区ともメンタルクリニック【1090と同一】', prefecture: '北海道', city: '札幌市西区', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-10-07' },
  { serialNo: 5164, receivedDate: '2026-10-21', inquiryNo: 3650, dayOfWeek: '水', rawName: 'すずきENTクリニック', prefecture: '北海道', city: '札幌市清田区', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-10-21', call1Date: '2026-10-21', call1Result: '不在' },
  { serialNo: 5174, receivedDate: '2026-10-25', inquiryNo: 3660, dayOfWeek: '日', rawName: '旭川駅前あしたばデンタルクリニック【医療法人愛和会】', prefecture: '北海道', city: '旭川市', salesRep: '松浦', docSentFlag: true, emailSentFlag: false, docSentDate: '2026-10-26' },
  { serialNo: 5177, receivedDate: '2026-10-26', inquiryNo: 3663, dayOfWeek: '月', rawName: 'おおまがり鈴木内科医院【医療法人社団鈴木内科医院】', prefecture: '北海道', city: '北広島市', salesRep: '松浦', docSentFlag: true, emailSentFlag: true, docSentDate: '2026-10-26', call1Date: '2026-10-26', call1Result: '会話' }
];

export function inferDepartment(name: string): string {
  if (name.includes('歯科') || name.includes('DENTAL') || name.includes('デンタル')) return '歯科';
  if (name.includes('整形外科')) return '整形外科';
  if (name.includes('動物病院')) return '動物病院';
  if (name.includes('メンタル') || name.includes('心療')) return '精神科・心療内科';
  if (name.includes('耳鼻') || name.includes('ENT')) return '耳鼻咽喉科';
  if (name.includes('産婦人科') || name.includes('レディース')) return '産婦人科・婦人科';
  if (name.includes('皮フ科') || name.includes('皮膚科')) return '皮膚科';
  if (name.includes('薬局')) return '調剤薬局';
  if (name.includes('株式会社') || name.includes('（株）') || name.includes('有限会社')) return 'ディーラー・パートナー企業';
  if (name.includes('内科') || name.includes('医院') || name.includes('クリニック')) return '内科・クリニック';
  return '医療機関';
}

export function inferLeadTag(rawName: string): { cleanName: string; tag: string; isNewOpening: boolean; isDealer: boolean } {
  const isNewOpening = rawName.includes('新規開業');
  const isDealer = rawName.includes('コセキ') || rawName.includes('スズケン') || rawName.includes('歯科器材') || rawName.includes('メディカルサポート') || rawName.includes('三城') || rawName.includes('三櫻') || rawName.includes('フォールド');
  
  let tag = '新規反響';
  if (isNewOpening) tag = '新規開業';
  else if (rawName.includes('既存見込み')) tag = '既存見込み';
  else if (rawName.includes('既存リード') || rawName.includes('【既存】')) tag = '既存リード';
  else if (rawName.includes('と同一')) {
    const match = rawName.match(/【(\d+と同一)】/);
    tag = match ? `再反響(${match[1]})` : '再反響';
  } else if (isDealer) {
    tag = 'BtoB・ディーラー';
  }

  return {
    cleanName: rawName.trim(),
    tag,
    isNewOpening,
    isDealer
  };
}

/**
 * 過去に入力された活動履歴・失注リスト(5件)・基本情報(電話番号/院長名/診療時間/休診日/URL/予約システム)を含む全42件名簿データを返す
 */
export function buildRoster42Dataset(): { projects: Project[]; actions: NextAction[] } {
  const recoveredProjects = (recoveredRosterData as any).projects as Project[];
  const recoveredActions = (recoveredRosterData as any).actions as NextAction[];

  if (Array.isArray(recoveredProjects) && recoveredProjects.length >= 42) {
    const normalizedProjects: Project[] = recoveredProjects.map(p => ({
      ...p,
      clinicPoints: typeof p.clinicPoints === 'number' ? p.clinicPoints : getClinicTotalPoints(p),
      activities: Array.isArray(p.activities) ? p.activities : []
    }));
    normalizedProjects.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
    return {
      projects: normalizedProjects,
      actions: Array.isArray(recoveredActions) ? recoveredActions : []
    };
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const projects: Project[] = [];
  const actions: NextAction[] = [];

  ROSTER_42_RAW.forEach((r) => {
    const projectId = `roster-${r.serialNo}`;
    const dept = inferDepartment(r.rawName);
    const { cleanName, tag, isNewOpening, isDealer } = inferLeadTag(r.rawName);

    // 最新の架電結果・進捗判定
    const latestCallResult = r.call2Result || r.call1Result || '';
    const hasInterview = !!r.interviewDate;

    let status = '初動';
    let probability: 'A' | 'B' | 'C' | 'D' = 'B';
    let priority: '高' | '中' | '低' = '中';
    let ballHolder = '松浦 貴文';
    let nextActionTitle = '';
    let nextActionMemo = '';
    let deadlineOffsetDays = 1;

    if (hasInterview) {
      status = 'デモ';
      probability = 'A';
      priority = '高';
      nextActionTitle = '面談・デモ後フォロー：見積書および補助金案内の提示';
      nextActionMemo = `面談・デモ実施済（${r.interviewDate}）。レセコン連携仕様と見積条件の最終すり合わせ。`;
      deadlineOffsetDays = 0;
    } else if (latestCallResult === '折返待ち') {
      status = '初動';
      probability = 'A';
      priority = '高';
      nextActionTitle = '【最優先】折り返し確認コール ＆ AIフォローメール送信';
      nextActionMemo = `前回架電時（${r.call1Date}）に折返待ち。休診時間帯を狙って再架電またはメール送付。`;
      deadlineOffsetDays = -1; // 最優先（期限超過扱いにしてトップ表示）
    } else if (latestCallResult === '会話') {
      status = '初動';
      probability = 'B';
      priority = isNewOpening ? '高' : '中';
      nextActionTitle = isNewOpening
        ? '開業スケジュール確認 ＆ 実機デモ・概算見積の提案'
        : isDealer
        ? 'パートナー紹介案件のヒアリング ＆ 同行デモ打診'
        : '会話後フォロー：デモ日程打診・レセコン型番ヒアリング';
      nextActionMemo = `電話にて会話済（${r.call2Date || r.call1Date}）。検討温度感が高いうちに次ステップ（デモ/見積）へ進める。`;
      deadlineOffsetDays = 0;
    } else if (latestCallResult === '不在') {
      status = '初動';
      probability = 'C';
      priority = '高';
      nextActionTitle = '不在のため再架電（時間帯変更）＋不在フォローメール送信';
      nextActionMemo = `前回架電（${r.call1Date}）は不在。昼休み前または夕方枠で再コール。`;
      deadlineOffsetDays = 0;
    } else {
      // 未架電（資料送付のみ等）
      status = '問合せ';
      probability = 'C';
      priority = '高';
      nextActionTitle = '資料到着確認の初回架電（ファーストコール）';
      nextActionMemo = r.docSentDate
        ? `資料発送済（${r.docSentDate}）。手元に届いているか確認し、現状の会計課題をヒアリングする。`
        : '反響受付後の初回アプローチを実施。';
      deadlineOffsetDays = 0;
    }

    // 活動履歴の構築 ＆ クリニック別初期ポイント算出
    const activities: Activity[] = [];
    let initialClinicPoints = 0;

    activities.push({
      id: `act-rec-${r.serialNo}`,
      projectId,
      date: r.receivedDate,
      type: '反響受付',
      content: `名簿No.${r.serialNo}（反響番号:${r.inquiryNo} / ${r.dayOfWeek}曜）として受付。区分: ${tag}`,
      points: 0
    });

    if (r.docSentFlag || r.emailSentFlag) {
      const sentTypes = [
        r.docSentFlag ? '●資料送付' : '',
        r.emailSentFlag ? '〇案内メール送付' : ''
      ].filter(Boolean).join('・');
      const mailPts = r.emailSentFlag ? 5 : 0;
      initialClinicPoints += mailPts;
      activities.push({
        id: `act-doc-${r.serialNo}`,
        projectId,
        date: r.docSentDate || r.receivedDate,
        type: r.emailSentFlag ? '初動・案内メール送付 (+5p)' : '資料送付',
        content: `${sentTypes}を実施完了。`,
        points: mailPts
      });
    }

    if (r.call1Date || r.call1Result) {
      const c1Pts = r.call1Result === '会話' ? 3 : r.call1Result === '折返待ち' ? 1 : r.call1Result === '不在' ? 1 : 0;
      initialClinicPoints += c1Pts;
      activities.push({
        id: `act-call1-${r.serialNo}`,
        projectId,
        date: r.call1Date || r.receivedDate,
        type: `電話フォロー(1回目)${c1Pts > 0 ? ` (+${c1Pts}p)` : ''}`,
        content: `架電結果: 【${r.call1Result || '記録済'}】`,
        points: c1Pts
      });
    }

    if (r.call2Date || r.call2Result) {
      const c2Pts = r.call2Result === '会話' ? 3 : 0;
      initialClinicPoints += c2Pts;
      activities.push({
        id: `act-call2-${r.serialNo}`,
        projectId,
        date: r.call2Date || r.receivedDate,
        type: `電話フォロー(2回目)${c2Pts > 0 ? ` (+${c2Pts}p)` : ''}`,
        content: `再架電結果: 【${r.call2Result || '記録済'}】（1回目不在からリカバリー会話成功）`,
        points: c2Pts
      });
    }

    if (r.interviewDate) {
      initialClinicPoints += 5;
      activities.push({
        id: `act-int-${r.serialNo}`,
        projectId,
        date: r.interviewDate,
        type: '面談・デモ (+5p)',
        content: `面談・詳細案内を実施（${r.interviewDate}）。`,
        points: 5
      });
    }

    const lastActivityAt = r.interviewDate || r.call2Date || r.call1Date || r.docSentDate || r.receivedDate;

    // AI要約＆推奨アプローチ
    const aiSummary = `【${r.prefecture}${r.city} / ${dept}】反響日:${r.receivedDate} (${tag})。${r.docSentFlag ? '●資料送付済' : ''}${r.emailSentFlag ? '・〇メール送付済' : ''}。現在ステータス: ${hasInterview ? '面談済' : latestCallResult ? `架電「${latestCallResult}」` : '未架電（資料送付のみ）'}。`;

    const aiRecommendation = hasInterview
      ? '面談後の熱量が高い段階です。IT導入補助金・省力化補助金の活用パターンを添えて見積書を提示しましょう。'
      : latestCallResult === '折返待ち'
      ? '先方からの折り返し待ち状態です。「お電話が繋がりにくいためメールにて失礼いたします」とAIナレッジから要点を絞ったメールを送ると返信率が上がります。'
      : latestCallResult === '会話'
      ? '電話での会話に成功しています！トップ営業の型「レセコン名確認＋実機デモ日程の2択打診」をメールで送り、商談アポを確定させましょう。'
      : latestCallResult === '不在'
      ? '院長先生・事務長様が不在でした。休診時間前に再コールするか、30秒で読める「資料到着確認＋導入事例メール」をAI起案して送りましょう。'
      : '資料送付後の未架電案件です。まずは1コール入れ、不在でも「資料をお送りした松浦です」と一言残すと次回通話率が大幅に向上します。';

    const project: Project = {
      id: projectId,
      clinicName: cleanName,
      clinicType: dept,
      address: `${r.prefecture}${r.city}`,
      phone: '',
      email: '',
      contactPerson: isDealer ? 'ご担当者様' : '院長先生 / 事務長様',
      contactTitle: isDealer ? '担当者' : '院長',
      memo: `【名簿No.${r.serialNo} / 反響#${r.inquiryNo}】${tag} | ${r.docSentFlag ? '●資料送付済' : '資料未'} / ${r.emailSentFlag ? '〇メール済' : 'メール未'} | 架電状況: ${latestCallResult || '未架電'}${hasInterview ? ` | 面談日:${r.interviewDate}` : ''}`,
      source: tag,
      sourceDetail: `反響番号: ${r.inquiryNo} (${r.dayOfWeek}曜反響)`,
      receivedAt: r.receivedDate,
      salesRep: '松浦 貴文',
      product: 'テマサック自動精算機',
      quantity: 1,
      status,
      priority,
      lastActivityAt,
      ballHolder,
      isImplementationProject: false,
      probability,
      clinicPoints: initialClinicPoints,
      aiSummary,
      aiRecommendation,
      activities,
      pipelineMap: {
        department: dept,
        inquiryType: tag,
        deviceType: 'テマサック (標準モデル)',
        purpose: isNewOpening ? '新規開業に伴う会計自動化・省人化' : '受付会計の待ち時間短縮・締め作業効率化'
      },
      createdAt: r.receivedDate,
      updatedAt: lastActivityAt
    };

    const action: NextAction = {
      id: `act-next-${r.serialNo}`,
      projectId,
      title: nextActionTitle,
      assignee: '松浦 貴文',
      deadline: format(addDays(new Date(), deadlineOffsetDays), 'yyyy-MM-dd'),
      priority,
      status: '未完了',
      memo: nextActionMemo,
      createdAt: todayStr
    };

    projects.push(project);
    actions.push(action);
  });

  // 反響日が新しい順（通し番号の降順）に並べる
  projects.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));

  return { projects, actions };
}

export interface ParsedPasteLead {
  id: string;
  receivedDate: string;
  clinicName: string;
  address: string;
  salesRep: string;
  docSentFlag: boolean;
  emailSentFlag: boolean;
  callResult: '会話' | '不在' | '折返待ち' | '';
  interviewFlag: boolean;
  rawLine: string;
}

const PREF_LIST = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

function normalizeDateToken(token: string): string | null {
  const s = token.trim();
  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  // M/D/YY (例: 10/26/26)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yr = 2000 + parseInt(m[3], 10);
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  // M月D日 or M/D (当年補完)
  m = s.match(/^(\d{1,2})[月/](\d{1,2})日?$/);
  if (m) {
    const yr = new Date().getFullYear();
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

/**
 * コピペされたテキスト（複数行対応）から
 * 「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」および名簿フル行を自動解析する
 */
export function parsePastedRosterText(rawText: string): ParsedPasteLead[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const results: ParsedPasteLead[] = [];

  lines.forEach((line, idx) => {
    // 区切り文字の自動判定: タブ -> カンマ -> スラッシュ(` / `) -> 全角・連続スペース
    let cols: string[] = [];
    if (line.includes('\t')) {
      cols = line.split('\t').map(c => c.trim());
    } else if (line.includes(',')) {
      cols = line.split(',').map(c => c.trim());
    } else if (line.includes(' / ') || line.includes('／')) {
      cols = line.split(/\s*[/／]\s*/).map(c => c.trim());
    } else {
      cols = line.split(/[\s　]{2,}/).map(c => c.trim());
      if (cols.length === 1) {
        cols = line.split(/[\s　]+/).map(c => c.trim());
      }
    }

    // ヘッダー行スキップ判定
    if (cols[0] === '反響日' || cols[1] === '反響日' || cols.includes('顧客名') || cols.includes('クリニック名')) {
      return;
    }

    let receivedDate = todayStr;
    let clinicName = '';
    let address = '';
    let salesRep = '松浦';
    let docSentFlag = true;
    let emailSentFlag = true;
    let callResult: '会話' | '不在' | '折返待ち' | '' = '';

    // パターンA: 顧客管理.xlsx のフルフォーマット (列0:連番, 列1:日付, 列2:反響番号, 列3:曜日, 列4:顧客名, 列5:都道府県, 列6:市区町村, 列7:担当...)
    const col0IsNum = /^\d{3,5}$/.test(cols[0] || '');
    const col1Date = cols[1] ? normalizeDateToken(cols[1]) : null;
    const col2IsNum = /^\d{3,5}$/.test(cols[2] || '');

    if (col0IsNum && col1Date && col2IsNum && cols.length >= 6) {
      receivedDate = col1Date;
      clinicName = cols[4] || '';
      const pref = cols[5] || '';
      const city = cols[6] || '';
      address = `${pref}${city}`;
      salesRep = cols[7] || '松浦';
      docSentFlag = cols[8] === '●' || cols.includes('●');
      emailSentFlag = cols[9] === '〇' || cols[9] === '○' || cols.includes('〇') || cols.includes('○');
      if (cols.includes('会話')) callResult = '会話';
      else if (cols.includes('折返待ち')) callResult = '折返待ち';
      else if (cols.includes('不在')) callResult = '不在';
    } else {
      // パターンB: シンプルな「反響日 / 顧客名 / 都道府県・市区町村 / 担当(松浦)」または順不同の列
      const remaining: string[] = [];
      let foundDate = false;
      let prefPart = '';
      let cityPart = '';

      cols.forEach(token => {
        if (!token) return;
        const d = normalizeDateToken(token);
        if (d && !foundDate) {
          receivedDate = d;
          foundDate = true;
          return;
        }
        if (token === '●') {
          docSentFlag = true;
          return;
        }
        if (token === '〇' || token === '○') {
          emailSentFlag = true;
          return;
        }
        if (token === '会話' || token === '不在' || token === '折返待ち') {
          callResult = token;
          return;
        }
        if (/^[月火水木金土日]曜?$/.test(token) || /^\d{1,2}:\d{2}(:\d{2})?$/.test(token)) {
          return;
        }
        if (token.startsWith('松浦') || token.startsWith('杉田')) {
          salesRep = token;
          return;
        }
        const matchedPref = PREF_LIST.find(p => token.startsWith(p));
        if (matchedPref && !prefPart) {
          prefPart = token;
          return;
        }
        remaining.push(token);
      });

      // 都道府県と市区町村が別列だった場合の結合チェック
      if (prefPart && PREF_LIST.includes(prefPart) && remaining.length >= 2) {
        // remainingの中に「〇〇市」「〇〇区」「〇〇郡」「〇〇町」があれば市区町村として結合
        const cityIdx = remaining.findIndex(r => /[市区町村郡]$/.test(r) && !r.includes('クリニック') && !r.includes('医院') && !r.includes('病院'));
        if (cityIdx !== -1) {
          cityPart = remaining[cityIdx];
          remaining.splice(cityIdx, 1);
        }
      }

      address = `${prefPart}${cityPart}`;

      // 残ったトークンのうち最もクリニック名らしいものを採用
      if (remaining.length > 0) {
        // 先頭が単なる連番なら除外
        const nonNumeric = remaining.filter(r => !/^\d+$/.test(r));
        if (nonNumeric.length >= 2 && !address) {
          clinicName = nonNumeric[0];
          address = nonNumeric[1];
          if (nonNumeric[2]) salesRep = nonNumeric[2];
        } else if (nonNumeric.length >= 1) {
          clinicName = nonNumeric[0];
          if (!address && nonNumeric[1]) address = nonNumeric[1];
        }
      }
    }

    if (!clinicName) return;

    results.push({
      id: `paste-${Date.now()}-${idx}`,
      receivedDate,
      clinicName: clinicName.trim(),
      address: address.trim() || '北海道札幌市',
      salesRep: salesRep.includes('松浦') ? '松浦 貴文' : salesRep,
      docSentFlag,
      emailSentFlag,
      callResult,
      interviewFlag: false,
      rawLine: line
    });
  });

  return results;
}

/**
 * 解析されたコピペ行データを Project + NextAction に変換
 */
export function convertParsedLeadsToProjects(leads: ParsedPasteLead[]): { projects: Project[]; actions: NextAction[] } {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const projects: Project[] = [];
  const actions: NextAction[] = [];

  leads.forEach((lead, idx) => {
    const projectId = `paste-proj-${Date.now()}-${idx}`;
    const dept = inferDepartment(lead.clinicName);
    const { cleanName, tag, isNewOpening, isDealer } = inferLeadTag(lead.clinicName);

    let status = '問合せ';
    let probability: 'A' | 'B' | 'C' | 'D' = 'B';
    let priority: '高' | '中' | '低' = '高';
    let nextActionTitle = '資料到着確認の初回架電（ファーストコール）';
    let nextActionMemo = `コピペ一括登録（反響日: ${lead.receivedDate}）。まずは1コール入れて状況を確認。`;

    if (lead.callResult === '会話') {
      status = '初動';
      nextActionTitle = '会話後フォロー：実機デモ日程調整 ＆ 概算見積・補助金案内';
    } else if (lead.callResult === '折返待ち') {
      status = '初動';
      probability = 'A';
      nextActionTitle = '【最優先】折り返し確認コール ＆ AIフォローメール送信';
    } else if (lead.callResult === '不在') {
      status = '初動';
      nextActionTitle = '不在のため再架電（時間帯変更）＋不在フォローメール送信';
    }

    const aiRecommendation = lead.callResult === '折返待ち'
      ? '先方からの折り返し待ち状態です。AIナレッジから要点を絞ったメールを送ると返信率が上がります。'
      : lead.callResult === '会話'
      ? '電話での会話に成功しています！「レセコン名確認＋実機デモ日程の2択打診」をメールで送りましょう。'
      : lead.callResult === '不在'
      ? '不在でした。休診時間前に再コールするか、30秒で読める「資料到着確認＋導入事例メール」をAI起案して送りましょう。'
      : '新規追加された案件です。まずは1コール入れ、不在でも「資料をお送りした松浦です」と一言残しましょう。';

    const project: Project = {
      id: projectId,
      clinicName: cleanName,
      clinicType: dept,
      address: lead.address,
      phone: '',
      email: '',
      contactPerson: isDealer ? 'ご担当者様' : '院長先生 / 事務長様',
      contactTitle: isDealer ? '担当者' : '院長',
      memo: `【コピペ追加】${tag} | ${lead.docSentFlag ? '●資料送付済' : '資料未'} / ${lead.emailSentFlag ? '〇メール済' : 'メール未'} | 架電状況: ${lead.callResult || '未架電'}`,
      source: tag,
      receivedAt: lead.receivedDate,
      salesRep: lead.salesRep || '松浦 貴文',
      product: 'テマサック自動精算機',
      quantity: 1,
      status,
      priority,
      lastActivityAt: lead.receivedDate,
      ballHolder: lead.salesRep || '松浦 貴文',
      isImplementationProject: false,
      probability,
      aiSummary: `【${lead.address} / ${dept}】反響日:${lead.receivedDate} (${tag})。`,
      aiRecommendation,
      activities: [
        {
          id: uuidv4(),
          projectId,
          date: lead.receivedDate,
          type: '反響受付（コピペ追加）',
          content: `反響日:${lead.receivedDate} / ${cleanName} (${lead.address}) / 担当:${lead.salesRep}`
        }
      ],
      pipelineMap: {
        department: dept,
        inquiryType: tag,
        deviceType: 'テマサック (標準モデル)',
        purpose: isNewOpening ? '新規開業に伴う会計自動化・省人化' : '受付会計の待ち時間短縮・締め作業効率化'
      },
      createdAt: lead.receivedDate,
      updatedAt: todayStr
    };

    const action: NextAction = {
      id: uuidv4(),
      projectId,
      title: nextActionTitle,
      assignee: lead.salesRep || '松浦 貴文',
      deadline: todayStr,
      priority,
      status: '未完了',
      memo: nextActionMemo,
      createdAt: todayStr
    };

    projects.push(project);
    actions.push(action);
  });

  return { projects, actions };
}
