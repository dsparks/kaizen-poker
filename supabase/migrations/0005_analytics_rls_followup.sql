begin;

-- Follow-up to analytics RLS: PostgREST upserts need SELECT as well as
-- INSERT/UPDATE, and auth.role() is the more reliable anon check here.
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
        and policyname like 'anon %'
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end
$$;

grant usage on schema public to anon;

grant select, insert, update on table public.player_profiles to anon;
grant select, insert, update on table public.games to anon;
grant select, insert, update on table public.game_initial_state to anon;
grant select, insert, update on table public.game_events to anon;
grant select, insert, update on table public.game_rounds to anon;
grant select, insert, update on table public.game_player_decks to anon;
grant select, insert, update on table public.game_player_card_presence to anon;
grant select, insert, update on table public.game_player_card_usage to anon;

revoke delete on table public.player_profiles from anon;
revoke delete on table public.games from anon;
revoke delete on table public.game_initial_state from anon;
revoke delete on table public.game_events from anon;
revoke delete on table public.game_rounds from anon;
revoke delete on table public.game_player_decks from anon;
revoke delete on table public.game_player_card_presence from anon;
revoke delete on table public.game_player_card_usage from anon;

create policy "anon select guest player profiles"
on public.player_profiles
for select
to anon
using (
  auth.role() = 'anon'
  and auth_user_id is null
);

create policy "anon insert guest player profiles"
on public.player_profiles
for insert
to anon
with check (
  auth.role() = 'anon'
  and auth_user_id is null
);

create policy "anon update guest player profiles"
on public.player_profiles
for update
to anon
using (
  auth.role() = 'anon'
  and auth_user_id is null
)
with check (
  auth.role() = 'anon'
  and auth_user_id is null
);

create policy "anon select games"
on public.games
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert games"
on public.games
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update games"
on public.games
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game initial state"
on public.game_initial_state
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game initial state"
on public.game_initial_state
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game initial state"
on public.game_initial_state
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game events"
on public.game_events
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game events"
on public.game_events
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game events"
on public.game_events
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game rounds"
on public.game_rounds
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game rounds"
on public.game_rounds
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game rounds"
on public.game_rounds
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game player decks"
on public.game_player_decks
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game player decks"
on public.game_player_decks
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game player decks"
on public.game_player_decks
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game player card presence"
on public.game_player_card_presence
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game player card presence"
on public.game_player_card_presence
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game player card presence"
on public.game_player_card_presence
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

create policy "anon select game player card usage"
on public.game_player_card_usage
for select
to anon
using (
  auth.role() = 'anon'
);

create policy "anon insert game player card usage"
on public.game_player_card_usage
for insert
to anon
with check (
  auth.role() = 'anon'
);

create policy "anon update game player card usage"
on public.game_player_card_usage
for update
to anon
using (
  auth.role() = 'anon'
)
with check (
  auth.role() = 'anon'
);

commit;
