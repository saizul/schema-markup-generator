import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, toMicrodata, toRdfa, toMarkup, escapeAttr, fileInfo } from '../assets/js/markup.js';
import { extractFromHtml, parseHtml } from '../assets/js/extract.js';
import { byId } from '../assets/js/schemas/index.js';
import { defaultsFor } from '../assets/js/schemas/util.js';
import { TEMPLATES, applyTemplate } from '../assets/js/templates.js';
import { buildGraph } from '../assets/js/graph.js';

const article = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Tea & "biscuits" <tested>',
  image: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  wordCount: 1200,
  isAccessibleForFree: true,
  author: { '@type': 'Person', name: 'Rahim Uddin', url: 'https://example.com/rahim' },
};

/**
 * What the microdata reader is expected to return for a JSON-LD node: values become strings,
 * `@id` references become plain URLs, nested arrays flatten and one-item arrays collapse.
 */
function expected(v, top = true) {
  if (Array.isArray(v)) {
    const list = v.flat(Infinity).map((x) => expected(x, false));
    return list.length === 1 ? list[0] : list;
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '@id') return v['@id'];
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === '@context') continue;
      if (k === '@type') out[k] = Array.isArray(val) ? val[0] : val;
      else if (k === '@id') out[k] = val;
      else out[k] = expected(val, false);
    }
    return out;
  }
  return top ? v : String(v);
}

/** Every element node of the parsed HTML, depth first. */
function elements(html) {
  const out = [];
  (function walk(n) {
    for (const c of n.children || []) if (c.tag) { out.push(c); walk(c); }
  })(parseHtml(html));
  return out;
}

test('FORMATS lists the supported output syntaxes', () => {
  assert.deepEqual(FORMATS, ['jsonld', 'microdata', 'rdfa']);
});

test('escapeAttr escapes the characters that can break an attribute', () => {
  assert.equal(escapeAttr('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
  assert.equal(escapeAttr(12), '12');
});

test('toMicrodata renders scopes, links and meta values', () => {
  assert.equal(toMicrodata(article), [
    '<div itemscope itemtype="https://schema.org/Article">',
    '  <meta itemprop="headline" content="Tea &amp; &quot;biscuits&quot; &lt;tested&gt;">',
    '  <link itemprop="image" href="https://example.com/a.jpg">',
    '  <link itemprop="image" href="https://example.com/b.jpg">',
    '  <meta itemprop="wordCount" content="1200">',
    '  <meta itemprop="isAccessibleForFree" content="true">',
    '  <div itemprop="author" itemscope itemtype="https://schema.org/Person">',
    '    <meta itemprop="name" content="Rahim Uddin">',
    '    <link itemprop="url" href="https://example.com/rahim">',
    '  </div>',
    '</div>',
  ].join('\n'));
});

test('toRdfa renders vocab, typeof and property attributes', () => {
  assert.equal(toRdfa(article), [
    '<div vocab="https://schema.org/" typeof="Article">',
    '  <meta property="headline" content="Tea &amp; &quot;biscuits&quot; &lt;tested&gt;">',
    '  <link property="image" href="https://example.com/a.jpg">',
    '  <link property="image" href="https://example.com/b.jpg">',
    '  <meta property="wordCount" content="1200">',
    '  <meta property="isAccessibleForFree" content="true">',
    '  <div property="author" typeof="Person">',
    '    <meta property="name" content="Rahim Uddin">',
    '    <link property="url" href="https://example.com/rahim">',
    '  </div>',
    '</div>',
  ].join('\n'));
});

test('minify removes line breaks and indentation but keeps the same elements', () => {
  for (const fn of [toMicrodata, toRdfa]) {
    const pretty = fn(article);
    const min = fn(article, { minify: true });
    assert.ok(!min.includes('\n'));
    assert.equal(min, pretty.split('\n').map((l) => l.trim()).join(''));
    assert.deepEqual(elements(min), elements(pretty.replace(/\n\s*/g, '')));
  }
});

test('empty documents produce an empty string', () => {
  for (const fn of [toMicrodata, toRdfa]) {
    assert.equal(fn({}), '');
    assert.equal(fn({ '@context': 'https://schema.org', '@type': 'Thing' }), '');
    assert.equal(fn({ '@context': 'https://schema.org', '@graph': [] }), '');
    assert.equal(fn(null), '');
  }
});

test('@id becomes itemid / resource and references become links', () => {
  const doc = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://example.com/#organization', name: 'Example' },
      { '@type': 'WebSite', '@id': 'https://example.com/#website', name: 'Site', publisher: { '@id': 'https://example.com/#organization' } },
    ],
  };
  const md = toMicrodata(doc);
  assert.match(md, /<div itemscope itemtype="https:\/\/schema\.org\/Organization" itemid="https:\/\/example\.com\/#organization">/);
  assert.match(md, /<link itemprop="publisher" href="https:\/\/example\.com\/#organization">/);
  assert.equal(md.match(/^<div /gm).length, 2);

  const rdfa = toRdfa(doc);
  assert.match(rdfa, /<div vocab="https:\/\/schema\.org\/" typeof="WebSite" resource="https:\/\/example\.com\/#website">/);
  assert.match(rdfa, /<link property="publisher" href="https:\/\/example\.com\/#organization">/);
  assert.equal(rdfa.match(/^<div vocab=/gm).length, 2);
});

