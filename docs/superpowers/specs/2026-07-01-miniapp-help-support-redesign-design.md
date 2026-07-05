# Mini App Help & Support Screen Redesign

**Date:** 2026-07-01
**Status:** Approved (design)
**Scope:** Frontend redesign of the mini app Help & Support screen + one light API addition.

## Problem

The current Help & Support screen (`HelpSection` in `src/miniapp/screens/ProfileScreen.jsx:595`)
leads with process instructions and a heavy, always-open ticket form. Self-service FAQ
("Quick answers") is buried at the very bottom, there is no search, and there is no direct
way to reach the team for urgent cases. Four same-weight cards stack with no clear "start here".

Concretely:

1. **Ordering fights the goal.** Users open Help to get an answer fast, but FAQ is last.
2. **The form is heavy and always expanded.** Five full-height category cards + a textarea
   dominate the screen even though most visits will not file a ticket.
3. **No search** across FAQ content.
4. **`SupportIntro`** (the 3-step "check → send → track" panel) is low-value filler in prime space.
5. **No direct contact affordance** — everything routes through a ticket.

## Goal

A full information-architecture rethink into an **answer-first hub**: search and self-service
answers are the primary path, a direct Telegram contact shortcut is available, and ticket
filing becomes a streamlined, on-demand secondary action.

## Design

### Screen structure (top → bottom)

1. **Header** — `SectionFrame`, title "Help & support", subtitle "Search answers or reach the team".
2. **Search bar** — text input with `search` icon and a clear (`x`) button when filled.
   Filters FAQ live, client-side, case-insensitive substring match on category title + content.
3. **Contact card** ("Need a hand?") with two actions:
   - **Primary — "Message on Telegram"** → opens `https://t.me/<botUsername>` via
     `window.Telegram?.WebApp?.openTelegramLink(url)`, falling back to `window.open(url, '_blank')`.
   - **Secondary — "New ticket"** → sets `showTicketForm = true` and scrolls the form into view.
4. **Quick answers** (hero) — accordion of FAQ categories from `api.getHelp()`.
   - No active search: full accordion, one section expandable at a time.
   - Active search: flatten to matching categories, show a result count, auto-expand matches,
     and render an empty state ("No answers match '<q>' — send a ticket instead") when nothing matches.
5. **Recent tickets** — collapsed accordion (kept from today, count shown in header).
6. **Ticket form** — hidden by default; revealed by "New ticket".
   - Category picker becomes a compact **2-column grid of selectable chips** (icon + label)
     instead of five full-height stacked cards.
   - The selected chip's hint renders as a single helper line under the grid.
   - Textarea + character counter + send button retained.
   - On successful submit: form hides, Recent tickets expands (existing behavior), toast shown.

### Component refactor

The ~160-line inline `HelpSection` is broken into focused components in the same file:

| Component | Responsibility |
|---|---|
| `HelpSection` | Data loading, top-level state, composition |
| `HelpSearch` | Search input + clear button (controlled by `query`) |
| `SupportContactCard` | Telegram + New-ticket actions |
| `QuickAnswers` | Searchable FAQ accordion (owns filtering against `query`) |
| `RecentTickets` | Kept; minor header tweak |
| `TicketForm` | Extracted form with chip category picker |
| ~~`SupportIntro`~~ | **Deleted** — guidance folds into the textarea placeholder (already present) |

### State (in `HelpSection`)

- New: `query` (search text), `showTicketForm` (bool), `botUsername` (string).
- Retained: `categories`, `tickets`, `expanded`, `ticketCategory`, `ticketDescription`,
  `loading`, `submitting`.

### Behavior details

- Search filtering is client-side over already-loaded `categories`; no new request.
- Matching sections auto-expand while a query is active.
- "New ticket" reveals the form and scrolls it into view; submit hides it again.
- Telegram link prefers `openTelegramLink`, falls back to `window.open`.

### API change (light)

- Add `bot_username: config.botUsername` to the `/help` response
  (`src/routes/miniapp.routes.js:638`, `success(res, { categories, bot_username })`).
- Frontend reads `bot_username` from the `getHelp()` result into `botUsername` state.
- No DB, schema, or ticket-submission changes.

### New icon

- Add one `send` (paper-plane) icon to `src/miniapp/components/Icons.jsx` for the Telegram action.

### Design vocabulary reused

`SectionFrame`, `ToneIcon`, `StatusPill`, `Field`, `LoadingRows`, existing tone color system
(cyan / emerald / amber / violet / slate), `rounded-2xl` cards, dark slate theme.

## Non-goals

- No changes to the ticket submission API, admin ticket queue, or FAQ content / i18n strings.
- No backend changes beyond exposing `bot_username`.
- No routing/navigation changes (screen still reached from the Profile menu).

## Testing

- Manual: run the mini app, open Profile → Help & support; verify search filters FAQ,
  Telegram button opens the bot, New-ticket reveals the streamlined form, submit works and
  updates Recent tickets.
- Confirm `/help` returns `bot_username` and the frontend consumes it.
- Verify role-aware FAQ (driver vs host) still renders correctly.
