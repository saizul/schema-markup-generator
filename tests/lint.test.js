import test from 'node:test';
import assert from 'node:assert/strict';
import { lintNode, has, summarize, fieldForIssue } from '../assets/js/lint.js';
import { byId } from '../assets/js/schemas/index.js';
import { defaultsFor } from '../assets/js/schemas/util.js';
import { applyTemplate } from '../assets/js/templates.js';

const issues = (id, node) => lintNode(byId(id).rules, node);
const codes = (list, sev) => list.filter((i) => i.severity === sev).map((i) => i.path || i.paths.join('|'));

test('has resolves nested paths and requires every array item', () => {
  assert.ok(has({ a: { b: 1 } }, 'a.b'));
  assert.ok(!has({ a: {} }, 'a.b'));
  assert.ok(has({ s: [{ t: 'x' }, { t: 'y' }] }, 's[].t'));
  assert.ok(!has({ s: [{ t: 'x' }, {}] }, 's[].t'));
  assert.ok(!has({ s: [] }, 's'));
});
test('has treats @id-only references as satisfied', () => {
  assert.ok(has({ author: { '@id': '#p' } }, 'author.name'));
});
test('FAQ: required properties reported once, children collapsed', () => {
  assert.deepEqual(codes(issues('faq', {}), 'error'), ['mainEntity']);
});
test('FAQ: incomplete answers are flagged', () => {
  const node = { mainEntity: [{ name: 'Q', acceptedAnswer: {} }] };
  assert.ok(codes(issues('faq', node), 'error').includes('mainEntity[].acceptedAnswer'));
});
test('Product: one-of offers/review/aggregateRating', () => {
  const list = issues('product', { name: 'P', image: 'x' });
  assert.ok(list.some((i) => i.code === 'one-of'));
  assert.ok(!issues('product', { name: 'P', image: 'x', offers: { price: 1 } }).some((i) => i.code === 'one-of'));
});
test('Article has no required properties but recommends several', () => {
  const list = issues('article', { headline: 'H' });
  assert.equal(codes(list, 'error').length, 0);
  assert.ok(codes(list, 'warning').includes('image'));
  assert.ok(!codes(list, 'warning').includes('headline'));
});
test('LocalBusiness requires name and address', () => {
  assert.deepEqual(codes(issues('localbusiness', { name: 'X' }), 'error'), ['address']);
});
test('JobPosting needs a location unless remote', () => {
  const base = { title: 'T', description: 'D', datePosted: '2026-01-01', hiringOrganization: { name: 'O' } };
  assert.ok(issues('jobposting', base).some((i) => i.code === 'job-location'));
  assert.ok(!issues('jobposting', { ...base, jobLocation: { address: { addressLocality: 'Dhaka' } } }).some((i) => i.code === 'job-location'));
  const remote = issues('jobposting', { ...base, jobLocationType: 'TELECOMMUTE' });
  assert.ok(!remote.some((i) => i.code === 'job-location'));
  assert.ok(remote.some((i) => i.code === 'job-remote-applicant'));
});
test('Breadcrumb: non-final items need URLs', () => {
  const list = issues('breadcrumb', { itemListElement: [{ position: 1, name: 'Home' }, { position: 2, name: 'Post' }] });
  assert.ok(list.some((i) => i.code === 'breadcrumb-item-url' && i.params.n === 1));
});
test('Video requires contentUrl or embedUrl via one-of', () => {
  const list = issues('video', { name: 'V', thumbnailUrl: 'x', uploadDate: '2026-01-01' });
  assert.ok(list.some((i) => i.code === 'one-of'));
});
test('info notes are emitted for FAQ, HowTo and WebSite', () => {
  assert.ok(issues('faq', {}).some((i) => i.code === 'faq-restricted' && i.severity === 'info'));
  assert.ok(issues('howto', {}).some((i) => i.code === 'howto-deprecated'));
  assert.ok(issues('website', {}).some((i) => i.code === 'sitelinks-retired'));
});
test('a complete template yields no errors', () => {
  for (const id of ['blog-post', 'local-shop-dhaka', 'saas-product', 'faq', 'product', 'event', 'recipe', 'job', 'course', 'video']) {
    const patch = applyTemplate(id);
    const s = byId(patch.type);
    const node = s.build(patch.values[patch.type]);
    assert.deepEqual(codes(lintNode(s.rules, node), 'error'), [], id);
  }
});
test('summarize counts severities', () => {
  assert.deepEqual(summarize([{ severity: 'error' }, { severity: 'warning' }, { severity: 'warning' }]), { error: 1, warning: 2, info: 0 });
});
test('fieldForIssue maps issues to form fields', () => {
  const f = byId('article').fields;
  assert.equal(fieldForIssue(f, { path: 'image' }), 'images');
  assert.equal(fieldForIssue(f, { path: 'author.name' }), 'authorName');
  assert.equal(fieldForIssue(f, { path: 'author' }), 'authorName');
  assert.equal(fieldForIssue(byId('faq').fields, { path: 'mainEntity[].acceptedAnswer.text' }), 'items');
  assert.equal(fieldForIssue(f, { path: 'zzz' }), null);
  assert.equal(fieldForIssue(byId('video').fields, { paths: ['contentUrl', 'embedUrl'] }), 'contentUrl');
});
test('defaults are accepted by lintNode without throwing', () => {
  for (const id of ['article', 'event', 'recipe']) assert.ok(Array.isArray(issues(id, byId(id).build(defaultsFor(byId(id).fields)))));
});