test('several types, untyped nodes and other vocabularies are handled', () => {
  const doc = {
    '@context': 'https://schema.org/',
    '@type': ['LocalBusiness', 'Store'],
    '@id': 'https://example.com/#shop',
    name: 'Shop',
    geo: { latitude: 23.78, longitude: 90.4 },
    additionalType: 'http://www.productontology.org/id/Bookselling',
  };
  const md = toMicrodata(doc);
  assert.match(md, /itemtype="https:\/\/schema\.org\/LocalBusiness https:\/\/schema\.org\/Store"/);
  assert.match(md, /<div itemprop="geo" itemscope>\n {4}<meta itemprop="latitude" content="23\.78">/);
  assert.match(md, /<link itemprop="additionalType" href="http:\/\/www\.productontology\.org\/id\/Bookselling">/);
  const rdfa = toRdfa(doc);
  assert.match(rdfa, /^<div vocab="https:\/\/schema\.org\/" typeof="LocalBusiness Store" resource="https:\/\/example\.com\/#shop">/);
  assert.match(rdfa, /<div property="geo" typeof="">/);

  const full = toMicrodata({ '@type': 'https://example.org/vocab/Thing', name: 'x' });
  assert.match(full, /itemtype="https:\/\/example\.org\/vocab\/Thing"/);
});

test('itemid is omitted when the item has no type', () => {
  const md = toMicrodata({ '@id': 'https://example.com/#x', name: 'x' });
  assert.equal(md, '<div itemscope>\n  <meta itemprop="name" content="x">\n</div>');
});

test('null values are skipped and nested arrays flatten', () => {
  const md = toMicrodata({ '@type': 'Thing', name: null, alternateName: [['a'], [null, 'b']] });
  assert.equal(md, [
    '<div itemscope itemtype="https://schema.org/Thing">',
    '  <meta itemprop="alternateName" content="a">',
    '  <meta itemprop="alternateName" content="b">',
    '</div>',
  ].join('\n'));
});

test('an array of documents renders one top-level item each', () => {
  const md = toMicrodata([{ '@context': 'https://schema.org', '@type': 'Thing', name: 'a' }, { '@type': 'Thing', name: 'b' }]);
  assert.equal(md.match(/^<div itemscope/gm).length, 2);
});

test('text containing markup cannot break out of the attribute', () => {
  const md = toMicrodata({ '@type': 'Thing', name: '"><script>alert(1)</script>' });
  const els = elements(md);
  assert.deepEqual(els.map((e) => e.tag), ['div', 'meta']);
  assert.equal(els[1].attrs.content, '"><script>alert(1)</script>');
  assert.ok(!md.includes('<script>'));
});

test('toMarkup dispatches by format and rejects unknown ones', () => {
  assert.equal(toMarkup(article, 'microdata'), toMicrodata(article));
  assert.equal(toMarkup(article, 'rdfa', { minify: true }), toRdfa(article, { minify: true }));
  assert.throws(() => toMarkup(article, 'jsonld'), /Unknown markup format/);
});

test('fileInfo gives the download extension and MIME type', () => {
  assert.deepEqual(fileInfo('jsonld'), { ext: 'json', mime: 'application/json' });
  assert.deepEqual(fileInfo('microdata'), { ext: 'html', mime: 'text/html' });
  assert.deepEqual(fileInfo('rdfa'), { ext: 'html', mime: 'text/html' });
});

test('microdata for every single-schema template reads back as the same data', () => {
  const singles = TEMPLATES.filter((tpl) => tpl.mode === 'single');
  assert.ok(singles.length >= 8);
  for (const tpl of singles) {
    const schema = byId(tpl.type);
    const node = schema.build({ ...defaultsFor(schema.fields), ...applyTemplate(tpl.id).values[tpl.type] });
    for (const minify of [false, true]) {
      const { microdata, errors } = extractFromHtml(toMicrodata(node, { minify }));
      assert.deepEqual(errors, [], tpl.id);
      assert.deepEqual(microdata, [expected(node)], tpl.id);
    }
  }
});

test('microdata for graph templates keeps every entity and its @id', () => {
  for (const tpl of TEMPLATES.filter((x) => x.mode === 'graph')) {
    const doc = buildGraph(applyTemplate(tpl.id).graph);
    const { microdata } = extractFromHtml(toMicrodata(doc));
    assert.deepEqual(microdata, doc['@graph'].map((n) => expected(n)), tpl.id);
  }
});

test('RDFa output is balanced and mirrors the microdata structure', () => {
  for (const tpl of TEMPLATES) {
    const patch = applyTemplate(tpl.id);
    const doc = tpl.mode === 'graph'
      ? buildGraph(patch.graph)
      : byId(tpl.type).build({ ...defaultsFor(byId(tpl.type).fields), ...patch.values[tpl.type] });
    const rdfa = toRdfa(doc);
    assert.equal(rdfa.match(/<div /g).length, rdfa.match(/<\/div>/g).length, tpl.id);
    const shape = (html, name) => elements(html).map((e) => `${e.tag}:${e.attrs[name] ?? ''}`);
    assert.deepEqual(shape(rdfa, 'property'), shape(toMicrodata(doc), 'itemprop'), tpl.id);
  }
});
