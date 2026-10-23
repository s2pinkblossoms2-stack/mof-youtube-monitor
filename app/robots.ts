// 검색 로봇 안내: 메인(/)만 열고 나머지 화면·API는 막는다.
// 각 화면의 noindex(layout.tsx)와 함께 이중으로 막아 두며, 메인만 page.tsx에서 index를 연다.
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/$", disallow: ["/report", "/comments", "/login", "/api/"] },
  };
}
