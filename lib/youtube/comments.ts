// 영상의 최상위 댓글 읽기 (서버 전용). 대댓글은 가져오지 않는다 (PRD: 대댓글 제외).
import { YoutubeApiError, youtubeGet } from "./api";

// 유튜브에서 읽은 댓글 (분류 전). 닉네임·본문·작성 시각만 담는다.
export type RawComment = {
  id: string; // 댓글 ID
  videoId: string;
  authorName: string;
  body: string;
  publishedAt: string;
};

export type CommentPage = {
  comments: RawComment[];
  nextPageToken: string | undefined;
  commentsDisabled: boolean; // 댓글을 막아 둔 영상이면 true (실패가 아님)
};

type CommentThreadsResponse = {
  nextPageToken?: string;
  items?: {
    id: string;
    snippet: {
      videoId: string;
      topLevelComment: {
        snippet: { authorDisplayName: string; textOriginal: string; publishedAt: string };
      };
    };
  }[];
};

// 최신 댓글부터 한 페이지(최대 100개)를 읽는다.
// 이미 저장한 댓글 ID를 만나면 호출하는 쪽에서 다음 페이지 읽기를 멈추면 된다.
export async function fetchCommentPage(videoId: string, pageToken?: string): Promise<CommentPage> {
  try {
    const res = await youtubeGet<CommentThreadsResponse>("commentThreads", {
      part: "snippet",
      videoId,
      order: "time",
      maxResults: 100,
      textFormat: "plainText",
      pageToken,
    });
    return {
      comments: (res.items ?? []).map((item) => ({
        id: item.id,
        videoId: item.snippet.videoId,
        authorName: item.snippet.topLevelComment.snippet.authorDisplayName,
        body: item.snippet.topLevelComment.snippet.textOriginal,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
      })),
      nextPageToken: res.nextPageToken,
      commentsDisabled: false,
    };
  } catch (error) {
    if (error instanceof YoutubeApiError && error.reason === "commentsDisabled") {
      return { comments: [], nextPageToken: undefined, commentsDisabled: true };
    }
    throw error;
  }
}
