import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clean, isUrl, isDate, isDuration, isTime, isEmail, isNumber, isCurrency, lines, one, num, validate, defaultsFor,
  toScriptTag, toJson, nonEmptyRows, bool, csv, text, urlOf, parseAddress, buildAddress, isEmpty, schemaUrl, bare,
} from '../assets/js/schemas/util.js';

test('clean drops empty strings, arrays and objects recursively', () => {
  assert.deepEqual(clean({ a: '', b: ' x ', c: [], d: { e: '' }, f: [{ g: '' }, { h: 1 }] }), { b: 'x', f: [{ h: 1 }] });
});
test('clean keeps zero and false', () => {
  assert.deepEqual(clean({ price: 0, ok: false }), { price: 0, ok: false });
});
test('clean collapses objects that only hold @type', () => {
  assert.deepEqual(clean({ '@type': 'Thing', author: { '@type': 'Person', name: '' } }), {});
  assert.deepEqual(clean({ '@context': 'x', '@type': 'Thing', name: 'a' }), { '@context': 'x', '@type': 'Thing', name: 'a' });
});
test('isUrl accepts http(s) only', () => {
  assert.ok(isUrl('https://example.com/a?b=1'));
  assert.ok(isUrl('http://localhost:3000'));
  assert.ok(!isUrl('example.com'));
  assert.ok(!isUrl('ftp://example.com'));
  assert.ok(!isUrl('javascript:alert(1)'));
});
test('isDate validates ISO dates and datetimes', () => {
  assert.ok(isDate('2026-01-31'));
  assert.ok(isDate('2026-01-31T09:00:00+06:00'));
  assert.ok(isDate('2026-01-31T09:00Z'));
  assert.ok(!isDate('2026-02-30'));
  assert.ok(!isDate('31/01/2026'));
  assert.ok(!isDate('2026-01-31T25:00:00'));
});
test('isDuration validates ISO 8601 durations', () => {
  assert.ok(isDuration('PT30M'));
  assert.ok(isDuration('P1DT2H'));
  assert.ok(!isDuration('P'));
  assert.ok(!isDuration('PT'));
  assert.ok(!isDuration('30 minutes'));
});
test('isTime, isEmail, isNumber, isCurrency', () => {
  assert.ok(isTime('09:30') && !isTime('24:00'));
  assert.ok(isEmail('a@b.co') && !isEmail('a@b'));
  assert.ok(isNumber('12.5') && isNumber('-3') && !isNumber('1,5'));
  assert.ok(isCurrency('BDT') && !isCurrency('bdt'));
});
test('lines trims and drops blanks', () => {
  assert.deepEqual(lines(' a \r\n\n b\n'), ['a', 'b']);
});
test('one unwraps single-item arrays only', () => {
  assert.equal(one(['a']), 'a');
  assert.deepEqual(one(['a', 'b']), ['a', 'b']);
});
test('num parses numbers and rejects junk', () => {
  assert.equal(num('4.5'), 4.5);
  assert.equal(num('0'), 0);
  assert.equal(num(''), undefined);
  assert.equal(num('abc'), undefined);
});
test('bool, csv, schemaUrl, bare', () => {
  assert.equal(bool('true'), true);
  assert.equal(bool('false'), false);
  assert.equal(bool(''), undefined);
  assert.deepEqual(csv('a, b ,,c'), ['a', 'b', 'c']);
  assert.equal(schemaUrl('InStock'), 'https://schema.org/InStock');
  assert.equal(schemaUrl(''), undefined);
  assert.equal(bare('https://schema.org/InStock'), 'InStock');
});
test('isEmpty handles primitives', () => {
  assert.ok(isEmpty('') && isEmpty('  ') && isEmpty([]) && isEmpty({}) && isEmpty(null));
  assert.ok(!isEmpty(0) && !isEmpty(false) && !isEmpty('x'));
});
test('toScriptTag wraps JSON in a ld+json script', () => {
  const s = toScriptTag({ a: 1 });
  assert.ok(s.startsWith('<script type="application/ld+json">\n{'));
  assert.ok(s.endsWith('\n</script>'));
  assert.equal(toJson({ a: 1 }), '{\n  "a": 1\n}');
});
test('nonEmptyRows filters rows by keys', () => {
  assert.equal(nonEmptyRows([{ a: '', b: '' }, { a: 'x', b: '' }], ['a', 'b']).length, 1);
});
test('text and urlOf read values from strings or objects', () => {
  assert.equal(text({ name: 'N' }), 'N');
  assert.equal(text({ '@id': '#x' }), '');
  assert.equal(urlOf({ url: 'https://a.b' }), 'https://a.b');
  assert.equal(urlOf('https://a.b'), 'https://a.b');
});
test('address build and parse round trip', () => {
  const v = { street: 'S', city: 'Dhaka', region: 'R', postal: '1213', country: 'BD' };
  const a = buildAddress(v);
  assert.equal(a['@type'], 'PostalAddress');
  assert.deepEqual(parseAddress(a), v);
});
test('validate reports required, format and nested row errors', () => {
  const fields = [
    { key: 'name', label: 'n', type: 'text', required: true },
    { key: 'url', label: 'u', type: 'url' },
    { key: 'rows', label: 'r', type: 'rows', required: true, fields: [{ key: 'q', label: 'q', type: 'text', required: true }, { key: 'a', label: 'a', type: 'text' }] },
  ];
  const e = validate(fields, { name: '', url: 'nope', rows: [{ q: '', a: 'x' }] });
  assert.ok(e.name.required);
  assert.ok(e.url.msg && !e.url.required);
  assert.ok(e['rows.0.q'].required);
  assert.equal(validate(fields, { name: 'a', url: '', rows: [{ q: 'q', a: '' }] }) && Object.keys(validate(fields, { name: 'a', url: '', rows: [{ q: 'q', a: '' }] })).length, 0);
});
test('validate ignores fully empty rows but requires at least one', () => {
  const fields = [{ key: 'rows', label: 'r', type: 'rows', required: true, fields: [{ key: 'q', label: 'q', type: 'text', required: true }] }];
  const e = validate(fields, { rows: [{ q: '' }] });
  assert.ok(e.rows.required);
  assert.equal(e['rows.0.q'], undefined);
});
test('validate runs custom checks', () => {
  const fields = [{ key: 'x', label: 'x', type: 'text', check: (v) => (v === 'bad' ? 'nope' : '') }];
  assert.equal(validate(fields, { x: 'bad' }).x.msg, 'nope');
  assert.deepEqual(validate(fields, { x: 'ok' }), {});
});
test('validate checks each line of a url list', () => {
  const fields = [{ key: 'u', label: 'u', type: 'list', format: 'url' }];
  assert.ok(validate(fields, { u: 'https://a.com\nbad' }).u);
  assert.deepEqual(validate(fields, { u: 'https://a.com\nhttps://b.com' }), {});
});
test('defaultsFor creates one empty row and respects defaults', () => {
  const d = defaultsFor([
    { key: 't', type: 'select', default: 'A' }, { key: 'r', type: 'rows', fields: [{ key: 'x', type: 'text' }] }, { key: 'd', type: 'days' },
  ]);
  assert.deepEqual(d, { t: 'A', r: [{ x: '' }], d: [] });
});
