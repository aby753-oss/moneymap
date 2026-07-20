// rules.js
// 사용자가 정의한 계좌별 규칙에 따라 거래를 다음 버킷 중 하나로 분류한다.
//   income   : 수입으로 집계
//   expense  : 지출로 집계 (카테고리 그래프 대상)
//   savings  : 적금으로 집계 (지출 아님)
//   stock    : 주식으로 집계 (지출 아님)
//   excluded : 내부이체/중복이므로 아무 집계에도 넣지 않음

function classify(tx, settings) {
  const cp = tx.counterparty || '';

  // 1) 적금/주식 계좌는 무엇보다 우선 (자동이체로 걸려있어도 여기로)
  if (settings.savingsAccounts.some(k => cp.includes(k))) {
    return { bucket: 'savings', categoryOverride: null };
  }
  if (settings.stockAccounts.some(k => cp.includes(k))) {
    return { bucket: 'stock', categoryOverride: null };
  }

  // 2) 카드결제 / SKT 소액결제는 항상 지출 (개별 결제 건이므로 그대로 반영)
  if (tx.channel === 'card' || tx.channel === 'skt') {
    return { bucket: 'expense', categoryOverride: null };
  }

  // 3) 은행 계좌 거래 처리
  const sourceApp = tx.sourceApp || '';
  const isIncomeAccount = sourceApp.includes(settings.incomeApp);

  if (isIncomeAccount) {
    if (tx.direction === 'income') {
      return { bucket: 'income', categoryOverride: null };
    }
    // 출금: 카드값/휴대폰요금/저축은행 이체 등 중복·내부이체는 제외
    if (settings.excludeFromIncomeAccount.some(k => cp.includes(k))) {
      return { bucket: 'excluded', categoryOverride: null };
    }
    return { bucket: 'expense', categoryOverride: null };
  }

  // 수입 계좌가 아닌 다른 계좌: 입금 내역은 아예 무시
  if (tx.direction === 'income') {
    return { bucket: 'excluded', categoryOverride: null };
  }

  // OK저축은행 등 특수 계좌 규칙: 기업은행으로 되돌아가는 건 내부이체라 제외,
  // 그 외의 출금은 지정된 카테고리(기본값: 게임)로 고정
  const isOkBank = sourceApp.includes(settings.okBankSourceName) || sourceApp.includes('오케이') || sourceApp.includes('OK');
  if (isOkBank) {
    if (cp.includes(settings.incomeApp) || cp.includes('기업은행') || cp.includes('IBK')) {
      return { bucket: 'excluded', categoryOverride: null };
    }
    return { bucket: 'expense', categoryOverride: settings.okBankOtherCategory };
  }

  // 그 외 알 수 없는 계좌의 출금은 일반 지출로 처리
  return { bucket: 'expense', categoryOverride: null };
}

module.exports = { classify };
