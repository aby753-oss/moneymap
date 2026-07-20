// storage.js
const fs = require('fs');
const path = require('path');
const { toCycle } = require('./cycle');
const rules = require('./rules');
const { suggestCategory } = require('./categorize');
const settingsStore = require('./settingsStore');

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

function addTransaction(parsed) {
  const transactions = load();
  const settings = settingsStore.load();
  const now = new Date();
  const year = now.getFullYear();

  const { cycleYear, cycleMonth } = toCycle(year, parsed.month, parsed.day);

  const classification = parsed.needsReview
    ? { bucket: 'pending', categoryOverride: null }
    : rules.classify(parsed, settings);

  const category = classification.categoryOverride
    || (classification.bucket === 'expense' ? suggestCategory(parsed.counterparty, settings.reportCategories) : null);

  const tx = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    year,
    cycleYear,
    cycleMonth,
    ...parsed,
    bucket: classification.bucket,
    category,
    categoryLocked: !!classification.categoryOverride,
    createdAt: now.toISOString(),
  };

  const dedupeKey = makeDedupeKey(tx);
  const exists = transactions.some(t => makeDedupeKey(t) === dedupeKey);
  if (exists) return null;

  transactions.push(tx);
  saveAll(transactions);
  return tx;
}

function resolveReview(id, { counterparty, amount, category }) {
  const transactions = load();
  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;

  const settings = settingsStore.load();
  const tx = transactions[idx];
  if (counterparty !== undefined) tx.counterparty = counterparty;
  if (amount !== undefined) tx.amount = Number(amount);

  const classification = rules.classify(tx, settings);
  tx.bucket = classification.bucket;
  tx.category = category || classification.categoryOverride || suggestCategory(tx.counterparty, settings.reportCategories);
  tx.categoryLocked = !!classification.categoryOverride;
  tx.needsReview = false;

  transactions[idx] = tx;
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

module.exports = { load, saveAll, addTransaction, updateTransaction, deleteTransaction, resolveReview };
