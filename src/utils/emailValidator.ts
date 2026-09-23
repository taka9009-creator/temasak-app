import { ExtractedRecipient, ExtractionSummary, OptOutContact } from '../types/email';

// RFC 5322準拠の一般的なメール形式正規表現
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  if (!email) return false;
  const clean = email.trim();
  // 簡易チェック + 正規表現
  if (clean.length < 5 || clean.length > 254) return false;
  return EMAIL_REGEX.test(clean);
}

/**
 * 抽出ルールに基づき、生の行データ配列から正規化・バリデーション・重複排除・配信停止判定を行う
 */
export function processRecipients(
  rawList: Array<{
    companyName?: string;
    recipientName?: string;
    phone?: string;
    email?: string;
    region?: string;
    salesRep?: string;
    status?: string;
    registeredDate?: string;
    lastContactDate?: string;
    rawRowData?: Record<string, string>;
    projectId?: string;
  }>,
  optOutList: OptOutContact[] = []
): { recipients: ExtractedRecipient[]; summary: ExtractionSummary } {
  const optOutSet = new Set(
    optOutList
      .filter(o => o.status === 'opted_out')
      .map(o => normalizeEmail(o.email))
  );

  const seenEmailSet = new Set<string>();
  const recipients: ExtractedRecipient[] = [];

  let validCount = 0;
  let noEmailCount = 0;
  let duplicateCount = 0;
  let invalidEmailCount = 0;
  let optedOutCount = 0;

  rawList.forEach((item, index) => {
    const rawEmail = (item.email || '').trim();
    const normalized = normalizeEmail(rawEmail);
    const id = item.projectId || `rec_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;

    let isValid = true;
    let validationError: string | undefined;
    let isDuplicate = false;
    let isOptedOut = false;

    if (!rawEmail) {
      isValid = false;
      validationError = '空欄';
      noEmailCount++;
    } else if (!isValidEmailFormat(normalized)) {
      isValid = false;
      validationError = '形式不正';
      invalidEmailCount++;
    } else if (seenEmailSet.has(normalized)) {
      isValid = false;
      isDuplicate = true;
      validationError = '重複';
      duplicateCount++;
    } else if (optOutSet.has(normalized)) {
      isValid = false;
      isOptedOut = true;
      validationError = '配信停止';
      optedOutCount++;
    } else {
      // 正常な一意メールアドレス
      seenEmailSet.add(normalized);
      validCount++;
    }

    // デフォルトで、有効なメールアドレスかつ配信停止・重複でないものを選択状態にする
    const isSelected = isValid;

    recipients.push({
      id,
      companyName: (item.companyName || '').trim(),
      recipientName: (item.recipientName || '').trim(),
      phone: (item.phone || '').trim(),
      email: normalized || rawEmail,
      region: (item.region || '').trim(),
      salesRep: (item.salesRep || '').trim(),
      status: (item.status || '未対応').trim(),
      registeredDate: item.registeredDate,
      lastContactDate: item.lastContactDate,
      isValidEmail: isValid,
      validationError,
      isDuplicate,
      isOptedOut,
      isSelected,
      rawRowData: item.rawRowData,
      projectId: item.projectId
    });
  });

  const selectedCount = recipients.filter(r => r.isSelected).length;

  const summary: ExtractionSummary = {
    totalRows: recipients.length,
    validCount,
    noEmailCount,
    duplicateCount,
    invalidEmailCount,
    optedOutCount,
    selectedCount
  };

  return { recipients, summary };
}

/**
 * 差し込み変数 {{会社名}}, {{氏名}}, {{担当者}}, {{地域}} を置換する
 */
export function interpolateVariables(
  template: string,
  recipient: ExtractedRecipient
): string {
  if (!template) return '';
  let result = template;
  result = result.replace(/{{\s*会社名\s*}}/g, recipient.companyName || '');
  result = result.replace(/{{\s*氏名\s*}}/g, recipient.recipientName || '');
  result = result.replace(/{{\s*担当者\s*}}/g, recipient.salesRep || '');
  result = result.replace(/{{\s*地域\s*}}/g, recipient.region || '');

  // もし rawRowData に他のカラムがあれば展開
  if (recipient.rawRowData) {
    Object.keys(recipient.rawRowData).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, recipient.rawRowData?.[key] || '');
    });
  }

  return result;
}

/**
 * 配信停止（オプトアウト）案内文の定型文
 */
export const OPTOUT_FOOTER_TEXT = `
--------------------------------------------------
※本メールは、過去にお名刺交換・資料請求・お問い合わせをいただいた皆様にお送りしております。
今後このようなご案内メールの配信を希望されない場合は、お手数ですが本メールにご返信いただくか、下記までご連絡いただけますようお願い申し上げます。
--------------------------------------------------`;
