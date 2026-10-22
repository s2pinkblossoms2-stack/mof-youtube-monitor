// 공식 자료 링크의 글자 읽기 (서버 전용). 읽지 못한 자료는 건너뛴다 (지어내지 않는다).
import { REFERENCE_LINKS } from "../constants";

const MAX_LENGTH = 3000; // 자료 하나당 AI에 넘기는 최대 글자 수

function toPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchReferenceTexts(links: readonly string[] = REFERENCE_LINKS): Promise<string[]> {
  const texts: string[] = [];
  for (const link of links) {
    try {
      const res = await fetch(link, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = toPlainText(await res.text()).slice(0, MAX_LENGTH);
      if (text) texts.push(text);
    } catch {
      // 읽지 못한 링크는 건너뛴다
    }
  }
  return texts;
}
