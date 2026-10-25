import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF 만들기(pdfkit)는 자체 데이터 파일을 읽으므로 묶지 않고 그대로 쓴다
  serverExternalPackages: ["pdfkit"],
  // PDF에 넣는 한글 글꼴 파일을 배포 결과물에 포함시킨다
  outputFileTracingIncludes: { "/api/export": ["./assets/fonts/**/*"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
