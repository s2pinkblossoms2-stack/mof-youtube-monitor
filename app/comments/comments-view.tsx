// 댓글 화면의 내용 (서버 컴포넌트): 초안 작성 탭과 제외됨 탭.
import Link from "next/link";
import { EXCLUDE_REASON_LABELS, LABEL_NEEDS_CHECK } from "@/lib/constants";
import { countComments, listCommentCards, type CommentCard, type CommentTab } from "@/lib/db/comment-view";
import { formatKstDateTime } from "@/lib/time";
import DraftCard from "./draft-card";

type Params = Record<string, string | string[] | undefined>;

function CardHeader({ card }: { card: CommentCard }) {
  return (
    <>
      <p className="text-sm text-muted">
        영상: {card.videoTitle || "(제목 없음)"} · 닉네임: {card.authorName} · {formatKstDateTime(card.publishedAt)}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{card.body}</p>
    </>
  );
}

function DraftItem({ card }: { card: CommentCard }) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${card.videoId}&lc=${card.id}`;
  return (
    <li className="rounded-2xl border border-brand-line bg-white p-5">
      <CardHeader card={card} />
      {card.draft === null ? (
        <p className="mt-3 rounded-xl bg-brand-wash p-3 text-sm text-muted">
          답글 초안을 만드는 중입니다. 다음 자동 실행 때 이곳에 나타납니다.
        </p>
      ) : (
        <>
          {card.draft.needsCheck && (
            <p className="mt-3 inline-block rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
              {LABEL_NEEDS_CHECK}
            </p>
          )}
          <DraftCard
            commentId={card.id}
            initialText={card.draft.finalText ?? card.draft.text}
            usedAt={card.draft.usedAt ? `${formatKstDateTime(card.draft.usedAt)} 복사함` : null}
            youtubeUrl={youtubeUrl}
          />
        </>
      )}
    </li>
  );
}

function ExcludedItem({ card }: { card: CommentCard }) {
  return (
    <li className="rounded-2xl border border-brand-line bg-white p-5">
      <CardHeader card={card} />
      <p className="mt-2 text-sm">
        제외 사유:{" "}
        <span className="rounded-full bg-brand-soft px-3 py-0.5 text-brand">
          {card.excludeReason ? EXCLUDE_REASON_LABELS[card.excludeReason] : "미정"}
        </span>
      </p>
    </li>
  );
}

export default async function CommentsView({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const asked = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: CommentTab = asked === "excluded" ? "excluded" : "drafts";

  const [counts, cards] = await Promise.all([countComments(), listCommentCards(tab)]);

  const tabs: { key: CommentTab; label: string; count: number }[] = [
    { key: "drafts", label: "초안 작성", count: counts.drafts },
    { key: "excluded", label: "제외됨", count: counts.excluded },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="댓글 구분" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/comments?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={
              t.key === tab
                ? "rounded-full bg-brand px-4 py-1.5 text-white"
                : "rounded-full border border-brand-line bg-white px-4 py-1.5 text-ink hover:bg-brand-soft"
            }
          >
            {t.label} {t.count}
          </Link>
        ))}
      </nav>

      {counts.unclassified > 0 && (
        <p className="rounded-xl bg-brand-wash p-3 text-sm text-muted">
          분류를 기다리는 댓글이 {counts.unclassified}개 있습니다. 다음 자동 실행 때 분류됩니다.
        </p>
      )}

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-brand-line bg-brand-wash p-6 text-muted">
          {tab === "drafts" ? "답글 초안을 만들 질문 댓글이 아직 없습니다." : "제외된 댓글이 아직 없습니다."}
        </p>
      ) : (
        <ul className="space-y-4">
          {cards.map((card) =>
            tab === "drafts" ? <DraftItem key={card.id} card={card} /> : <ExcludedItem key={card.id} card={card} />,
          )}
        </ul>
      )}
    </div>
  );
}
