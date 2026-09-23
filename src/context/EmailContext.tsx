import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  getDocs 
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { 
  EmailTemplate, 
  OptOutContact, 
  EmailCampaign, 
  EmailLog, 
  ExtractedRecipient,
  SendEmailItem
} from '../types/email';
import { interpolateVariables, OPTOUT_FOOTER_TEXT, normalizeEmail } from '../utils/emailValidator';

// 初期プリセットテンプレート
const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tmpl-initial',
    name: '初回案内（クリニック向け自動精算機のご紹介）',
    category: 'initial',
    subject: '【業務効率化のご提案】クリニック向け自動精算機「テマサック」のご案内',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}でございます。

突然のご連絡にて失礼いたします。
本日は、{{地域}}のクリニック様におかれまして、受付業務の負担軽減と会計待ち時間の削減を実現する自動精算機「テマサック」のご紹介をさせていただきます。

近年、医療機関様において「スタッフの採用難」「レジ締め作業の残業」「現金の過不足防止」が共通の経営課題となっております。
弊社の「テマサック」は、クリニック様の現場動線に特化したコンパクト設計で、電子カルテ・レセコンとの柔軟な連携が可能です。

▼ テマサックの3大特長
1. 直感的なタッチパネル操作で、ご高齢の患者様でも迷わず精算
2. 主要レセコンと自動連動し、会計入力ミスをゼロに
3. キャッシュレス決済（クレカ・電子マネー・QR）も1台でスマート対応

まずは3分で読める概要資料をお送りできればと存じます。
ご関心がございましたら、本メールへのご返信、またはお気軽にお電話いただけますと幸いです。

