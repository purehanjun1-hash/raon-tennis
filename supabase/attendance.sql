-- 라온 테니스: 내 참석 일정 (달력의 빨간 점)
-- 예약(reservations)과 따로 둡니다. 예약에 연결할 수도 있고(reservation_id), 예약 없이 날짜만 넣을 수도 있어요.
-- Supabase 대시보드 > SQL Editor에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  attend_date date not null,
  start_time time,
  end_time time,
  venue_id uuid references public.venues(id),
  court_number text,
  reservation_id uuid references public.reservations(id),
  member_name text not null default '유환준',
  memo text not null default '',
  created_at timestamptz not null default now(),
  constraint attendance_time_order check (start_time is null or end_time is null or end_time > start_time)
);

create index if not exists attendance_date_idx on public.attendance (attend_date);
-- 같은 사람이 같은 예약에 두 번 참석 표시되지 않게
create unique index if not exists attendance_one_per_res on public.attendance (member_name, reservation_id) where reservation_id is not null;

alter table public.attendance enable row level security;
drop policy if exists "admin all attendance" on public.attendance;
create policy "admin all attendance" on public.attendance for all to authenticated using (true) with check (true);
-- 참석 취소는 실제로 지웁니다(개인 일정이라 이력 보관 불필요). 로그인한 관리자만 가능.
grant select, insert, update, delete on public.attendance to authenticated;
revoke all on public.attendance from anon;
