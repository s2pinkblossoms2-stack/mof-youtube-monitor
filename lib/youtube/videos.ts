// 최근 14일 영상 목록과 영상별 조회수·댓글 수 읽기 (서버 전용).
import { requireEnv } from "../env";
import { isWithinVideoWindow } from "../time";
import type { Video, VideoKind } from "../types";
import { youtubeGet } from "./api";
import { parseIsoDuration } from "./duration";
import { detectKind } from "./shorts";

// 영상 한 개와 그 시점의 숫자. 유튜브가 값을 주지 않으면 null (채우거나 추측하지 않는다).
export type VideoWithStats = {
  video: Video;
  viewCount: number | null;
  commentCount: number | null;
};

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[];
};

type VideosResponse = {
  items?: {
    id: string;
    snippet: { title: string; description: string; publishedAt: string };
    contentDetails: { duration: string };
    statistics: { viewCount?: string; commentCount?: string };
  }[];
};

// 업로드 목록 ID는 채널 ID의 앞 두 글자 "UC"를 "UU"로 바꾼 것이다 (호출 한 번을 아낀다)
function uploadsPlaylistId(): string {
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");
  return "UU" + channelId.slice(2);
}

function toCount(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// 업로드 목록을 최신순으로 읽어 최근 14일 안의 영상 ID를 모은다.
// 한 페이지가 통째로 14일 밖이면 멈춘다 (전체 영상을 읽지 않아 사용량을 아낀다).
export async function listRecentVideoIds(now: Date): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await youtubeGet<PlaylistItemsResponse>("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId(),
      maxResults: 50,
      pageToken,
    });
    const items = page.items ?? [];
    let anyInWindow = false;
    for (const item of items) {
      const published = item.contentDetails.videoPublishedAt;
      if (published && isWithinVideoWindow(new Date(published), now)) {
        ids.push(item.contentDetails.videoId);
        anyInWindow = true;
      }
    }
    if (!anyInWindow) break;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

// 영상 ID 목록의 제목·설명·길이·조회수·댓글 수를 읽는다 (50개씩 한 번에).
// knownKinds: 이미 저장된 영상의 구분. 여기 없는 새 영상만 쇼츠 여부를 확인한다.
export async function fetchVideoDetails(
  ids: string[],
  knownKinds: ReadonlyMap<string, VideoKind> = new Map(),
): Promise<VideoWithStats[]> {
  const result: VideoWithStats[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await youtubeGet<VideosResponse>("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const item of res.items ?? []) {
      const seconds = parseIsoDuration(item.contentDetails.duration);
      result.push({
        video: {
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          kind: knownKinds.get(item.id) ?? (await detectKind(item.id, seconds)),
          uploadedAt: item.snippet.publishedAt,
          active: true,
        },
        viewCount: toCount(item.statistics.viewCount),
        commentCount: toCount(item.statistics.commentCount),
      });
    }
  }
  return result;
}

// 최근 14일 영상 전체와 숫자를 한 번에 가져온다 (수집·월요일 갱신에서 사용)
export async function collectRecentVideos(
  now: Date,
  knownKinds?: ReadonlyMap<string, VideoKind>,
): Promise<VideoWithStats[]> {
  const ids = await listRecentVideoIds(now);
  return fetchVideoDetails(ids, knownKinds);
}
