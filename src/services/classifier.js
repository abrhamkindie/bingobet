/**
 * @file Lightweight keyword-based classifier for support ticket descriptions.
 *
 * Predicts one of the five support ticket categories based on keyword
 * scoring of the description text. No external API calls — runs locally.
 *
 * @module services/classifier
 */

// ── Keyword maps: each category has weighted keywords ─────────────────────
//
// Higher weight = stronger signal. Negative weights reduce the score for
// a category when the keyword appears (disambiguation).
//
// Keywords are lowercased; matching is case-insensitive.

const KEYWORDS = {
  payment: [
    // High-signal (weight 3)
    { word: 'refund',         weight: 3 },
    { word: 'charged',        weight: 3 },
    { word: 'double charge',  weight: 3 },
    // Medium-signal (weight 2)
    { word: 'payment',        weight: 2 },
    { word: 'chapa',          weight: 2 },
    { word: 'telebirr',       weight: 2 },
    { word: 'cbe birr',       weight: 2 },
    { word: 'transaction',    weight: 2 },
    { word: 'money',          weight: 2 },
    { word: 'paid',           weight: 2 },
    { word: 'receipt',        weight: 2 },
    { word: 'invoice',        weight: 2 },
    { word: 'debit',          weight: 2 },
    { word: 'deduct',         weight: 2 },
    { word: 'billing',        weight: 2 },
    { word: 'overcharge',     weight: 2 },
    // Low-signal (weight 1)
    { word: 'cost',           weight: 1 },
    { word: 'price',          weight: 1 },
    { word: 'fee',            weight: 1 },
    { word: 'pay',            weight: 1 },
    { word: 'bank',           weight: 1 },
    { word: 'transfer',       weight: 1 },
  ],

  booking: [
    { word: 'reservation',    weight: 3 },
    { word: 'cancel booking', weight: 3 },
    { word: 'extend',         weight: 2 },
    { word: 'booking',        weight: 2 },
    { word: 'reserved',       weight: 2 },
    { word: 'confirmation',   weight: 2 },
    { word: 'confirmation code', weight: 3 },
    { word: 'code',           weight: 1 },
    { word: 'slot',           weight: 2 },
    { word: 'time slot',      weight: 2 },
    { word: 'schedule',       weight: 1 },
    { word: 'modify',         weight: 2 },
    { word: 'change',         weight: 1 },
    { word: 'wrong date',     weight: 2 },
    { word: 'wrong time',     weight: 2 },
    { word: 'no show',        weight: 2 },
    { word: 'overlap',        weight: 2 },
    { word: 'double booked',  weight: 3 },
  ],

  host: [
    { word: 'list my spot',   weight: 3 },
    { word: 'my spot',        weight: 2 },
    { word: 'listing',        weight: 2 },
    { word: 'host',           weight: 2 },
    { word: 'owner',          weight: 2 },
    { word: 'manage spot',    weight: 2 },
    { word: 'pause',          weight: 2 },
    { word: 'resume',         weight: 2 },
    { word: 'delete spot',    weight: 3 },
    { word: 'edit price',     weight: 2 },
    { word: 'price change',   weight: 1 },
    { word: 'capacity',       weight: 1 },
    { word: 'amenities',      weight: 1 },
    { word: 'availability',   weight: 2 },
    { word: 'check in',       weight: 2 },
    { word: 'checkin',        weight: 2 },
    { word: 'qr code',        weight: 1 },
    { word: 'payout',         weight: 3 },
    { word: 'earnings',       weight: 2 },
    { word: 'balance',        weight: 2 },
    { word: 'commission',     weight: 2 },
  ],

  feature: [
    { word: 'feature',        weight: 2 },
    { word: 'suggestion',     weight: 3 },
    { word: 'would be nice',  weight: 3 },
    { word: 'could you add',  weight: 3 },
    { word: 'idea',           weight: 2 },
    { word: 'request',        weight: 1 },
    { word: 'improve',        weight: 2 },
    { word: 'improvement',    weight: 2 },
    { word: 'upgrade',        weight: 2 },
    { word: 'enhance',        weight: 2 },
    { word: 'add',            weight: 1 },
    { word: 'support for',    weight: 2 },
    { word: 'integrate',      weight: 2 },
    { word: 'integration',    weight: 2 },
    { word: 'missing',        weight: 1 },
    { word: 'need a way to',  weight: 2 },
    { word: 'convenient',     weight: 1 },
  ],
};

// Disambiguation: if a keyword from one category appears alongside negative
// signals, reduce its score. Example: "booking" appearing with "payment"
// keywords should stay in booking, not get pulled to payment.
const NEGATIVE_SIGNALS = {
  payment: ['refund policy', 'cancel', 'wrong spot', 'host not responding'],
  booking: ['feature request', 'idea', 'suggestion'],
  host: ['booking issue', 'payment problem', 'feature request'],
};

// ── Default fallback weights (bias toward a category when nothing matches) ─
const DEFAULT_BIAS = {
  payment: 0,
  booking: 0,
  host: 0,
  feature: 0,
  other: 1, // slight bias toward "other" — it's the catch-all
};

/**
 * Predict the most likely category for a support ticket description.
 *
 * @param {string} description - The user's issue description
 * @returns {{ category: string, score: number, scores: Object<string, number>, label: string }}
 *   Returns the predicted category key, its confidence score (0–1 range normalised),
 *   all raw scores, and a human-readable label.
 */
export function predictCategory(description) {
  if (!description || typeof description !== 'string') {
    return {
      category: 'other',
      score: 0,
      scores: { ...DEFAULT_BIAS },
      label: 'Other',
    };
  }

  const text = description.toLowerCase();
  const scores = { ...DEFAULT_BIAS };

  // Score each category
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const { word, weight } of keywords) {
      if (text.includes(word)) {
        scores[category] += weight;
      }
    }
  }

  // Apply negative signals (penalize)
  for (const [category, signals] of Object.entries(NEGATIVE_SIGNALS)) {
    for (const signal of signals) {
      if (text.includes(signal)) {
        scores[category] = Math.max(0, scores[category] - 2);
      }
    }
  }

  // Find the category with the highest score
  let bestCategory = 'other';
  let bestScore = scores.other;

  for (const [cat, score] of Object.entries(scores)) {
    if (cat === 'other') continue; // other is the fallback
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // If the best score is 0, fall back to "other"
  if (bestScore <= 0) {
    bestCategory = 'other';
  }

  // Normalise scores to a 0–1 confidence range (cap at sum of max possible)
  // Max possible score ≈ sum of all keyword weights for a category
  const maxPossible = 30; // rough ceiling
  const normalised = {};
  for (const [cat, score] of Object.entries(scores)) {
    normalised[cat] = Math.min(1, Math.round((score / maxPossible) * 100) / 100);
  }

  const confidence = normalised[bestCategory];

  const labels = {
    payment: 'Payment Issue',
    booking: 'Booking Problem',
    host: 'Host Issue',
    feature: 'Feature Request',
    other: 'Other',
  };

  return {
    category: bestCategory,
    score: confidence,
    scores: normalised,
    label: labels[bestCategory] || 'Other',
  };
}

/**
 * Convenience: returns just the category key.
 * @param {string} description
 * @returns {string}
 */
export function predictCategoryKey(description) {
  return predictCategory(description).category;
}
