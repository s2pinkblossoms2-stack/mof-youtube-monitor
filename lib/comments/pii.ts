// 개인정보 걸러내기 (PRD 7장): 전화번호·이메일·주민(외국인등록)번호·계좌번호·메신저 ID 형태가 있으면 "개인정보 포함"으로 본다.
// 이런 댓글은 AI에 보내지 않는다. 놓치는 것보다 잘못 거르는 쪽이 안전해서 넓게 잡는다.
// 먼저 글자를 정리(normalize)한 뒤 검사해서, 전각 숫자·한글 숫자·"골뱅이" 같은 우회 표기도 잡는다.

const HANGUL_DIGITS: Record<string, string> = {
  공: "0", 영: "0", 일: "1", 이: "2", 삼: "3", 사: "4", 오: "5", 육: "6", 륙: "6", 칠: "7", 팔: "8", 구: "9",
};

// 글자를 검사하기 쉬운 모양으로 정리한다
export function normalizeForPii(text: string): string {
  let s = text.normalize("NFKC"); // 전각 숫자·기호(０１０, ＠)를 일반 글자로
  s = s.replace(/[​-‏⁠﻿]/g, ""); // 보이지 않는 글자 제거
  // 한글 숫자 "공일공 일이삼사 오육칠팔" → "010 1234 5678" (한글 숫자 3개 이상이 이어질 때만)
  s = s.replace(/[공영일이삼사오육륙칠팔구](?:[\s\-.]?[공영일이삼사오육륙칠팔구]){2,}/g, (m) =>
    m.replace(/[공영일이삼사오육륙칠팔구]/g, (c) => HANGUL_DIGITS[c]),
  );
  // 이메일 우회 표기
  s = s
    .replace(/\s*(?:골뱅이|\(at\)|\[at\]|\(앳\)|앳)\s*/gi, "@")
    .replace(/\s*(?:\(dot\)|\[dot\]|닷컴)\s*/gi, ".com")
    .replace(/\s*닷\s*(?:넷|케이알|씨오케이알|co\.?kr)\s*/gi, ".net");
  return s;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

// 구분자(공백, 어떤 모양의 하이픈·점·기호든 글자·숫자가 아닌 것 3개까지)로 끊긴 숫자 덩어리: 9자리 이상 이어진 것
const DIGIT_RUN = /\+?\d(?:[^\p{L}\p{N}]{0,3}\d){8,}/gu;

function looksLikePhone(d: string): boolean {
  // 국가번호 82(+82)를 떼고 0으로 시작하는 국내 번호 형태로 맞춘다
  const national = d.startsWith("82") && d.length >= 11 ? `0${d.slice(2)}` : d;
  if (/^01[016789]\d{7,8}$/.test(national)) return true; // 휴대전화 (010 등)
  if (/^0(2|[3-6]\d)\d{7,8}$/.test(national)) return true; // 지역 번호 (02, 031 등)
  if (/^0(70|80|50\d)\d{7,8}$/.test(national)) return true; // 인터넷전화·수신자부담
  return false;
}

function looksLikeResidentNumber(d: string): boolean {
  // 주민등록번호·외국인등록번호: 생년월일 6자리 + 성별(1~8) + 6자리
  if (d.length !== 13) return false;
  const month = Number(d.slice(2, 4));
  const day = Number(d.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && /^[1-8]/.test(d.slice(6));
}

const EMAIL = /[A-Za-z0-9._%+-]{2,}\s?@\s?[A-Za-z0-9-]{2,}/; // abc@naver 처럼 점이 없어도 잡는다
const ACCOUNT_WORD = /계좌|입금|송금|무통장|account/i;
const MESSENGER_ID = /(?:카톡|카카오톡|카카오|텔레그램|텔레|라인|위챗|디엠|dm|인스타|insta|kakao|telegram|line)\s*(?:아이디|id|ID|주소)?\s*[:：]?\s*@?[A-Za-z][A-Za-z0-9._-]{3,}/i;

const REPRESENTATIVE_NUMBER = /(?:전화|문의|연락|콜센터|대표번호|번호|tel|call)[^\n]{0,15}?(?<!\d)1[5-9]\d{2}[^\p{L}\p{N}]{0,3}\d{4}(?!\d)/iu;

export function hasPersonalInfo(text: string): boolean {
  const s = normalizeForPii(text);
  if (EMAIL.test(s)) return true;
  for (const run of s.match(DIGIT_RUN) ?? []) {
    const d = digitsOnly(run);
    if (looksLikePhone(d) || looksLikeResidentNumber(d)) return true;
    // 계좌번호: "계좌·입금" 같은 말과 함께 10~16자리 숫자가 있을 때
    if (d.length >= 10 && d.length <= 16 && ACCOUNT_WORD.test(s)) return true;
  }
  if (MESSENGER_ID.test(s)) return true;
  // 대표번호(1588-1234 등)는 8자리라 숫자 덩어리 검사에 걸리지 않는다. 연도 범위(1990-2024)와 구별하려고 "전화·문의" 같은 말이 앞에 있을 때만 본다.
  if (REPRESENTATIVE_NUMBER.test(s)) return true;
  return false;
}
