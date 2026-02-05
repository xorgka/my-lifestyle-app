"use client";

import { useEffect, useState } from "react";
import { loadSystemInsights } from "@/lib/insights";

type InsightItem = {
  id: number;
  text: string;
  createdAt: string;
};

/** 명언 한 편: 줄바꿈(\n) = 의미·문장 단위, author = 인물명 */
export type QuoteEntry = { quote: string; author: string };

/** 줄바꿈 가능 위치: 문자열 조각 또는 <wbr />용 마커 */
type QuoteSegment = string | { wbr: true };

/**
 * 한글 등 의미 단위로 줄바꿈되도록 <wbr /> 위치를 반환.
 * (Chrome/Safari는 word-break: keep-all 미지원이라 DOM으로 break opportunity 지정)
 */
function getQuoteSegments(text: string): QuoteSegment[] {
  if (!text.length) return [];
  const result: QuoteSegment[] = [];
  let run = "";
  const isHangul = (c: string) => /[\uAC00-\uD7A3]/.test(c);
  const isSpaceOrPunct = (c: string) => /[\s,.!?·]/.test(c);

  const flushRun = () => {
    if (run.length === 0) return;
    if (run.length > 2) {
      for (let j = 0; j < run.length; j += 2) {
        result.push(run.slice(j, j + 2));
        if (j + 2 < run.length) result.push({ wbr: true });
      }
    } else {
      result.push(run);
    }
    run = "";
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (isSpaceOrPunct(c)) {
      flushRun();
      result.push(c);
      if (/\s/.test(c)) result.push({ wbr: true });
    } else if (isHangul(c)) {
      run += c;
    } else {
      flushRun();
      result.push(c);
    }
  }
  flushRun();
  return result;
}

const STORAGE_KEY = "my-lifestyle-insights";
const FAVORITES_KEY = "my-lifestyle-insights-favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveFavorites(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
  } catch {}
}

