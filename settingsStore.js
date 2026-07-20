// settingsStore.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'settings.json');

const DEFAULT_SETTINGS = {
  // 수입으로 인식할 은행 앱 (여기서 온 "입금"만 수입으로 잡음)
  incomeApp: '기업은행',

  // 이 키워드가 상대방/메모에 포함되면 지출로 세지 않고 무시(내부이체/중복방지)
  // { from: 'IBK기업은행에서 출금될 때 상대방 이름에 포함되면', keyword, reason }
  excludeFromIncomeAccount: ['오케이저축은행', 'OK저축', '삼성카드', 'SKT'],

  // OK저축은행에서 기업은행이 아닌 다른 곳으로 나가는 돈은 이 카테고리로 고정
  okBankOtherCategory: '게임',
  okBankSourceName: 'OK저축은행',

  // 적금/주식 계좌 (상대방 이름에 포함되면 지출이 아니라 적금/주식으로 집계)
  savingsAccounts: ['IBK청년도약', '주택청약'],
  stockAccounts: ['키움증권'],

  // 리포트(그래프)에 쓰는 카테고리 목록 - 사용자가 추가/수정/삭제 가능
  reportCategories: ['게임', '쇼핑', '식비', '의료비', '여가생활비'],

  // 예상 월수입 (경고 알림 기준값). 0이면 자동감지된 수입 합계를 사용
  monthlyIncome: 0,

  // 지출 경고 임계값(%), 오름차순
  warningThresholds: [5, 10],
  strongWarningThreshold: 20,
  strongWarningMessage: '이번 달 지출이 수입의 20%를 넘었어요. 지출을 점검해보세요!',

  // 알림 방식
  notifyMethod: 'ntfy', // 'ntfy' | 'none'
  ntfyTopic: '',

  // 매달 알림 중복 방지를 위해 마지막으로 보낸 경고 단계를 기록 (cycleYear-cycleMonth -> level)
  lastAlertLevel: {},
};

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function save(settings) {
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function update(partial) {
  const current = load();
  const next = { ...current, ...partial };
  save(next);
  return next;
}

module.exports = { load, save, update, DEFAULT_SETTINGS };
