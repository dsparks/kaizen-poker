create table if not exists live_games (
  id uuid primary key,
  mode text not null default 'online',
  status text not null default 'waiting',
  state jsonb not null,
  tracked jsonb,
  version integer not null default 1,
  player_a_token text,
  player_b_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_games_status on live_games(status);
create index if not exists idx_live_games_updated_at on live_games(updated_at);
