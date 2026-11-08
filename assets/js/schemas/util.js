// Pure helpers shared by all schema modules. No DOM access.
export const CONTEXT = 'https://schema.org';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const asArray = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
export const one = (a) => (Array.isArray(a) && a.length === 1 ? a[0] : a);
export const lines = (s) =>
  String(s ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const schemaUrl = (v) => (v ? 'https://schema.org/' + v : undefined);
export const bare = (x) => String(x ?? '').replace(/^https?:\/\/schema\.org\//, '');

export function num(s) {
  if (s === undefined || s === null || String(s).trim() === '') return undefined;
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : undefined;
}

export function isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

/** Recursively drops empty values. Objects holding only @type/@context collapse to {}. */
export function clean(v) {
  if (Array.isArray(v)) return v.map(clean).filter((x) => !isEmpty(x));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      const c = clean(val);
      if (!isEmpty(c)) out[k] = c;
    }
    return Object.keys(out).some((k) => k !== '@type' && k !== '@context') ? out : {};
  }
  return typeof v === 'string' ? v.trim() : v;
}

// ---- validators -----------------------------------------------------------
export function isUrl(s) {
  try {
    const u = new URL(String(s).trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

export function isDate(s) {
  s = String(s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  if (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || (m[6] !== undefined && +m[6] > 59))) return false;
  return true;
}

export const isDuration = (s) =>
  /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/.test(String(s).trim());
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(s).trim());
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
export const isNumber = (s) => /^-?\d+(\.\d+)?$/.test(String(s).trim());
export const isCurrency = (s) => /^[A-Z]{3}$/.test(String(s).trim());

function formatError(f, v) {
  const fmt = f.format || f.type;
  if (f.type === 'list' && fmt === 'url') {
    return lines(v).every(isUrl) ? '' : 'Each line must be a full URL starting with http:// or https://.';
  }
  switch (fmt) {
    case 'url': return isUrl(v) ? '' : 'Enter a full URL starting with http:// or https://.';
    case 'date': return isDate(v) ? '' : 'Use ISO 8601, e.g. 2026-01-31 or 2026-01-31T09:00:00+06:00.';
    case 'duration': return isDuration(v) ? '' : 'Use an ISO 8601 duration, e.g. PT30M or P1DT2H.';
    case 'time': return isTime(v) ? '' : 'Use 24-hour HH:MM.';
    case 'email': return isEmail(v) ? '' : 'Enter a valid email address.';
    case 'number': return isNumber(v) ? '' : 'Enter a number (digits and an optional decimal point).';
    case 'currency': return isCurrency(v) ? '' : 'Use a 3-letter ISO 4217 code, e.g. USD.';
    default: return '';
  }
}

// ---- forms ----------------------------------------------------------------
export function rowEmpty(fields, row) {
  return fields.every((f) => isEmpty(row?.[f.key]));
}

export function nonEmptyRows(rows, keys) {
  return asArray(rows).filter((r) => keys.some((k) => !isEmpty(r?.[k])));
}

export function defaultsFor(fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'rows') out[f.key] = [defaultsFor(f.fields)];
    else if (f.type === 'days') out[f.key] = [];
    else out[f.key] = f.default ?? '';
  }
  return out;
}

/** Returns { path: { msg, required } }. Row paths look like "steps.0.text". */
export function validate(fields, values, prefix = '') {
  const errors = {};
  for (const f of fields) {
    const path = prefix + f.key;
    const v = values?.[f.key];
    if (f.type === 'rows') {
      const rows = asArray(v);
      if (f.required && !rows.some((r) => !rowEmpty(f.fields, r))) {
        errors[path] = { msg: `Add at least one ${f.itemLabel || 'item'}.`, required: true };
      }
      rows.forEach((r, i) => {
        if (!rowEmpty(f.fields, r)) Object.assign(errors, validate(f.fields, r, `${path}.${i}.`));
      });
      continue;
    }
    const empty = isEmpty(v);
    if (empty) {
      if (f.required) errors[path] = { msg: 'This field is required.', required: true };
    } else {
      const m = formatError(f, v);
      if (m) errors[path] = { msg: m };
    }
    if (!errors[path] && f.check) {
      const m = f.check(v, values);
      if (m) errors[path] = { msg: m, required: empty };
    }
  }
  return errors;
}

// ---- output ---------------------------------------------------------------
/** Serialises to JSON; pass `{ minify: true }` for a single-line, whitespace-free document. */
export const toJson = (obj, { minify = false } = {}) =>
  minify ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
/**
 * Wraps the document in a JSON-LD script tag. "</" is escaped as "<\/" (still valid JSON) so
 * user text such as "</script>" cannot close the tag early.
 */
export const toScriptTag = (obj, opts = {}) => {
  const body = toJson(obj, opts).replace(/<\//g, '<\\/');
  return opts.minify
    ? `<script type="application/ld+json">${body}</script>`
    : `<script type="application/ld+json">\n${body}\n</script>`;
};

// ---- shared field groups --------------------------------------------------
export const addressFields = [
  { key: 'street', label: 'Street address', type: 'text' },
  { key: 'city', label: 'City / locality', type: 'text' },
  { key: 'region', label: 'State / region', type: 'text' },
  { key: 'postal', label: 'Postal code', type: 'text' },
  { key: 'country', label: 'Country (ISO code, e.g. BD)', type: 'text' },
];

export function buildAddress(v) {
  return {
    '@type': 'PostalAddress',
    streetAddress: v.street,
    addressLocality: v.city,
    addressRegion: v.region,
    postalCode: v.postal,
    addressCountry: v.country,
  };
}

// ---- parsing helpers (used by import) ---------------------------------------
export const text = (x) =>
  x === undefined || x === null ? '' : typeof x === 'object' ? String(x.name ?? x.url ?? '') : String(x);
export const urlOf = (x) =>
  typeof x === 'string' ? x : (x && (x.url || x.contentUrl || x['@id'])) || '';
export const joinLines = (x) => asArray(x).map(urlOf).filter(Boolean).join('\n');

export function parseAddress(a) {
  a = asArray(a)[0];
  if (!a) return {};
  if (typeof a === 'string') return { street: a };
  return {
    street: text(a.streetAddress),
    city: text(a.addressLocality),
    region: text(a.addressRegion),
    postal: text(a.postalCode),
    country: text(a.addressCountry),
  };
}

/** Removes keys whose value is undefined so parsed values merge cleanly over defaults. */
export const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const str = (x) => (x === undefined || x === null ? '' : String(x));
export { str };

/**
 * Compact field-definition helper.
 * @param {string} key
 * @param {string} label
 * @param {import('../types.js').FieldType} [type]
 * @param {Partial<import('../types.js').Field>} [o]
 * @returns {import('../types.js').Field}
 */
export const f = (key, label, type = 'text', o = {}) => ({ key, label, type, ...o });

/** First entry of node["@type"] that is in `list`, or undefined. */
export const pickType = (node, list) => asArray(node?.['@type']).find((t) => list.includes(t));

/** Converts "true"/"false" strings to booleans; anything else becomes undefined. */
export const bool = (s) => (s === 'true' ? true : s === 'false' ? false : undefined);

/** Splits a comma separated string into trimmed parts. */
export const csv = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
