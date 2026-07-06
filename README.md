# BetBingo — Telegram lottery & bingo Mini App (Ethiopia)

A Telegram bot + Mini App where players deposit ETB, buy lottery/bingo tickets,
watch live number draws, and win prizes. Bilingual bot (English / አማርኛ),
Chapa payments (Telebirr / CBE Birr / Card), and a tap-to-earn styled Mini App.

## Tech stack

- **Backend:** Node.js + Express
- **Bot:** [grammY](https://grammy.dev)
- **DB:** PostgreSQL 14+
- **Payments:** Chapa (with manual withdrawal payout)
- **Mini App:** React + Vite + Tailwind + Telegram WebApp SDK
- **Admin dashboard:** React + Tailwind

## Project layout

```
migrations/        SQL schema (001), functions (002), seed (003),
                   mini app features — daily/referrals (004)
scripts/           migrate.js · seed.js
src/
  config/          env loading + validation (zod)
  db/              pg pool + repositories/
  i18n/            bot translator + locales/{en,am}.json
  services/        gameService · walletService · chapaService ·
                   rewardsService (daily reward, referrals, leaderboard)
  routes/          miniapp.routes.js · admin/* · auth · public
  middlewares/     telegramAuth (HMAC initData) · errorHandler · validate
  bot/             grammY bot: handlers/ keyboards
  miniapp/         React Mini App (see below)
  admin/           React admin dashboard
  server.js        Express app
  index.js         entrypoint — starts bot + server
```

## Mini App (`src/miniapp/`) — "Gold Coin" theme

A tap-to-earn styled interface over the lottery product.

- **Screens:** Home (coin hero, daily reward, live games), Games (list + detail
  with prize tiers), Live Draw (animated coin balls, past results), Tickets
  (filters + detail sheet), Deposit, Withdraw, Referrals, Leaderboard, Profile.
- **Design system:** `components/ui/` primitives (Button, Card, Coin, NumberBall,
  ProgressMeter, Sheet, SegmentedTabs, ScreenShell, states) + `hooks/`
  (`useResource`, `useTelegram`, `useOnline`, `usePolling`, `useCountdown`).
- **Resilience:** ErrorBoundary, offline banner, auth/reconnect screen, typed
  `ApiError` with timeout + network detection, uniform loading/empty/error states,
  Telegram haptics + BackButton.

### Games

- **Lottery / Bingo** — buy tickets → scheduled live draw → prizes
- **Keno** — pick up to 8 numbers, 10 are drawn instantly, payout by matches
- **Spin Wheel** — stake and spin a weighted wheel for an instant multiplier

Keno & Spin are instant house games settled atomically against the wallet, with
server-side RNG and admin-tunable paytable / segments / stake limits in `settings`.
See `migrations/005_instant_games.sql` and `services/instantGamesService.js`.

### Wallet & rewards

- Buy tickets → live draw → prizes (existing lottery engine)
- **Deposit** via Chapa; **Withdraw** (manual payout, min from `settings`)
- **Daily reward + streak** — claim ETB once per UTC day, streak bonus (capped)
- **Referrals** — share `t.me/<bot>?start=ref_<code>`; referrer earns a bonus on
  the invitee's first deposit
- **Leaderboard** — top winners (all-time / this week) with your own rank

## Getting started

Requires Node ≥ 20 and Docker (for PostgreSQL).

```bash
cp .env.example .env          # set BOT_TOKEN, BOT_USERNAME, DATABASE_URL, JWT_SECRET, CHAPA_*
npm install

npm run db:up                 # start PostgreSQL
npm run db:migrate            # apply schema + functions + mini app features
npm run db:seed               # sample games

npm start                     # builds admin + mini app, boots Express + bot
```

Health checks: `GET /health` and `GET /ready` (the latter pings the DB).

### Local Mini App auth

In `development`, the Mini App API accepts an `X-Telegram-User-Id` header instead
of signed Telegram `initData`, so you can test in a plain browser:

```bash
curl -H "X-Telegram-User-Id: 900000001" localhost:3000/api/miniapp/player
```

In production, requests must carry Telegram `initData` (HMAC-verified against the
bot token, with `auth_date` freshness).

## Scripts

```
npm run dev            # watch build + node --watch
npm run miniapp:build  # build the Mini App only
npm run admin:build    # build the admin dashboard only
npm test               # vitest
npm run db:reset       # drop, migrate, seed
```

## Configuration

Runtime config is in `.env` (see `.env.example`). Tunable business values live in
the `settings` table (JSONB), e.g. `min_withdrawal`, `daily_reward_base`,
`daily_streak_bonus`, `daily_streak_max`, `referral_bonus_amount`,
`platform_fee_percent` — changeable without a redeploy.
```
