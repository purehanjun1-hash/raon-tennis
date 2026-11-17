-- 라온 테니스: 갤럭시 카톡 알림 자동 수집 (Phase 5)
-- 폰의 자동화 앱(MacroDroid)이 라온 단톡방 알림을 kakao-notify 함수로 보내면 여기에 쌓입니다.
-- 앱을 열면 새 메시지 중 예약 관련만 AI로 분석해 '제안'으로 보여 주고, 승인은 사람이 합니다.
-- Supabase 대시보드 > SQL Editor에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.

create table if not exists public.kakao_inbox (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  room text not null default '',
  sender text not null default '',
  body text not null,
  raw_title text not null default '',
  raw_sub text not null default '',
  status text not null default 'new' check (status in ('new', 'done'))
);
create index if not exists kakao_inbox_status_idx on public.kakao_inbox (status, received_at);

-- 연결 설정: 단톡방 이름 + 연결 코드(원문은 저장하지 않고 SHA-256 해시만 저장)
create table if not exists public.notify_config (
  id int primary key default 1 check (id = 1),
  room_name text not null default '',
  token_hash text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.notify_config (id) values (1) on conflict (id) do nothing;

alter table public.kakao_inbox enable row level security;
alter table public.notify_config enable row level security;
drop policy if exists "admin all kakao_inbox" on public.kakao_inbox;
create policy "admin all kakao_inbox" on public.kakao_inbox for all to authenticated using (true) with check (true);
drop policy if exists "admin all notify_config" on public.notify_config;
create policy "admin all notify_config" on public.notify_config for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.kakao_inbox to authenticated;
grant select, insert, update on public.notify_config to authenticated;
revoke all on public.kakao_inbox from anon;
revoke all on public.notify_config from anon;
