// storage.js
// 개인용 소규모 서비스이므로 DB 대신 로컬 JSON 파일에 저장한다.
// 트래픽이 늘어나면 SQLite 등으로 교체하면 된다.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'transactions.json');

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveAll(transactions) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2), 'utf-8');
}

function makeDedupeKey(tx) {
  return [tx.channel, tx.year, tx.month, tx.day, tx.hour, tx.minute, tx.amount, tx.counterparty].join('|');
}

/**
 * 새 거래를 추가한다. 이미 동일한 거래(같은 시각/금액/상대방)가 있으면 무시한다.
 * @returns {object|null} 실제로 추가된 거래 (중복이면 null)
 */
function addTransaction(parsed) {
  const transactions = load();
  const now = new Date();

  const tx = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    year: now.getFullYear(),
    ...parsed,
    category: null, // 사용자가 직접 수정한 경우에만 채워짐, 없으면 자동분류값 사용
    createdAt: now.toISOString(),
  };

  const dedupeKey = makeDedupeKey(tx);
  const exists = transactions.some(t => makeDedupeKey(t) === dedupeKey);
  if (exists) return null;

  transactions.push(tx);
  saveAll(transactions);
  return tx;
}

function updateTransaction(id, updates) {
  const transactions = load();
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  transactions[idx] = { ...transactions[idx], ...updates };
  saveAll(transactions);
  return transactions[idx];
}

function deleteTransaction(id) {
  const transactions = load();
  const next = transactions.filter(t => t.id !== id);
  saveAll(next);
  return next.length !== transactions.length;
}

module.exports = { load, saveAll, addTransaction, updateTransaction, deleteTransaction };
