# BetBingo Mini App — "Gold Coin" Production Pass

**Date:** 2026-07-06
**Status:** Draft for review
**Scope:** Restyle the existing BetBingo Telegram Mini App to a tap-to-earn "Gold Coin"
aesthetic (visual reskin only — the lottery/bingo product is unchanged), add four new
features, and harden the whole stack for production (error handling, edge cases, backend).

---

## 1. Context

The repo directory is `parking-bot` and the README describes "ParkAddis", but the actual
product is **BetBingo** — a Telegram Mini App lottery/bingo betting game for Ethiopia
(ETB currency, Chapa payments). The README is stale and will be updated.

### Current mini app (`src/miniapp/`)

- **App.jsx** — screen switcher (home/games/draw/tickets/profile/deposit), `PlayerContext`,
  `ToastContext`, Telegram `ready/expand`.
- **Screens:** HomeScreen, GamesScreen (list + detail), DrawScreen (live polling every 5s),
  TicketsScreen (filters), ProfileScreen (header + wallet + Transactions/Language/Help),
  DepositScreen (presets + custom → Chapa).
- **Components:** BottomNav, Toast.
- **api.js** — thin fetch wrapper over `/api/miniapp/*`.

### Current look

Dark `#0a0a0f`, cyan/emerald neon, glassmorphism, backdrop-blur, many animations. Polished
but generic; not tap-to-earn.

### Backend that powers it (`src/`)

- `routes/miniapp.routes.js` — player, games, tickets, wallet (deposit/withdraw), language,
  transactions. Guarded by `middlewares/telegramAuth.js` (HMAC initData verification; dev
  header bypass).
- `services/gameService.js` (buyTicket via `buy_ticket()` SQL fn, atomic), `walletService.js`
  (Chapa deposit + withdrawal), `chapaService.js`.
- Standard response envelope `{success, data}` / `{success, error:{code,message,details}}`
  via `utils/apiResponse.js`; error hierarchy + legacy-code map in `utils/errors.js`.
- Schema in `migrations/001_init.sql`: `players` (has `wallet_balance`, `total_spent`,
  `total_won`, `total_tickets_bought`), `game_rounds`, `tickets`, `drawn_numbers`,
  `transactions` (enum `transaction_type` = deposit|ticket_purchase|winnings|withdrawal|refund),
  `settings` (JSONB values; `min_withdrawal` = `'50'`).

---

## 2. Confirmed defects (fix as part of this work)

| # | Defect | Location | Fix |
|---|--------|----------|-----|
| D1 | Profile "Spent" always 0 — `/player` omits `total_spent` | `routes/miniapp.routes.js:23` | add `total_spent` (and new feature fields) to response |
| D2 | Error-code branches never fire — `api.js` throws the human *message*, screens compare against *codes* | `miniapp/api.js:29`, all screens | `api.js` throws an `ApiError` carrying `.code` + `.message`; screens branch on `.code` |
| D3 | Withdrawal is dead code — backend + `api.withdraw()` exist, no UI | — | build Withdrawal screen (Phase C) |
| D4 | Broken withdrawal min query — `SELECT min_withdrawal FROM settings` then reads `.value` | `walletService.js:104` | `SELECT value FROM settings WHERE key='min_withdrawal'`, coerce JSONB number |
| D5 | Auth/player load failure swallowed — `catch {}` renders app with null player | `App.jsx:51` | dedicated auth-error/reconnect screen + retry |
| D6 | Draw polls every 5s forever, even when tab hidden / screen inactive | `DrawScreen.jsx:47` | `usePolling` pauses on `visibilitychange` and when Draw isn't the active screen |
| D7 | Theme mismatch — `tailwind.config.js` is the admin light theme; miniapp hardcodes hex | `tailwind.config.js` | add coin tokens additively; miniapp consumes tokens |
| D8 | Duplicated `SkeletonCard`/`ProgressBar`/button markup across screens | all screens | shared `components/ui/` primitives |

**Non-goals for this pass:** full Amharic translation of the mini app (strings will be
centralized to make it easy later); changes to the admin dashboard theme; changes to the
bot handlers; changes to the draw/settlement algorithm.

---

## 3. Visual direction — "Gold Coin"

Deep violet-navy base, glossy **gold/amber** coin accent, emerald for wins, chunky 3D
press-down buttons (bottom shadow that compresses on `:active`), coin-styled number balls,
energy-bar-style fill meters (repurposed for tickets-sold / countdown, not a real energy
mechanic).

### Tokens (added to `tailwind.config.js`, additive)