/** 추천 명언 – 의미·문장 단위 줄바꿈(\n), author 필드 유지. 설정 화면에서 수정·삭제 가능 */
export const RECOMMENDED_INSIGHTS: QuoteEntry[] = [
  { quote: "나를 죽이지 못하는 것은\n나를 더 강하게 만든다.", author: "프리드리히 니체" },
  { quote: "무소의 뿔처럼\n혼자서 가라.", author: "수타니파타" },
  {
    quote: "춤추는 별을 잉태하려면\n반드시 스스로의 내면에 혼돈을 지녀야 한다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "새는 알을 깨고 나오려 투쟁한다.\n알은 세계다.\n태어나려는 자는 한 세계를 파괴해야 한다.",
    author: "헤르만 헤세",
  },
  {
    quote: "너 자신을 등불로 삼고\n너 자신에게 의지하라.",
    author: "대반열반경",
  },
  {
    quote:
      "책이란 무릇 우리 안에 있는 꽁꽁 얼어버린 바다를 깨트려버리는 도끼가 아니면\n안 되는 것이다.",
    author: "프란츠 카프카",
  },
  {
    quote: "왜 살아야 하는지 아는 사람은\n그 어떤 상황도 견딜 수 있다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "한겨울의 한복판에서 나는\n내 안에 도저히 꺾이지 않는 영원한 여름이 있다는 사실을 깨달았다.",
    author: "알베르 카뮈",
  },
  {
    quote: "그대 영혼 속에 있는 영웅을\n절대 포기하지 말라.",
    author: "프리드리히 니체",
  },
  {
    quote: "고통이 남기고 간 뒤를 보라!\n고난이 지나면 반드시 기쁨이 스며든다.",
    author: "요한 볼프강 폰 괴테",
  },
  {
    quote:
      "과거에 매달리지 말고, 미래를 원망하지도 말라.\n오직 현재의 순간만을 굳게 지켜라.",
    author: "붓다",
  },
  {
    quote: "신과 악마가 싸우고 있다.\n그 전쟁터는 바로 인간의 마음이다.",
    author: "표도르 도스토옙스키",
  },
  {
    quote: "내가 헛되이 보낸 오늘은\n어제 죽은 이가 그토록 갈망하던 내일이다.",
    author: "소포클레스",
  },
  {
    quote: "너는 안일하게 살고자 하는가?\n그렇다면 항상 군중 속에 머물러 있어라.",
    author: "프리드리히 니체",
  },
  {
    quote: "남의 허물은 보기 쉬우나\n자기 허물은 보기 어렵다.",
    author: "법구경",
  },
  {
    quote:
      "우리가 두려워하는 것은 죽음이 아니라,\n한 번도 제대로 살아보지 못했다는 사실이어야 한다.",
    author: "세네카",
  },
  {
    quote:
      "당신이 무의식을 의식으로 만들지 않으면,\n무의식이 당신의 삶을 지배할 것이고 당신은 그것을 운명이라 부를 것이다.",
    author: "칼 구스타프 융",
  },
  {
    quote: "가장 깊은 곳에 내려가 본 사람만이\n가장 높은 곳으로 날아오를 수 있다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "한 번 시도했다. 한 번 실패했다. 상관없다.\n다시 시도하라. 다시 실패하라. 더 낫게 실패하라.",
    author: "사무엘 베케트",
  },
  {
    quote: "나는 아무것도 바라지 않는다.\n나는 아무것도 두려워하지 않는다.\n나는 자유다.",
    author: "니코스 카잔차키스",
  },
  {
    quote: "길을 가로막는 장애물이\n곧 길이 된다.",
    author: "마르쿠스 아우렐리우스",
  },
  {
    quote:
      "뱀이 허물을 벗지 못하면 끝내 죽고 말듯이,\n인간도 낡은 사고의 허물을 벗지 못하면 그 마음은 부패한다.",
    author: "프리드리히 니체",
  },
  {
    quote: "진흙이 없으면\n연꽃도 없다.",
    author: "틱낫한",
  },
  {
    quote:
      "세상은 모든 사람을 깨부순다.\n하지만 많은 사람은 그렇게 부서진 바로 그 자리에서 더 강해진다.",
    author: "어니스트 헤밍웨이",
  },
  {
    quote: "불안은\n자유의 현기증이다.",
    author: "쇠렌 키르케고르",
  },
  { quote: "타인은 지옥이다.", author: "장 폴 사르트르" },
  {
    quote:
      "내게 있어 가장 큰 위험은 목표를 너무 높게 잡아서 실패하는 것이 아니라,\n목표를 너무 낮게 잡아서 그것을 이루어버리는 것이다.",
    author: "미켈란젤로",
  },
  {
    quote: "자극과 반응 사이에는 공간이 있다.\n그 공간에 우리의 선택이 있다.",
    author: "빅터 프랭클",
  },
  {
    quote: "누구나 그럴싸한 계획을 가지고 있다.\n처맞기 전까지는.",
    author: "마이크 타이슨",
  },
  {
    quote: "물이 되어라.\n물은 컵에 따르면 컵이 되고, 병에 따르면 병이 된다.",
    author: "이소룡",
  },
  {
    quote: "지옥을 걷고 있다면,\n멈추지 말고 계속 전진하라.",
    author: "윈스턴 처칠",
  },
  {
    quote: "당신이 사랑하는 것을 찾아라.\n그리고 그것이 당신을 죽이게 놔두라.",
    author: "찰스 부코스키",
  },
  {
    quote: "부처를 만나면 부처를 죽이고,\n조사를 만나면 조사를 죽여라.",
    author: "임제 의현",
  },
  {
    quote: "인간은 노력하는 한\n방황하는 법이다.",
    author: "요한 볼프강 폰 괴테",
  },
  { quote: "너의 운명을 사랑하라.", author: "프리드리히 니체" },
  { quote: "죽음을 기억하라.", author: "라틴 격언" },
  {
    quote: "가장 큰 복수는\n적과 같아지지 않는 것이다.",
    author: "마르쿠스 아우렐리우스",
  },
  {
    quote: "인생은 고통과 지루함 사이를 오가는\n시계추와 같다.",
    author: "아르투어 쇼펜하우어",
  },
  {
    quote:
      "나무가 하늘로 크고 강하게 자라려면,\n그 뿌리는 반드시 어둡고 깊은 땅속, 악이라 불리는 곳까지 뻗어 내려가야 한다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "화살을 맞은 자가 해야 할 일은 누가 쏘았는지 따지는 것이 아니라,\n즉시 독화살을 뽑아내는 일이다.",
    author: "전유경",
  },
  {
    quote:
      "나는 내 그림에 내 심장과 영혼을 쏟아부었고,\n그 과정에서 내 정신을 잃었다.",
    author: "빈센트 반 고흐",
  },
  {
    quote: "천재란\n노력을 계속할 수 있는 재능을 말한다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "태산은 한 줌의 흙도 사양하지 않기에 그 높이를 이룰 수 있고,\n바다는 작은 물줄기도 가리지 않기에 그 깊이를 이룰 수 있다.",
    author: "사기",
  },
  {
    quote: "무거운 짐은 동시에\n가장 격렬한 생명의 완성에 대한 이미지이다.",
    author: "밀란 쿤데라",
  },
  {
    quote: "고독은\n모든 위대한 정신의 운명이다.",
    author: "아르투어 쇼펜하우어",
  },
  {
    quote: "삶이 있는 한\n희망은 있다.",
    author: "키케로",
  },
  {
    quote: "너 자신의 무지를 아는 것이\n앎의 시작이다.",
    author: "소크라테스",
  },
  {
    quote:
      "강한 인간이 되고 싶다면 물과 같아야 한다.\n장애물이 없으면 흐르고, 둑이 있으면 멈추고, 둑이 터지면 또 흐른다.",
    author: "노자",
  },
  {
    quote: "위험하게 살아라!\n베수비오 화산의 비탈에 너의 도시를 세워라!",
    author: "프리드리히 니체",
  },
  {
    quote: "머무르는 곳마다 주인이 되라.\n지금 서 있는 그곳이 바로 진리의 세계다.",
    author: "임제 의현",
  },
  {
    quote: "오직 밖으로 구하는 마음을 쉬어라.\n그러면 부처와 다를 바가 없다.",
    author: "임제 의현",
  },
  {
    quote: "부처를 구하고 법을 구하는 것은\n모두 지옥을 만드는 업이다.",
    author: "임제 의현",
  },
  {
    quote:
      "전장에서 백만 대군을 이기는 것보다\n자기 자신을 이기는 자가 가장 위대한 승리자다.",
    author: "붓다",
  },
  {
    quote:
      "바위가 거센 바람에 흔들리지 않듯,\n지혜로운 자는 비난과 칭찬에 흔들리지 않는다.",
    author: "붓다",
  },
  {
    quote:
      "녹은 쇠에서 생기지만 점차 그 쇠를 먹어버린다.\n이와 같이 마음이 옳지 못하면 그 마음이 사람을 먹어버린다.",
    author: "붓다",
  },
  {
    quote: "네가 인생의 강을 건너기 위해 밟고 가야 할 다리는\n오직 너 혼자만이 놓을 수 있다.",
    author: "프리드리히 니체",
  },
  {
    quote: "너의 양심은 무엇을 말하고 있는가?\n'너 자신이 되어라'라고 말하고 있지 않은가.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "고통은 삶에 대한 반대 증거가 아니다.\n오히려 삶이 우리를 자극하고 있다는 증거다.",
    author: "프리드리히 니체",
  },
  {
    quote:
      "언젠가 회상해 보면,\n당신이 겪은 가장 힘들었던 시절이 가장 아름다웠던 시기로 기억될 것이다.",
    author: "지그문트 프로이트",
  },
  {
    quote: "너 자신을 남과 비교하지 말고,\n오직 어제의 너와 비교하라.",
    author: "조던 피터슨",
  },
  {
    quote:
      "두 인격의 만남은 두 가지 화학 물질의 접촉과 같다.\n반응이 일어나면 둘 다 변화한다.",
    author: "칼 구스타프 융",
  },
  {
    quote:
      "상황을 변화시킬 수 없을 때,\n우리는 우리 자신을 변화시켜야 하는 도전에 직면한다.",
    author: "빅터 프랭클",
  },
  {
    quote:
      "의미는 상황이 결정하는 것이 아니라,\n우리가 그 상황에 어떤 의미를 부여하느냐에 따라 결정된다.",
    author: "알프레드 아들러",
  },
  {
    quote:
      "첫 번째 원칙은 자신을 속이지 않는 것이다.\n그리고 당신은 세상에서 가장 속이기 쉬운 사람이다.",
    author: "리처드 파인만",
  },
  {
    quote:
      "위대한 정신은 항상\n평범한 사고를 가진 사람들의 격렬한 반대에 부딪혔다.",
    author: "알베르트 아인슈타인",
  },
  {
    quote:
      "살아남는 종은 가장 강한 종도, 가장 똑똑한 종도 아니다.\n변화에 가장 잘 적응하는 종이다.",
    author: "찰스 다윈",
  },
  {
    quote: "삶의 그 무엇도 두려움의 대상이 아니다.\n단지 이해해야 할 대상일 뿐이다.",
    author: "마리 퀴리",
  },
  {
    quote:
      "어제로부터 배우고, 오늘을 살며, 내일을 희망하라.\n중요한 것은 질문을 멈추지 않는 것이다.",
    author: "알베르트 아인슈타인",
  },
  {
    quote:
      "인간은 모든 것에 익숙해지는 존재다.\n나는 이것이 인간에 대한 가장 훌륭한 정의라고 생각한다.",
    author: "표도르 도스토옙스키",
  },
  {
    quote: "고통은 피할 수 없지만,\n괴로워할지는 선택에 달려 있다.",
    author: "무라카미 하루키",
  },
  {
    quote: "거짓이 판치는 시대에\n진실을 말하는 것은 혁명적인 행동이다.",
    author: "조지 오웰",
  },
  {
    quote: "상처야말로\n빛이 네 안으로 들어오는 통로다.",
    author: "루미",
  },
  {
    quote:
      "너무 멀리 갈 위험을 감수하는 사람만이\n자신이 얼마나 멀리 갈 수 있는지 알 수 있다.",
    author: "T.S. 엘리엇",
  },
  {
    quote: "이 숲에서 나가는 가장 좋은 방법은\n숲을 관통해 나가는 것이다.",
    author: "로버트 프로스트",
  },
  {
    quote: "나는 나로서 존재한다.\n그것으로 충분하다.",
    author: "월트 휘트먼",
  },
  {
    quote: "취해라!\n술이든, 시든, 덕이든, 그 무엇이든 좋다.\n다만 언제나 취해 있어라.",
    author: "샤를 보들레르",
  },
];

