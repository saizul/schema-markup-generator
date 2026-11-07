import test from 'node:test';
import assert from 'node:assert/strict';
import { t, tl, keys, LANGS } from '../assets/js/i18n.js';

test('English and Bangla define the same keys', () => {
  assert.deepEqual(keys('bn').sort(), keys('en').sort());
});
test('t interpolates parameters', () => {
  assert.equal(t('status.errors', { n: 3 }), '3 error(s)');
  assert.match(t('status.errors', { n: 3 }, 'bn'), /^3/);
});
test('t falls back to the key when missing', () => {
  assert.equal(t('no.such.key'), 'no.such.key');
});
test('Bangla strings differ from English for UI chrome', () => {
  for (const k of ['app.title', 'out.copy', 'mode.graph']) assert.notEqual(t(k, {}, 'bn'), t(k, {}, 'en'));
});
test('tl translates known labels and keeps unknown ones', () => {
  assert.equal(tl('Headline', 'bn'), 'শিরোনাম');
  assert.equal(tl('Headline', 'en'), 'Headline');
  assert.equal(tl('Some unknown label', 'bn'), 'Some unknown label');
});
test('every lint code used by schema rules has a message', async () => {
  const { SCHEMAS } = await import('../assets/js/schemas/index.js');
  const { lintNode } = await import('../assets/js/lint.js');
  const seen = new Set(['missing-required', 'missing-recommended', 'one-of']);
  for (const s of SCHEMAS) {
    (s.rules.info || []).forEach((c) => seen.add(c));
    for (const i of lintNode(s.rules, {})) seen.add(i.code);
  }
  for (const c of seen) for (const lang of LANGS) assert.notEqual(t('lint.' + c, {}, lang), 'lint.' + c, c);
});