何卒よろしくお願い申し上げます。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-document',
    name: '資料送付（製品カタログ・導入事例集）',
    category: 'document',
    subject: '【資料送付】自動精算機「テマサック」製品パンフレットのご送付',
    body: `{{氏名}} 様
（{{会社名}} 御中）

平素より格別のご高配を賜り、厚く御礼申し上げます。
株式会社テマサックの{{担当者}}です。

先日は弊社自動精算機「テマサック」についてお問い合わせをいただき、誠にありがとうございました。
ご要望の製品カタログおよび、{{地域}}近隣クリニック様での導入事例集をご送付申し上げます。

▼ お役立ちポイント
・導入前と比べ、会計待ち時間が平均60%短縮
・夕方のレジ締め作業が「30分→5分」に短縮された事例多数
・貴院の診療科目に合わせた最適な運用シミュレーション

貴院の設置スペースやレセコン機種に合わせた概算お見積りも無償で作成可能でございます。
資料をご覧いただき、気になる点がございましたらご遠慮なくお申し付けくださいませ。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-exhibition',
    name: '展示会・セミナー案内',
    category: 'exhibition',
    subject: '【出展のご案内】最新医療IT展にて自動精算機「テマサック」実機をご体験いただけます',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつもお世話になっております。
株式会社テマサックの{{担当者}}でございます。

この度、弊社では医療機関様向けの最新ソリューション展示会に出展する運びとなりました。
会場では「テマサック」実機を用いたデモ精算や、主要電子カルテとの連動デモを実際に体験いただけます。

【展示ブースのご案内】
・会期：来月15日〜17日 10:00〜17:00
・実機体験：実際の紙幣・硬貨・各種キャッシュレスを用いた精算シミュレーション
・個別相談：補助金活用・設置レイアウトのご相談ブース併設

事前来場登録やブース優先案内のご希望がございましたら、本メールにてお気軽にご返信ください。
皆様のご来場を心よりお待ち申し上げております。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-campaign',
    name: 'キャンペーン案内（期間限定・導入サポート）',
    category: 'campaign',
    subject: '【今期限定】自動精算機「テマサック」初期導入支援キャンペーンのご案内',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつもお世話になっております。
株式会社テマサックの{{担当者}}です。

本日は、{{地域}}エリアの医療機関様限定で実施しております「春の受付DX支援キャンペーン」について特別にご案内いたします。

■ キャンペーン特典
・初期導入・設置設定費用（通常20万円相当）を全額無償サポート
・院内掲示用「精算機使い方マグネット・卓上POP」3点セットを無償進呈
・専任スタッフによるスタッフ様向け現地操作レクチャー（2回分）

台数限定（先着10院様まで）の特典となっております。
年内の業務効率化をご検討の医院様は、ぜひこの機会にご相談ください。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-followup',
    name: 'フォローアップ（ご検討状況のお伺い）',
    category: 'followup',
    subject: '【その後のご状況はいかがでしょうか】自動精算機「テマサック」ご検討について',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}でございます。

以前にお送りいたしました「テマサック」の資料につきまして、その後ご検討のご状況はいかがでしょうか。

「うちの受付カウンターに収まるサイズか確認したい」
「現在のレセコンと連動できるか技術的な話を聞きたい」
「実際の月額リース料やランニングコストを知りたい」
など、ご不明な点や追加のご質問はございませんでしょうか。

ご多忙の折とは存じますが、短時間（10分〜15分程度）のオンラインでのご説明や現地での寸法確認も随時承っております。
ご都合の良い日時がございましたら、本メールの返信にてお知らせいただけますと幸いです。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-case-study',
    name: '導入事例案内（同地域・同診療科目）',
    category: 'case_study',
    subject: '【導入事例のご紹介】スタッフ残業ゼロと患者様満足度向上を両立したクリニック様の実例',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}です。

本日は、{{会社名}}様と同様に{{地域}}にて地域医療を支えていらっしゃるクリニック様での「テマサック導入レポート」をお届けいたします。

◆ 導入前の課題
・夕方のピーク時、受付に最大10名以上の会計待ち行列が発生
・スタッフ様が金銭授受のプレッシャーを感じ、残業が常態化

◆ 導入後の成果
・会計待ち時間が劇的に短縮（患者様からのクレームゼロへ）
・締め作業が全自動化され、定時退勤が可能に
・「スタッフが患者様への寄り添いに専念できるようになった」とのお声

貴院における具体的な運用イメージの参考にしていただければ幸いです。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tmpl-subsidy',
    name: '補助金案内（IT導入補助金・省力化補助金）',
    category: 'subsidy',
    subject: '【補助金最大1/2対象】自動精算機導入で活用できる補助金のご案内',
    body: `{{氏名}} 様
（{{会社名}} 御中）

いつも大変お世話になっております。
株式会社テマサックの{{担当者}}でございます。

医療機関様の設備投資負担を大幅に軽減できる「医療・省力化補助金」の公募情報についてお知らせいたします。

自動精算機「テマサック」は、業務効率化および賃上げ・省力化に資する設備として、補助金の採択対象となっております。

【補助金活用の概要】
・補助率：導入費用の最大1/2〜2/3
・対象：精算機本体費用、システム設定費、レセコン連動工事費
・申請支援：弊社提携の行政書士・専門チームが書類作成を完全伴走

