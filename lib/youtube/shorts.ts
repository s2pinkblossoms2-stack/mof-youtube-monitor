// 쇼츠 판별 (서버 전용). 유튜브 API에는 쇼츠를 구분하는 값이 없다.
// 실제 채널 확인 결과, 길이만으로는 구분할 수 없었다 (2분 19초 롱폼, 2분 14초 쇼츠가 함께 있음).
// 그래서 3분을 넘으면 롱폼, 3분 이하는 쇼츠 전용 주소(youtube.com/shorts/ID)로 한 번 확인한다.
//   - 쇼츠이면 그 주소가 열리고(200), 롱폼이면 일반 영상 주소로 넘어간다(3xx).
// 공식 API가 아닌 방법이라 바뀔 수 있다. 확인이 안 되면 길이 기준(쇼츠)으로 두고,
// 구분(롱폼/쇼츠)은 화면 표시용이라 조회수·댓글 수 집계에는 영향이 없다.
import { SHORTS_MAX_SECONDS } from "../constants";
import type { VideoKind } from "../types";

export async function detectKind(videoId: string, seconds: number | null): Promise<VideoKind> {
  if (seconds === null || seconds > SHORTS_MAX_SECONDS) return "long";
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
    });
    if (res.status === 200) return "short";
    if (res.status >= 300 && res.status < 400) return "long";
  } catch {
    // 확인하지 못한 경우는 아래 기본값을 쓴다
  }
  return "short";
}
