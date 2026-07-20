// server.js
const express = require('express');
const path = require('path');
const { parseMessage } = require('./parser');
const { categorize } = require('./categorize');
const { detectRecurring } = require('./recurring');
const storage = require('./storage');

const app = express();
app.use(express.json());
app.use(express.text({ type: '*/*', limit: '200kb' })); // MacroDroid가 plain text로 보낼 수도 있음

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'changeme';

function checkSecret(req, res) {
  const secret = req.query.secret || req.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) {
    res.status(401).json({ ok: false, error: 'invalid secret' });
    return false;
  }
  return true;
}

// MacroDroid/Tasker 등에서 문자·알림 텍스트를 이 엔드포인트로 전송한다.
// body 예시: { "message": "...", "appName": "IBK기업은행" }
// 또는 그냥 raw text로 message만 보내도 동작한다.
app.post('/webhook', (req, res) => {
  if (!checkSecret(req, res)) return;

  let message, appName;
  if (typeof req.body === 'string') {
    message = req.body;
    appName = req.query.appName || '';
  } else {
    message = req.body.message;
    appName = req.body.appName || '';
  }

  if (!message) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  const parsed = parseMessage(message, { appName });
  if (!parsed) {
    return res.status(422).json({ ok: false, error: 'could not parse message', raw: message });
  }

  const added = storage.addTransaction(parsed);
  if (!added) {
    return res.json({ ok: true, duplicate: true });
  }

  res.json({ ok: true, transaction: added });
});

// 거래 목록 조회 (year, month 쿼리로 필터링)
app.get('/api/transactions', (req, res) => {
  const { year, month } = req.query;
  let transactions = storage.load();
  if (year) transactions = transactions.filter(t => String(t.year) === String(year));
  if (month) transactions = transactions.filter(t => String(t.month) === String(month));

  const recurringIds = detectRecurring(storage.load());
  transactions = transactions
    .map(t => ({
      ...t,
      category: t.category || categorize(t.counterparty),
      isFixed: recurringIds.has(t.id),
    }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.day - a.day) || (b.hour - a.hour) || (b.minute - a.minute));

  res.json({ ok: true, transactions });
});

// 월별 요약 (카테고리별 합계, 고정/변동 지출 합계)
app.get('/api/summary', (req, res) => {
  const { year, month } = req.query;
  const all = storage.load();
  const recurringIds = detectRecurring(all);

  const filtered = all.filter(t => (!year || String(t.year) === String(year)) && (!month || String(t.month) === String(month)));

  const expenses = filtered.filter(t => t.direction === 'expense');
  const income = filtered.filter(t => t.direction === 'income');

  const byCategory = {};
  let fixedTotal = 0;
  let variableTotal = 0;

  for (const t of expenses) {
    const cat = t.category || categorize(t.counterparty);
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    if (recurringIds.has(t.id)) fixedTotal += t.amount;
    else variableTotal += t.amount;
  }

  res.json({
    ok: true,
    totalExpense: expenses.reduce((s, t) => s + t.amount, 0),
    totalIncome: income.reduce((s, t) => s + t.amount, 0),
    fixedTotal,
    variableTotal,
    byCategory,
    count: expenses.length,
  });
});

app.patch('/api/transactions/:id', (req, res) => {
  const updated = storage.updateTransaction(req.params.id, req.body);
  if (!updated) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, transaction: updated });
});

app.delete('/api/transactions/:id', (req, res) => {
  const ok = storage.deleteTransaction(req.params.id);
  res.json({ ok });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`moneymap server listening on port ${PORT}`);
});
