create extension if not exists pgcrypto;

create table if not exists player_profiles (
  id uuid primary key,
  auth_user_id uuid unique,
  is_guest boolean not null default true,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key,
  status text not null,
  mode text not null,
  winner_player_slot text,
  winner_profile_id uuid references player_profiles(id),
  a_profile_id uuid references player_profiles(id),
  b_profile_id uuid references player_profiles(id),
  started_at timestamptz not null,
  finished_at timestamptz,
  app_version text not null,
  rules_version text not null,
  source text not null,
  final_state jsonb
);

create table if not exists game_initial_state (
  game_id uuid primary key references games(id) on delete cascade,
  a_initial_deck text[] not null,
  b_initial_deck text[] not null,
  a_initial_hand text[] not null,
  b_initial_hand text[] not null,
  a_initial_discard text[] not null default '{}',
  b_initial_discard text[] not null default '{}',
  initial_first_player text not null,
  initial_round integer not null default 1,
  initial_state jsonb not null
);

create table if not exists game_events (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  seq integer not null,
  round_number integer not null,
  phase text not null,
  player_slot text,
  event_type text not null,
  event_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists game_rounds (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  round_number integer not null,
  first_player text not null,
  a_actions_required integer not null,
  b_actions_required integer not null,
  a_cards_drawn integer not null,
  b_cards_drawn integer not null,
  winner_player_slot text,
  a_hand_rank text,
  b_hand_rank text,
  round_summary jsonb not null,
  unique (game_id, round_number)
);

create table if not exists game_player_decks (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_slot text not null,
  profile_id uuid references player_profiles(id),
  deck_cards text[] not null,
  opening_hand text[] not null,
  won boolean,
  unique (game_id, player_slot)
);

create table if not exists game_player_card_presence (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_slot text not null,
  profile_id uuid references player_profiles(id),
  card_id text not null,
  in_deck boolean not null default true,
  in_opening_hand boolean not null default false,
  won boolean,
  unique (game_id, player_slot, card_id)
);

create table if not exists game_player_card_usage (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_slot text not null,
  profile_id uuid references player_profiles(id),
  card_id text not null,
  times_drawn integer not null default 0,
  times_played_face_up integer not null default 0,
  times_played_face_down integer not null default 0,
  times_in_scoring_hand integer not null default 0,
  times_scrapped integer not null default 0,
  unique (game_id, player_slot, card_id)
);

create index if not exists idx_game_events_game_seq on game_events(game_id, seq);
create index if not exists idx_game_events_type on game_events(event_type);
create index if not exists idx_game_rounds_game_round on game_rounds(game_id, round_number);
create index if not exists idx_games_finished_at on games(finished_at);
create index if not exists idx_games_winner_profile on games(winner_profile_id);
create index if not exists idx_card_presence_card_won on game_player_card_presence(card_id, won);
create index if not exists idx_game_player_decks_profile on game_player_decks(profile_id);

create or replace view v_card_deck_win_rates as
select
  card_id,
  count(*) as appearances,
  count(*) filter (where won is true) as wins,
  avg(case when won is true then 1.0 else 0.0 end) as win_rate
from game_player_card_presence
where in_deck is true
group by card_id;

create or replace view v_card_opening_hand_win_rates as
select
  card_id,
  count(*) as appearances,
  count(*) filter (where won is true) as wins,
  avg(case when won is true then 1.0 else 0.0 end) as win_rate
from game_player_card_presence
where in_opening_hand is true
group by card_id;

create or replace view v_card_usage_summary as
select
  card_id,
  sum(times_drawn) as times_drawn,
  sum(times_played_face_up) as times_played_face_up,
  sum(times_played_face_down) as times_played_face_down,
  sum(times_in_scoring_hand) as times_in_scoring_hand,
  sum(times_scrapped) as times_scrapped
from game_player_card_usage
group by card_id;
