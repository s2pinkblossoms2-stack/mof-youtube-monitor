// 모든 화면 맨 위의 제목과 메뉴 (서버 컴포넌트).
import Link from "next/link";

const MENU = [
  { href: "/", label: "숫자", key: "numbers" },
  { href: "/comments", label: "댓글", key: "comments" },
] as const;

export default function SiteHeader({ current }: { current: (typeof MENU)[number]["key"] }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold tracking-tight">재정경제부 유튜브 모니터링 서비스</h1>
      <nav aria-label="화면 이동" className="flex gap-2">
        {MENU.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            aria-current={m.key === current ? "page" : undefined}
            className={
              m.key === current
                ? "rounded bg-foreground px-3 py-1 text-background"
                : "rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }
          >
            {m.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
