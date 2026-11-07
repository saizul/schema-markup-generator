import test from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, prune, snapshot, restore, toHash, fromHash } from '../assets/js/share.js';
import { applyTemplate } from '../assets/js/templates.js';
import { byId } from '../assets/js/schemas/index.js';
import { defaultsFor } from '../assets/js/schemas/util.js';

test('encode/decode round trip with unicode', () => {
  const o = { a: 'বাংলা ✓', n: [1, 2, { x: 'y' }] };
  assert.deepEqual(decode(encode(o)), o);
});
test('encoded text is URL safe', () => {
  assert.match(encode({ s: '??>>~~ÿ'.repeat(10) }), /^[A-Za-z0-9_-]+$/);
});
test('decode returns null for garbage', () => {
  assert.equal(decode('!!!not-valid'), null);
  assert.equal(decode(''), null);
});
test('prune removes empty values', () => {
  assert.deepEqual(prune({ a: '', b: [], c: { d: '' }, e: 'x', f: [{ g: '' }] }), { e: 'x' });
});
test('single mode snapshot/restore keeps values', () => {
  const patch = applyTemplate('faq');
  const state = { mode: 'single', type: 'faq', values: patch.values, graph: { base: '', entities: [], active: 0 }, lang: 'en' };
  const back = restore(decode(encode(snapshot(state))));
  assert.equal(back.mode, 'single');
  assert.deepEqual(back.values.faq.items, patch.values.faq.items);
});
test('graph mode snapshot/restore keeps entities and base', () => {
  const patch = applyTemplate('blog-graph');
  const state = { mode: 'graph', type: 'article', values: {}, graph: { ...patch.graph, active: 2 }, lang: 'bn' };
  const back = restore(decode(encode(snapshot(state))));
  assert.equal(back.mode, 'graph');
  assert.equal(back.graph.base, 'https://example.com/');
  assert.equal(back.graph.entities.length, 6);
  assert.equal(back.graph.active, 2);
  assert.equal(back.lang, 'bn');
});
test('restore merges defaults so removed fields stay valid', () => {
  const back = restore({ m: 'single', t: 'article', v: { headline: 'H' } });
  assert.equal(back.values.article.headline, 'H');
  assert.equal(back.values.article.type, 'BlogPosting');
});
test('restore rejects unknown or malformed snapshots', () => {
  assert.equal(restore(null), null);
  assert.equal(restore({ m: 'single', t: 'nope' }), null);
  assert.equal(restore({ m: 'graph', e: [{ t: 'nope' }] }), null);
});
test('toHash and fromHash round trip', () => {
  const state = { mode: 'single', type: 'person', values: { person: { ...defaultsFor(byId('person').fields), name: 'Saizul' } }, graph: { base: '', entities: [], active: 0 }, lang: 'en' };
  const hash = toHash(state);
  assert.ok(hash.startsWith('#s='));
  assert.equal(fromHash(hash).values.person.name, 'Saizul');
  assert.equal(fromHash('#other'), null);
  assert.equal(fromHash(''), null);
});
