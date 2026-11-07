import { CONTEXT, clean, lines, one, num, f, defined, joinLines, pickType, str, asArray } from './util.js';

export const TYPES = ['SoftwareApplication', 'MobileApplication', 'WebApplication'];
export const CATEGORIES = [
  'GameApplication', 'SocialNetworkingApplication', 'TravelApplication', 'ShoppingApplication', 'SportsApplication',
  'LifestyleApplication', 'BusinessApplication', 'DesignApplication', 'DeveloperApplication', 'EducationalApplication',
  'HealthApplication', 'FinanceApplication', 'SecurityApplication', 'BrowserApplication', 'CommunicationApplication',
  'EntertainmentApplication', 'MultimediaApplication', 'HomeApplication', 'UtilitiesApplication', 'ReferenceApplication',
];

const fields = [
  f('type', 'Application type', 'select', { options: TYPES, default: 'SoftwareApplication' }),
  f('name', 'Name', 'text', { required: true, ld: 'name' }),
  f('category', 'Category', 'select', { options: CATEGORIES, ld: 'applicationCategory' }),
  f('os', 'Operating system', 'text', { ld: 'operatingSystem', placeholder: 'Web, Android 9+' }),
  f('price', 'Price (0 for free)', 'number', {
    required: true, ld: 'offers.price', check: (v, a) => (!v && a.currency ? 'Price is required when a currency is set.' : ''),
  }),
  f('currency', 'Currency (ISO 4217)', 'text', { format: 'currency', ld: 'offers.priceCurrency', placeholder: 'USD' }),
  f('url', 'URL', 'url'),
  f('images', 'Screenshot URLs (one per line)', 'list', { format: 'url' }),
  f('description', 'Description', 'textarea'),
  f('version', 'Software version', 'text'),
  f('ratingValue', 'Average rating', 'number', { ld: 'aggregateRating' }),
  f('ratingCount', 'Number of ratings', 'number', {
    check: (v, a) => (!v && a.ratingValue ? 'Rating count is required with a rating.' : ''),
  }),
];

export default {
  id: 'software',
  label: 'SoftwareApplication',
  types: TYPES,
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/software-app',
  fields,
  rules: {
    required: ['name', 'offers', 'offers.price'],
    oneOf: [['aggregateRating', 'review']],
    recommended: ['applicationCategory', 'operatingSystem', 'offers.priceCurrency'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': v.type || 'SoftwareApplication',
      name: v.name,
      description: v.description,
      url: v.url,
      image: one(lines(v.images)),
      softwareVersion: v.version,
      applicationCategory: v.category,
      operatingSystem: v.os,
      offers: { '@type': 'Offer', price: num(v.price), priceCurrency: v.currency },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: num(v.ratingValue), ratingCount: num(v.ratingCount) },
    });
  },
  parse(n) {
    const o = asArray(n.offers)[0] || {};
    const r = n.aggregateRating || {};
    return defined({
      type: pickType(n, TYPES), name: str(n.name), category: str(n.applicationCategory), os: str(n.operatingSystem),
      price: str(o.price), currency: str(o.priceCurrency), url: str(n.url), images: joinLines(n.image),
      description: str(n.description), version: str(n.softwareVersion),
      ratingValue: str(r.ratingValue), ratingCount: str(r.ratingCount ?? r.reviewCount),
    });
  },
};
