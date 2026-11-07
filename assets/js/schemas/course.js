import { CONTEXT, clean, num, f, str, asArray, text } from './util.js';

const fields = [
  f('name', 'Course name', 'text', { required: true, ld: 'name' }),
  f('description', 'Description (up to 60 characters shown)', 'textarea', { required: true, ld: 'description' }),
  f('providerName', 'Provider name', 'text', { required: true, ld: 'provider.name' }),
  f('providerUrl', 'Provider URL', 'url', { ld: 'provider.sameAs' }),
  f('url', 'Course URL', 'url', { ld: 'url' }),
  f('courseCode', 'Course code', 'text'),
  f('language', 'Language (BCP 47)', 'text', { placeholder: 'en' }),
  f('price', 'Price', 'number', { ld: 'offers' }),
  f('currency', 'Currency (ISO 4217)', 'text', { format: 'currency' }),
  f('courseMode', 'Course mode', 'select', { options: ['Online', 'Onsite', 'Blended'], ld: 'hasCourseInstance.courseMode' }),
  f('instanceStart', 'Instance start date', 'text', { format: 'date', ld: 'hasCourseInstance.startDate' }),
  f('instanceEnd', 'Instance end date', 'text', { format: 'date' }),
];

export default {
  id: 'course',
  label: 'Course',
  types: ['Course'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/course',
  fields,
  rules: {
    required: ['name', 'description', 'provider', 'provider.name'],
    recommended: ['provider.sameAs', 'url', 'offers', 'hasCourseInstance', 'hasCourseInstance.courseMode', 'inLanguage'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'Course',
      name: v.name,
      description: v.description,
      url: v.url,
      courseCode: v.courseCode,
      inLanguage: v.language,
      provider: { '@type': 'Organization', name: v.providerName, sameAs: v.providerUrl },
      offers: { '@type': 'Offer', price: num(v.price), priceCurrency: v.currency },
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: v.courseMode, startDate: v.instanceStart, endDate: v.instanceEnd },
    });
  },
  parse(n) {
    const p = asArray(n.provider)[0] || {};
    const o = asArray(n.offers)[0] || {};
    const i = asArray(n.hasCourseInstance)[0] || {};
    return {
      name: str(n.name), description: str(n.description), providerName: text(p), providerUrl: str(p.sameAs ?? p.url),
      url: str(n.url), courseCode: str(n.courseCode), language: str(n.inLanguage), price: str(o.price), currency: str(o.priceCurrency),
      courseMode: str(asArray(i.courseMode)[0]), instanceStart: str(i.startDate), instanceEnd: str(i.endDate),
    };
  },
};
