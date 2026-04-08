begin;

-- =========================================================
-- Analytics tables: replace overly-permissive RLS policies
-- =========================================================
do $$
declare
  t text;
  p record;
  analytics_tables text[] := array[
    'player_profiles',
    'games',
    'game_initial_state',
    'game_events',
    'game_rounds',
    'game_player_decks',
    'game_player_card_presence',
    'game_player_card_usage'
  ];
begin
  foreach t in array analytics_tables loop
    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end
$$;

grant usage on schema public to anon;

grant insert, update on table public.player_profiles to anon;
grant insert, update on table public.games to anon;
grant insert, update on table public.game_initial_state to anon;
grant insert, update on table public.game_events to anon;
grant insert, update on table public.game_rounds to anon;
grant insert, update on table public.game_player_decks to anon;
grant insert, update on table public.game_player_card_presence to anon;
grant insert, update on table public.game_player_card_usage to anon;

revoke select, delete on table public.player_profiles from anon;
revoke select, delete on table public.games from anon;
revoke select, delete on table public.game_initial_state from anon;
revoke select, delete on table public.game_events from anon;
revoke select, delete on table public.game_rounds from anon;
revoke select, delete on table public.game_player_decks from anon;
revoke select, delete on table public.game_player_card_presence from anon;
revoke select, delete on table public.game_player_card_usage from anon;

create policy "anon insert guest player profiles"
on public.player_profiles
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
  and auth_user_id is null
);

create policy "anon update guest player profiles"
on public.player_profiles
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
  and auth_user_id is null
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
  and auth_user_id is null
);

create policy "anon insert games"
on public.games
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update games"
on public.games
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game initial state"
on public.game_initial_state
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game initial state"
on public.game_initial_state
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game events"
on public.game_events
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game events"
on public.game_events
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game rounds"
on public.game_rounds
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game rounds"
on public.game_rounds
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game player decks"
on public.game_player_decks
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game player decks"
on public.game_player_decks
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game player card presence"
on public.game_player_card_presence
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game player card presence"
on public.game_player_card_presence
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon insert game player card usage"
on public.game_player_card_usage
for insert
to anon
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

create policy "anon update game player card usage"
on public.game_player_card_usage
for update
to anon
using (
  current_setting('request.jwt.claim.role', true) = 'anon'
)
with check (
  current_setting('request.jwt.claim.role', true) = 'anon'
);

-- =========================================================
-- Views: use security_invoker instead of security_definer
-- =========================================================
alter view public.v_card_deck_win_rates
  set (security_invoker = true);

alter view public.v_card_opening_hand_win_rates
  set (security_invoker = true);

alter view public.v_card_usage_summary
  set (security_invoker = true);

grant select on public.v_card_deck_win_rates to anon, authenticated;
grant select on public.v_card_opening_hand_win_rates to anon, authenticated;
grant select on public.v_card_usage_summary to anon, authenticated;

-- =========================================================
-- live_games: enable RLS and preserve current guest-token flow
-- =========================================================
alter table public.live_games enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'live_games'
  loop
    execute format('drop policy if exists %I on public.live_games', p.policyname);
  end loop;
end
$$;

grant select, insert, update on public.live_games to anon;
revoke delete on public.live_games from anon;

create policy "anon can read live games"
on public.live_games
for select
to anon
using (id is not null);

create policy "anon can create live games"
on public.live_games
for insert
to anon
with check (
  mode = 'online'
  and status in ('waiting', 'active', 'finished')
  and version >= 1
);

create policy "anon can claim player b seat"
on public.live_games
for update
to anon
using (
  player_b_token is null
)
with check (
  mode = 'online'
  and status in ('waiting', 'active', 'finished')
  and player_b_token is not null
  and version >= 1
);

create policy "anon can update claimed live games"
on public.live_games
for update
to anon
using (
  player_a_token is not null
  or player_b_token is not null
)
with check (
  mode = 'online'
  and status in ('waiting', 'active', 'finished')
  and version >= 1
);

commit;
