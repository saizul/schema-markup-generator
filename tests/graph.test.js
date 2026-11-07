import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, buildGraphDetailed, lintGraph, normalizeBase } from '../assets/js/graph.js';
import { byId } from '../assets/js/schemas/index.js';
import { defaultsFor } from '../assets/js/schemas/util.js';
import { applyTemplate } from '../assets/js/templates.js';

const ent = (type, values) => ({ type, values: { ...defaultsFor(byId(type).fields), ...values } });

test('normalizeBase strips fragments and whitespace', () => {
  assert.equal(normalizeBase(' https://a.com/#x '), 'https://a.com/');
  assert.equal(normalizeBase(undefined), '');
});
test('empty graph builds to an empty object', () => {
  assert.deepEqual(buildGraph({ base: 'https://a.com/', entities: [ent('article', {})] }), {});
});
test('graph has @context, @graph and @id for each entity', () => {
  const g = buildGraph({ base: 'https://a.com/', entities: [ent('organization', { name: 'O' }), ent('website', { name: 'W', url: 'https://a.com/' })] });
  assert.equal(g['@context'], 'https://schema.org');
  assert.deepEqual(g['@graph'].map((n) => n['@id']), ['https://a.com/#organization', 'https://a.com/#website']);
  assert.equal(g['@graph'][0]['@type'], 'Organization');
  assert.equal(g['@graph'][0]['@context'], undefined);
});
test('website publisher references the organization', () => {
  const g = buildGraph({ base: 'https://a.com/', entities: [ent('organization', { name: 'O' }), ent('website', { name: 'W', url: 'https://a.com/' })] });
  assert.deepEqual(g['@graph'][1].publisher, { '@id': 'https://a.com/#organization' });
});
test('full blog graph wires WebPage, Article, Person, Organization and breadcrumb', () => {
  const g = buildGraph(applyTemplate('blog-graph').graph);
  const by = (t) => g['@graph'].find((n) => n['@type'] === t);
  assert.deepEqual(by('WebPage').isPartOf, { '@id': 'https://example.com/#website' });
  assert.deepEqual(by('WebPage').breadcrumb, { '@id': 'https://example.com/#breadcrumb' });
  assert.deepEqual(by('BlogPosting').isPartOf, { '@id': 'https://example.com/#webpage' });
  assert.deepEqual(by('BlogPosting').author, { '@id': 'https://example.com/#person' });
  assert.deepEqual(by('BlogPosting').publisher, { '@id': 'https://example.com/#organization' });
  assert.equal(g['@graph'].length, 6);
});
test('duplicate types get numbered ids', () => {
  const { ids } = buildGraphDetailed({ base: 'https://a.com', entities: [ent('person', { name: 'A' }), ent('person', { name: 'B' })] });
  assert.deepEqual(ids, ['https://a.com#person', 'https://a.com#person-2']);
});
test('empty entities are skipped and do not receive ids', () => {
  const { ids, graph } = buildGraphDetailed({ base: 'https://a.com/', entities: [ent('person', {}), ent('person', { name: 'B' })] });
  assert.deepEqual(ids, [null, 'https://a.com/#person']);
  assert.equal(graph['@graph'].length, 1);
});
test('article keeps inline author when no Person entity exists', () => {
  const g = buildGraph({ base: 'https://a.com/', entities: [ent('article', { headline: 'H', authorName: 'Me' })] });
  assert.equal(g['@graph'][0].author.name, 'Me');
});
test('local shop graph links localbusiness as the organization', () => {
  const g = buildGraph(applyTemplate('shop-graph').graph);
  const site = g['@graph'].find((n) => n['@type'] === 'WebSite');
  assert.deepEqual(site.publisher, { '@id': 'https://example.com/#localbusiness' });
});
test('lintGraph does not complain about referenced authors/publishers', () => {
  const res = lintGraph(applyTemplate('blog-graph').graph);
  const art = res.find((r) => r.type === 'article');
  assert.ok(!art.issues.some((i) => i.path === 'author.name' || i.path === 'publisher.name'));
  assert.equal(res.length, 6);
});
test('lintGraph reports errors for incomplete entities', () => {
  const res = lintGraph({ base: '', entities: [ent('faq', {})] });
  assert.ok(res[0].issues.some((i) => i.code === 'missing-required'));
});
test('graph without a base uses relative fragment ids', () => {
  const { ids } = buildGraphDetailed({ base: '', entities: [ent('person', { name: 'A' })] });
  assert.deepEqual(ids, ['#person']);
});
