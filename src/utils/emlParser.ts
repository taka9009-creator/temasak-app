/**
 * 📧 資料請求・お問い合わせフォーム（form-mailer）EMLパーサー
 * - .eml の MIME ヘッダー / multipart / base64 / quoted-printable / 文字コード(UTF-8, ISO-2022-JP, Shift_JIS)をブラウザ内で解析
 * - 本文の「【項目名】\n　値」形式を構造化し、新規案件フォームへ自動入力できる形にする
 * ※ファイルは外部へ送信せず、ブラウザ内だけで処理します
 */
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Project, NextAction } from '../types';
import { inferDepartment } from './roster42Data';

export interface ParsedInquiryEml {
  subject: string;
  receivedAt: string; // yyyy-MM-dd
  inquiryNo: string; // 受付番号
  clinicName: string; // 貴院名
  contactTitle: string; // ご担当役職
  contactPerson: string; // ご担当者名
  furigana: string;
  phone: string;
  email: string;
  postalCode: string;
  address: string;
  prefecture: string;
  products: string; // お問い合わせ商材
  inquiryTypes: string; // お問い合わせ種別
  rececon: string; // 電子カルテ/レセコン名
  reason: string; // お問い合わせ理由
  content: string; // お問い合わせ内容
  rawFields: Record<string, string>;
  bodyText: string;
}

type Headers = Record<string, string>;

function splitHeaderBody(raw: string): { headerText: string; body: string } {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) return { headerText: raw, body: '' };
  return { headerText: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}

function parseHeaders(headerText: string): Headers {
  const headers: Headers = {};
  // 折り返し行（先頭が空白/タブ）を連結
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ');
  unfolded.split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (!(key in headers)) headers[key] = val;
  });
  return headers;
}

function getParam(headerVal: string | undefined, name: string): string {
  if (!headerVal) return '';
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i');
  const m = headerVal.match(re);
  if (!m) return '';
  return (m[2] ?? m[1]).replace(/^"|"$/g, '');
}

function binaryStringToBytes(bin: string): Uint8Array {
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  const cs = (charset || 'utf-8').toLowerCase();
  const candidates = [cs, cs === 'shift_jis' || cs === 'sjis' ? 'shift_jis' : cs, 'utf-8'];
  for (const c of candidates) {
    try {
      return new TextDecoder(c).decode(bytes);
    } catch {
      // 次の候補へ
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    return binaryStringToBytes(atob(clean));
  } catch {
    return new Uint8Array();
  }
}

function decodeQuotedPrintableToBytes(qp: string): Uint8Array {
  const s = qp.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(s.charCodeAt(i) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** RFC2047 エンコードワード（=?utf-8?B?...?=）のデコード */
export function decodeMimeWords(input: string): string {
  if (!input) return '';
  return input
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset: string, enc: string, text: string) => {
      const bytes =
        enc.toUpperCase() === 'B'
          ? decodeBase64ToBytes(text)
          : decodeQuotedPrintableToBytes(text.replace(/_/g, ' '));
      return decodeBytes(bytes, charset);
    });
}

function decodePartBody(body: string, headers: Headers): string {
  const cte = (headers['content-transfer-encoding'] || '').toLowerCase();
  const charset = getParam(headers['content-type'], 'charset') || 'utf-8';
  let bytes: Uint8Array;
  // 貼り付けテキスト等で既にUnicode文字列になっている場合はそのまま返す
  if (!cte.includes('base64') && /[^\x00-\xff]/.test(body)) return body;
  if (cte.includes('base64')) bytes = decodeBase64ToBytes(body);
  else if (cte.includes('quoted-printable')) bytes = decodeQuotedPrintableToBytes(body);
  else bytes = binaryStringToBytes(body);
  return decodeBytes(bytes, charset);
}

/** MIME（multipart対応）からテキスト本文を取り出す */
function extractTextBody(raw: string): { headers: Headers; text: string } {
  const { headerText, body } = splitHeaderBody(raw);
  const headers = parseHeaders(headerText);
  const ctype = (headers['content-type'] || 'text/plain').toLowerCase();

  if (ctype.startsWith('multipart/')) {
    const boundary = getParam(headers['content-type'], 'boundary');
    if (boundary) {
      const parts = body.split(`--${boundary}`).slice(1);
      let htmlFallback = '';
      for (const part of parts) {
        if (part.trim().startsWith('--')) break;
        const inner = extractTextBody(part.replace(/^\r?\n/, ''));
        const innerType = (inner.headers['content-type'] || 'text/plain').toLowerCase();
        if (innerType.startsWith('text/plain') && inner.text.trim()) return { headers, text: inner.text };
        if (innerType.startsWith('text/html') && !htmlFallback) htmlFallback = inner.text;
        if (innerType.startsWith('multipart/') && inner.text.trim()) return { headers, text: inner.text };
      }
      if (htmlFallback) return { headers, text: htmlToText(htmlFallback) };
    }
    return { headers, text: '' };
  }

  const decoded = decodePartBody(body, headers);
  return { headers, text: ctype.startsWith('text/html') ? htmlToText(decoded) : decoded };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** 本文の「【項目名】\n　値」形式を Key-Value 化 */
export function parseBracketFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let currentKey = '';
  let buf: string[] = [];
  const flush = () => {
    if (currentKey) {
      fields[currentKey] = buf
        .map(l => l.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
        .filter(l => l && !/^-{3,}$/.test(l))
        .join('\n')
        .trim();
    }
  };
  for (const line of lines) {
    const m = line.match(/^\s*【([^】]+)】\s*(.*)$/);
    if (m) {
      flush();
      currentKey = m[1].trim();
      buf = m[2] ? [m[2]] : [];
    } else if (currentKey) {
      buf.push(line);
    }
  }
  flush();

  // 「受付番号 ： 3543」形式
  const noMatch = text.match(/受付番号\s*[：:]\s*(\d+)/);
  if (noMatch) fields['受付番号'] = noMatch[1];
  return fields;
}

const PREFS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県',
  '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県',
  '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

function pick(fields: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(fields).find(f => f.replace(/\s/g, '').includes(k));
    if (hit && fields[hit]) return fields[hit];
  }
  return '';
}

function normalizePhone(v: string): string {
  return v
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－ー―‐]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '')
    .trim();
}

