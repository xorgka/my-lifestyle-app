/**
 * 인사이트 문장 자동 분류
 *
 * 문장 텍스트(+출처)를 키워드 점수로 채점해 태그 하나를 붙인다.
 * DB에 태그 컬럼을 두지 않고 계산으로 뽑기 때문에, 기존 문장은 물론
 * 앞으로 추가되는 문장도 저장 없이 그대로 분류된다.
 */

export const INSIGHT_TAGS = ["글쓰기", "철학", "마음", "성장", "자기다움", "기타"] as const;
export type InsightTag = (typeof INSIGHT_TAGS)[number];

/** 매칭 실패 시 붙는 태그 */
export const FALLBACK_TAG: InsightTag = "기타";

type Rule = {
  tag: Exclude<InsightTag, "기타">;
  /** 문장에 등장하면 점수를 얻는 표현 */
  keywords: string[];
  /** 출처가 여기 속하면 가산점 (문장 키워드가 약할 때 갈리는 용도) */
  authors?: string[];
};

/**
 * 위에 있는 규칙일수록 동점 시 우선.
 * 글쓰기를 맨 위에 둔 건, 책·문장을 다루는 인용문은 주제가 겹쳐도
 * 글쓰기로 보는 편이 찾기 쉬워서다.
 */
const RULES: Rule[] = [
  {
    tag: "글쓰기",
    keywords: [
      "글", "문장", "책", "독서", "읽", "쓰기", "쓴다", "쓰는", "써라",
      "문학", "시인", "이야기", "작가", "언어", "단어", "표현", "기록",
      "일기", "메모", "노트", "초고", "퇴고", "원고", "카피", "제목",
    ],
    // 작가가 남긴 말이라고 글쓰기에 관한 말은 아니라서 출처 가산점을 두지 않는다
  },
  {
    tag: "마음",
    keywords: [
      "마음", "고통", "괴로", "불안", "두려", "슬픔", "화가", "분노",
      "평온", "고요", "명상", "번뇌", "집착", "욕심", "비우", "내려놓",
      "부처", "지혜", "흔들", "평정", "감정", "상처", "치유", "위로",
    ],
    authors: ["붓다", "법구경", "대반열반경", "수타니파타", "틱낫한", "임제 의현", "노자", "루미"],
  },
  {
    tag: "자기다움",
    keywords: [
      "너 자신", "나 자신", "자기 자신", "자신을", "나로서", "나답",
      "비교", "고독", "혼자", "군중", "타인", "남의", "남과",
      "양심", "운명", "자유", "정체", "본래", "주인",
    ],
  },
  {
    tag: "성장",
    keywords: [
      "노력", "실패", "도전", "시도", "성장", "변화", "극복", "견디",
      "훈련", "연습", "습관", "재능", "천재", "목표", "이루", "성취",
      "강해", "강하", "강한", "이기", "포기", "계속", "전진", "나아가",
      "버티", "투쟁", "배우", "실수", "위험", "감수",
    ],
  },
  {
    tag: "철학",
    keywords: [
      "존재", "진리", "죽음", "세계", "인간", "인생", "삶", "의미",
      "영혼", "정신", "본질", "진실", "선택", "자유의지", "신은", "우주",
      "시간", "영원", "현재", "과거", "미래", "지옥", "천국",
    ],
    authors: [
      "니체", "사르트르", "키르케고르", "카뮈", "쇼펜하우어", "소크라테스",
      "세네카", "마르쿠스 아우렐리우스", "키케로", "융", "빅터 프랭클",
      "아들러", "도스토옙스키", "괴테", "쿤데라",
    ],
  },
];

/**
 * 문장에 직접 적은 태그(`#글쓰기`)를 찾는 패턴.
 * 뒤에 글자가 더 붙은 `#글쓰기다` 같은 건 태그로 보지 않는다.
 */
const EXPLICIT_TAG_PATTERN = new RegExp(`#(${INSIGHT_TAGS.join("|")})(?![가-힣A-Za-z0-9])`, "g");

export type ResolvedInsightTag = {
  tag: InsightTag;
  /** 화면에 보여줄 본문 (직접 적은 #태그는 떼어낸 상태) */
  body: string;
  /** 문장에 #태그를 직접 적어 지정한 경우 true */
  explicit: boolean;
};

/** 규칙 하나가 문장에서 얻는 점수. 키워드 1개당 2점, 출처 일치는 1점. */
function scoreRule(rule: Rule, text: string, author: string): number {
  let score = 0;
  for (const kw of rule.keywords) {
    if (text.includes(kw)) score += 2;
  }
  if (rule.authors?.some((a) => author.includes(a))) score += 1;
  return score;
}

/**
 * 문장 하나를 태그 하나로 분류한다.
 * 어떤 규칙에도 걸리지 않으면 "기타".
 */
export function resolveInsightTag(text: string, author?: string): ResolvedInsightTag {
  const raw = text ?? "";
  let explicitTag: InsightTag | null = null;
  const stripped = raw
    .replace(EXPLICIT_TAG_PATTERN, (_match, tag: string) => {
      // 여러 개 적혀 있으면 첫 번째만 쓴다
      if (!explicitTag) explicitTag = tag as InsightTag;
      return "";
    })
    // 태그를 떼어낸 자리에 남은 공백·빈 줄 정리
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 태그만 적혀 있어 본문이 사라지는 경우엔 원문을 그대로 둔다
  const body = stripped.length > 0 ? stripped : raw.trim();

  return explicitTag
    ? { tag: explicitTag, body, explicit: true }
    : { tag: classifyInsight(body, author), body, explicit: false };
}

/**
 * 문장에 적힌 #태그를 지정한 값으로 바꾼다. tag가 null이면 떼어내기만 한다.
 * (편집 폼의 태그 버튼용)
 */
export function withExplicitTag(text: string, tag: InsightTag | null): string {
  const stripped = (text ?? "")
    .replace(EXPLICIT_TAG_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!tag) return stripped;
  return stripped.length > 0 ? `${stripped} #${tag}` : `#${tag}`;
}

export function classifyInsight(text: string, author?: string): InsightTag {
  const t = (text ?? "").toLowerCase();
  const a = (author ?? "").toLowerCase();
  let best: InsightTag = FALLBACK_TAG;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = scoreRule(rule, t, a);
    // 앞선 규칙이 우선이므로 동점일 때는 교체하지 않는다
    if (score > bestScore) {
      bestScore = score;
      best = rule.tag;
    }
  }
  return best;
}
