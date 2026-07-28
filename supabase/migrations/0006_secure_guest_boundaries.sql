begin;

create extension if not exists pgcrypto;

-- Browser-readable rows exposed both seat secrets and the complete hidden
-- game state. Keep the table private and expose only token-checking RPCs.
update public.live_games
set player_a_token=crypt(player_a_token,gen_salt('bf'))
where player_a_token is not null and player_a_token not like '$2%';

update public.live_games
set player_b_token=crypt(player_b_token,gen_salt('bf'))
where player_b_token is not null and player_b_token not like '$2%';

revoke all on table public.live_games from anon, authenticated;

create or replace function public.create_live_game(
  p_game_id uuid,
  p_state jsonb,
  p_tracked jsonb,
  p_player_a_token text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result public.live_games;
begin
  if p_player_a_token is null or length(p_player_a_token)<16 then
    raise exception 'A strong seat token is required';
  end if;
  insert into public.live_games(id,mode,status,state,tracked,version,player_a_token)
  values(p_game_id,'online','waiting',p_state,p_tracked,1,crypt(p_player_a_token,gen_salt('bf')))
  returning * into result;
  return jsonb_build_object(
    'id',result.id,'mode',result.mode,'status',result.status,'state',result.state,
    'tracked',result.tracked,'version',result.version,'seat','A',
    'player_a_claimed',true,'player_b_claimed',result.player_b_token is not null
  );
end
$$;

create or replace function public.get_live_game(
  p_game_id uuid,
  p_seat_token text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare row public.live_games; seat text;
begin
  select * into row from public.live_games where id=p_game_id;
  if not found then return null; end if;
  if p_seat_token is not null and row.player_a_token is not null
     and crypt(p_seat_token,row.player_a_token)=row.player_a_token then seat='A';
  elsif p_seat_token is not null and row.player_b_token is not null
     and crypt(p_seat_token,row.player_b_token)=row.player_b_token then seat='B';
  end if;
  return jsonb_build_object(
    'id',row.id,'mode',row.mode,'status',row.status,
    'state',case when seat is not null then row.state else null end,
    'tracked',case when seat='A' then row.tracked else null end,
    'version',row.version,'seat',seat,
    'player_a_claimed',row.player_a_token is not null,
    'player_b_claimed',row.player_b_token is not null
  );
end
$$;

create or replace function public.claim_live_game_seat(
  p_game_id uuid,
  p_player_b_token text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare row public.live_games;
begin
  if p_player_b_token is null or length(p_player_b_token)<16 then
    raise exception 'A strong seat token is required';
  end if;
  update public.live_games
  set player_b_token=crypt(p_player_b_token,gen_salt('bf')),status='active',updated_at=now()
  where id=p_game_id and player_b_token is null
  returning * into row;
  if not found then raise exception 'Player B seat is already claimed'; end if;
  return jsonb_build_object(
    'id',row.id,'mode',row.mode,'status',row.status,'state',row.state,
    'tracked',null,'version',row.version,'seat','B',
    'player_a_claimed',true,'player_b_claimed',true
  );
end
$$;

create or replace function public.update_live_game(
  p_game_id uuid,
  p_seat_token text,
  p_expected_version integer,
  p_state jsonb,
  p_tracked jsonb default null,
  p_status text default 'active'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare row public.live_games; seat text;
begin
  select * into row from public.live_games where id=p_game_id for update;
  if not found then raise exception 'Online game not found'; end if;
  if row.player_a_token is not null and crypt(p_seat_token,row.player_a_token)=row.player_a_token then seat='A';
  elsif row.player_b_token is not null and crypt(p_seat_token,row.player_b_token)=row.player_b_token then seat='B';
  else raise exception 'Invalid seat token'; end if;
  if row.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_status not in ('waiting','active','finished') then raise exception 'Invalid game status'; end if;
  update public.live_games
  set state=p_state,
      tracked=case when seat='A' and p_tracked is not null then p_tracked else tracked end,
      version=version+1,status=p_status,updated_at=now()
  where id=p_game_id
  returning * into row;
  return jsonb_build_object(
    'id',row.id,'mode',row.mode,'status',row.status,'state',row.state,
    'tracked',case when seat='A' then row.tracked else null end,
    'version',row.version,'seat',seat,
    'player_a_claimed',true,'player_b_claimed',row.player_b_token is not null
  );
end
$$;

revoke all on function public.create_live_game(uuid,jsonb,jsonb,text) from public;
revoke all on function public.get_live_game(uuid,text) from public;
revoke all on function public.claim_live_game_seat(uuid,text) from public;
revoke all on function public.update_live_game(uuid,text,integer,jsonb,jsonb,text) from public;
grant execute on function public.create_live_game(uuid,jsonb,jsonb,text) to anon;
grant execute on function public.get_live_game(uuid,text) to anon;
grant execute on function public.claim_live_game_seat(uuid,text) to anon;
grant execute on function public.update_live_game(uuid,text,integer,jsonb,jsonb,text) to anon;

-- Analytics ingestion uses a per-game secret generated by the originating
-- browser. Raw analytics rows are no longer anonymously readable or writable.
alter table public.games add column if not exists ingest_token_hash text;
update public.games
set ingest_token_hash=crypt(gen_random_uuid()::text,gen_salt('bf'))
where ingest_token_hash is null;

revoke all on table public.player_profiles from anon, authenticated;
revoke all on table public.games from anon, authenticated;
revoke all on table public.game_initial_state from anon, authenticated;
revoke all on table public.game_events from anon, authenticated;
revoke all on table public.game_rounds from anon, authenticated;
revoke all on table public.game_player_decks from anon, authenticated;
revoke all on table public.game_player_card_presence from anon, authenticated;
revoke all on table public.game_player_card_usage from anon, authenticated;
revoke all on public.v_card_deck_win_rates from anon, authenticated;
revoke all on public.v_card_opening_hand_win_rates from anon, authenticated;
revoke all on public.v_card_usage_summary from anon, authenticated;

create or replace function public.sync_game_analytics(p_token text,p_payload jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare game_data jsonb:=p_payload->'game'; game_uuid uuid:=(game_data->>'id')::uuid; stored_hash text;
begin
  if p_token is null or length(p_token)<16 then raise exception 'A strong ingest token is required'; end if;
  if game_uuid is null then raise exception 'A game id is required'; end if;

  select ingest_token_hash into stored_hash from public.games where id=game_uuid;
  if stored_hash is not null and crypt(p_token,stored_hash)<>stored_hash then
    raise exception 'Invalid analytics ingest token';
  end if;

  -- Only the two profiles named by this game may be created through this RPC.
  insert into public.player_profiles(id,is_guest,display_name,created_at)
  select id,is_guest,display_name,created_at
  from jsonb_to_recordset(coalesce(p_payload->'profiles','[]'::jsonb))
    as x(id uuid,is_guest boolean,display_name text,created_at timestamptz)
  where id in (
    nullif(game_data->>'a_profile_id','')::uuid,
    nullif(game_data->>'b_profile_id','')::uuid
  )
  on conflict(id) do nothing;

  insert into public.games(
    id,status,mode,winner_player_slot,winner_profile_id,a_profile_id,b_profile_id,
    started_at,finished_at,app_version,rules_version,source,final_state,ingest_token_hash
  ) values(
    game_uuid,game_data->>'status',game_data->>'mode',game_data->>'winner_player_slot',
    nullif(game_data->>'winner_profile_id','')::uuid,nullif(game_data->>'a_profile_id','')::uuid,
    nullif(game_data->>'b_profile_id','')::uuid,(game_data->>'started_at')::timestamptz,
    nullif(game_data->>'finished_at','')::timestamptz,game_data->>'app_version',
    game_data->>'rules_version',game_data->>'source',game_data->'final_state',
    crypt(p_token,gen_salt('bf'))
  )
  on conflict(id) do update set
    status=excluded.status,winner_player_slot=excluded.winner_player_slot,
    winner_profile_id=excluded.winner_profile_id,finished_at=excluded.finished_at,
    final_state=excluded.final_state
  where crypt(p_token,public.games.ingest_token_hash)=public.games.ingest_token_hash;

  -- The game row now owns this token. Constrain every imported row to that
  -- game so a valid token cannot be used to mutate another game's analytics.

  insert into public.game_initial_state(
    game_id,a_initial_deck,b_initial_deck,a_initial_hand,b_initial_hand,
    a_initial_discard,b_initial_discard,initial_first_player,initial_round,initial_state
  )
  select game_id,a_initial_deck,b_initial_deck,a_initial_hand,b_initial_hand,
    a_initial_discard,b_initial_discard,initial_first_player,initial_round,initial_state
  from jsonb_to_recordset(jsonb_build_array(p_payload->'initial_state'))
    as x(game_id uuid,a_initial_deck text[],b_initial_deck text[],a_initial_hand text[],b_initial_hand text[],
      a_initial_discard text[],b_initial_discard text[],initial_first_player text,initial_round integer,initial_state jsonb)
  where game_id=game_uuid
  on conflict(game_id) do update set initial_state=excluded.initial_state;

  insert into public.game_events(id,game_id,seq,round_number,phase,player_slot,event_type,event_payload,created_at)
  select * from jsonb_to_recordset(coalesce(p_payload->'events','[]'::jsonb))
    as x(id uuid,game_id uuid,seq integer,round_number integer,phase text,player_slot text,event_type text,event_payload jsonb,created_at timestamptz)
  where game_id=game_uuid
  on conflict(id) do update set event_payload=excluded.event_payload;

  insert into public.game_rounds(id,game_id,round_number,first_player,a_actions_required,b_actions_required,a_cards_drawn,b_cards_drawn,winner_player_slot,a_hand_rank,b_hand_rank,round_summary)
  select * from jsonb_to_recordset(coalesce(p_payload->'rounds','[]'::jsonb))
    as x(id uuid,game_id uuid,round_number integer,first_player text,a_actions_required integer,b_actions_required integer,a_cards_drawn integer,b_cards_drawn integer,winner_player_slot text,a_hand_rank text,b_hand_rank text,round_summary jsonb)
  where game_id=game_uuid
  on conflict(game_id,round_number) do update set
    winner_player_slot=excluded.winner_player_slot,a_hand_rank=excluded.a_hand_rank,
    b_hand_rank=excluded.b_hand_rank,round_summary=excluded.round_summary;

  insert into public.game_player_decks(id,game_id,player_slot,profile_id,deck_cards,opening_hand,won)
  select * from jsonb_to_recordset(coalesce(p_payload->'decks','[]'::jsonb))
    as x(id uuid,game_id uuid,player_slot text,profile_id uuid,deck_cards text[],opening_hand text[],won boolean)
  where game_id=game_uuid
  on conflict(game_id,player_slot) do update set won=excluded.won;

  insert into public.game_player_card_presence(id,game_id,player_slot,profile_id,card_id,in_deck,in_opening_hand,won)
  select * from jsonb_to_recordset(coalesce(p_payload->'card_presence','[]'::jsonb))
    as x(id uuid,game_id uuid,player_slot text,profile_id uuid,card_id text,in_deck boolean,in_opening_hand boolean,won boolean)
  where game_id=game_uuid
  on conflict(game_id,player_slot,card_id) do update set won=excluded.won;

  insert into public.game_player_card_usage(id,game_id,player_slot,profile_id,card_id,times_drawn,times_played_face_up,times_played_face_down,times_in_scoring_hand,times_scrapped)
  select * from jsonb_to_recordset(coalesce(p_payload->'card_usage','[]'::jsonb))
    as x(id uuid,game_id uuid,player_slot text,profile_id uuid,card_id text,times_drawn integer,times_played_face_up integer,times_played_face_down integer,times_in_scoring_hand integer,times_scrapped integer)
  where game_id=game_uuid
  on conflict(game_id,player_slot,card_id) do update set
    times_drawn=excluded.times_drawn,times_played_face_up=excluded.times_played_face_up,
    times_played_face_down=excluded.times_played_face_down,times_in_scoring_hand=excluded.times_in_scoring_hand,
    times_scrapped=excluded.times_scrapped;
end
$$;

revoke all on function public.sync_game_analytics(text,jsonb) from public;
grant execute on function public.sync_game_analytics(text,jsonb) to anon;

commit;
