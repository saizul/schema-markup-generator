import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMAS, byId, byType, flatten, dereference, recognize } from '../assets/js/schemas/index.js';
import { defaultsFor, validate } from '../assets/js/schemas/util.js';
import { TEMPLATES, applyTemplate } from '../assets/js/templates.js';

const defaults = (id) => defaultsFor(byId(id).fields);
const build = (id, over = {}) => byId(id).build({ ...defaults(id), ...over });

test('every schema has unique id, fields and rules', () => {
  const ids = new Set();
  for (const s of SCHEMAS) {
    assert.ok(!ids.has(s.id)); ids.add(s.id);
    assert.ok(s.fields.length && s.rules && typeof s.build === 'function' && typeof s.parse === 'function', s.id);
  }
  assert.ok(SCHEMAS.length >= 19);
});
test('empty forms build to an empty object for every schema', () => {
  for (const s of SCHEMAS) assert.deepEqual(s.build(defaults(s.id)), {}, s.id);
});
test('byType resolves subtypes', () => {
  assert.equal(byType('BlogPosting').id, 'article');
  assert.equal(byType('Restaurant').id, 'localbusiness');
  assert.equal(byType('WebApplication').id, 'software');
  assert.equal(byType('Nope'), undefined);
});

test('article: BlogPosting with author and publisher', () => {
  const j = build('article', { headline: 'H', images: 'https://a.com/1.jpg', authorName: 'A', publisherName: 'P', publisherLogo: 'https://a.com/l.png', url: 'https://a.com/p' });
  assert.equal(j['@context'], 'https://schema.org');
  assert.equal(j['@type'], 'BlogPosting' === j['@type'] ? 'BlogPosting' : '');
  assert.equal(j.image, 'https://a.com/1.jpg');
  assert.deepEqual(j.author, { '@type': 'Person', name: 'A' });
  assert.deepEqual(j.publisher.logo, { '@type': 'ImageObject', url: 'https://a.com/l.png' });
  assert.deepEqual(j.mainEntityOfPage, { '@type': 'WebPage', '@id': 'https://a.com/p' });
});
test('article: multiple images stay an array and type can change', () => {
  const j = build('article', { type: 'NewsArticle', headline: 'H', images: 'https://a.com/1.jpg\nhttps://a.com/2.jpg' });
  assert.equal(j['@type'], 'NewsArticle');
  assert.equal(j.image.length, 2);
});
test('article: round trip', () => {
  const v = { ...defaults('article'), type: 'NewsArticle', headline: 'H', authorName: 'A', authorType: 'Organization', datePublished: '2026-01-01' };
  const back = { ...defaults('article'), ...byId('article').parse(byId('article').build(v)) };
  assert.equal(back.type, 'NewsArticle'); assert.equal(back.authorType, 'Organization'); assert.equal(back.authorName, 'A'); assert.equal(back.headline, 'H');
});

test('faq: builds Question/Answer pairs and skips empty rows', () => {
  const j = build('faq', { items: [{ q: 'Q1', a: 'A1' }, { q: '', a: '' }, { q: 'Q2', a: 'A2' }] });
  assert.equal(j['@type'], 'FAQPage');
  assert.equal(j.mainEntity.length, 2);
  assert.deepEqual(j.mainEntity[0], { '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' } });
});
test('faq: round trip', () => {
  const j = build('faq', { items: [{ q: 'Q', a: 'A' }] });
  assert.deepEqual(byId('faq').parse(j).items, [{ q: 'Q', a: 'A' }]);
});

test('localbusiness: address, geo, hours and sameAs', () => {
  const j = build('localbusiness', {
    businessType: 'Restaurant', name: 'Cafe', city: 'Dhaka', country: 'BD', lat: '23.8', lng: '90.4',
    hours: [{ days: ['Monday', 'Tuesday'], opens: '09:00', closes: '17:00' }, { days: [], opens: '', closes: '' }],
    sameAs: 'https://facebook.com/x\nhttps://instagram.com/x',
  });
  assert.equal(j['@type'], 'Restaurant');
  assert.deepEqual(j.geo, { '@type': 'GeoCoordinates', latitude: 23.8, longitude: 90.4 });
  assert.equal(j.openingHoursSpecification.length, 1);
  assert.deepEqual(j.openingHoursSpecification[0].dayOfWeek, ['Monday', 'Tuesday']);
  assert.equal(j.address.addressLocality, 'Dhaka');
  assert.equal(j.sameAs.length, 2);
});
test('localbusiness: omits geo when only one coordinate is set and flags it', () => {
  const v = { ...defaults('localbusiness'), name: 'X', lat: '23.8' };
  assert.equal(byId('localbusiness').build(v).geo, undefined);
  assert.ok(validate(byId('localbusiness').fields, v).lng);
  assert.ok(validate(byId('localbusiness').fields, { ...v, lat: '95', lng: '10' }).lat);
});
test('localbusiness: single day uses a string and parse round trips', () => {
  const j = build('localbusiness', { name: 'X', hours: [{ days: ['Friday'], opens: '10:00', closes: '12:00' }] });
  assert.equal(j.openingHoursSpecification[0].dayOfWeek, 'Friday');
  assert.deepEqual(byId('localbusiness').parse(j).hours[0].days, ['Friday']);
});

