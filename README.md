# Kaizen Poker

A two-player deckcrafting poker game. Each round: draw 7, play 2 as actions, score the best 5-card poker hand. First to 7 chips wins.

## Play Online

Visit: `https://dsparks.github.io/kaizen-poker/`

## Deploy to GitHub Pages

1. Create a new repo on GitHub named `kaizen-poker`
2. Push this folder to the repo:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/kaizen-poker.git
   git push -u origin main
   ```
3. Go to repo **Settings → Pages → Source** and select **GitHub Actions**
4. The deploy workflow runs automatically on push. Your site will be live in ~2 minutes.

## Develop Locally

```
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Future: Adding Supabase

When you're ready for multiplayer, auth, and analytics:

1. Create a free Supabase project at https://supabase.com
2. Install the client: `npm install @supabase/supabase-js`
3. Create a `src/supabase.js` file:
   ```js
   import { createClient } from '@supabase/supabase-js'
   export const supabase = createClient(
     'https://YOUR_PROJECT.supabase.co',
     'YOUR_ANON_KEY'
   )
   ```
4. Use `supabase.from('games').insert(...)` to store game state
5. Use `supabase.channel('game:123').on(...)` for real-time sync
6. Use `supabase.auth.signInWithOAuth(...)` for login

The game logic in `KaizenPoker.jsx` stays the same — you'd just replace `useState` for game state with Supabase reads/writes.
