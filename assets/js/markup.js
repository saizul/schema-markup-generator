// Alternative output syntaxes: converts a built JSON-LD document to Microdata or RDFa Lite HTML.
// Pure string building, no DOM access, so it also runs under Node.
import { CONTEXT, asArray, isUrl } from './schemas/util.js';

export const FORMATS = ['jsonld', 'microdata', 'rdfa'];

/** Escapes text for use inside a double-quoted HTML attribute. */
export const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isRef = (o) => isObject(o) && Object.keys(o).length === 1 && typeof o['@id'] === 'string';
const isLeaf = (x) => ['string', 'number', 'boolean'].includes(typeof x);

/** Vocabulary URL (with a trailing slash) taken from the document's @context. */
function vocabOf(doc) {
  const ctx = asArray(doc?.['@context']).find((c) => typeof c === 'string') || CONTEXT;
  return ctx.replace(/\/+$/, '') + '/';
}

/** Top-level items of a document: the @graph members, the array entries, or the node itself. */
function topLevel(doc) {
  if (Array.isArray(doc)) return doc.flatMap(topLevel);
  if (!isObject(doc)) return [];
  if (Array.isArray(doc['@graph'])) return doc['@graph'].filter(isObject);
  return Object.keys(doc).some((k) => !k.startsWith('@')) ? [doc] : [];
}

/**
 * Syntax-neutral tree: every item is { types, id, props } and every prop is
 * { name, kind: 'item'|'link'|'text', value }.
 */
function toItem(node) {
  const props = [];
  for (const [name, raw] of Object.entries(node)) {
    if (name.startsWith('@')) continue;
    // JSON-LD arrays are unordered sets, so nested arrays flatten to repeated properties.
    for (const value of asArray(raw).flat(Infinity)) {
      if (value === null || value === undefined) continue;
      if (isRef(value)) props.push({ name, kind: 'link', value: value['@id'] });
      else if (isObject(value)) props.push({ name, kind: 'item', value: toItem(value) });
      else if (isLeaf(value)) props.push({ name, kind: typeof value === 'string' && isUrl(value) ? 'link' : 'text', value: String(value) });
    }
  }
  return { types: asArray(node['@type']).map(String).filter(Boolean), id: typeof node['@id'] === 'string' ? node['@id'] : '', props };
}

const attrs = (pairs) =>
  pairs.filter(([, v]) => v !== undefined).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`)).join('');

/** Absolute type URL; types that already are URLs (other vocabularies) stay untouched. */
const typeUrl = (vocab, t) => (/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : vocab + t);

const SYNTAX = {
  microdata: {
    open: (item, vocab, name) => attrs([
      ['itemprop', name],
      ['itemscope', true],
      ['itemtype', item.types.length ? item.types.map((t) => typeUrl(vocab, t)).join(' ') : undefined],
      // itemid is only valid together with itemtype.
      ['itemid', item.types.length && item.id ? item.id : undefined],
    ]),
    link: (p) => `<link${attrs([['itemprop', p.name], ['href', p.value]])}>`,
    text: (p) => `<meta${attrs([['itemprop', p.name], ['content', p.value]])}>`,
  },
  rdfa: {
    open: (item, vocab, name) => attrs([
      ['vocab', name === undefined ? vocab : undefined],
      ['property', name],
      ['typeof', item.types.join(' ')],
      ['resource', item.id || undefined],
    ]),
    link: (p) => `<link${attrs([['property', p.name], ['href', p.value]])}>`,
    text: (p) => `<meta${attrs([['property', p.name], ['content', p.value]])}>`,
  },
};

function render(item, syntax, vocab, name, depth, lines) {
  const pad = '  '.repeat(depth);
  lines.push(`${pad}<div${syntax.open(item, vocab, name)}>`);
  for (const p of item.props) {
    if (p.kind === 'item') render(p.value, syntax, vocab, p.name, depth + 1, lines);
    else lines.push(`${pad}  ${syntax[p.kind](p)}`);
  }
  lines.push(`${pad}</div>`);
}

function convert(doc, syntax, { minify = false } = {}) {
  const items = topLevel(doc);
  if (!items.length) return '';
  const vocab = vocabOf(Array.isArray(doc) ? doc.find(isObject) : doc);
  const lines = [];
  for (const node of items) render(toItem(node), syntax, isObject(node) && node['@context'] ? vocabOf(node) : vocab, undefined, 0, lines);
  return minify ? lines.map((l) => l.trim()).join('') : lines.join('\n');
}

/**
 * Converts a JSON-LD document to Microdata. Nodes become `itemscope` elements, URLs become
 * `<link itemprop>`, other values `<meta itemprop>`, and `@id` references link to the `itemid`
 * of the referenced item. The result is invisible markup that can be pasted into a page body.
 */
export const toMicrodata = (doc, opts) => convert(doc, SYNTAX.microdata, opts);

/**
 * Converts a JSON-LD document to RDFa Lite (`vocab`, `typeof`, `property`, `resource`).
 * `@id` values become `resource` and references to them become `<link property href>`.
 */
export const toRdfa = (doc, opts) => convert(doc, SYNTAX.rdfa, opts);

/**
 * Serialises a document in the requested output format.
 * @param {Object} doc      JSON-LD document (single node or @graph).
 * @param {'microdata'|'rdfa'} format
 * @param {{minify?: boolean}} [opts]
 */
export function toMarkup(doc, format, opts) {
  if (format === 'microdata') return toMicrodata(doc, opts);
  if (format === 'rdfa') return toRdfa(doc, opts);
  throw new Error('Unknown markup format: ' + format);
}

/** Download metadata for an output format. */
export const fileInfo = (format) =>
  format === 'microdata' || format === 'rdfa'
    ? { ext: 'html', mime: 'text/html' }
    : { ext: 'json', mime: 'application/json' };
