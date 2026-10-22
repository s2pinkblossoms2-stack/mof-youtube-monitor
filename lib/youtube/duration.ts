// 유튜브가 주는 영상 길이(ISO 8601, 예: PT1H2M3S)를 초로 바꾼다.
// 형식이 다르면 null (추측하지 않는다).
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => (x === undefined ? 0 : Number(x)));
  return d * 86_400 + h * 3_600 + min * 60 + s;
}
