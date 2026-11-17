-- 라온 테니스 AI 매니저 - Supabase 데이터베이스 설정 (Phase 1)
-- 사용법: Supabase 대시보드 > SQL Editor > 이 파일 내용을 전부 붙여넣고 Run.
-- 여러 번 실행해도 기존 데이터가 지워지지 않도록 작성했습니다.

create extension if not exists btree_gist;

-- 장소
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  venue_name text not null,
  address text default '',
  court_information jsonb not null default '[]'::jsonb,  -- 예: ["1","2","3"]
  created_at timestamptz not null default now()
);

-- 예약
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  start_time time not null,
  end_time time not null,
  venue_id uuid not null references public.venues(id),
  court_number text not null,
  reserved_by text default '',
  status text not null default '확정' check (status in ('확정','예정','확인 필요','취소')),
  memo text default '',
  source_message text,          -- Phase 2: AI가 분석한 원본 메시지
  confidence numeric,           -- Phase 2: AI 신뢰도 (0~1)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

-- 중복 예약 방지: 같은 장소·코트·날짜에서 시간이 겹치면 저장 거부 (취소된 예약은 제외)
do $$ begin
  alter table public.reservations add constraint no_overlap exclude using gist (
    venue_id with =,
    court_number with =,
    tsrange(reservation_date + start_time, reservation_date + end_time) with &&
  ) where (status <> '취소');
exception when duplicate_object or duplicate_table then null; end $$;

-- 변경 이력 (등록·수정·취소 전후 기록)
create table if not exists public.reservation_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  previous_data jsonb,
  updated_data jsonb,
  change_reason text,
  changed_at timestamptz not null default now()
);

-- Phase 2용: 카카오톡 TXT 가져오기 기록 (지금은 비어 있음)
create table if not exists public.message_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  import_status text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 예약이 바뀔 때마다 자동으로 이력 저장
create or replace function public.log_reservation_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare reason text;
begin
  if tg_op = 'INSERT' then
    insert into reservation_history(reservation_id, previous_data, updated_data, change_reason)
      values (new.id, null, to_jsonb(new), '등록');
    return new;
  end if;
  new.updated_at := now();
  if old.status <> '취소' and new.status = '취소' then reason := '취소';
  elsif old.status = '취소' and new.status <> '취소' then reason := '취소 해제';
  else reason := '수정'; end if;
  insert into reservation_history(reservation_id, previous_data, updated_data, change_reason)
    values (new.id, to_jsonb(old), to_jsonb(new), reason);
  return new;
end $$;

drop trigger if exists trg_log_reservation_ins on public.reservations;
create trigger trg_log_reservation_ins after insert on public.reservations
  for each row execute function public.log_reservation_change();
drop trigger if exists trg_log_reservation_upd on public.reservations;
create trigger trg_log_reservation_upd before update on public.reservations
  for each row execute function public.log_reservation_change();

-- 보안 규칙(RLS): 로그인한 관리자만 읽고 쓸 수 있음. (Phase 4에서 회원 조회 권한 추가 예정)
alter table public.venues enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_history enable row level security;
alter table public.message_imports enable row level security;

drop policy if exists "admin all venues" on public.venues;
create policy "admin all venues" on public.venues for all to authenticated using (true) with check (true);
drop policy if exists "admin all reservations" on public.reservations;
create policy "admin all reservations" on public.reservations for all to authenticated using (true) with check (true);
drop policy if exists "admin read history" on public.reservation_history;
create policy "admin read history" on public.reservation_history for select to authenticated using (true);
drop policy if exists "admin all imports" on public.message_imports;
create policy "admin all imports" on public.message_imports for all to authenticated using (true) with check (true);

-- 예약은 삭제하지 않고 '취소' 상태로 남깁니다: delete 권한은 주지 않음
revoke delete on public.reservations from authenticated, anon;
revoke delete on public.reservation_history from authenticated, anon;

-- 기본 장소 (이미 있으면 추가하지 않음)
insert into public.venues (venue_name)
select v from (values ('수목원 테니스장'), ('스포원 테니스장'), ('송정 테니스장')) as t(v)
where not exists (select 1 from public.venues x where x.venue_name = t.v);
