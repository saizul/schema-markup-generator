import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConsistency, compareDates, parseIsoDate, todayIso, CONSISTENCY_CODES } from '../assets/js/consistency.js';
import { lintNode, fieldForIssue } from '../assets/js/lint.js';
import { lintGraph } from '../assets/js/graph.js';
import { byId } from '../assets/js/schemas/index.js';
import { t, LANGS } from '../assets/js/i18n.js';

const NOW = Date.UTC(2026, 5, 15, 12); // 2026-06-15T12:00:00Z
const check = (node) => checkConsistency(node, { now: NOW });
const codes = (list) => list.map((i) => i.code);

test('parseIsoDate reads dates and date-times independent of local time zone', () => {
  assert.equal(parseIsoDate('2026-01-31').ms, Date.UTC(2026, 0, 31));
  assert.equal(parseIsoDate('2026-01-31T10:00:00').ms, Date.UTC(2026, 0, 31, 10));
  assert.equal(parseIsoDate('2026-01-31T10:00:00+06:00').ms, Date.UTC(2026, 0, 31, 4));
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('next week'), null);
  assert.equal(parseIsoDate(20260101), null);
});

test('compareDates handles offsets and mixed date / date-time values', () => {
  assert.equal(compareDates('2026-01-01', '2026-01-02'), -1);
  assert.equal(compareDates('2026-01-02T00:30:00+06:00', '2026-01-01T18:00:00Z'), 1);
  assert.equal(compareDates('2026-01-02T00:30:00+06:00', '2026-01-01T18:30:00Z'), 0);
  // Same calendar day: a date-only end is not "before" a date-time start.
  assert.equal(compareDates('2026-05-01T18:00:00+06:00', '2026-05-01'), 0);
  assert.equal(compareDates('2026-05-01', 'soon'), null);
});

test('todayIso uses UTC', () => {
  assert.equal(todayIso(NOW), '2026-06-15');
});

test('event ending before it starts is an error on endDate', () => {
  const list = check({ '@type': 'Event', startDate: '2026-09-02T18:00:00+06:00', endDate: '2026-09-01' });
  assert.deepEqual(codes(list), ['date-order']);
  assert.equal(list[0].severity, 'error');
  assert.equal(list[0].path, 'endDate');
  assert.deepEqual(list[0].params, { a: 'startDate', b: 'endDate' });
});

test('same-day events and valid ranges produce no issues', () => {
  assert.deepEqual(check({ '@type': 'Event', startDate: '2026-09-01T18:00:00+06:00', endDate: '2026-09-01' }), []);
  assert.deepEqual(check({ '@type': 'Article', datePublished: '2026-01-01', dateModified: '2026-02-01' }), []);
});

test('dateModified before datePublished is flagged', () => {
  assert.deepEqual(codes(check({ datePublished: '2026-03-01', dateModified: '2026-02-01' })), ['date-order']);
});

test('nested paths are reported with dotted property paths', () => {
  const list = check({
    '@type': 'Product',
    offers: { '@type': 'Offer', price: -5, validFrom: '2026-12-01', priceValidUntil: '2026-11-01' },
  });
  assert.deepEqual(list.map((i) => [i.code, i.path]), [
    ['date-order', 'offers.priceValidUntil'],
    ['negative-value', 'offers.price'],
  ]);
});

test('expired job postings and offers are warnings', () => {
  const job = check({ '@type': 'JobPosting', datePosted: '2026-01-01', validThrough: '2026-03-01' });
  assert.deepEqual(job.map((i) => [i.code, i.severity, i.params.value]), [['date-expired', 'warning', '2026-03-01']]);
  assert.deepEqual(check({ offers: [{ priceValidUntil: '2026-06-15' }] }), [], 'today is still valid');
  assert.deepEqual(codes(check({ offers: [{ priceValidUntil: '2026-06-14' }] })), ['date-expired']);
});

test('salary and price ranges must not be inverted', () => {
  const job = check({ baseSalary: { '@type': 'MonetaryAmount', value: { minValue: 90000, maxValue: 50000 } } });
  assert.deepEqual(job.map((i) => [i.code, i.path]), [['range-order', 'baseSalary.value.minValue']]);
  assert.deepEqual(codes(check({ offers: { '@type': 'AggregateOffer', lowPrice: '20', highPrice: '10' } })), ['range-order']);
  assert.deepEqual(check({ offers: { lowPrice: '10', highPrice: '10' } }), []);
});

