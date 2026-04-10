create or replace view public.v_completed_solo_runs as
select
  g.id as game_id,
  g.mode,
  g.source,
  g.started_at,
  g.finished_at,
  g.winner_player_slot,
  max(gr.round_number) as total_rounds,
  g.a_profile_id,
  g.b_profile_id
from public.games g
join public.game_rounds gr
  on gr.game_id = g.id
where g.mode in ('solo_variant', 'solo_art_test')
  and g.status = 'finished'
  and g.winner_player_slot in ('A', 'B')
group by
  g.id,
  g.mode,
  g.source,
  g.started_at,
  g.finished_at,
  g.winner_player_slot,
  g.a_profile_id,
  g.b_profile_id;

create or replace view public.v_completed_solo_run_card_outcomes as
select
  csr.game_id,
  csr.mode,
  csr.source,
  csr.started_at,
  csr.finished_at,
  csr.total_rounds,
  cpp.card_id,
  cpp.in_deck,
  cpp.in_opening_hand,
  (csr.winner_player_slot = 'A') as player_won_run
from public.v_completed_solo_runs csr
join public.game_player_card_presence cpp
  on cpp.game_id = csr.game_id
where cpp.player_slot = 'A';

create or replace view public.v_solo_card_run_win_rates as
select
  card_id,
  count(*) filter (where in_deck is true) as deck_appearances,
  count(*) filter (where in_deck is true and player_won_run is true) as deck_wins,
  count(*) filter (where in_deck is true and player_won_run is false) as deck_losses,
  round(
    100.0 * count(*) filter (where in_deck is true and player_won_run is true)
    / nullif(count(*) filter (where in_deck is true), 0),
    1
  ) as deck_win_rate_pct,
  count(*) filter (where in_deck is true and total_rounds > 6) as long_run_deck_appearances,
  count(*) filter (where in_deck is true and total_rounds > 6 and player_won_run is true) as long_run_deck_wins,
  count(*) filter (where in_deck is true and total_rounds > 6 and player_won_run is false) as long_run_deck_losses,
  round(
    100.0 * count(*) filter (where in_deck is true and total_rounds > 6 and player_won_run is true)
    / nullif(count(*) filter (where in_deck is true and total_rounds > 6), 0),
    1
  ) as long_run_deck_win_rate_pct
from public.v_completed_solo_run_card_outcomes
group by card_id;
