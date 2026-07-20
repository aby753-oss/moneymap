// cycle.js
// "월"의 기준을 1일~말일이 아니라, 매월 5일~다음달 4일로 재정의한다.
// 예: 7월 5일 ~ 8월 4일 = "2026년 7월 정산주기"

const CYCLE_START_DAY = 5;

/**
 * 실제 달력 날짜(year, month, day)를 정산 주기(cycleYear, cycleMonth)로 변환한다.
 */
function toCycle(year, month, day) {
  if (day >= CYCLE_START_DAY) {
    return { cycleYear: year, cycleMonth: month };
  }
  if (month === 1) {
    return { cycleYear: year - 1, cycleMonth: 12 };
  }
  return { cycleYear: year, cycleMonth: month - 1 };
}

/**
 * 특정 정산 주기의 시작일/종료일(달력 기준)을 반환한다. (표시용)
 */
function cycleRangeLabel(cycleYear, cycleMonth) {
  const endMonth = cycleMonth === 12 ? 1 : cycleMonth + 1;
  const endYear = cycleMonth === 12 ? cycleYear + 1 : cycleYear;
  return `${cycleMonth}/5 ~ ${endMonth}/4`;
}

function currentCycle(now = new Date()) {
  return toCycle(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

module.exports = { toCycle, cycleRangeLabel, currentCycle, CYCLE_START_DAY };
