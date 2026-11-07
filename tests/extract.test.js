import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromHtml, parseHtml, decodeEntities } from '../assets/js/extract.js';
import { parseInput, toStatePatch } from '../assets/js/importer.js';

const LD = `<!doctype html><html><head><title>x</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://acme.test/"}</script>
<script type="application/ld+json">{ broken </script>
<script>var a = "<div itemscope>";</script></head><body></body></html>`;

const MICRO = `<div itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Kettle &amp; Co</h1>
  <img itemprop="image" src="https://a.test/k.jpg" alt="">
  <span itemprop="brand" itemscope itemtype="https://schema.org/Brand"><meta itemprop="name" content="Brandy"></span>
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span itemprop="price" content="49.90">$49.90</span><meta itemprop="priceCurrency" content="USD">
    <link itemprop="availability" href="https://schema.org/InStock">
  </div>
</div>`;

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('a &amp; b &#39;c&#x27; &lt;'), "a & b 'c' <");
});
test('parseHtml builds a tree and tolerates void and unclosed tags', () => {
  const root = parseHtml('<div><p>one<br><img src="a"><p>two</div><span>x</span>');
  assert.equal(root.children[0].tag, 'div');
  assert.equal(root.children[1].tag, 'span');
});
test('extracts valid JSON-LD blocks and reports invalid ones', () => {
  const r = extractFromHtml(LD);
  assert.equal(r.jsonld.length, 1);
  assert.equal(r.jsonld[0].name, 'Acme');
  assert.equal(r.errors.length, 1);
});
test('script contents are not parsed as markup', () => {
  assert.equal(extractFromHtml(LD).microdata.length, 0);
});
test('microdata: nested scopes and value rules', () => {
  const [p] = extractFromHtml(MICRO).microdata;
  assert.equal(p['@type'], 'Product');
  assert.equal(p.name, 'Kettle & Co');
  assert.equal(p.image, 'https://a.test/k.jpg');
  assert.deepEqual(p.brand, { '@type': 'Brand', name: 'Brandy' });
  assert.equal(p.offers.price, '49.90');
  assert.equal(p.offers.priceCurrency, 'USD');
  assert.equal(p.offers.availability, 'https://schema.org/InStock');
});
test('microdata: repeated itemprop becomes an array', () => {
  const [x] = extractFromHtml('<div itemscope itemtype="http://schema.org/Recipe"><li itemprop="recipeIngredient">a</li><li itemprop="recipeIngredient">b</li></div>').microdata;
  assert.deepEqual(x.recipeIngredient, ['a', 'b']);
});
test('microdata: time and a[href] values', () => {
  const [x] = extractFromHtml('<article itemscope itemtype="https://schema.org/Article"><time itemprop="datePublished" datetime="2026-01-02">Jan</time><a itemprop="url" href="https://a.test/p">link</a></article>').microdata;
  assert.equal(x.datePublished, '2026-01-02');
  assert.equal(x.url, 'https://a.test/p');
});
test('parseInput: plain JSON, script block, page HTML and microdata', () => {
  assert.equal(parseInput('{"@type":"Person","name":"P"}').source, 'json');
  assert.equal(parseInput('<script type="application/ld+json">{"@type":"Person","name":"P"}</script>').source, 'jsonld');
  assert.equal(parseInput(LD).nodes.length, 1);
  assert.equal(parseInput(MICRO).source, 'microdata');
});
test('parseInput: errors for empty, invalid and empty-html input', () => {
  assert.equal(parseInput('').errors[0], 'empty');
  assert.match(parseInput('{oops').errors[0], /^invalid-json/);
  assert.equal(parseInput('<p>nothing</p>').source, 'none');
});
test('toStatePatch: single entity goes to single mode with parsed values', () => {
  const patch = toStatePatch(parseInput('{"@context":"https://schema.org","@type":"Product","name":"K","offers":{"price":5,"priceCurrency":"USD"}}').nodes);
  assert.equal(patch.mode, 'single');
  assert.equal(patch.type, 'product');
  assert.equal(patch.values.product.price, '5');
});
test('toStatePatch: several entities become a graph and base is guessed', () => {
  const doc = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': 'https://a.test/#website', name: 'W', url: 'https://a.test/' },
    { '@type': 'Article', headline: 'H', author: { '@id': 'https://a.test/#p' }, isPartOf: { '@id': 'https://a.test/#website' } },
    { '@type': 'Person', '@id': 'https://a.test/#p', name: 'Pat' },
  ] };
  const patch = toStatePatch(parseInput(JSON.stringify(doc)).nodes);
  assert.equal(patch.mode, 'graph');
  assert.equal(patch.graph.base, 'https://a.test/');
  assert.deepEqual(patch.graph.entities.map((e) => e.type), ['website', 'article', 'person']);
  assert.equal(patch.graph.entities[1].values.authorName, 'Pat');
});
test('toStatePatch: returns null when nothing is recognised', () => {
  assert.equal(toStatePatch([{ '@type': 'SomethingElse' }]), null);
});
test('microdata can be imported end to end', () => {
  const patch = toStatePatch(parseInput(MICRO).nodes);
  assert.equal(patch.type, 'product');
  assert.equal(patch.values.product.brand, 'Brandy');
  assert.equal(patch.values.product.currency, 'USD');
});
