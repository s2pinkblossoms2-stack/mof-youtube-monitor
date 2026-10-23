// 답글 초안이 "근거 있는 내용"인지 검사한다 (PRD 5장 must 2: 정책·수치·일정은 영상이나 공식 자료에 있는 내용만).
// 근거(evidence)는 영상 제목·설명과 공식 자료뿐이다. 시청자 댓글은 근거가 아니다.
// (댓글에 "300만원 맞죠?"가 있다고 해서 AI가 "네, 300만원입니다"라고 써도 되는 것은 아니기 때문이다.)

function numbers(s: string): string[] {
  return (s.replace(/,/g, "").match(/\d[\d.]*/g) ?? []).map((t) => t.replace(/\.+$/, ""));
}

// 답글에 나온 숫자가 근거 어디에도 없으면 지어낸 것일 수 있다
export function hasUngroundedNumber(reply: string, evidence: string): boolean {
  const known = new Set(numbers(evidence));
  // 줄 맨 앞의 목록 번호("1)", "2.")는 숫자로 보지 않는다
  const body = reply.replace(/(^|\n)\s*\d+[.)]\s/g, "$1");
  return numbers(body).some((t) => !known.has(t));
}

// 한글로 쓴 수량("삼백만 원", "수천 명")은 숫자 검사로 확인할 수 없으므로 항상 사람이 확인하게 한다
// (앞에 아라비아 숫자가 붙은 "500만 명"은 숫자 검사가 따로 확인하므로 여기서는 제외한다)
const HANGUL_QUANTITY = /(?<![\d,.])(?:[일이삼사오육칠팔구십백천만억조]|수)?[십백천만억조]\s?(?:원|명|%|퍼센트|개|건|배|년|월)/;

const URL_LIKE = /(?:https?:\/\/|www\.)[^\s)>\]]+|[a-z0-9-]+\.(?:com|net|kr|org|io|me|ly|co|go)\b[^\s)>\]]*/gi;

// 근거에 없는 링크(주소), 전화번호처럼 긴 숫자, 이메일이 답글에 있으면 위험하다
export function hasUngroundedContact(reply: string, evidence: string): boolean {
  const ev = evidence.toLowerCase();
  for (const url of reply.match(URL_LIKE) ?? []) {
    if (!ev.includes(url.toLowerCase().replace(/[.,]+$/, ""))) return true;
  }
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+/.test(reply)) return true;
  for (const run of reply.match(/\d(?:[\s\-.]?\d){6,}/g) ?? []) {
    if (!evidence.replace(/[\s\-.,]/g, "").includes(run.replace(/[\s\-.,]/g, ""))) return true;
  }
  return false;
}

// 담당자 확인이 필요한 초안인지 (true면 "담당자 확인 필요" 표시)
export function needsHumanCheck(reply: string, evidence: string): boolean {
  return hasUngroundedNumber(reply, evidence) || hasUngroundedContact(reply, evidence) || HANGUL_QUANTITY.test(reply);
}
