// 구독자 수 정확값 읽기 (서버 전용).
// 유튜브 공개 API의 구독자 수는 반올림되어 있어서 쓰지 않고, 채널 관리자 권한으로
// Analytics 보고서의 "늘어난 구독자 − 줄어든 구독자"를 채널 개설 이후 전체로 합쳐 계산한다.
// (실제 채널에서 스튜디오 값과 5명 차이였다: 57,193 / 57,188)
import { requireEnv } from "../env";
import { toKstDate } from "../time";

// 응답이 늘어져도 함수가 통째로 꺼지지 않도록 호출마다 시간 제한을 둔다 (넘으면 networkError로 처리)
const GOOGLE_TIMEOUT_MS = 12_000;

export class SubscriberError extends Error {
  constructor(readonly reason: string) {
    super(`구독자 수 수집 오류 (${reason})`);
    this.name = "SubscriberError";
  }
}

// 오래 쓰는 열쇠(refresh token)로 잠깐 쓰는 접근권을 받는다
async function getAccessToken(): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
        refresh_token: requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    throw new SubscriberError("networkError");
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  // 열쇠가 만료되면 invalid_grant가 온다 (테스트 중인 앱은 7일 뒤 만료)
  if (!res.ok || !body.access_token) throw new SubscriberError(body.error ?? `status${res.status}`);
  return body.access_token;
}

export async function fetchExactSubscriberCount(now: Date): Promise<number> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: "2005-01-01",
    endDate: toKstDate(now),
    metrics: "subscribersGained,subscribersLost",
  });
  let res: Response;
  try {
    res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    throw new SubscriberError("networkError");
  }
  if (!res.ok) throw new SubscriberError(`status${res.status}`);
  const body = (await res.json()) as { rows?: number[][] };
  const row = body.rows?.[0];
  if (!row || row.length < 2 || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) {
    throw new SubscriberError("noData");
  }
  const total = row[0] - row[1];
  if (!Number.isInteger(total) || total < 0) throw new SubscriberError("invalidTotal");
  return total;
}
