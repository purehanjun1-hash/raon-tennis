-- 라온 테니스: 조편성 경기 결과 (스코어 기록 → 사람별 승률·득실, 나중에 실력 비슷하게 편성할 때 사용)
-- Supabase 대시보드 > SQL Editor에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  play_date date not null,
  game_no int not null,
  court_no int not null,
  match_type text not null default '',
  team_a text[] not null,
  team_b text[] not null,
  score_a int not null,
  score_b int not null,
  created_at timestamptz not null default now(),
  constraint matches_scores check (score_a >= 0 and score_b >= 0)
);

create index if not exists matches_date_idx on public.matches (play_date);
-- 같은 날 같은 게임·코트는 한 줄만 (다시 저장하면 덮어씀)
create unique index if not exists matches_one_slot on public.matches (play_date, game_no, court_no);

alter table public.matches enable row level security;
drop policy if exists "admin all matches" on public.matches;
create policy "admin all matches" on public.matches for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.matches to authenticated;
revoke all on public.matches from anon;
