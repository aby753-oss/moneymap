// fixedExpenseStore.js
// 사용자가 수동으로 등록하는 "매달 자동이체/자동결제" 고정지출 항목.
// 실제 거래 문자와 별개로, 설정에서 등록한 이 항목들의 합이 매달 고정지출에 더해진다.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'fixed_expenses.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveAll(items) {
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function add(item) {
  const items = load();
  const newItem = {
    id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: item.name,
    amount: Number(item.amount),
    day: Number(item.day) || 1, // 매달 몇 일에 나가는지 (표시용)
  };
  items.push(newItem);
  saveAll(items);
  return newItem;
}

function remove(id) {
  const items = load();
  const next = items.filter(i => i.id !== id);
  saveAll(next);
  return next.length !== items.length;
}

function update(id, updates) {
  const items = load();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  saveAll(items);
  return items[idx];
}

module.exports = { load, add, remove, update };
