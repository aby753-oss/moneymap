// recurring.js
// 저장된 거래 내역 중에서 "매달 반복되는 고정 지출"을 자동으로 탐지한다.
// 정산 주기(cycleYear/cycleMonth, 매월 5일~다음달 4일) 기준으로 판단한다.
// 규칙: 같은 상대방(counterparty)에게, 비슷한 금액(±10% 이내)으로,
//       서로 다른 정산월에 2번 이상 발생하면 고정 지출로 판단한다.

function normalizeName(name) {
  return (name || '').replace(/\s+/g, '').toLowerCase();
}

function isSimilarAmount(a, b) {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff / Math.max(a, b) <= 0.1;
}

function detectRecurring(transactions) {
  const groups = new Map();

  for (const tx of transactions) {
    if (tx.bucket !== 'expense') continue;
    const key = normalizeName(tx.counterparty);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const recurringIds = new Set();

  for (const [, txs] of groups) {
    if (txs.length < 2) continue;

    const byCycle = new Map();
    for (const tx of txs) {
      const cycleKey = `${tx.cycleYear}-${tx.cycleMonth}`;
      if (!byCycle.has(cycleKey)) byCycle.set(cycleKey, []);
      byCycle.get(cycleKey).push(tx);
    }
    if (byCycle.size < 2) continue;

    const cycleEntries = [...byCycle.entries()];
    for (let i = 0; i < cycleEntries.length; i++) {
      let matchCount = 1;
      const [, txsA] = cycleEntries[i];
      const refAmount = txsA[0].amount;
      for (let j = 0; j < cycleEntries.length; j++) {
        if (i === j) continue;
        const [, txsB] = cycleEntries[j];
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
