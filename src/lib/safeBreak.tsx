"use client";

import React from "react";

const HANGUL_REGEX = /[\uAC00-\uD7A3]/;

/**
 * 한글 등 단어 중간 줄바꿈 방지: 공백에서만 줄바꿈하고,
 * 공백 없는 한글 단어는 2글자 단위로만 줄바꿈 (좋아요 → 좋아|요).
 * Chrome/Safari는 word-break: keep-all 미지원이라 <wbr />로 보완.
 */
export function safeBreakText(text: string): React.ReactNode {
  if (!text || typeof text !== "string") return text;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return text;
  const out: React.ReactNode[] = [];
  parts.forEach((word, i) => {
    out.push(<React.Fragment key={i}>{safeBreakWord(word)}</React.Fragment>);
    if (i < parts.length - 1) {
      out.push(" ");
      out.push(<wbr key={`w-${i}`} />);
    }
  });
  return <>{out}</>;
}

/**
 * 한 단어(공백 없음) 안에서 한글 연속 구간만 2글자 단위로 <wbr /> 삽입.
 * "좋아요" → 좋아 + wbr + 요, "좋음" → 좋 + wbr + 음
 */
let wbrKeyId = 0;
export function safeBreakWord(word: string): React.ReactNode {
  if (!word || !HANGUL_REGEX.test(word)) return word;
  const segments: React.ReactNode[] = [];
  let run = "";
  const flushRun = () => {
    if (!run.length) return;
    for (let j = 0; j < run.length; j += 2) {
      segments.push(run.slice(j, j + 2));
      if (j + 2 < run.length) segments.push(<wbr key={`wbr-${++wbrKeyId}`} />);
    }
    run = "";
  };
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (HANGUL_REGEX.test(c)) {
      run += c;
    } else {
      flushRun();
      segments.push(c);
    }
  }
  flushRun();
  if (segments.length === 1 && typeof segments[0] === "string") return segments[0];
  return <>{segments}</>;
}

/** 한글이 포함된 문자열인지 */
export function hasHangul(s: string): boolean {
  return typeof s === "string" && HANGUL_REGEX.test(s);
}

const ZWSP = "\u200B"; // 제로너비 공백 — 여기서만 줄바꿈 (문자열만 반환, <wbr> 없음)

/**
 * 한글 2글자·공백 뒤에 ZWSP를 넣은 문자열 반환.
 * 이 문자열을 그대로 렌더하면 브라우저가 ZWSP 위치에서만 줄바꿈함. (날씨 카드 등 레이아웃 제약 있을 때 사용)
 */
export function safeBreakString(text: string): string {
  if (!text || typeof text !== "string") return text;
  if (!HANGUL_REGEX.test(text)) return text;
  let out = "";
  let run = "";
  const flush = () => {
    for (let j = 0; j < run.length; j += 2) {
      out += run.slice(j, j + 2);
      if (j + 2 < run.length) out += ZWSP;
    }
    run = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (HANGUL_REGEX.test(c)) run += c;
    else {
      flush();
      out += c;
      if (/\s/.test(c)) out += ZWSP; // 공백 뒤에도 줄바꿈 허용
    }
  }
  flush();
  return out;
}

const SKIP_TAGS = new Set(["script", "style", "textarea", "input", "code", "pre"]);

/**
 * React 자식 트리를 재귀 순회하며 한글 문자열만 safeBreakText로 감쌈.
 * DOM 조작 없이 React만으로 전체 페이지 줄바꿈 보정.
 */
export function processKoreanBreaks(children: React.ReactNode, keyPrefix = "k"): React.ReactNode {
  if (children == null || typeof children === "boolean") return children;
  if (typeof children === "number") return children;
  if (typeof children === "string") {
    if (!hasHangul(children)) return children;
    return <React.Fragment key={keyPrefix}>{safeBreakText(children)}</React.Fragment>;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const k = `${keyPrefix}-${i}`;
      const processed = processKoreanBreaks(child, k);
      if (React.isValidElement(processed) && processed.key != null) return processed;
      return <React.Fragment key={k}>{processed}</React.Fragment>;
    });
  }
  if (React.isValidElement(children)) {
    const tag = typeof children.type === "string" ? (children.type as string).toLowerCase() : "";
    if (SKIP_TAGS.has(tag)) return children;
    const next = children.props.children;
    if (next === undefined || next === null) return children;
    return React.cloneElement(children, { key: children.key }, processKoreanBreaks(next, keyPrefix));
  }
  return children;
}
