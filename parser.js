// parser.js
// 카드사 결제 승인 문자와 은행 입출금 알림 텍스트를 구조화된 거래 데이터로 변환한다.

/**
 * 문자열에서 "숫자,콤마 + 원" 형태의 금액들을 전부 찾아서
 * "누적"이 앞에 붙은 것과 아닌 것을 구분해 반환한다.
 */
function extractAmounts(text) {
  const results = [];
  const re = /(누적)?\s*([\d,]+)\s*원/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({ isCumulative: !!m[1], amount: Number(m[2].replace(/,/g, '')) });
  }
  return results;
}

function extractDateTime(text) {
  const m = text.match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]), hour: Number(m[3]), minute: Number(m[4]) };
}

/**
 * 카드사 결제 승인 문자 파싱
 * 예: "삼성3456승인 안*훈\n186,000원 일시불\n07/18 11:36 11번가-SKPay\n누적651,152원"
 */
function parseCardMessage(rawText) {
  const text = rawText.trim();
  if (!/승인/.test(text)) return null;

  const companyMatch = text.match(/([가-힣]{2,6})\s*\(?\d{2,4}\)?\s*승인/);
  const company = companyMatch ? companyMatch[1] : '카드사미상';

  const installmentMatch = text.match(/(일시불|할부\s*\d+\s*개월)/);
  const installment = installmentMatch ? installmentMatch[1].replace(/\s+/g, '') : '일시불';

  const dt = extractDateTime(text);
  const amounts = extractAmounts(text);
  const mainAmount = amounts.find(a => !a.isCumulative);
  if (!mainAmount || !dt) return null;

  // 날짜/시간이 있는 줄에서 시간 뒤 텍스트를 가맹점명으로 추출
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let merchant = '';
  for (const line of lines) {
    const dateLineMatch = line.match(/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+(.+)/);
    if (dateLineMatch) {
      merchant = dateLineMatch[1].trim();
      break;
    }
  }
  if (!merchant) merchant = '가맹점미상';

  return {
    channel: 'card',
    cardCompany: company + '카드',
    direction: 'expense',
    amount: mainAmount.amount,
    counterparty: merchant,
    installment,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
  };
}

/**
 * 은행 입출금 알림 파싱
 * 예: "[출금] 10원 토스 안재훈 127-******-01-018 07/18 13:26"
 */
function parseBankMessage(rawText, appName) {
  const text = rawText.trim();
  const bracketMatch = text.match(/^\[(입금|출금)\]/);
  if (!bracketMatch) return null;

  const direction = bracketMatch[1] === '출금' ? 'expense' : 'income';

  const amounts = extractAmounts(text);
  if (amounts.length === 0) return null;
  const amount = amounts[0].amount;

  const dt = extractDateTime(text);
  if (!dt) return null;

  // "[출금] 10원 토스 안재훈 127-******-01-018 07/18 13:26"에서
  // 금액과 날짜/시간, 계좌번호를 제거한 나머지를 상대방/메모로 추정
  let rest = text.replace(/^\[(입금|출금)\]\s*/, '');
  rest = rest.replace(/[\d,]+\s*원/, '');
  rest = rest.replace(/\d{2}\/\d{2}\s+\d{2}:\d{2}/, '');
  rest = rest.replace(/[\d\*]+(?:-[\d\*]+)+/, '');
  const counterparty = rest.trim().split(/\s+/).join(' ') || '상대방미상';

  return {
    channel: 'bank',
    bankName: appName || '은행미상',
    direction,
    amount,
    counterparty,
    installment: null,
    month: dt.month,
    day: dt.day,
    hour: dt.hour,
    minute: dt.minute,
  };
}

/**
 * 메인 파싱 함수. 어떤 포맷인지 자동 감지한다.
 * @param {string} rawText - SMS 본문 또는 알림 텍스트
 * @param {object} meta - { appName, packageName } 등 부가 정보
 */
function parseMessage(rawText, meta = {}) {
  if (!rawText || typeof rawText !== 'string') return null;

  const card = parseCardMessage(rawText);
  if (card) return card;

  const bank = parseBankMessage(rawText, meta.appName);
  if (bank) return bank;

  return null;
}

module.exports = { parseMessage, parseCardMessage, parseBankMessage, extractAmounts, extractDateTime };