```
coin: { 50..900 }          amber/gold ramp; 400 = #fbbf24, 500 = #f59e0b
violet base surfaces:      bg #0b0713, surface #150f24, raised #1e1533
coin-glow shadows:         0 0 24px rgba(251,191,36,.35)
gradients:                 coin (gold sheen), violet-mesh background
animations:                coinFlip, shine sweep, press, pop, float, countUp
```

CSS variables + a `.coin-bg` mesh in `index.css`. Existing miniapp animations kept/renamed.

---

## 4. Component & hook architecture (Phase A)

### `src/miniapp/components/ui/`

- **Button** — variants `primary` (gold 3D), `ghost`, `danger`, `subtle`; `loading`,
  `disabled`, `block`; haptic on press.
- **Card** — glass violet surface; `interactive` variant.
- **Coin** — reusable glossy coin (sizes; optional value label) — hero + inline.
- **NumberBall** — coin-styled drawn number; states pending/drawn/latest.
- **ProgressMeter** — energy-bar fill (label, pct, tone).
- **StatTile** — small labeled stat.
- **Sheet** — bottom-sheet modal (confirm buy / withdraw / ticket detail); focus-trap, backdrop, Telegram BackButton integration.
- **SegmentedTabs** — pill filter (tickets filters, leaderboard periods).
- **EmptyState / ErrorState / Skeleton** — uniform states with retry.
- **ScreenShell** — standard screen wrapper: coin top-bar (balance + settings), scroll area,
  optional title/back.
- **Toast** — restyled to coin theme (keep existing API).
- **BottomNav** — floating pill, 5 tabs, active coin indicator.

### `src/miniapp/hooks/`

- **useResource(fetcher, deps)** → `{data, loading, error, reload, refreshing}`; supports
  silent refresh; centralizes the load/empty/error/retry pattern used everywhere.
- **useTelegram()** → `{ tg, haptic(style), showBackButton(cb), hideBackButton,
  mainButton(...), themeParams, initData }`.
- **useOnline()** → boolean; drives a global offline banner.
- **usePolling(fn, ms, active)** → polls only while `active` && `document.visible`.
- **useCountdown(target)** → formatted remaining string.

### `src/miniapp/api.js` (rework)

- `request()` returns data or throws `ApiError { code, message, status, details }`.
- `AbortController` timeout (default 15s → `TIMEOUT`); network failure → `NETWORK` code.
- Screens branch on `err.code` (fixes D2).

---

## 5. Screen redesigns (Phase B)

All screens use `ScreenShell` + shared primitives; consistent loading/empty/error; haptics
on primary actions.

- **Home** — glossy coin hero (balance, greeting), quick actions (Play / Deposit / Daily),
  stat strip (active games / tickets / prize pool), featured game card, games list (coin
  motif, fill meter, countdown). Buy → confirm Sheet.
- **Games** — list + detail. Detail: coin prize-tier rows, fill meter, chunky Buy in a
  confirm Sheet showing price + resulting balance; sold-out / not-active states.
- **Draw** — coin number balls with sequential pop, live pulse, "complete" badge; past
  results accordion; polling via `usePolling`.
- **Tickets** — `SegmentedTabs` (All/Active/Won/Lost), win banner, ticket rows with coin win
  badge; tap → ticket detail Sheet (uses `/tickets/:id`).
- **Deposit** — coin denomination chips, custom stepper, method chips (Telebirr/CBE/Card),
  validation inline, redirect to Chapa; pending-state handling.
- **Profile** — coin avatar header, wallet card with **Deposit + Withdraw**, menu:
  Transactions, **Referrals**, **Leaderboard**, **Daily reward**, Language, Help, Admin (if admin).

---

## 6. New features (Phase C) — FE + BE + migration `004_miniapp_features.sql`

### 6.1 Withdrawal
- **UI:** `WithdrawScreen` — balance, amount (min from settings), method/phone note, confirm Sheet.
- **BE:** fix D4; add zod validation; return updated balance + pending tx. Withdrawals stay
  `pending` (manual payout by admin — existing behavior).

### 6.2 Daily reward + streak
- **Migration:** `players.last_daily_claim_at TIMESTAMPTZ`, `players.daily_streak INT DEFAULT 0`;
  add `'bonus'` to `transaction_type` enum. Reward table in `settings` (`daily_reward_base`,
  `daily_streak_bonus`, `daily_streak_max`).
- **BE:** `GET /player/daily` → `{ canClaim, streak, nextClaimAt, rewardPreview }`;
  `POST /player/daily/claim` → credits wallet (base + streak bonus, capped), records `bonus`
  tx, advances/resets streak (reset if a day was missed). Idempotent per UTC day.
