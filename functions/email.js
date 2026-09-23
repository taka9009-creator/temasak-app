const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// メール送信トランスポーターの初期化
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // 設定がない場合はモックトランスポーター（開発・検証用）
  return {
    sendMail: async (options) => {
      logger.info("[Mock Mailer] Sending simulated email to:", options.to, "Subject:", options.subject);
      return { messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` };
    }
  };
}

/**
 * 1通テスト送信用エンドポイント
 */
exports.sendTestEmail = onRequest({ cors: true, region: "asia-northeast1", invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }
  res.set("Access-Control-Allow-Origin", "*");

  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    res.status(400).json({ error: "宛先(to)、件名(subject)、本文(body)は必須です。" });
    return;
  }

  try {
    const transporter = createTransporter();
    const fromAddress = process.env.MAIL_FROM || '"テマサック営業担当" <noreply@temasak-sales.jp>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `[テスト送信] ${subject}`,
      text: body
    });

    logger.info("Test mail sent successfully:", info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    logger.error("Error sending test mail:", error);
    res.status(500).json({ error: `テストメール送信に失敗しました: ${error.message}` });
  }
});

/**
 * バッチ個別一斉送信用エンドポイント
 */
exports.processEmailBatch = onRequest({ cors: true, region: "asia-northeast1", invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }
  res.set("Access-Control-Allow-Origin", "*");

  const { campaignId, items } = req.body || {};
  if (!campaignId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "campaignId と items 配列が必要です。" });
    return;
  }

  try {
    const db = admin.firestore();
    const transporter = createTransporter();
    const fromAddress = process.env.MAIL_FROM || '"テマサック営業担当" <noreply@temasak-sales.jp>';

    // サーバーサイドでの最新配信停止リスト取得
    const optOutSnapshot = await db.collection("email_optouts").get();
    const optOutSet = new Set(
      optOutSnapshot.docs
        .map(doc => doc.data())
        .filter(d => d.status === "opted_out")
        .map(d => (d.email || "").trim().toLowerCase())
    );

    const results = [];

    for (const item of items) {
      const cleanEmail = (item.email || "").trim().toLowerCase();

      // 配信停止チェック
      if (optOutSet.has(cleanEmail)) {
        results.push({ email: cleanEmail, status: "opted_out", message: "配信停止指定のためスキップ" });
        continue;
      }

      try {
        const info = await transporter.sendMail({
          from: fromAddress,
          to: cleanEmail,
          subject: item.subject,
          text: item.body
        });

        results.push({ email: cleanEmail, status: "sent", messageId: info.messageId });
      } catch (err) {
        logger.error(`Send failed for ${cleanEmail}:`, err);
        results.push({ email: cleanEmail, status: "failed", error: err.message });
      }
    }

    res.status(200).json({ success: true, count: results.length, results });
  } catch (error) {
    logger.error("Batch processing error:", error);
    res.status(500).json({ error: `一斉送信バッチ処理に失敗しました: ${error.message}` });
  }
});