test('shipping and handling day ranges are checked through nested QuantitativeValue nodes', () => {
  const node = byId('product').build({
    ...{ name: 'Tea', images: 'https://example.com/t.jpg', price: '10', currency: 'USD' },
    handlingMin: '3', handlingMax: '1', shippingCountry: 'BD', shippingRate: '0', shippingCurrency: 'USD',
  });
  const list = check(node);
  assert.ok(list.some((i) => i.code === 'range-order' && i.path.endsWith('handlingTime.minValue')), JSON.stringify(list));
});

test('ratings must sit inside the bestRating / worstRating scale', () => {
  assert.deepEqual(check({ reviewRating: { '@type': 'Rating', ratingValue: 4 } }), []);
  const high = check({ reviewRating: { '@type': 'Rating', ratingValue: 6 } });
  assert.deepEqual(high.map((i) => [i.code, i.path, i.params.max]), [['rating-range', 'reviewRating.ratingValue', 5]]);
  assert.deepEqual(check({ reviewRating: { '@type': 'Rating', ratingValue: 8, bestRating: 10 } }), []);
  assert.deepEqual(codes(check({ aggregateRating: { '@type': 'AggregateRating', ratingValue: 0.5, ratingCount: 3 } })), ['rating-range']);
  assert.deepEqual(codes(check({ reviewRating: { ratingValue: 3, bestRating: 1, worstRating: 5 } })), ['rating-scale']);
});

test('negative counts are errors, numeric strings are understood', () => {
  assert.deepEqual(codes(check({ aggregateRating: { ratingValue: 4, ratingCount: '-2' } })), ['negative-value']);
  assert.deepEqual(check({ offers: { price: 'free' } }), [], 'non-numeric text is left to other checks');
});

test('event tickets on sale after the start date are a warning', () => {
  const list = check({ '@type': 'Event', startDate: '2026-09-01', offers: { validFrom: '2026-09-05' } });
  assert.deepEqual(list.map((i) => [i.code, i.severity]), [['offer-after-start', 'warning']]);
});

test('@id references and non-objects are ignored', () => {
  assert.deepEqual(check({ author: { '@id': '#p' } }), []);
  assert.deepEqual(checkConsistency(null), []);
  assert.deepEqual(checkConsistency('x'), []);
});

test('lintNode includes consistency issues and can switch them off', () => {
  const rules = byId('event').rules;
  const node = byId('event').build({
    name: 'Meetup', startDate: '2026-09-02', endDate: '2026-09-01', placeName: 'Hall', city: 'Dhaka',
  });
  assert.ok(lintNode(rules, node, { now: NOW }).some((i) => i.code === 'date-order'));
  assert.ok(!lintNode(rules, node, { now: NOW, consistency: false }).some((i) => i.code === 'date-order'));
  assert.ok(!lintNode(rules, {}).some((i) => CONSISTENCY_CODES.includes(i.code)));
});

test('consistency issues map to the related form field', () => {
  const event = byId('event').fields;
  assert.equal(fieldForIssue(event, { path: 'endDate' }), 'endDate');
  assert.equal(fieldForIssue(byId('review').fields, { path: 'reviewRating.ratingValue' }), 'ratingValue');
  assert.equal(fieldForIssue(byId('product').fields, { path: 'offers.priceValidUntil' }), 'priceValidUntil');
});

test('lintGraph passes options through to every entity', () => {
  const graph = {
    base: 'https://example.com/',
    entities: [{ type: 'article', values: { headline: 'H', datePublished: '2026-05-01', dateModified: '2026-04-01' } }],
  };
  assert.ok(lintGraph(graph, { now: NOW })[0].issues.some((i) => i.code === 'date-order'));
});

test('every consistency code has a message with its parameters filled in', () => {
  const params = { a: 'startDate', b: 'endDate', path: 'price', value: 6, min: 1, max: 5 };
  for (const code of CONSISTENCY_CODES) {
    for (const lang of LANGS) {
      const msg = t('lint.' + code, params, lang);
      assert.notEqual(msg, 'lint.' + code, `${lang} ${code}`);
      assert.doesNotMatch(msg, /\{\w+\}/, `${lang} ${code} leaves a placeholder`);
    }
  }
});
