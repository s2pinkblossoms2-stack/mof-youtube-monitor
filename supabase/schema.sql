-- 재정경제부 유튜브 모니터링 서비스 저장소 표 6개 (기준: DESIGN.md 3장)
-- 여러 번 실행해도 안전하도록 이미 있으면 건너뛴다.
-- 모든 표는 행 단위 보안(RLS)을 켜고 정책을 만들지 않는다.
--   → 브라우저용 공개 키로는 읽고 쓸 수 없고, 서버의 서비스 키(SUPABASE_SERVICE_ROLE_KEY)만 접근한다.

-- 1) 영상 (월요일 갱신과 수집 때마다 14일 이내로 거른다)
create table if not exists public.videos (
  id text primary key,                                  -- 유튜브 영상 ID
  title text not null,
  description text not null default '',                 -- 답글 초안의 근거 자료
  kind text not null check (kind in ('long', 'short')),
  uploaded_at timestamptz not null,
  active boolean not null default true,                 -- 14일이 지나면 false
  created_at timestamptz not null default now()
);

-- 2) 영상별 수집 기록 (값은 유튜브가 준 그대로, 실패는 null + failed)
create table if not exists public.video_snapshots (
  id bigint generated always as identity primary key,
  video_id text not null references public.videos (id),
  collected_at timestamptz not null,                    -- 실제 수집한 시각
  report_date date not null,                            -- 보고 날짜 (한국 시간)
  report_slot text not null check (report_slot in ('10:00', '14:00', '17:00')),
  status text not null check (status in ('ok', 'failed')),
  view_count bigint,
  comment_count bigint,
  -- 성공이면 두 값이 모두 있고, 실패면 두 값이 모두 없어야 한다 (채우거나 추측하지 않음)
  constraint video_snapshots_status_values check (
    (status = 'ok' and view_count is not null and comment_count is not null)
    or (status = 'failed' and view_count is null and comment_count is null)
  ),
  -- 같은 영상은 보고 시각마다 한 줄 (재시도 때 실패 기록을 덮어쓴다)
  constraint video_snapshots_unique_slot unique (video_id, report_date, report_slot)
);
create index if not exists video_snapshots_slot_idx
  on public.video_snapshots (report_date, report_slot);

-- 3) 채널 구독자 기록
create table if not exists public.channel_snapshots (
  id bigint generated always as identity primary key,
  collected_at timestamptz not null,
  report_date date not null,
  report_slot text not null check (report_slot in ('10:00', '14:00', '17:00')),
  status text not null check (status in ('ok', 'failed')),
  subscriber_count bigint,
  constraint channel_snapshots_status_values check (
    (status = 'ok' and subscriber_count is not null)
    or (status = 'failed' and subscriber_count is null)
  ),
  constraint channel_snapshots_unique_slot unique (report_date, report_slot)
);

-- 4) 댓글 (수집한 시각부터 14일 뒤 삭제)
create table if not exists public.comments (
  id text primary key,                                  -- 유튜브 댓글 ID
  video_id text not null references public.videos (id),
  author_name text not null,
  body text not null,
  published_at timestamptz not null,
  collected_at timestamptz not null default now(),      -- 14일 보관의 기준
  class_kind text check (class_kind in ('draft', 'excluded')),  -- 분류 전이면 null
  exclude_reason text check (
    exclude_reason in ('personal_info', 'abuse', 'political_attack', 'simple_comment', 'event_entry', 'other')
  ),
  -- 제외일 때만 사유가 있어야 한다 (모든 댓글에 초안 또는 제외 사유 중 하나)
  constraint comments_class_reason check (
    (class_kind is null and exclude_reason is null)
    or (class_kind = 'draft' and exclude_reason is null)
    or (class_kind = 'excluded' and exclude_reason is not null)
  )
);
create index if not exists comments_collected_idx on public.comments (collected_at);
create index if not exists comments_video_idx on public.comments (video_id);

-- 5) 답글 초안 (댓글이 지워지면 함께 지워진다)
create table if not exists public.reply_drafts (
  comment_id text primary key references public.comments (id) on delete cascade,
  text text not null,
  needs_check boolean not null default false,           -- "담당자 확인 필요" 여부
  created_at timestamptz not null default now(),        -- "수집 후 30분 이내" 측정용
  final_text text,                                      -- [복사] 때 저장한 담당자 수정본
  used_at timestamptz                                   -- [복사] 시각
);

-- 6) 삭제 기록 (원문은 14일 뒤 비우고 나머지 기록은 남긴다)
create table if not exists public.deletion_logs (
  id bigint generated always as identity primary key,
  deleted_by text not null,                             -- 담당자가 입력한 이름
  deleted_at timestamptz not null default now(),
  comment_id text not null,                             -- 댓글이 지워져도 남도록 연결하지 않음
  comment_body text                                     -- 14일 뒤 null
);

-- 행 단위 보안: 켜고 정책은 만들지 않는다 (서비스 키만 접근)
alter table public.videos enable row level security;
alter table public.video_snapshots enable row level security;
alter table public.channel_snapshots enable row level security;
alter table public.comments enable row level security;
alter table public.reply_drafts enable row level security;
alter table public.deletion_logs enable row level security;
