// Consistency checks across related values in a JSON-LD node. Pure: no DOM access.
//
// The form validators only look at one field at a time (is this a URL, is that an ISO date). These checks catch
// values that are valid on their own but contradict each other: an event that ends before it starts, a rating
// above bestRating, a salary range whose minimum exceeds its maximum, or an offer that already expired.
import { asArray, isDate } from './schemas/util.js';

/** Every issue code this module can emit (each one needs an i18n message). */
export const CONSISTENCY_CODES = [
  'date-order', 'date-expired', 'offer-after-start', 'rating-range', 'rating-scale', 'range-order', 'negative-value',
];

/** [earlier, later, severity] pairs checked inside the same object. */
const DATE_PAIRS = [
  ['startDate', 'endDate', 'error'],
  ['datePublished', 'dateModified', 'error'],
  ['datePosted', 'validThrough', 'error'],
  ['uploadDate', 'expires', 'error'],
  ['validFrom', 'priceValidUntil', 'error'],
  ['validFrom', 'validThrough', 'error'],
];

/** Dates that mean "this listing is no longer valid" once they pass. */
const EXPIRY = ['validThrough', 'priceValidUntil', 'expires'];

/** [min, max] pairs checked inside the same object. */
const RANGE_PAIRS = [
  ['minValue', 'maxValue'],
  ['lowPrice', 'highPrice'],
];

/** Numeric properties that can never be negative. */
const NON_NEGATIVE = [
  'price', 'lowPrice', 'highPrice', 'ratingCount', 'reviewCount', 'offerCount', 'merchantReturnDays', 'minValue', 'maxValue',
];

const SKIP = new Set(['@context', '@id', '@type']);

/**
 * Parses an ISO 8601 date or date-time into `{ ms, dateOnly }`, or null when it is not a valid date.
 * Date-only values are read as UTC midnight; date-times without an offset are read as UTC too, so the result does
 * not depend on the time zone of the browser or CI runner.
 */
export function parseIsoDate(s) {
  if (typeof s !== 'string' || !isDate(s)) return null;
  const v = s.trim();
  const dateOnly = !v.includes('T');
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/.test(v);
  const ms = Date.parse(dateOnly ? v + 'T00:00:00Z' : hasZone ? v : v + 'Z');
  return Number.isFinite(ms) ? { ms, dateOnly, day: v.slice(0, 10) } : null;
}

/**
 * Compares two ISO dates. Returns -1, 0 or 1, or null when either is not a date.
 * When one side has no time part only the calendar days are compared, so "2026-05-01" and "2026-05-01T18:00"
 * count as the same day instead of the date-time looking "later".
 */
export function compareDates(a, b) {
  const x = parseIsoDate(a);
  const y = parseIsoDate(b);
  if (!x || !y) return null;
  if (x.dateOnly || y.dateOnly) return x.day < y.day ? -1 : x.day > y.day ? 1 : 0;
  return x.ms < y.ms ? -1 : x.ms > y.ms ? 1 : 0;
}

/** Number from a JSON-LD value (number or numeric string), else undefined. */
function numeric(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return undefined;
}

const join = (prefix, key) => (prefix ? prefix + '.' + key : key);
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isRating = (o) => asArray(o['@type']).some((t) => t === 'Rating' || t === 'AggregateRating') || 'ratingValue' in o;

function checkObject(o, prefix, today, out) {
  for (const [a, b, severity] of DATE_PAIRS) {
    if (compareDates(o[a], o[b]) === 1) {
      out.push({ severity, code: 'date-order', path: join(prefix, b), params: { a: join(prefix, a), b: join(prefix, b) } });
    }
  }
  for (const k of EXPIRY) {
    if (o[k] !== undefined && compareDates(o[k], today) === -1) {
      out.push({ severity: 'warning', code: 'date-expired', path: join(prefix, k), params: { value: String(o[k]) } });
    }
  }
  for (const [lo, hi] of RANGE_PAIRS) {
    const x = numeric(o[lo]);
    const y = numeric(o[hi]);
    if (x !== undefined && y !== undefined && x > y) {
      out.push({ severity: 'error', code: 'range-order', path: join(prefix, lo), params: { a: join(prefix, lo), b: join(prefix, hi) } });
    }
  }
  for (const k of NON_NEGATIVE) {
    const x = numeric(o[k]);
    if (x !== undefined && x < 0) out.push({ severity: 'error', code: 'negative-value', path: join(prefix, k), params: { value: x } });
  }
  if (isRating(o)) {
    const best = numeric(o.bestRating) ?? 5;
    const worst = numeric(o.worstRating) ?? 1;
    const value = numeric(o.ratingValue);
    if (best <= worst) {
      out.push({ severity: 'error', code: 'rating-scale', path: join(prefix, 'bestRating'), params: { min: worst, max: best } });
    } else if (value !== undefined && (value < worst || value > best)) {
      out.push({ severity: 'error', code: 'rating-range', path: join(prefix, 'ratingValue'), params: { value, min: worst, max: best } });
    }
  }
}

function walk(v, prefix, today, out) {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, prefix, today, out));
  if (!isObject(v)) return;
  checkObject(v, prefix, today, out);
  for (const [k, child] of Object.entries(v)) {
    if (!SKIP.has(k) && typeof child === 'object' && child !== null) walk(child, join(prefix, k), today, out);
  }
}

/** Today's date (UTC) as YYYY-MM-DD. */
export const todayIso = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/**
 * Finds contradictions between related values anywhere in the node.
 * @param {Object} node JSON-LD node
 * @param {{now?: number|Date}} [opts] `now` is used for expiry checks (defaults to the current time).
 * @returns {import('./types.js').LintIssue[]}
 */
export function checkConsistency(node, { now = Date.now() } = {}) {
  const out = [];
  if (!isObject(node)) return out;
  const today = todayIso(now instanceof Date ? now.getTime() : now);
  walk(node, '', today, out);

  // Event tickets that only go on sale after the event has started are almost always a typo.
  if (asArray(node['@type']).includes('Event')) {
    asArray(node.offers).forEach((offer) => {
      if (isObject(offer) && compareDates(offer.validFrom, node.startDate) === 1) {
        out.push({ severity: 'warning', code: 'offer-after-start', path: 'offers.validFrom', params: { a: 'offers.validFrom', b: 'startDate' } });
      }
    });
  }
  return out;
}
