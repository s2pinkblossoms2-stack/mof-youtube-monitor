"use client";

// 1440×1080 크기의 판을 화면에 꼭 맞게 줄이거나 늘려 가운데에 보여 준다 (비율 유지).
// 안쪽의 모든 요소는 이 판 안의 좌표(단위)로 놓는다.
import { useLayoutEffect, useState } from "react";

const FRAME_W = 1440;
const FRAME_H = 1080;

export default function HeroStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const s = scale ?? 1;
  return (
    <div
      className="relative"
      style={{ width: FRAME_W * s, height: FRAME_H * s, visibility: scale === null ? "hidden" : "visible" }}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${s})` }}>
        {children}
      </div>
    </div>
  );
}
