// YouTube Data API v3 호출 공통 코드 (서버 전용).
// API 키는 요청 주소에 붙어 나가므로, 오류 메시지에 주소를 절대 넣지 않는다.
import { requireEnv } from "../env";

const BASE_URL = "https://www.googleapis.com/youtube/v3";

export class YoutubeApiError extends Error {
  readonly status: number; // HTTP 상태 (네트워크 오류는 0)
  readonly reason: string; // 유튜브가 알려 준 사유 (예: quotaExceeded, commentsDisabled)

  constructor(status: number, reason: string) {
    super(`유튜브 API 오류 (상태 ${status}, 사유 ${reason})`);
    this.name = "YoutubeApiError";
    this.status = status;
    this.reason = reason;
  }
}

type Params = Record<string, string | number | undefined>;

export async function youtubeGet<T>(resource: string, params: Params): Promise<T> {
  const url = new URL(`${BASE_URL}/${resource}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("key", requireEnv("YOUTUBE_API_KEY"));

  let res: Response;
  try {
    // 수집은 항상 최신 값을 받아야 하므로 캐시하지 않는다
    res = await fetch(url, { cache: "no-store" });
  } catch {
    // 원래 오류에 주소(키 포함)가 담길 수 있어 내용을 버리고 새로 던진다
    throw new YoutubeApiError(0, "networkError");
  }

  if (!res.ok) {
    let reason = "unknown";
    try {
      const body = (await res.json()) as { error?: { errors?: { reason?: string }[] } };
      reason = body.error?.errors?.[0]?.reason ?? reason;
    } catch {
      // 본문을 읽지 못해도 상태 코드만으로 알린다
    }
    throw new YoutubeApiError(res.status, reason);
  }
  return (await res.json()) as T;
}