function toYmd(dateHeader: string | undefined): string {
  if (dateHeader) {
    const d = new Date(dateHeader);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  }
  return format(new Date(), 'yyyy-MM-dd');
}

/** 本文テキスト（またはEML全体）から問い合わせ情報を構造化 */
export function buildInquiryFromText(bodyText: string, opts?: { subject?: string; dateHeader?: string }): ParsedInquiryEml {
  const fields = parseBracketFields(bodyText);

  const subject = opts?.subject || '';
  const subjNo = subject.match(/[［\[](\d+)[］\]]/);
  const inquiryNo = fields['受付番号'] || (subjNo ? subjNo[1] : '');

  // 住所: 「064-0954 北海道 札幌市中央区...」→ 郵便番号と住所に分離
  const rawAddr = pick(fields, ['住所', '所在地']).replace(/\s+/g, ' ').trim();
  const postalMatch = rawAddr.match(/^〒?\s*(\d{3}-?\d{4})\s*/);
  const postalCode = postalMatch ? postalMatch[1] : '';
  const addressBody = (postalMatch ? rawAddr.slice(postalMatch[0].length) : rawAddr).replace(/\s+/g, '').trim();
  const prefecture = PREFS.find(p => addressBody.startsWith(p)) || '';

  return {
    subject,
    receivedAt: toYmd(opts?.dateHeader),
    inquiryNo,
    clinicName: pick(fields, ['貴院名', '医院名', 'クリニック名', '病院名', '会社名', '施設名']),
    contactTitle: pick(fields, ['役職']),
    contactPerson: pick(fields, ['担当者名', 'お名前', '氏名']),
    furigana: pick(fields, ['フリガナ', 'ふりがな']),
    phone: normalizePhone(pick(fields, ['電話番号', 'TEL', '電話'])),
    email: pick(fields, ['メールアドレス', 'Email', 'E-mail', 'メール']).replace(/\s+/g, ''),
    postalCode,
    address: addressBody,
    prefecture,
    products: pick(fields, ['お問い合わせ商材', '商材', '製品']),
    inquiryTypes: pick(fields, ['お問い合わせ種別', '種別']),
    rececon: pick(fields, ['レセコン', '電子カルテ']),
    reason: pick(fields, ['お問い合わせ理由', '理由']),
    content: pick(fields, ['お問い合わせ内容', '内容', 'ご要望']),
    rawFields: fields,
    bodyText
  };
}

/** EMLファイル全文（文字列）を解析 */
export function parseInquiryEml(rawEml: string): ParsedInquiryEml {
  const { headers, text } = extractTextBody(rawEml);
  // EMLヘッダーが無い（本文だけ貼り付け）場合はそのまま本文として扱う
  const looksLikeEml = !!(headers['from'] || headers['subject'] || headers['content-type']);
  const bodyText = looksLikeEml ? text : rawEml;
  return buildInquiryFromText(bodyText, {
    subject: decodeMimeWords(headers['subject'] || ''),
    dateHeader: headers['date']
  });
}

