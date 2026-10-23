// 메인 화면에 보여줄 재정경제부 최신 영상 (서버 전용). 로그인하지 않은 방문자도 보는 화면이라 결과를 1시간 이상 캐시한다.
// 캐시 덕분에 방문자가 많아도 유튜브 호출(하루 사용량 한도)이 늘지 않는다.
import { cacheLife } from "next/cache";
import { requireEnv } from "../env";

export type LatestVideo = {
  id: string;
  title: string;
  thumbnail: string; // 썸네일 이미지 주소 (유튜브 공개 이미지)
  publishedAt: string;
};

type PlaylistResponse = {
  items?: {
    snippet?: {
      title?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  }[];
};

// 가장 큰 썸네일을 고른다 (없으면 그다음으로 큰 것)
const THUMB_ORDER = ["maxres", "standard", "high", "medium", "default"] as const;

// 업로드 목록 ID는 채널 ID 앞 두 글자 "UC"를 "UU"로 바꾼 것이다
export async function getLatestVideos(count = 10): Promise<LatestVideo[]> {
  "use cache";
  cacheLife("hours");

  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", `UU${channelId.slice(2)}`);
  url.searchParams.set("maxResults", String(Math.min(50, count + 10))); // 비공개·삭제 영상을 거르고도 충분하게
  url.searchParams.set("key", requireEnv("YOUTUBE_API_KEY"));

  // 실패하면 오류를 그대로 던진다 (오류는 캐시되지 않으므로 다음 방문 때 다시 시도하고, 화면은 대체 모양을 보여준다)
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`최신 영상 읽기 실패 (상태 ${res.status})`);
  const body = (await res.json()) as PlaylistResponse;

  const videos: LatestVideo[] = [];
  for (const item of body.items ?? []) {
    const s = item.snippet;
    const id = s?.resourceId?.videoId;
    const thumbs = s?.thumbnails;
    if (!id || !s?.title || !thumbs) continue; // 비공개·삭제된 영상은 썸네일이 없다
    const thumb = THUMB_ORDER.map((k) => thumbs[k]?.url).find(Boolean);
    if (!thumb) continue;
    videos.push({ id, title: s.title, thumbnail: thumb, publishedAt: s.publishedAt ?? "" });
    if (videos.length >= count) break;
  }
  return videos;
}
