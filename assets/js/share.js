// URL-hash sharing. Encodes a pruned snapshot of the app state as base64url JSON.
import { byId } from './schemas/index.js';
import { defaultsFor, isEmpty } from './schemas/util.js';

/** Recursively removes empty strings, empty arrays and empty objects. */
export function prune(v) {
  if (Array.isArray(v)) return v.map(prune).filter((x) => !isEmpty(x));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      const p = prune(val);
      if (!isEmpty(p)) out[k] = p;
    }
    return out;
  }
  return v;
}

export function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decode(str) {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Minimal serialisable snapshot of the parts of the state worth sharing. */
export function snapshot(state) {
  if (state.mode === 'graph') {
    return prune({
      m: 'graph', b: state.graph.base, a: state.graph.active || undefined,
      e: state.graph.entities.map((e) => ({ t: e.type, v: e.values })),
      l: state.lang === 'bn' ? 'bn' : undefined,
    });
  }
  return prune({ m: 'single', t: state.type, v: state.values[state.type], l: state.lang === 'bn' ? 'bn' : undefined });
}

/** Expands a snapshot into a state patch, or null when it is invalid. */
export function restore(snap) {
  if (!snap || typeof snap !== 'object') return null;
  const lang = snap.l === 'bn' ? 'bn' : undefined;
  if (snap.m === 'graph' && Array.isArray(snap.e)) {
    const entities = snap.e
      .filter((e) => e && byId(e.t))
      .map((e) => ({ type: e.t, values: { ...defaultsFor(byId(e.t).fields), ...(e.v || {}) } }));
    if (!entities.length) return null;
    const active = Number.isInteger(snap.a) && snap.a >= 0 && snap.a < entities.length ? snap.a : 0;
    return { mode: 'graph', graph: { base: String(snap.b || ''), entities, active }, ...(lang && { lang }) };
  }
  if (snap.m === 'single' && byId(snap.t)) {
    return { mode: 'single', type: snap.t, values: { [snap.t]: { ...defaultsFor(byId(snap.t).fields), ...(snap.v || {}) } }, ...(lang && { lang }) };
  }
  return null;
}

export const toHash = (state) => '#s=' + encode(snapshot(state));

export function fromHash(hash) {
  const m = /^#?s=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
  return m ? restore(decode(m[1])) : null;
}