/** File(.eml / .txt) を読み込み解析（バイナリ安全に latin1 で読み、MIME層で文字コード変換） */
export function readInquiryEmlFile(file: File): Promise<ParsedInquiryEml> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const buf = new Uint8Array(reader.result as ArrayBuffer);
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < buf.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
        }
        const isEml = /^[\x20-\x7e]+:/m.test(bin.slice(0, 2000)) && /\r?\n\r?\n/.test(bin);
        if (isEml) {
          resolve(parseInquiryEml(bin));
        } else {
          // ヘッダー無しのテキスト（UTF-8想定）
          resolve(buildInquiryFromText(new TextDecoder('utf-8').decode(buf)));
        }
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** 問い合わせ商材 → テマサック機種表記 */
export function inferDeviceTypeFromProducts(products: string): string {
  if (!products) return '';
  const list = products.split(/[,、，\n]/).map(s => s.trim()).filter(Boolean);
  return list.join(' / ');
}

/** 複数 .eml / .txt ファイルをまとめて読み込み解析 */
export async function readInquiryEmlFiles(files: FileList | File[]): Promise<ParsedInquiryEml[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map(file => readInquiryEmlFile(file)));
}

/** 貼り付けテキストが問い合わせメール（EMLまたは【項目名】形式）かどうかを判定 */
export function isInquiryEmailText(text: string): boolean {
  if (!text) return false;
  return (
    /【(貴院名|医院名|クリニック名|病院名|会社名|施設名|電話番号|メールアドレス|お問い合わせ内容)】/.test(text) ||
    (/^Subject:.*\r?\n/mi.test(text) && /受付番号|Content-Transfer-Encoding/i.test(text))
  );
}

