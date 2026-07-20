// categorize.js
// 가맹점명/상대방명에 포함된 키워드로 지출 카테고리를 자동 분류한다.
// 사용자가 설정에서 카테고리 목록(reportCategories)을 바꿀 수 있으므로,
// 여기서는 "추천값"만 계산하고, 현재 설정된 목록에 있는 카테고리만 채택한다.

const DEFAULT_KEYWORDS = {
  '게임': ['스팀', 'STEAM', '넥슨', '넷마블', '플레이스토어', 'PlayStore', '구글플레이', '블리자드', '라이엇', 'PSN'],
  '쇼핑': ['쿠팡', '11번가', '지마켓', 'G마켓', '옥션', '위메프', '티몬', 'SSG', '무신사', '에이블리', '올리브영'],
  '식비': ['GS25', 'CU', '세븐일레븐', '이마트24', '스타벅스', '이디야', '투썸', '카페', '배달의민족', '요기요', '쿠팡이츠', '식당', '치킨', '피자', '버거', '마트', '이마트', '홈플러스'],
  '의료비': ['약국', '의원', '병원', '치과', '한의원'],
  '여가생활비': ['영화', 'CGV', '메가박스', '롯데시네마', '넷플릭스', 'Netflix', '왓챠', 'Watcha', '디즈니', 'Disney', '멜론', '노래방', '당구장', '헬스', '골프'],
};

function suggestCategory(counterparty, reportCategories) {
  if (!counterparty) return '기타';
  for (const [category, keywords] of Object.entries(DEFAULT_KEYWORDS)) {
    if (!reportCategories.includes(category)) continue;
    if (keywords.some(k => counterparty.includes(k))) {
      return category;
    }
  }
  return '기타';
}

module.exports = { suggestCategory, DEFAULT_KEYWORDS };