function pickDailyIndex(length: number): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < todayKey.length; i++) {
    hash = (hash * 31 + todayKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 문장이 2개 이상이면 문장 단위로 줄바꿈 */
function sentenceBreaks(text: string): string {
  return text
    .replace(/\.\s+/g, ".\n")
    .replace(/\?\s+/g, "?\n")
    .replace(/!\s+/g, "!\n")
    .trim();
}

/** "인용문 - 인물명" 형태면 { quote, author }로 파싱 */
function parseQuoteAndAuthor(raw: string): { quote: string; author: string | null } {
  const dash = " - ";
  const idx = raw.lastIndexOf(dash);
  if (idx === -1) return { quote: raw, author: null };
  const quote = raw.slice(0, idx).trim();
  const author = raw.slice(idx + dash.length).trim();
  if (author.length > 40 || !author) return { quote: raw, author: null };
  return { quote, author };
}

type ListItem = string | QuoteEntry;

function getItemId(item: ListItem): string {
  if (typeof item === "object" && item !== null && "quote" in item && "author" in item) {
    return `${item.quote}|${item.author}`;
  }
  return String(item);
}

export function TodayInsightHero() {
  const [list, setList] = useState<ListItem[]>([]);
  const [index, setIndex] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined") return;
        let userList: string[] = [];
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as InsightItem[];
          userList = parsed
            .filter((item) => item.text && item.text.trim())
            .map((item) => item.text.trim());
        }
        const systemList = await loadSystemInsights(RECOMMENDED_INSIGHTS);
        if (cancelled) return;
        const combined = shuffle<ListItem>([...userList, ...systemList]);
        if (combined.length > 0) {
          setList(combined);
          setIndex(pickDailyIndex(combined.length));
        }
      } catch {
        const systemList = await loadSystemInsights(RECOMMENDED_INSIGHTS);
        if (!cancelled) {
          setList(systemList);
          setIndex(pickDailyIndex(systemList.length));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (list.length === 0) {
    return (
      <p className="mt-6 min-w-0 text-[1.35rem] leading-relaxed text-neutral-500 md:text-[1.6rem]">
        오늘의 인사이트를 불러오는 중이에요…
      </p>
    );
  }

  const item = list[index];
  const goPrev = () => setIndex((i) => (i - 1 + list.length) % list.length);
  const goNext = () => setIndex((i) => (i + 1) % list.length);

  const isQuote = (x: ListItem): x is QuoteEntry =>
    typeof x === "object" && x !== null && "quote" in x && "author" in x;
  const quoteText = isQuote(item) ? item.quote : "";
  const parsed = !isQuote(item) ? parseQuoteAndAuthor(item) : null;
  const lines = isQuote(item)
    ? quoteText.split("\n").filter(Boolean)
    : parsed
      ? sentenceBreaks(parsed.quote).split("\n").filter(Boolean)
      : [item];
  const author = isQuote(item) ? item.author : parsed?.author ?? null;
  const itemId = getItemId(item);
  const isFav = favorites.has(itemId);
  const toggleFavorite = () => {
    const next = new Set(favorites);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setFavorites(next);
    saveFavorites(next);
  };

  return (
    <>
      <div className="font-insight-serif insight-quote-wrap mt-6 min-w-0 text-[1.35rem] font-semibold leading-relaxed text-neutral-800 md:text-[1.6rem] [text-shadow:0_1px_2px_rgba(0,0,0,0.06),0_0_1px_rgba(255,255,255,0.8)]" lang="ko">
        {lines.map((line, i) => (
          <span key={i} lang="ko">
            {i > 0 && <br />}
            {getQuoteSegments(line).map((seg, k) =>
              typeof seg === "string" ? seg : <wbr key={`${i}-${k}`} />
            )}
          </span>
        ))}
        {author != null && (
          <div className="mt-4 border-t border-neutral-200 pt-3 text-right">
            <span className="text-base font-normal not-italic text-neutral-500 md:text-lg">
              {author}
            </span>
          </div>
        )}
      </div>
      <div className="absolute right-0 top-0 flex gap-1">
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
          title={isFav ? "즐겨찾기 해제" : "즐겨찾기"}
          className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-200 hover:text-rose-500"
        >
          <svg className="h-5 w-5" fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goPrev}
          aria-label="이전 인사이트"
          className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="다음 인사이트"
          className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}
