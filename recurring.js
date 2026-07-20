// recurring.js
// 저장된 거래 내역 중에서 "매달 반복되는 고정 지출"을 자동으로 탐지한다.
// 규칙: 같은 상대방(counterparty)에게, 비슷한 금액(±10% 이내)으로,
//       서로 다른 달(month)에 2번 이상 발생하면 고정 지출로 판단한다.

function normalizeName(name) {
  return (name || '').replace(/\s+/g, '').toLowerCase();
}

function isSimilarAmount(a, b) {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff / Math.max(a, b) <= 0.1;
}

/**
 * @param {Array} transactions - {year, month, day, amount, counterparty, direction, ...}
 * @returns {Set<string>} 고정 지출로 판단된 거래의 id 집합
 */
function detectRecurring(transactions) {
  const groups = new Map();

  for (const tx of transactions) {
    if (tx.direction !== 'expense') continue;
    const key = normalizeName(tx.counterparty);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const recurringIds = new Set();

  for (const [, txs] of groups) {
    if (txs.length < 2) continue;

    // 서로 다른 (year, month) 조합별로 대표 거래 하나씩만 남긴다
    const byMonth = new Map();
    for (const tx of txs) {
      const monthKey = `${tx.year}-${tx.month}`;
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey).push(tx);
    }
    if (byMonth.size < 2) continue;

    // 금액이 서로 비슷한 달이 2개 이상인지 확인
    const monthEntries = [...byMonth.entries()];
    for (let i = 0; i < monthEntries.length; i++) {
      let matchCount = 1;
      const [, txsA] = monthEntries[i];
      const refAmount = txsA[0].amount;
      for (let j = 0; j < monthEntries.length; j++) {
        if (i === j) continue;
        const [, txsB] = monthEntries[j];
        if (txsB.some(t => isSimilarAmount(t.amount, refAmount))) matchCount++;
      }
      if (matchCount >= 2) {
        txsA.forEach(t => recurringIds.add(t.id));
      }
    }
  }

  return recurringIds;
}

module.exports = { detectRecurring };