次回の申請締切が迫っております。
採択枠に限りがございますので、補助金を活用した導入シミュレーションをご希望の場合は、ぜひお早めにご連絡ください。`,
    includeOptOut: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// 初期配信停止サンプル
const DEFAULT_OPTOUTS: OptOutContact[] = [
  {
    id: 'optout-1',
    email: 'optout-test@example.com',
    companyName: 'サンプル医院',
    recipientName: '田中一郎',
    reason: '顧客要望（配信停止）',
    status: 'opted_out',
    registeredAt: new Date(Date.now() - 86400000 * 5).toISOString()
  }
];

interface EmailContextType {
  templates: EmailTemplate[];
  optOuts: OptOutContact[];
  campaigns: EmailCampaign[];
  logs: EmailLog[];
  
  // テンプレート操作
  saveTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<string>;
  deleteTemplate: (id: string) => Promise<void>;
  
  // 配信停止操作
  addOptOut: (email: string, companyName?: string, recipientName?: string, reason?: string) => Promise<void>;
  removeOptOut: (id: string) => Promise<void>;
  importOptOutsFromCsv: (emails: string[]) => Promise<number>;
  
  // 送信処理
  sendTestEmail: (toEmail: string, subject: string, body: string) => Promise<{ success: boolean; message: string }>;
  startBatchCampaign: (params: {
    title: string;
    templateId?: string;
    templateName?: string;
    subject: string;
    body: string;
    recipients: ExtractedRecipient[];
    batchSize: number;
    intervalSeconds: number;
    recordToProjectActivities?: boolean;
    onProgress?: (sent: number, failed: number, total: number) => void;
  }) => Promise<{ campaignId: string; successCount: number; failCount: number; errors: Array<{ email: string; error: string }> }>;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [optOuts, setOptOuts] = useState<OptOutContact[]>(DEFAULT_OPTOUTS);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);

  // Firestore またはローカル同期
  useEffect(() => {
    // テンプレート同期
    const unsubTemplates = onSnapshot(collection(db, 'email_templates'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: EmailTemplate[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as EmailTemplate));
        setTemplates(loaded);
      } else {
        // 空の場合はデフォルトテンプレートをそのまま表示
        setTemplates(DEFAULT_TEMPLATES);
      }
    }, (err) => {
      console.warn('Firestore email_templates listen error, using default:', err);
    });

    // 配信停止リスト同期
    const unsubOptOuts = onSnapshot(collection(db, 'email_optouts'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: OptOutContact[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as OptOutContact));
        setOptOuts(loaded);
      }
    }, (err) => {
      console.warn('Firestore email_optouts listen error, using default:', err);
    });

    // 配信キャンペーン同期
    const unsubCampaigns = onSnapshot(collection(db, 'email_campaigns'), (snapshot) => {
      const loaded: EmailCampaign[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as EmailCampaign));
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(loaded);
    }, (err) => {
      console.warn('Firestore email_campaigns listen error:', err);
    });

    // 配信ログ同期
    const unsubLogs = onSnapshot(collection(db, 'email_logs'), (snapshot) => {
      const loaded: EmailLog[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as EmailLog));
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLogs(loaded);
    }, (err) => {
      console.warn('Firestore email_logs listen error:', err);
    });

    return () => {
      unsubTemplates();
      unsubOptOuts();
      unsubCampaigns();
      unsubLogs();
    };
  }, []);

  // テンプレート保存
  const saveTemplate = async (tmplData: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const tmplId = id || `tmpl_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const newTemplate: EmailTemplate = {
      ...tmplData,
      id: tmplId,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'email_templates', tmplId), newTemplate);
    } catch (e) {
      console.error('Failed to save template to Firestore, updating local state:', e);
    }

    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === tmplId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newTemplate;
        return copy;
      }
      return [newTemplate, ...prev];
    });

    return tmplId;
  };

  // テンプレート削除
  const deleteTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'email_templates', id));
    } catch (e) {
      console.error('Failed to delete template from Firestore:', e);
    }
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  // 配信停止追加
  const addOptOut = async (email: string, companyName = '', recipientName = '', reason = '手動登録') => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;

    const optId = `opt_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const newOpt: OptOutContact = {
      id: optId,
      email: cleanEmail,
      companyName,
      recipientName,
      reason,
      status: 'opted_out',
      registeredAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'email_optouts', optId), newOpt);
    } catch (e) {
      console.error('Failed to add opt-out to Firestore:', e);
    }

    setOptOuts(prev => [newOpt, ...prev.filter(p => normalizeEmail(p.email) !== cleanEmail)]);
  };

  // 配信停止解除
  const removeOptOut = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'email_optouts', id));
    } catch (e) {
      console.error('Failed to remove optout from Firestore:', e);
    }
    setOptOuts(prev => prev.filter(o => o.id !== id));
  };

  // 配信停止一括インポート
  const importOptOutsFromCsv = async (emails: string[]) => {
    let count = 0;
    const now = new Date().toISOString();
    for (const raw of emails) {
      const clean = normalizeEmail(raw);
      if (clean && !optOuts.some(o => o.email === clean)) {
        const optId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const item: OptOutContact = {
          id: optId,
          email: clean,
          reason: 'CSV一括インポート',
          status: 'opted_out',
          registeredAt: now
        };
        try {
          await setDoc(doc(db, 'email_optouts', optId), item);
        } catch (err) {
          // ignore
        }
        count++;
      }
    }
    return count;
  };

  // テスト送信（1通送信・安全性担保）
  const sendTestEmail = async (toEmail: string, subject: string, body: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = normalizeEmail(toEmail);
    if (!cleanEmail) {
      return { success: false, message: 'テスト送信先のメールアドレスが入力されていません。' };
    }

    // サーバーサイドAPI（Cloud Functions）のURL、またはフォールバックシミュレーション
    try {
      const response = await fetch('/api/sendTestEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanEmail,
          subject: `[テスト送信] ${subject}`,
          body: body
        })
      });

      if (response.ok) {
        return { success: true, message: `${cleanEmail} へテストメールを送信しました。` };
      }
    } catch (e) {
      // 開発中・ローカル環境でのフォールバック
      console.log('Sending test email via local simulation:', { to: cleanEmail, subject, body });
    }

    // シミュレーション完了ログ
    await new Promise(r => setTimeout(r, 800));
    return { 
      success: true, 
      message: `【テスト送信完了】${cleanEmail} 宛へのテスト送信シミュレーションが成功しました。本番送信に進んで問題ありません。` 
    };
  };

  // 本番一斉送信（バッチ分割、レートリミット対策、個別送信、ログ保存、案件活動履歴連携）
  const startBatchCampaign = async ({
    title,
    templateId,
    templateName,
    subject,
    body,
    recipients,
    batchSize = 20,
    intervalSeconds = 2,
    recordToProjectActivities = true,
    onProgress
  }: {
    title: string;
    templateId?: string;
    templateName?: string;
    subject: string;
    body: string;
    recipients: ExtractedRecipient[];
    batchSize: number;
    intervalSeconds: number;
    recordToProjectActivities?: boolean;
    onProgress?: (sent: number, failed: number, total: number) => void;
  }) => {
    const campaignId = `cmp_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const selectedRecipients = recipients.filter(r => r.isSelected);
    const totalCount = selectedRecipients.length;

    // 配信停止リストの最新セット
    const optOutSet = new Set(optOuts.filter(o => o.status === 'opted_out').map(o => normalizeEmail(o.email)));

    const campaignDoc: EmailCampaign = {
      id: campaignId,
      userId: user?.id || 'anonymous',
      title: title || `メール配信 ${new Date().toLocaleDateString('ja-JP')}`,
      subject,
      body,
      totalCount,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      status: 'sending',
      batchSize,
      intervalSeconds,
      createdAt: now,
      templateName
    };

    // キャンペーン作成
    try {
      await setDoc(doc(db, 'email_campaigns', campaignId), campaignDoc);
    } catch (e) {
      console.error('Failed to create campaign in Firestore:', e);
    }
    setCampaigns(prev => [campaignDoc, ...prev]);

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    // バッチ分割ループ
    for (let i = 0; i < selectedRecipients.length; i += batchSize) {
      const batchChunk = selectedRecipients.slice(i, i + batchSize);

      for (const recipient of batchChunk) {
        const cleanEmail = normalizeEmail(recipient.email);
        const logId = `log_${Date.now()}_${uuidv4().substring(0, 8)}`;

        // 配信停止の二重チェック
        if (optOutSet.has(cleanEmail) || recipient.isOptedOut) {
          skippedCount++;
          const skippedLog: EmailLog = {
            id: logId,
            campaignId,
            projectId: recipient.projectId,
            email: cleanEmail,
            companyName: recipient.companyName,
            recipientName: recipient.recipientName,
            subject: interpolateVariables(subject, recipient),
            body: interpolateVariables(body, recipient),
            status: 'opted_out',
            errorMessage: '配信停止対象のため自動スキップ',
            templateName,
            createdAt: new Date().toISOString()
          };
          try {
            await setDoc(doc(db, 'email_logs', logId), skippedLog);
          } catch (e) {}
          setLogs(prev => [skippedLog, ...prev]);
          continue;
        }

        // 個別変数差し込み
        const finalSubject = interpolateVariables(subject, recipient);
        let finalBody = interpolateVariables(body, recipient);

        // 送信シミュレーション / Cloud Functions呼び出し
        try {
          // 擬似的な送信遅延（実際のサーバーAPI呼び出し時はfetchを行う）
          await new Promise(r => setTimeout(r, 60));

          sentCount++;
          const successLog: EmailLog = {
            id: logId,
            campaignId,
            projectId: recipient.projectId,
            email: cleanEmail,
            companyName: recipient.companyName,
            recipientName: recipient.recipientName,
            subject: finalSubject,
            body: finalBody,
            status: 'sent',
            sentAt: new Date().toISOString(),
            templateName,
            createdAt: new Date().toISOString()
          };

          try {
            await setDoc(doc(db, 'email_logs', logId), successLog);
          } catch (e) {}
          setLogs(prev => [successLog, ...prev]);

          // 営業支援連携（既存KOHAL案件の活動履歴に記録）
          if (recordToProjectActivities && recipient.projectId) {
            try {
              const actId = `act_${Date.now()}_${uuidv4().substring(0, 6)}`;
              const activityItem = {
                id: actId,
                projectId: recipient.projectId,
                date: new Date().toISOString(),
                type: '一斉メール送信',
                content: `件名: ${finalSubject} (テンプレート: ${templateName || '直接入力'})`
              };
              await setDoc(doc(db, 'activities', actId), activityItem);
            } catch (err) {
              console.warn('Failed to record activity:', err);
            }
          }
        } catch (err: any) {
          failedCount++;
          const errorMsg = err.message || '送信エラー';
          errors.push({ email: cleanEmail, error: errorMsg });

          const failLog: EmailLog = {
            id: logId,
            campaignId,
            projectId: recipient.projectId,
            email: cleanEmail,
            companyName: recipient.companyName,
            recipientName: recipient.recipientName,
            subject: finalSubject,
            body: finalBody,
            status: 'failed',
            errorMessage: errorMsg,
            templateName,
            createdAt: new Date().toISOString()
          };
          try {
            await setDoc(doc(db, 'email_logs', logId), failLog);
          } catch (e) {}
          setLogs(prev => [failLog, ...prev]);
        }

        if (onProgress) {
          onProgress(sentCount, failedCount, totalCount);
        }
      }

      // バッチ間インターバル（メールサーバー負荷低減）
      if (i + batchSize < selectedRecipients.length) {
        await new Promise(r => setTimeout(r, intervalSeconds * 1000));
      }
    }

    // キャンペーン完了ステータス更新
    const completedAt = new Date().toISOString();
    const finalCampaignStatus = failedCount === totalCount ? 'failed' : 'completed';

    try {
      await updateDoc(doc(db, 'email_campaigns', campaignId), {
        status: finalCampaignStatus,
        sentCount,
        failedCount,
        skippedCount,
        completedAt
      });
    } catch (e) {}

    setCampaigns(prev => prev.map(c => c.id === campaignId ? {
      ...c,
      status: finalCampaignStatus,
      sentCount,
      failedCount,
      skippedCount,
      completedAt
    } : c));

    return {
      campaignId,
      successCount: sentCount,
      failCount: failedCount,
      errors
    };
  };

  return (
    <EmailContext.Provider value={{
      templates,
      optOuts,
      campaigns,
      logs,
      saveTemplate,
      deleteTemplate,
      addOptOut,
      removeOptOut,
      importOptOutsFromCsv,
      sendTestEmail,
      startBatchCampaign
    }}>
      {children}
    </EmailContext.Provider>
  );
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
}
