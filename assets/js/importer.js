// Turns pasted JSON-LD or page HTML into a state patch. Pure.
import { extractFromHtml } from './extract.js';
import { flatten, recognize } from './schemas/index.js';

/**
 * @param {string} text JSON-LD, a <script> block, or full page HTML.
 * @returns {{nodes: Object[], source: 'json'|'jsonld'|'microdata'|'none', errors: string[], counts: {jsonld: number, microdata: number}}}
 */
export function parseInput(text) {
  const src = String(text ?? '').trim();
  if (!src) return { nodes: [], source: 'none', errors: ['empty'], counts: { jsonld: 0, microdata: 0 } };
  if (src.startsWith('<')) {
    const r = extractFromHtml(src);
    const counts = { jsonld: r.jsonld.length, microdata: r.microdata.length };
    if (r.jsonld.length) return { nodes: flatten(r.jsonld), source: 'jsonld', errors: r.errors, counts };
    if (r.microdata.length) return { nodes: flatten(r.microdata), source: 'microdata', errors: r.errors, counts };
    return { nodes: [], source: 'none', errors: r.errors.length ? r.errors : ['nothing-found'], counts };
  }
  try {
    const json = JSON.parse(src);
    return { nodes: flatten(json), source: 'json', errors: [], counts: { jsonld: 1, microdata: 0 } };
  } catch (e) {
    return { nodes: [], source: 'none', errors: ['invalid-json: ' + e.message], counts: { jsonld: 0, microdata: 0 } };
  }
}

const originOf = (u) => {
  try { return new URL(u).origin + '/'; } catch { return ''; }
};

/**
 * Builds a state patch from parsed nodes: one recognised entity gives single mode, several give graph mode.
 * @returns {Object|null} null when nothing recognisable was found.
 */
export function toStatePatch(nodes) {
  const found = recognize(nodes);
  if (!found.length) return null;
  if (found.length === 1) {
    const { schema, values } = found[0];
    return { mode: 'single', type: schema.id, values: { [schema.id]: values } };
  }
  const entities = found.map((f) => ({ type: f.schema.id, values: f.values }));
  const withUrl = entities.find((e) => ['website', 'webpage', 'organization'].includes(e.type) && e.values.url);
  return { mode: 'graph', graph: { base: originOf(withUrl?.values.url), entities, active: 0 } };
}