test('organization: contactPoint, address and sameAs', () => {
  const j = build('organization', { orgType: 'NGO', name: 'Org', logo: 'https://a.com/l.png', contactType: 'support', contactTelephone: '+8801', city: 'Dhaka' });
  assert.equal(j['@type'], 'NGO');
  assert.deepEqual(j.contactPoint, { '@type': 'ContactPoint', contactType: 'support', telephone: '+8801' });
  assert.equal(j.address.addressLocality, 'Dhaka');
  assert.equal(byId('organization').parse(j).contactType, 'support');
});
test('person: worksFor becomes an Organization', () => {
  const j = build('person', { name: 'P', worksFor: 'Acme', sameAs: 'https://github.com/p' });
  assert.deepEqual(j.worksFor, { '@type': 'Organization', name: 'Acme' });
  assert.equal(j.sameAs, 'https://github.com/p');
  assert.equal(byId('person').parse(j).worksFor, 'Acme');
});

test('product: offers use numeric price and schema.org availability URL', () => {
  const j = build('product', { name: 'P', images: 'https://a.com/p.jpg', price: '19.99', currency: 'USD', availability: 'InStock', brand: 'B', ratingValue: '4.5', reviewCount: '10' });
  assert.equal(j.offers.price, 19.99);
  assert.equal(j.offers.availability, 'https://schema.org/InStock');
  assert.deepEqual(j.brand, { '@type': 'Brand', name: 'B' });
  assert.equal(j.aggregateRating.reviewCount, 10);
});
test('product: price of zero is kept', () => {
  assert.equal(build('product', { name: 'P', price: '0', currency: 'USD' }).offers.price, 0);
});
test('product: validation couples price/currency and rating/review count', () => {
  const fields = byId('product').fields;
  assert.ok(validate(fields, { ...defaults('product'), price: '5' }).currency);
  assert.ok(validate(fields, { ...defaults('product'), currency: 'USD' }).price);
  assert.ok(validate(fields, { ...defaults('product'), ratingValue: '4' }).reviewCount);
  assert.ok(validate(fields, { ...defaults('product'), currency: 'usd', price: '1' }).currency);
});
test('product: round trip', () => {
  const j = build('product', { name: 'P', price: '5', currency: 'USD', availability: 'OutOfStock', condition: 'NewCondition' });
  const v = byId('product').parse(j);
  assert.equal(v.availability, 'OutOfStock'); assert.equal(v.condition, 'NewCondition'); assert.equal(v.price, '5');
});

test('breadcrumb: positions are sequential and the last url may be omitted', () => {
  const j = build('breadcrumb', { items: [{ name: 'Home', url: 'https://a.com/' }, { name: '', url: '' }, { name: 'Post', url: '' }] });
  assert.deepEqual(j.itemListElement.map((x) => x.position), [1, 2]);
  assert.equal(j.itemListElement[1].item, undefined);
  assert.equal(byId('breadcrumb').parse(j).items.length, 2);
});

test('howto: steps, supplies and tools', () => {
  const j = build('howto', { name: 'H', totalTime: 'PT10M', supply: 'Paper\nPen', tool: 'Scissors', steps: [{ name: 's', text: 't', url: '', image: '' }], costValue: '5', costCurrency: 'USD' });
  assert.equal(j.step[0]['@type'], 'HowToStep');
  assert.deepEqual(j.supply.map((s) => s.name), ['Paper', 'Pen']);
  assert.equal(j.estimatedCost.value, 5);
  assert.equal(byId('howto').parse(j).steps[0].text, 't');
});

