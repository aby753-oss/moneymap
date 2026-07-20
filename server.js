// server.js
const express = require('express');
const path = require('path');
const { parseMessage } = require('./parser');
const { suggestCategory } = require('./categorize');
const { detectRecurring } = require('./recurring');
const { currentCycle, cycleRangeLabel } = require('./cycle');
const storage = require('./storage');
const settingsStore = require('./settingsStore');
const fixedExpenseStore = require('./fixedExpenseStore');

const app = express();
app.use(express.json());
app.use(express.text({ type: '*/*', limit: '200kb' }));

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

// ---------- 알림(경고) 발송 ----------
async function sendNtfy(topic, message) {
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: message,
      headers: { Title: '이번 달 소비 통장', Priority: 'default', Tags: 'moneybag' },
    });
  } catch (e) {
    console.error('ntfy 전송 실패', e.message);
  }
}

function fmt(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

async function checkAndSendAlerts(cycleYear, cycleMonth) {
  const settings = settingsStore.load();
  const all = storage.load();
  const recurringIds = detectRecurring(all);

  const cycleTx = all.filter(t => t.cycleYear === cycleYear && t.cycleMonth === cycleMonth);
  const incomeThisCycle = cycleTx.filter(t => t.bucket === 'income').reduce((s, t) => s + t.amount, 0);
  const variableTotal = cycleTx
    .filter(t => t.bucket === 'expense' && !recurringIds.has(t.id))
    .reduce((s, t) => s + t.amount, 0);

  const effectiveIncome = settings.monthlyIncome > 0 ? settings.monthlyIncome : incomeThisCycle;
  if (effectiveIncome <= 0) return;

  const percent = (variableTotal / effectiveIncome) * 100;
  const allThresholds = [...settings.warningThresholds, settings.strongWarningThreshold]
    .map(Number).sort((a, b) => a - b);

  let crossed = 0;
  for (const t of allThresholds) {
    if (percent >= t) crossed = t;
  }

  const cycleKey = `${cycleYear}-${cycleMonth}`;
  const lastLevel = settings.lastAlertLevel[cycleKey] || 0;

  if (crossed > lastLevel) {
    const message = crossed >= settings.strongWarningThreshold
      ? settings.strongWarningMessage
      : `이번 달(정산주기) 변동지출이 수입의 ${crossed}%를 넘었어요. 현재 ${fmt(variableTotal)}원 사용했어요.`;

    if (settings.notifyMethod === 'ntfy') {
      await sendNtfy(settings.ntfyTopic, message);
    }

    settings.lastAlertLevel[cycleKey] = crossed;
    settingsStore.save(settings);
  }
}

// ---------- 웹훅 ----------
// body 예시: { "message": "...", "appName": "IBK기업은행", "isNotification": true }
app.post('/webhook', async (req, res) => {
  if (!checkSecret(req, res)) return;

  let message, appName, isNotification;
  if (typeof req.body === 'string') {
    message = req.body;
    appName = req.query.appName || '';
    isNotification = req.query.isNotification === 'true';
  } else {
    message = req.body.message;
    appName = req.body.appName || '';
    isNotification = !!req.body.isNotification;
  }

  if (!message) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  const parsed = parseMessage(message, { appName, isNotification });
  if (!parsed) {
    return res.status(422).json({ ok: false, error: 'could not parse message', raw: message });
  }

  const added = storage.addTransaction(parsed);
  if (!added) {
    return res.json({ ok: true, duplicate: true });
  }

  if (added.bucket === 'expense') {
    checkAndSendAlerts(added.cycleYear, added.cycleMonth).catch(e => console.error(e));
  }

  res.json({ ok: true, transaction: added });
});

// ---------- 거래 조회 ----------
app.get('/api/transactions', (req, res) => {
  const { cycleYear, cycleMonth, bucket } = req.query;
  let transactions = storage.load();
  if (cycleYear) transactions = transactions.filter(t => String(t.cycleYear) === String(cycleYear));
  if (cycleMonth) transactions = transactions.filter(t => String(t.cycleMonth) === String(cycleMonth));
  if (bucket) transactions = transactions.filter(t => t.bucket === bucket);

  const recurringIds = detectRecurring(storage.load());
  transactions = transactions
    .map(t => ({ ...t, isFixed: recurringIds.has(t.id) }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.day - a.day) || (b.hour - a.hour) || (b.minute - a.minute));

  res.json({ ok: true, transactions });
});

app.get('/api/current-cycle', (req, res) => {
  const { cycleYear, cycleMonth } = currentCycle();
  res.json({ ok: true, cycleYear, cycleMonth, label: cycleRangeLabel(cycleYear, cycleMonth) });
});

// ---------- 요약 ----------
app.get('/api/summary', (req, res) => {
  const cycleYear = Number(req.query.cycleYear);
  const cycleMonth = Number(req.query.cycleMonth);
  const settings = settingsStore.load();
  const all = storage.load();
  const recurringIds = detectRecurring(all);

  const cycleTx = all.filter(t => t.cycleYear === cycleYear && t.cycleMonth === cycleMonth);

  const income = cycleTx.filter(t => t.bucket === 'income').reduce((s, t) => s + t.amount, 0);
  const expenseTx = cycleTx.filter(t => t.bucket === 'expense');
  const savingsTotal = cycleTx.filter(t => t.bucket === 'savings').reduce((s, t) => s + t.amount, 0);
  const stockTotal = cycleTx.filter(t => t.bucket === 'stock').reduce((s, t) => s + t.amount, 0);
  const pendingCount = cycleTx.filter(t => t.bucket === 'pending').length;

  const autoFixed = expenseTx.filter(t => recurringIds.has(t.id)).reduce((s, t) => s + t.amount, 0);
  const manualFixedItems = fixedExpenseStore.load();
  const manualFixedTotal = manualFixedItems.reduce((s, i) => s + i.amount, 0);

  const expenseAll = expenseTx.reduce((s, t) => s + t.amount, 0);
  const fixedTotal = autoFixed + manualFixedTotal;
  const variableTotal = expenseAll - autoFixed;

  const byCategory = {};
  for (const t of expenseTx) {
    if (recurringIds.has(t.id)) continue; // 고정지출은 그래프에서 제외
    const cat = t.category || '기타';
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
  }

  const totalOut = expenseAll + manualFixedTotal + savingsTotal + stockTotal;
  const balance = income - totalOut;

  const effectiveIncome = settings.monthlyIncome > 0 ? settings.monthlyIncome : income;
  const spendingPercent = effectiveIncome > 0 ? Math.round((variableTotal / effectiveIncome) * 1000) / 10 : 0;

  res.json({
    ok: true,
    cycleYear,
    cycleMonth,
    label: cycleRangeLabel(cycleYear, cycleMonth),
    income,
    expenseAll,
    fixedTotal,
    autoFixed,
    manualFixedTotal,
    variableTotal,
    savingsTotal,
    stockTotal,
    balance,
    byCategory,
    pendingCount,
    spendingPercent,
  });
});

// ---------- 거래 수정/삭제 ----------
app.patch('/api/transactions/:id', (req, res) => {
  const updated = storage.updateTransaction(req.params.id, req.body);
  if (!updated) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, transaction: updated });
});

// "사용처 미상" 거래를 사용자가 채워서 정식 반영
app.post('/api/transactions/:id/resolve', (req, res) => {
  const updated = storage.resolveReview(req.params.id, req.body);
  if (!updated) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true, transaction: updated });
});

app.delete('/api/transactions/:id', (req, res) => {
  const ok = storage.deleteTransaction(req.params.id);
  res.json({ ok });
});

// ---------- 설정 ----------
app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: settingsStore.load() });
});

app.put('/api/settings', (req, res) => {
  const updated = settingsStore.update(req.body);
  res.json({ ok: true, settings: updated });
});

// ---------- 고정지출(수동 등록) ----------
app.get('/api/fixed-expenses', (req, res) => {
  res.json({ ok: true, items: fixedExpenseStore.load() });
});

app.post('/api/fixed-expenses', (req, res) => {
  const item = fixedExpenseStore.add(req.body);
  res.json({ ok: true, item });
});

app.delete('/api/fixed-expenses/:id', (req, res) => {
  const ok = fixedExpenseStore.remove(req.params.id);
  res.json({ ok });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`moneymap server listening on port ${PORT}`);
});
