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
-- 관리자가 고친 값 (자동 수집한 원래 값은 그대로 두고 따로 저장한다)
alter table public.channel_snapshots
  add column if not exists manual_count bigint check (manual_count is null or manual_count >= 0),
  add column if not exists manual_by text,       -- 고친 사람이 입력한 이름
  add column if not exists manual_at timestamptz; -- 고친 시각

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

-- 7) 로그인 시도 기록 (비밀번호 대입 방지: lib/login-throttle.ts)
-- 접속 주소(IP)는 그대로 저장하지 않고 비밀 열쇠로 섞은 값(해시)만 저장한다. 하루가 지나면 정리한다.
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,                             -- 접속 주소를 섞은 값
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_client_idx on public.login_attempts (client_key, attempted_at);
create index if not exists login_attempts_time_idx on public.login_attempts (attempted_at);

-- 행 단위 보안: 켜고 정책은 만들지 않는다 (서비스 키만 접근)
alter table public.login_attempts enable row level security;
alter table public.videos enable row level security;
alter table public.video_snapshots enable row level security;
alter table public.channel_snapshots enable row level security;
alter table public.comments enable row level security;
alter table public.reply_drafts enable row level security;
alter table public.deletion_logs enable row level security;

-- 관리자가 고친 조회수·댓글 수 (자동 수집한 원래 값은 그대로 두고 고친 값과 고친 사람·시각을 따로 저장한다)
-- 조회수와 댓글 수는 함께 고치므로 네 칸이 모두 있거나 모두 없어야 한다.
alter table public.video_snapshots
  add column if not exists manual_view_count bigint check (manual_view_count is null or manual_view_count >= 0),
  add column if not exists manual_comment_count bigint check (manual_comment_count is null or manual_comment_count >= 0),
  add column if not exists manual_by text,
  add column if not exists manual_at timestamptz;
alter table public.video_snapshots drop constraint if exists video_snapshots_manual_pair;
alter table public.video_snapshots add constraint video_snapshots_manual_pair check (
  (manual_view_count is null and manual_comment_count is null and manual_by is null and manual_at is null)
  or (manual_view_count is not null and manual_comment_count is not null and manual_by is not null and manual_at is not null)
);

-- 보고 시각 16:00 추가 (2026-10-30부터 하루 한 번: 15:30 수집, 16:00 기록). 예전 10:00 / 14:00 / 17:00 기록은 그대로 둔다.
alter table public.video_snapshots drop constraint if exists video_snapshots_report_slot_check;
alter table public.video_snapshots add constraint video_snapshots_report_slot_check
  check (report_slot in ('10:00', '14:00', '16:00', '17:00'));
alter table public.channel_snapshots drop constraint if exists channel_snapshots_report_slot_check;
alter table public.channel_snapshots add constraint channel_snapshots_report_slot_check
  check (report_slot in ('10:00', '14:00', '16:00', '17:00'));
