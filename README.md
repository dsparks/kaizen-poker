# Kaizen Poker

A two-player deckbuilding poker duel prototype. Each round, players draw seven cards, play two Actions, then score the best five-card poker hand they can make. First to seven chips wins.

## Play Online

Live build:

`https://dsparks.github.io/kaizen-poker/`

The app supports guest remote play through Supabase-backed live game rows. One player creates a game, copies the invite link, and the second player joins from another browser.

## Develop Locally

```bash
npm install
npm run dev
```

Vite serves the app at:

`http://localhost:5173`

## Main Modes

- `Tutorial`: guided onboarding with Chippy
- `Hotseat Game`: two players sharing one screen
- `Solo Mode`: race the Challenger to seven chips
- `Rules`: embedded PDF viewer for the rulebook
- `Online Game`: guest remote multiplayer

Some prototype-only tools and art modes still exist in the codebase, but they are hidden from the normal player-facing menu.

## Analytics Tracking

The app records a structured tracked game alongside the human-readable game log.

Tracked data includes:

- initial 26-card deck order for both players
- opening hands
- ordered game events
- round summaries
- final winner and final chip counts
- derived per-card deck, presence, and usage rows

Tracked games are saved locally during play in `localStorage`, then archived on game end.

## Optional Supabase Sync

Supabase is optional for analytics sync and required for remote guest multiplayer. Local hotseat, tutorial, and solo gameplay still work without it.

### 1. Create a Supabase project

Create a project at `https://supabase.com`.

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_ENABLE_ANALYTICS_SYNC=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

If `VITE_ENABLE_ANALYTICS_SYNC` is `false`, the app still tracks locally but skips network sync.

### 3. Run the database migrations

Apply these migrations in order:

- [supabase/migrations/0001_analytics_schema.sql](supabase/migrations/0001_analytics_schema.sql)
- [supabase/migrations/0002_live_games.sql](supabase/migrations/0002_live_games.sql)
- [supabase/migrations/0003_security_advisor_fixes.sql](supabase/migrations/0003_security_advisor_fixes.sql)
- [supabase/migrations/0004_solo_analytics_views.sql](supabase/migrations/0004_solo_analytics_views.sql)
- [supabase/migrations/0005_analytics_rls_followup.sql](supabase/migrations/0005_analytics_rls_followup.sql)
- [supabase/migrations/0006_secure_guest_boundaries.sql](supabase/migrations/0006_secure_guest_boundaries.sql)

Those migrations create:

- analytics tables such as `games`, `game_initial_state`, `game_events`, `game_rounds`, `game_player_decks`, `game_player_card_presence`, and `game_player_card_usage`
- the `live_games` table used by guest remote multiplayer
- analytics views for deck win rates, opening hand win rates, usage summaries, and completed solo runs
- token-checked RPC boundaries for live games and analytics ingestion; raw
  tables are not intended to be accessed directly by browser clients

Migration `0006` must be applied before deploying version `0.2.0` or later.
The current clients call its RPCs and no longer write the underlying tables
directly.

### Online security scope

Seat and analytics tokens are hashed in the database and checked inside
security-definer RPCs. Unseated browsers cannot read a live game's state, and
anonymous browser clients cannot read or write raw analytics tables.

The current online mode is still client-authoritative: both claimed players
receive the complete game state and may submit the next state. This is suitable
for friendly guest play, not adversarial or ranked play. Strong hidden-card and
anti-cheat guarantees require moving complete action/effect validation into a
server-authoritative command reducer and returning a redacted view to each
seat.

### 4. Guest Remote Multiplayer

Once Supabase is configured:

1. Open the app
2. Click `Create Online Game`
3. Copy the invite link
4. Send it to your friend
5. Your friend opens the link and joins as Player B

The app stores guest seat tokens in browser `localStorage`, so refreshing the same browser keeps the seat when possible.

### 5. Enable analytics on GitHub Pages

If you want the deployed GitHub Pages build to send analytics too, add these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub path:

`Repo -> Settings -> Secrets and variables -> Actions`

Then push to `main` again so the deploy workflow can bake those values into the bundle.

## Current Event Stream

The tracked event stream currently includes:

- `game_started`
- `initial_deal`
- `round_started`
- `card_drawn`
- `card_discarded`
- `card_scrapped`
- `action_played`
- `action_fizzled`
- `action_frozen`
- `action_cancelled`
- `modify_chosen`
- `queen_choice`
- `round_scored`
- `chip_awarded`
- `post_score_effect`
- `game_finished`

## Example Solo Analytics Query

For completed solo-run balance questions, `v_completed_solo_run_card_outcomes` is a good starting point:

```sql
select
  card_id,
  count(*) filter (where player_won_run is true) as wins,
  count(*) filter (where player_won_run is false) as losses,
  count(*) as total_runs,
  round(
    100.0 * count(*) filter (where player_won_run is true) / nullif(count(*), 0),
    1
  ) as win_rate_pct
from public.v_completed_solo_run_card_outcomes
where in_deck is true
  and total_rounds > 6
group by card_id
order by win_rate_pct desc nulls last, total_runs desc, card_id;
```

## Deploy to GitHub Pages

1. Create a GitHub repo named `kaizen-poker`
2. Push this project
3. In GitHub, set `Settings -> Pages -> Source` to `GitHub Actions`
4. Pushes to `main` will trigger the deploy workflow

## State and rules architecture

- `src/gameData.js` is the canonical card/rank metadata.
- `src/memory.js` is the canonical model of each player's persistent knowledge.
- `src/gameState.js` owns state migration and invariant validation.
- `src/rulesEngine.js` owns the extracted pure state-transition commands.
- `src/KaizenPoker.jsx` still orchestrates interactive, multi-step card effects.
  New transitions should move into `rulesEngine.js` as commands instead of
  adding more direct zone mutation to the component.

Saved and transported state is migrated to schema version 2. Generated build
artifacts under `dist/` should not be edited directly.

## Verification

```bash
npm test
npm run test:cards
npm run build
```

The unit suite covers state migration/invariants, deterministic randomness,
hand evaluation, draw exhaustion, reducer primitives, and Memory semantics.
The card-effect suite drives all 48 Action effects through the real UI. CI runs
both suites and a production build.
