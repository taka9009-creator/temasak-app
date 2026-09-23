export interface ExtractedRecipient {
  id: string;
  companyName: string;
  recipientName: string;
  phone: string;
  email: string;
  region: string;
  salesRep: string;
  status: string;
  registeredDate?: string;
  lastContactDate?: string;
  
  // バリデーション & 判定フラグ
  isValidEmail: boolean;
  validationError?: string; // '空欄' | '形式不正' | '重複' | '配信停止'
  isDuplicate: boolean;
  isOptedOut: boolean;
  
  // 送信対象選択
  isSelected: boolean;
  
  // 元データ（差し込み用のカスタムカラム保持）
  rawRowData?: Record<string, string>;
  projectId?: string; // KOHAL既存案件と紐付く場合
}

export interface ExtractionSummary {
  totalRows: number;
  validCount: number;
  noEmailCount: number;
  duplicateCount: number;
  invalidEmailCount: number;
  optedOutCount: number;
  selectedCount: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'initial' | 'document' | 'exhibition' | 'campaign' | 'followup' | 'case_study' | 'subsidy' | 'custom';
  subject: string;
  body: string;
  includeOptOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OptOutContact {
  id: string;
  email: string;
  companyName?: string;
  recipientName?: string;
  reason?: string;
  status: 'opted_out' | 'active' | 'unknown';
  registeredAt: string;
}

export interface EmailCampaign {
  id: string;
  userId: string;
  title: string;
  subject: string;
  body: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: 'draft' | 'sending' | 'completed' | 'failed' | 'paused';
  batchSize: number;
  intervalSeconds: number;
  createdAt: string;
  completedAt?: string;
  templateName?: string;
}

export interface EmailLog {
  id: string;
  campaignId: string;
  projectId?: string;
  email: string;
  companyName: string;
  recipientName: string;
  subject: string;
  body: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'opted_out';
  errorMessage?: string;
  templateName?: string;
  sentAt?: string;
  createdAt: string;
}

export interface SendEmailItem {
  id: string;
  email: string;
  companyName: string;
  recipientName: string;
  salesRep: string;
  region: string;
  subject: string;
  body: string;
  projectId?: string;
}

export interface ColumnMapping {
  companyName: string;
  recipientName: string;
  email: string;
  phone: string;
  region: string;
  salesRep: string;
  status: string;
}
