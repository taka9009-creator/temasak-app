import * as XLSX from 'xlsx';
import { ColumnMapping } from '../types/email';

export interface ParsedSheetData {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  inferredMapping: ColumnMapping;
}

// カラム名自動判定用辞書
const MAPPING_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  email: ['メール', 'メールアドレス', 'e-mail', 'email', 'mail', 'アドレス', 'mailaddress', '宛先'],
  companyName: ['会社名', '法人名', '施設名', '医院名', 'クリニック名', '組織名', '名称', '会社', '顧客名', '企業名'],
  recipientName: ['氏名', '名前', '担当者名', 'ご担当者', '代表者名', 'お名前', 'name'],
  phone: ['電話番号', '電話', 'tel', '携帯番号', '連絡先'],
  region: ['地域', '住所', '都道府県', '市区町村', '所在地', 'エリア', 'city', 'pref'],
  salesRep: ['担当者', '営業担当', '自社担当', '営業', '担当'],
  status: ['ステータス', '進捗', '状態', '対応状況', '状況', 'フェーズ']
};

export function inferColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    email: '',
    companyName: '',
    recipientName: '',
    phone: '',
    region: '',
    salesRep: '',
    status: ''
  };

  const lowerHeaders = headers.map(h => ({
    original: h,
    lower: h.trim().toLowerCase()
  }));

  (Object.keys(MAPPING_KEYWORDS) as (keyof ColumnMapping)[]).forEach(field => {
    const keywords = MAPPING_KEYWORDS[field];
    
    // 完全一致優先
    const exact = lowerHeaders.find(h => keywords.some(k => h.lower === k));
    if (exact) {
      mapping[field] = exact.original;
      return;
    }

    // 部分一致
    const partial = lowerHeaders.find(h => keywords.some(k => h.lower.includes(k)));
    if (partial) {
      mapping[field] = partial.original;
    }
  });

  return mapping;
}

/**
 * CSV または Excel (.xlsx / .xls) ファイルをパースして構造化データを返す
 */
export async function parseCustomerFile(file: File): Promise<ParsedSheetData> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'csv') {
    return parseCsvFile(file);
  } else if (['xlsx', 'xls'].includes(extension)) {
    return parseExcelFile(file);
  } else {
    throw new Error('サポートされていないファイル形式です。CSVまたはExcel(.xlsx)を選択してください。');
  }
}

/**
 * CSVファイルをパース（Shift_JIS / UTF-8 自動判別）
 */
async function parseCsvFile(file: File): Promise<ParsedSheetData> {
  const buffer = await file.arrayBuffer();
  
  let text = new TextDecoder('utf-8').decode(buffer);
  // 文字化け判定（Shift-JISフォールバック）
  if (text.includes('\uFFFD') || text.includes('莨') || text.includes('菴') || text.includes('驛')) {
    text = new TextDecoder('shift-jis').decode(buffer);
  }

  // 行分割
  const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('CSVファイルが空です。');
  }

  // 簡易カンマ区切り（引用符対応）
  const parseLine = (line: string): string[] => {
    const row: string[] = [];
    let inQuotes = false;
    let token = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += char;
      }
    }
    row.push(token.trim());
    return row;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIndex) => {
      rowObj[h] = values[colIndex] || '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    fileName: file.name,
    inferredMapping: inferColumnMapping(headers)
  };
}

/**
 * Excel (.xlsx / .xls) ファイルをパース
 */
async function parseExcelFile(file: File): Promise<ParsedSheetData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excelファイル内にシートが見つかりませんでした。');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

  if (jsonData.length === 0) {
    throw new Error('シート内にデータがありません。');
  }

  const rawHeaders = jsonData[0] as any[];
  const headers = rawHeaders.map(h => (h !== undefined && h !== null ? String(h).trim() : ''));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rawRow = jsonData[i] as any[];
    if (!rawRow || rawRow.length === 0) continue;

    const rowObj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, colIndex) => {
      if (!h) return;
      const val = rawRow[colIndex] !== undefined && rawRow[colIndex] !== null ? String(rawRow[colIndex]).trim() : '';
      if (val) hasValue = true;
      rowObj[h] = val;
    });

    if (hasValue) {
      rows.push(rowObj);
    }
  }

  return {
    headers: headers.filter(h => h.length > 0),
    rows,
    fileName: file.name,
    inferredMapping: inferColumnMapping(headers)
  };
}
