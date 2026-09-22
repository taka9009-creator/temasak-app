/**
 * 音声発話テキストから案件・ToDo情報を抽出するスマートパーサー
 * （schedule-voice-proto のコアNLPロジックをテマサック用に最適化）
 */

export interface ParsedVoiceResult {
  clinicName: string;
  contactPerson: string;
  todoTitle: string;
  deadline: string; // YYYY-MM-DD
  time?: string; // HH:MM
  priority: '高' | '中' | '低';
  memo: string;
  rawText: string;
}

// 相対日付の計算 (今日 + offsetDays)
export function getRelativeDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseVoiceTextLocally(text: string): ParsedVoiceResult {
  const cleanText = text.trim();
  const todayStr = getRelativeDateString(0);

  // 1. 日付の抽出
  let deadline = todayStr;
  let timeStr = '';

  if (cleanText.includes('明々後日') || cleanText.includes('しあさって')) {
    deadline = getRelativeDateString(3);
  } else if (cleanText.includes('明後日') || cleanText.includes('あさって')) {
    deadline = getRelativeDateString(2);
  } else if (cleanText.includes('明日') || cleanText.includes('あした') || cleanText.includes('あす')) {
    deadline = getRelativeDateString(1);
  } else {
    // ○月○日 のマッチ
    const monthDayMatch = cleanText.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const yyyy = new Date().getFullYear();
      const mm = String(parseInt(monthDayMatch[1], 10)).padStart(2, '0');
      const dd = String(parseInt(monthDayMatch[2], 10)).padStart(2, '0');
      deadline = `${yyyy}-${mm}-${dd}`;
    } else {
      // 曜日マッチ（例: 来週火曜、水曜日）
      const weekdayMatch = cleanText.match(/(来週|今週)?(?:の)?(月|火|水|木|金|土|日)曜?/);
      if (weekdayMatch) {
        const dayMap: Record<string, number> = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
        const targetDay = dayMap[weekdayMatch[2]];
        const now = new Date();
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (weekdayMatch[1] === '来週' || diff <= 0) {
          diff += 7;
        }
        deadline = getRelativeDateString(diff);
      }
    }
  }

  // 2. 時刻の抽出（例: 14時、14:30、午前10時、午後3時など）
  const timeMatch = cleanText.match(/(?:(午前|午後))?(\d{1,2})時(?:(\d{1,2})分|半)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[1] === '午後' || (hour < 8 && !timeMatch[1]); // 8時未満で午前指定がなければ午後と推測
    if (isPM && hour < 12) hour += 12;
    
    let minute = '00';
    if (timeMatch[0].includes('半')) {
      minute = '30';
    } else if (timeMatch[3]) {
      minute = String(parseInt(timeMatch[3], 10)).padStart(2, '0');
    }
    timeStr = `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // 3. クリニック名・医療機関名の抽出
  let clinicName = '';
  // 「〇〇クリニック」「〇〇医院」「〇〇病院」「〇〇歯科」などを検出
  const clinicMatch = cleanText.match(/([^\s、,。]+(?:クリニック|医院|病院|内科|眼科|小児科|耳鼻科|皮膚科|整形外科|歯科|デンタル|メディカル))/);
  if (clinicMatch) {
    clinicName = clinicMatch[1].replace(/^(で|に|の|へ)/, '').trim();
  } else {
    // 「〜様」「〜先生」「〜さん」
    const personMatch = cleanText.match(/([^\s、,。]+)(?:先生|様|さん)/);
    if (personMatch) {
      clinicName = `${personMatch[1]}様 案件`;
    }
  }

  // 4. 担当者・院長名の抽出
  let contactPerson = '';
  const doctorMatch = cleanText.match(/([^\s、,。]+(?:院長|先生|理事長|部長|事務長))/);
  if (doctorMatch) {
    contactPerson = doctorMatch[1];
  }

  // 5. アクション内容（ToDoタイトル）の抽出
  let todoTitle = '初回ヒアリング';
  if (cleanText.includes('デモ') && (cleanText.includes('訪問') || cleanText.includes('対面'))) {
    todoTitle = '訪問デモ・実機実演';
  } else if (cleanText.includes('デモ') || cleanText.includes('オンライン')) {
    todoTitle = 'オンラインデモ実施';
  } else if (cleanText.includes('見積') || cleanText.includes('資料') || cleanText.includes('パンフ') || cleanText.includes('送付')) {
    todoTitle = '資料・見積書の作成送付';
  } else if (cleanText.includes('現調') || cleanText.includes('下見') || cleanText.includes('工事')) {
    todoTitle = '現地調査（設置下見）';
  } else if (cleanText.includes('電話') || cleanText.includes('コール') || cleanText.includes('ヒアリング')) {
    todoTitle = '電話ヒアリング・状況確認';
  } else if (cleanText.includes('商談') || cleanText.includes('面談') || cleanText.includes('打合せ')) {
    todoTitle = '商談・面談実施';
  } else if (cleanText.includes('設置') || cleanText.includes('納品')) {
    todoTitle = '納品・設置作業';
  }

  // もし時刻情報があればタイトルに添える
  if (timeStr) {
    todoTitle = `${timeStr} ${todoTitle}`;
  }

  // 6. 優先度判定
  let priority: '高' | '中' | '低' = '中';
  if (cleanText.includes('至急') || cleanText.includes('急ぎ') || cleanText.includes('最優先') || cleanText.includes('緊急') || deadline === todayStr) {
    priority = '高';
  } else if (cleanText.includes('情報収集') || cleanText.includes('時期未定') || cleanText.includes('ゆっくり')) {
    priority = '低';
  }

  // 7. メモの作成
  let memo = cleanText;

  return {
    clinicName: clinicName || '新規お問い合わせ案件',
    contactPerson,
    todoTitle,
    deadline,
    time: timeStr,
    priority,
    memo,
    rawText: cleanText
  };
}
