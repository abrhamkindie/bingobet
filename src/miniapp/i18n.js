/**
 * Centralized mini app copy + formatting helpers.
 * English only for now; keeping strings here makes a future Amharic pass trivial
 * (swap `t` for a language-aware lookup).
 */

export const t = {
  appName: 'BetBingo',
  tagline: 'Tap. Play. Win big.',
  balance: 'Balance',
  play: 'Play',
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  daily: 'Daily',
  refresh: 'Refresh',
  tryAgain: 'Try Again',
  buy: 'Buy',
  buyTicket: 'Buy Ticket',
  offline: "You're offline — reconnecting…",
  reconnect: 'Reconnect',
  loading: 'Loading…',
  // errors (by ApiError code)
  errors: {
    NETWORK: 'No connection. Please try again.',
    TIMEOUT: 'Request timed out. Check your connection.',
    INSUFFICIENT_BALANCE: 'Not enough balance — top up first.',
    GAME_SOLD_OUT: 'This game is sold out!',
    GAME_NOT_ACCEPTING_TICKETS: 'This game is not open for tickets.',
    PLAYER_TICKET_LIMIT_REACHED: 'You reached the ticket limit for this game.',
    INVALID_AMOUNT: 'Please enter a valid amount.',
    WITHDRAWAL_MINIMUM: 'Amount is below the minimum withdrawal.',
    DAILY_ALREADY_CLAIMED: 'You already claimed today. Come back tomorrow!',
    RATE_LIMIT_EXCEEDED: 'Slow down a moment and try again.',
    default: 'Something went wrong. Please try again.',
  },
};

/** Map an ApiError (or Error) to a friendly, human message. */
export function errorMessage(err, fallback) {
  const code = err?.code;
  if (code && t.errors[code]) return t.errors[code];
  if (err?.message && code && !/^HTTP_/.test(code)) return err.message;
  return fallback || t.errors.default;
}

const nf = new Intl.NumberFormat('en-US');

/** 1234.5 -> "1,235" (whole ETB). */
export function fmtETB(v) {
  return nf.format(Math.round(Number(v || 0)));
}

/** 1234.5 -> "1,234.5" preserving up to 2 decimals. */
export function fmtNum(v) {
  return nf.format(Number(v || 0));
}
