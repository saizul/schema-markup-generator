// "Extract from page HTML": finds JSON-LD blocks and basic microdata in pasted markup.
// A tiny tolerant HTML tokenizer keeps this free of DOM APIs so it also runs under Node.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TOKEN = /<!--[\s\S]*?-->|<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<(\/?)([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|[^<]+|</gi;
const ATTR = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(ATTR)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

/** @returns {{tag: string, attrs: Object, children: any[]}} */
export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  for (const m of String(html).matchAll(TOKEN)) {
    const [whole, rawTag, rawAttrs, rawBody, closing, name, attrStr, selfClose] = m;
    if (whole.startsWith('<!--')) continue;
    if (rawTag) {
      top().children.push({ tag: rawTag.toLowerCase(), attrs: parseAttrs(rawAttrs), children: [{ text: rawBody, raw: true }] });
    } else if (name) {
      const tag = name.toLowerCase();
      if (closing) {
        const i = stack.map((n) => n.tag).lastIndexOf(tag);
        if (i > 0) stack.length = i;
      } else {
        const el = { tag, attrs: parseAttrs(attrStr), children: [] };
        top().children.push(el);
        if (!VOID.has(tag) && !selfClose) stack.push(el);
      }
    } else {
      top().children.push({ text: whole });
    }
  }
  return root;
}

const textOf = (n) => (n.text !== undefined ? (n.raw ? '' : decodeEntities(n.text)) : n.children.map(textOf).join(''));
const clean = (s) => s.replace(/\s+/g, ' ').trim();

function* walk(n) {
  for (const c of n.children || []) {
    if (c.tag) {
      yield c;
      yield* walk(c);
    }
  }
}

const hasAttr = (el, k) => k in el.attrs;
const typeName = (u) => String(u).trim().split(/\s+/)[0].replace(/^https?:\/\/schema\.org\//, '').replace(/^.*[/#]/, '');

function propValue(el) {
  const a = el.attrs;
  if (a.content !== undefined && el.tag !== 'meta') return a.content;
  switch (el.tag) {
    case 'meta': return a.content ?? '';
    case 'audio': case 'embed': case 'iframe': case 'img': case 'source': case 'track': case 'video': return a.src ?? '';
    case 'a': case 'area': case 'link': return a.href ?? '';
    case 'object': return a.data ?? '';
    case 'data': case 'meter': return a.value ?? clean(textOf(el));
    case 'time': return a.datetime ?? clean(textOf(el));
    default: return clean(textOf(el));
  }
}

function readItem(scope) {
  const item = {};
  const type = scope.attrs.itemtype ? typeName(scope.attrs.itemtype) : '';
  if (type) item['@type'] = type;
  if (scope.attrs.itemid) item['@id'] = scope.attrs.itemid;
  const props = {};
  const add = (names, value) => {
    for (const k of names.split(/\s+/).filter(Boolean)) (props[k] ||= []).push(value);
  };
  (function collect(node) {
    for (const c of node.children || []) {
      if (!c.tag) continue;
      if (hasAttr(c, 'itemprop')) {
        if (hasAttr(c, 'itemscope')) {
          add(c.attrs.itemprop, readItem(c));
          continue; // nested scope owns its descendants
        }
        add(c.attrs.itemprop, propValue(c));
      }
      if (!hasAttr(c, 'itemscope')) collect(c);
    }
  })(scope);
  for (const [k, vals] of Object.entries(props)) item[k] = vals.length === 1 ? vals[0] : vals;
  return item;
}

/**
 * @param {string} html
 * @returns {{jsonld: Object[], microdata: Object[], errors: string[]}}
 */
export function extractFromHtml(html) {
  const root = parseHtml(html);
  const jsonld = [];
  const microdata = [];
  const errors = [];
  for (const el of walk(root)) {
    if (el.tag === 'script' && /ld\+json/i.test(el.attrs.type || '')) {
      const body = el.children.map((c) => c.text || '').join('').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
      if (!body) continue;
      try {
        jsonld.push(JSON.parse(body));
      } catch (e) {
        errors.push('invalid-json: ' + e.message);
      }
    } else if (hasAttr(el, 'itemscope') && !hasAttr(el, 'itemprop')) {
      microdata.push(readItem(el));
    }
  }
  return { jsonld, microdata, errors };
}
