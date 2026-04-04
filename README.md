# Kaizen Poker

A two-player deckcrafting poker game. Each round: draw 7, play 2 as actions, score the best 5-card poker hand. First to 7 chips wins.

## Play Online

Visit: `https://dsparks.github.io/kaizen-poker/`

## Develop Locally

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

## Analytics Tracking

The app now records a structured tracked game alongside the human-readable battle log.

Tracked data includes:

- full initial 26-card deck order for Player A and Player B
- explicit opening hands for both players
- ordered game events with per-event sequence numbers
- round summaries
- final winner and final chip counts
- derived per-card deck presence and usage rows

Tracked games are stored locally during play in `localStorage`, then archived on game end.

## Optional Supabase Sync

Analytics sync is optional and does not control gameplay. The game still runs locally in hot-seat mode; Supabase is only used to persist analytics data.

### 1. Create a Supabase project

Create a project at `https://supabase.com`.

### 2. Add environment variables

Copy `.env.example` to `.env.local` and fill in your project values:

```bash
VITE_ENABLE_ANALYTICS_SYNC=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

If `VITE_ENABLE_ANALYTICS_SYNC` is `false`, the app keeps tracking locally but skips network sync.

### 3. Run the database migration

Apply:

- [supabase/migrations/0001_analytics_schema.sql](supabase/migrations/0001_analytics_schema.sql)

That migration creates:

- `player_profiles`
- `games`
- `game_initial_state`
- `game_events`
- `game_rounds`
- `game_player_decks`
- `game_player_card_presence`
- `game_player_card_usage`

It also creates analytics views:

- `v_card_deck_win_rates`
- `v_card_opening_hand_win_rates`
- `v_card_usage_summary`

### 4. Enable analytics on GitHub Pages

If you want the deployed site at `https://dsparks.github.io/kaizen-poker/` to send analytics too, add these repository secrets in GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Path in GitHub:

`Repo -> Settings -> Secrets and variables -> Actions -> New repository secret`

Then push to `main` again. The deploy workflow reads those secrets at build time and bakes them into the GitHub Pages bundle.

## Current Analytics Flow

During play, the app writes:

1. `games`
2. `game_initial_state`
3. append-only `game_events`
4. `game_rounds`
5. derived deck / presence / usage rows

Guest profile IDs are generated locally and synced into `player_profiles`, so the schema is ready for future account support.

## What The Event Stream Captures

The current tracked event stream includes:

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

## Baseline Analytics Queries

This schema supports the minimum balance-analysis questions directly:

- win rate with `[Card]` in your deck
- win rate with `[Card]` in your opening hand
- per-card draw / play / scoring-hand / scrap counts

The most immediately useful view is `v_card_deck_win_rates`, which lets you estimate card strength from very large samples based only on deck membership.

## Deploy to GitHub Pages

1. Create a new GitHub repo named `kaizen-poker`
2. Push this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kaizen-poker.git
git push -u origin main
```

3. In GitHub, go to `Settings -> Pages -> Source` and select `GitHub Actions`
4. The deploy workflow runs automatically on push
