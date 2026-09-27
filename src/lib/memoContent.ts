/**
 * 메모 본문: 예전엔 순수 텍스트, 볼드 지원 이후엔 서식이 있을 때만 HTML(contentEditable innerHTML)로 저장.
 * 두 형식을 모두 읽을 수 있게 변환 함수를 모아 둠.
 */

/** 에디터가 만드는 닫는 태그나 <br>이 있어야 HTML로 봄. 예전 텍스트의 "a<b & c>d" 같은 글자는 텍스트로 유지 */
export function isHtmlMemoContent(content: string): boolean {
  return /<\/(b|strong|i|em|u|div|p|span|font|li|ul|ol|h[1-6])>|<br\s*\/?>/i.test(content);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 에디터 내용 → 저장값. 서식·줄바꿈이 없으면 순수 텍스트로 저장해 예전 형식과 같게 둠 */
export function editorToMemoContent(html: string, text: string): string {
  return isHtmlMemoContent(html) ? html : text;
}

/** 저장값 → 화면에 넣을 HTML. 예전 순수 텍스트는 줄바꿈 유지 */
export function memoContentToHtml(content: string): string {
  if (isHtmlMemoContent(content)) return content;
  return escapeHtml(content).split("\n").join("<br>");
}

/** 저장값 → 순수 텍스트 (검색, 빈 본문 판별) */
export function memoContentToPlainText(content: string): string {
  if (!isHtmlMemoContent(content)) return content;
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(div|p|li|h[1-6])(\s[^>]*)?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function isMemoContentEmpty(content: string): boolean {
  return memoContentToPlainText(content).trim() === "";
}