test('event: in-person uses Place, online uses VirtualLocation, mixed uses both', () => {
  const base = { name: 'E', startDate: '2026-09-01', placeName: 'Hall', city: 'Dhaka', virtualUrl: 'https://a.com/live' };
  const off = build('event', { ...base, attendanceMode: 'OfflineEventAttendanceMode' });
  assert.equal(off.location['@type'], 'Place');
  assert.equal(off.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode');
  const on = build('event', { ...base, attendanceMode: 'OnlineEventAttendanceMode' });
  assert.equal(on.location['@type'], 'VirtualLocation');
  const mixed = build('event', { ...base, attendanceMode: 'MixedEventAttendanceMode' });
  assert.equal(mixed.location.length, 2);
});
test('event: validation requires venue for in-person and url for online', () => {
  const f = byId('event').fields;
  assert.ok(validate(f, { ...defaults('event'), name: 'E', startDate: '2026-01-01' }).placeName);
  assert.ok(validate(f, { ...defaults('event'), attendanceMode: 'OnlineEventAttendanceMode' }).virtualUrl);
  assert.equal(validate(f, { ...defaults('event'), name: 'E', startDate: '2026-01-01', attendanceMode: 'OnlineEventAttendanceMode', virtualUrl: 'https://a.com' }).placeName, undefined);
});
test('event: offers and status round trip', () => {
  const j = build('event', { name: 'E', startDate: '2026-09-01', placeName: 'V', eventStatus: 'EventCancelled', price: '10', currency: 'USD', availability: 'SoldOut' });
  const v = byId('event').parse(j);
  assert.equal(v.eventStatus, 'EventCancelled'); assert.equal(v.availability, 'SoldOut'); assert.equal(v.placeName, 'V');
});

test('website: SearchAction with EntryPoint target', () => {
  const j = build('website', { name: 'W', url: 'https://a.com/', searchTarget: 'https://a.com/?s={search_term_string}' });
  assert.equal(j.potentialAction['@type'], 'SearchAction');
  assert.equal(j.potentialAction.target.urlTemplate, 'https://a.com/?s={search_term_string}');
  assert.equal(j.potentialAction['query-input'], 'required name=search_term_string');
  assert.equal(byId('website').parse(j).searchTarget, 'https://a.com/?s={search_term_string}');
});
test('website: no SearchAction when the template is empty, and template is validated', () => {
  assert.equal(build('website', { name: 'W', url: 'https://a.com/' }).potentialAction, undefined);
  assert.ok(validate(byId('website').fields, { ...defaults('website'), name: 'W', url: 'https://a.com', searchTarget: 'https://a.com/?s=x' }).searchTarget);
});

test('webpage: type and primary image', () => {
  const j = build('webpage', { type: 'AboutPage', url: 'https://a.com/about', primaryImage: 'https://a.com/i.jpg' });
  assert.equal(j['@type'], 'AboutPage');
  assert.equal(j.primaryImageOfPage.url, 'https://a.com/i.jpg');
});

test('recipe: ingredients, instructions, nutrition and rating', () => {
  const j = build('recipe', { name: 'R', images: 'https://a.com/r.jpg', ingredients: 'rice\ndal', instructions: [{ name: 'a', text: 'Cook' }], calories: '300 calories', keywords: 'a, b', ratingValue: '4.5', ratingCount: '9', authorName: 'Me' });
  assert.deepEqual(j.recipeIngredient, ['rice', 'dal']);
  assert.equal(j.recipeInstructions[0]['@type'], 'HowToStep');
  assert.equal(j.nutrition.calories, '300 calories');
  assert.equal(j.keywords, 'a, b');
  assert.equal(j.aggregateRating.ratingCount, 9);
  assert.equal(byId('recipe').parse(j).ingredients, 'rice\ndal');
});
test('recipe: string instructions are parsed', () => {
  assert.deepEqual(byId('recipe').parse({ recipeInstructions: ['Mix', 'Bake'] }).instructions, [{ name: '', text: 'Mix' }, { name: '', text: 'Bake' }]);
});

test('jobposting: salary range, remote and boolean directApply', () => {
  const j = build('jobposting', { title: 'T', description: 'D', datePosted: '2026-01-01', orgName: 'O', remote: 'TELECOMMUTE', applicantCountry: 'BD', salaryMin: '10', salaryMax: '20', salaryCurrency: 'USD', salaryUnit: 'MONTH', directApply: 'false' });
  assert.equal(j.jobLocationType, 'TELECOMMUTE');
  assert.equal(j.directApply, false);
  assert.deepEqual(j.baseSalary.value, { '@type': 'QuantitativeValue', minValue: 10, maxValue: 20, unitText: 'MONTH' });
  assert.deepEqual(j.applicantLocationRequirements, { '@type': 'Country', name: 'BD' });
});
test('jobposting: equal min and max collapse to a single value; location is a Place', () => {
  const j = build('jobposting', { title: 'T', salaryMin: '5', salaryMax: '5', salaryCurrency: 'USD', city: 'Dhaka' });
  assert.equal(j.baseSalary.value.value, 5);
  assert.equal(j.jobLocation['@type'], 'Place');
  assert.equal(byId('jobposting').parse(j).city, 'Dhaka');
});

test('course: provider, offer and instance', () => {
  const j = build('course', { name: 'C', description: 'D', providerName: 'P', price: '0', currency: 'USD', courseMode: 'Online', instanceStart: '2026-01-01' });
  assert.equal(j.provider.name, 'P'); assert.equal(j.offers.price, 0); assert.equal(j.hasCourseInstance.courseMode, 'Online');
  assert.equal(byId('course').parse(j).courseMode, 'Online');
});
test('video: thumbnails and interaction statistic', () => {
  const j = build('video', { name: 'V', thumbnails: 'https://a.com/t.jpg', uploadDate: '2026-01-01', views: '1200', duration: 'PT1M' });
  assert.equal(j.thumbnailUrl, 'https://a.com/t.jpg');
  assert.equal(j.interactionStatistic.userInteractionCount, 1200);
  assert.equal(byId('video').parse(j).views, '1200');
});
test('software: offer, rating and subtype', () => {
  const j = build('software', { type: 'MobileApplication', name: 'App', category: 'GameApplication', os: 'Android', price: '0', currency: 'USD', ratingValue: '4.4', ratingCount: '100' });
  assert.equal(j['@type'], 'MobileApplication');
  assert.equal(j.offers.price, 0);
  assert.equal(byId('software').parse(j).type, 'MobileApplication');
});
test('review: itemReviewed, rating and author', () => {
  const j = build('review', { itemType: 'Movie', itemName: 'M', ratingValue: '4', bestRating: '5', authorName: 'A', reviewBody: 'Good' });
  assert.equal(j.itemReviewed['@type'], 'Movie');
  assert.equal(j.reviewRating.ratingValue, 4);
  assert.equal(j.author.name, 'A');
  assert.equal(byId('review').parse(j).itemType, 'Movie');
});
test('service: provider, areaServed and offer', () => {
  const j = build('service', { name: 'S', providerName: 'P', areaServed: 'Dhaka\nBangladesh', price: '100', currency: 'USD' });
  assert.deepEqual(j.areaServed, ['Dhaka', 'Bangladesh']);
  assert.equal(j.provider['@type'], 'Organization');
  assert.equal(byId('service').parse(j).areaServed, 'Dhaka\nBangladesh');
});
test('dataset: description length is checked and distribution is built', () => {
  const f = byId('dataset').fields;
  assert.ok(validate(f, { ...defaults('dataset'), name: 'D', description: 'short' }).description);
  const j = build('dataset', { name: 'D', description: 'x'.repeat(60), distUrl: 'https://a.com/d.csv', distFormat: 'text/csv', free: 'true', keywords: 'a, b' });
  assert.equal(j.isAccessibleForFree, true);
  assert.deepEqual(j.keywords, ['a', 'b']);
  assert.equal(j.distribution.encodingFormat, 'text/csv');
});

test('flatten handles arrays and @graph', () => {
  assert.equal(flatten([{ '@type': 'A' }, { '@graph': [{ '@type': 'B' }, { '@type': 'C' }] }]).length, 3);
});
test('dereference replaces @id references and drops unresolved ones', () => {
  const nodes = dereference([
    { '@id': '#p', '@type': 'Person', name: 'P' },
    { '@type': 'Article', author: { '@id': '#p' }, publisher: { '@id': '#missing' } },
  ]);
  assert.equal(nodes[1].author.name, 'P');
  assert.equal(nodes[1].publisher, undefined);
});
test('recognize returns schema-specific values for each known node', () => {
  const found = recognize({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'O' }, { '@type': 'Thing' }, { '@type': 'Person', name: 'P' }] });
  assert.deepEqual(found.map((f) => f.schema.id), ['organization', 'person']);
  assert.equal(found[0].values.name, 'O');
});

test('every template builds non-empty JSON and has no form validation errors', () => {
  for (const tpl of TEMPLATES) {
    const patch = applyTemplate(tpl.id);
    const list = patch.mode === 'graph' ? patch.graph.entities : [{ type: patch.type, values: patch.values[patch.type] }];
    for (const e of list) {
      const s = byId(e.type);
      assert.notDeepEqual(s.build(e.values), {}, tpl.id);
      assert.deepEqual(validate(s.fields, e.values), {}, `${tpl.id}/${e.type}`);
    }
  }
});
test('applyTemplate returns null for unknown ids', () => {
  assert.equal(applyTemplate('nope'), null);
});