- **UI:** claim card on Home + Profile; 7-day streak strip; haptic + coin animation on claim.

### 6.3 Referrals
- **Migration:** `players.referral_code TEXT UNIQUE`, `players.referred_by BIGINT REFERENCES
  players(id)`, `players.referral_count INT DEFAULT 0`; add `'referral_bonus'` to enum;
  settings `referral_bonus_amount`.
- **BE:** generate `referral_code` on first `/player` load if null; capture `referred_by`
  from Telegram `start_param` (passed by client) on first upsert — only if player is new and
  not self. Credit `referral_bonus` to referrer on the referred player's **first successful
  deposit** (hook in `confirmDeposit`). `GET /player/referrals` → `{ code, link, count,
  earned, invitees[] }`.
- **UI:** `ReferralScreen` — big code + copy, "Invite via Telegram" (share link
  `https://t.me/<bot>?start=ref_<code>`), earnings, invitee list.

### 6.4 Leaderboard
- **BE:** `GET /leaderboard?period=all|week` → top N by `total_won` (+ this-week via
  transactions sum for `week`), plus caller's own rank. Read-only.
- **UI:** `LeaderboardScreen` — top-3 podium (coins), ranked list, "you" row pinned; period tabs.

---

## 7. Backend hardening (Phase D)

- **Validation:** zod schemas for every mini app POST body (`amount` bounds + integer,
  `gameId` positive int, `language` enum, `daily/claim` no body, `withdraw` amount).
- **`/player` response:** add `total_spent`, `daily` summary, `referral_code`,
  `referral_count` (fixes D1; feeds new UIs in one round-trip).
- **Idempotency:** deposit — short-window dedupe of identical `(player, amount)` pending
  deposits to avoid double Chapa sessions on double-tap; buyTicket already atomic in SQL.
- **Rate limiting:** per-route limiter on `POST /wallet/*` and `POST /tickets` (prod).
- **Auth:** keep HMAC verification; require `auth_date` freshness in prod (already);
  ensure dev header bypass is dev-only (already). Accept optional `start_param` for referral.
- **Referral credit** wired transactionally inside `confirmDeposit`.

---

## 8. i18n / strings

Mini app strings centralized into `src/miniapp/i18n.js` (English now). Language toggle keeps
working for the bot; wiring the mini app to Amharic is a fast follow (out of scope here).

---

## 9. Testing & verification

- **Backend (vitest + supertest):** withdrawal min fix (D4), `/player` includes `total_spent`
  (D1), daily claim (first claim, same-day re-claim blocked, streak advance/reset), referral
  capture + credit-on-first-deposit + no self-referral, leaderboard shape + own-rank, deposit
  double-submit dedupe, validation rejects bad input.
- **Frontend:** manual verification via `npm run miniapp:build` + dev header; check each
  screen's loading/empty/error/offline states, buy/withdraw/daily/referral flows, and that
  error codes surface correct messages (D2).
- **Build gates:** `npm run lint`, `npm run miniapp:build`, `npm test` must pass.

---

## 10. File-change map (high level)

```
tailwind.config.js                     + coin tokens/animations (additive)
src/miniapp/index.css                  violet+gold base, coin utilities
src/miniapp/api.js                     ApiError, timeout, network detection
src/miniapp/i18n.js                    NEW centralized strings
src/miniapp/hooks/*                    NEW useResource/useTelegram/useOnline/usePolling/useCountdown
src/miniapp/components/ui/*            NEW primitives
src/miniapp/components/BottomNav.jsx   restyle (floating pill)
src/miniapp/components/Toast.jsx       restyle
src/miniapp/components/ErrorBoundary.jsx  NEW
src/miniapp/App.jsx                    shell, offline banner, auth-error screen, new routes
src/miniapp/screens/*                  restyle all + Withdraw/Referral/Leaderboard/Daily
migrations/004_miniapp_features.sql    NEW (daily + referral columns, enum values, settings)
src/db/repositories/players.js         daily/referral/leaderboard queries
src/services/walletService.js          D4 fix, referral credit, validation
src/services/rewardsService.js         NEW daily + referral logic
src/routes/miniapp.routes.js           D1 fix, new endpoints, zod validation, rate limits
src/utils/errors.js                    new legacy codes (DAILY_ALREADY_CLAIMED, etc.)
tests/*                                NEW backend tests
README.md                              refresh (BetBingo, not ParkAddis)
```

---

## 11. Sequencing

A (foundation) → B (reskin) → C (features) → D (hardening/tests). Each phase is independently
buildable and reviewable. Phase A unblocks everything; C and D share the migration and can be
built together per feature (feature UI + endpoint + test).
