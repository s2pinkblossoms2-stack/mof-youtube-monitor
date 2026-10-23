-- 자동 실행 일정 (Supabase pg_cron + pg_net이 Vercel의 자동 실행 주소를 정해진 시각에 부른다)
-- Vercel 무료(Hobby) 요금제는 자동 실행이 하루 1회로 제한돼서, 하루 3회 정시 수집을 위해 Supabase가 대신 부른다.
-- 시각은 세계 표준시(UTC)이고, 한국 시간(KST)은 +9시간이다.
--
-- 이 파일에는 비밀 값이 없다. __APP_URL__ 과 __CRON_SECRET__ 은 scripts/apply-supabase-cron.mjs가
-- .env에서 읽어 바꿔 넣은 뒤 적용한다 (이 파일을 직접 실행하지 않는다).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 다시 적용해도 중복되지 않도록 같은 이름의 일정은 먼저 지운다
select cron.unschedule(jobname) from cron.job where jobname like 'mof-%';

-- 수집: 한국 시간 매일 09:30 / 13:30 / 16:30
select cron.schedule('mof-collect', '30 0,4,7 * * *', $job$
  select net.http_get(
    url := '__APP_URL__/api/cron/collect',
    headers := jsonb_build_object('Authorization', 'Bearer __CRON_SECRET__'),
    timeout_milliseconds := 60000
  );
$job$);

-- 재시도·댓글 분류·초안: 한국 시간 매일 09:35 / 13:35 / 16:35
select cron.schedule('mof-retry-and-draft', '35 0,4,7 * * *', $job$
  select net.http_get(
    url := '__APP_URL__/api/cron/retry-and-draft',
    headers := jsonb_build_object('Authorization', 'Bearer __CRON_SECRET__'),
    timeout_milliseconds := 60000
  );
$job$);

-- 영상 목록 갱신: 한국 시간 월요일 08:50 (UTC 일요일 23:50)
select cron.schedule('mof-refresh-videos', '50 23 * * 0', $job$
  select net.http_get(
    url := '__APP_URL__/api/cron/refresh-videos',
    headers := jsonb_build_object('Authorization', 'Bearer __CRON_SECRET__'),
    timeout_milliseconds := 60000
  );
$job$);

-- 정리: 한국 시간 매일 03:00 (14일 지난 댓글, 하루 지난 로그인 시도 기록)
select cron.schedule('mof-cleanup', '0 18 * * *', $job$
  select net.http_get(
    url := '__APP_URL__/api/cron/cleanup',
    headers := jsonb_build_object('Authorization', 'Bearer __CRON_SECRET__'),
    timeout_milliseconds := 60000
  );
$job$);