/** EMLから案件メモ文字列を生成 */
export function formatEmlMemo(parsed: ParsedInquiryEml): string {
  return [
    parsed.inquiryNo ? `【反響#${parsed.inquiryNo}】資料請求・お問い合わせフォーム` : '【資料請求・お問い合わせフォーム】',
    parsed.products && `商材: ${parsed.products}`,
    parsed.inquiryTypes && `種別: ${parsed.inquiryTypes}`,
    parsed.reason && `理由: ${parsed.reason}`,
    parsed.content && `内容: ${parsed.content}`
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeClinicMatchName(s: string): string {
  return (s || '').replace(/[\s\u3000]|株式会社|医療法人社団|医療法人|（株）|\(株\)/g, '');
}

/** 既存案件リストから名称・電話番号・反響番号で一致候補を検索 */
export function findMatchingProjectsForEml(
  projects: Project[],
  criteria: { clinicName?: string; phone?: string; inquiryNo?: string }
): Project[] {
  const name = normalizeClinicMatchName(criteria.clinicName || '');
  const phoneDigits = (criteria.phone || '').replace(/\D/g, '');
  const inqNo = (criteria.inquiryNo || '').trim();
  return projects.filter(p => {
    const pName = normalizeClinicMatchName(p.clinicName);
    if (name.length > 2 && pName && (pName.includes(name) || name.includes(pName))) return true;
    if (phoneDigits.length >= 9 && (p.phone || '').replace(/\D/g, '') === phoneDigits) return true;
    if (
      inqNo &&
      ((p.sourceDetail || '').includes(`反響番号: ${inqNo}`) || (p.memo || '').includes(`反響#${inqNo}`))
    ) {
      return true;
    }
    return false;
  });
}

/** 解析済みEMLから既存案件への更新ペイロードを生成 */
export function buildProjectUpdatesFromEml(existing: Project, parsed: ParsedInquiryEml): Partial<Project> {
  const isDirector = (parsed.contactTitle || '').includes('院長') || (parsed.contactTitle || '').includes('理事長');
  const deviceType = inferDeviceTypeFromProducts(parsed.products);
  const purposeText = parsed.content
    ? parsed.reason
      ? `${parsed.reason}（${parsed.content}）`
      : parsed.content
    : parsed.reason || '';

  const emlMemo = formatEmlMemo(parsed);
  let nextMemo = existing.memo || '';
  if (!nextMemo.trim()) {
    nextMemo = emlMemo;
  } else if (parsed.content && !nextMemo.includes(parsed.content)) {
    nextMemo = `${nextMemo}\n--- [EML取込 #${parsed.inquiryNo || '-'}] ---\n${emlMemo}`;
  }

  return {
    email: parsed.email || existing.email,
    contactPerson: parsed.contactPerson || existing.contactPerson,
    contactTitle: parsed.contactTitle || existing.contactTitle,
    phone: parsed.phone || existing.phone,
    address: parsed.address || existing.address,
    reservationSystem: parsed.rececon || existing.reservationSystem,
    product: parsed.products ? `テマサック（${parsed.products}）` : existing.product,
    sourceDetail: existing.sourceDetail || (parsed.inquiryNo ? `反響番号: ${parsed.inquiryNo}` : undefined),
    memo: nextMemo,
    pipelineMap: {
      ...(existing.pipelineMap || {}),
      ...(isDirector && parsed.contactPerson ? { director: parsed.contactPerson } : {}),
      ...(parsed.rececon ? { receiptComputer: parsed.rececon } : {}),
      ...(deviceType ? { deviceType } : {}),
      ...(parsed.inquiryTypes ? { inquiryType: parsed.inquiryTypes } : {}),
      ...(purposeText ? { purpose: purposeText } : {})
    }
  };
}

/** 解析済みEMLから新規 Project と初回 NextAction を生成 */
export function createProjectAndActionFromEml(
  parsed: ParsedInquiryEml,
  opts: { salesRep: string; initialStatus: string }
): { project: Project; action: NextAction } {
  const projectId = `prod-${uuidv4()}`;
  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const receivedAt = parsed.receivedAt || todayYmd;
  const clinicName = parsed.clinicName.trim() || '新規お問い合わせ案件';
  const department = inferDepartment(clinicName);
  const isDirector = (parsed.contactTitle || '').includes('院長') || (parsed.contactTitle || '').includes('理事長');
  const nowIso = new Date().toISOString();

  const project: Project = {
    id: projectId,
    clinicName,
    clinicType: department === '医療機関' ? 'クリニック' : department,
    address: parsed.address.trim(),
    phone: parsed.phone.trim(),
    email: parsed.email.trim(),
    contactPerson: parsed.contactPerson.trim(),
    contactTitle: parsed.contactTitle.trim() || '担当者',
    memo: formatEmlMemo(parsed),
    source: 'HP資料請求・お問い合わせフォーム',
    sourceDetail: parsed.inquiryNo ? `反響番号: ${parsed.inquiryNo}` : undefined,
    receivedAt,
    salesRep: opts.salesRep,
    product: parsed.products ? `テマサック（${parsed.products}）` : 'テマサック自動精算機',
    quantity: 1,
    status: opts.initialStatus,
    priority: '高',
    lastActivityAt: todayYmd,
    ballHolder: opts.salesRep,
    isImplementationProject: false,
    reservationSystem: parsed.rececon.trim() || undefined,
    activities: [
      {
        id: `act-rec-${projectId}`,
        projectId,
        date: receivedAt,
        type: '反響受付',
        content: `資料請求・お問い合わせフォーム（受付番号: ${parsed.inquiryNo || '-'}）をEMLから取込。種別: ${parsed.inquiryTypes || '-'} / 商材: ${parsed.products || '-'}`
      }
    ],
    pipelineMap: {
      department: department === '医療機関' ? undefined : department,
      receiptComputer: parsed.rececon.trim() || undefined,
      director: isDirector ? parsed.contactPerson.trim() : undefined,
      deviceType: inferDeviceTypeFromProducts(parsed.products) || undefined,
      inquiryType: parsed.inquiryTypes || undefined,
      purpose: parsed.content
        ? parsed.reason
          ? `${parsed.reason}（${parsed.content}）`
          : parsed.content
        : parsed.reason || undefined
    },
    aiSummary: `【${parsed.address || '住所未設定'}】反響日:${receivedAt}（HPフォーム #${parsed.inquiryNo || '-'}）。理由: ${parsed.reason || '-'}。${parsed.content ? `要望: ${parsed.content}` : ''}`,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const action: NextAction = {
    id: uuidv4(),
    projectId,
    title: parsed.inquiryTypes.includes('資料請求') ? '資料到着確認の初回架電（ファーストコール）' : '初回電話ヒアリング',
    assignee: opts.salesRep,
    deadline: todayYmd,
    priority: '高',
    status: '未完了',
    memo: parsed.content ? `ご要望: ${parsed.content.slice(0, 80)}` : '',
    createdAt: nowIso
  };

  return { project, action };
}

/** テスト・デモ用サンプルEMLテキスト（受付番号 3543） */
export const SAMPLE_EML_3543_TEXT = `Date: Sun, 30 Aug 2026 11:31:39 +0900
Subject: 資料請求・お問い合わせフォームよりお問い合わせがありました。［3543］
From: フォームメーラー <admin@form-mailer.jp>

----
　受付番号 ： 3543
----
【貴院名】
　あみたに動物病院
【ご担当役職】
　院長
【ご担当者名】
　網谷誠
【フリガナ】
　
【電話番号】
　011 - 215 - 7881
【メールアドレス】
　amitani-ah@wf6.so-net.ne.jp
【住所】
　064-0954 北海道 札幌市中央区宮の森四条5-3-25
【お問い合わせ商材】
　テマサックPro スタンドタイプ,テマサックPro カウンタータイプ
【お問い合わせ種別】
　資料請求,その他ご相談/質問
【電子カルテ/レセコン名】
　アニコムレセプター
【お問い合わせ理由】
　業務の効率化
【お問い合わせ内容】
　人員不足の為セミセルフレジを検討しています。導入について、実際の使用感を知りたいです。
【送信確認】
　プライバシーポリシーに同意する`;
