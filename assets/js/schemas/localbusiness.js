import {
  CONTEXT, DAYS, clean, lines, one, num, f, defined, addressFields, buildAddress, parseAddress,
  joinLines, urlOf, str, asArray, bare, pickType, isEmpty,
} from './util.js';

export const TYPES = [
  'LocalBusiness', 'Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'Bakery', 'Store', 'BookStore', 'ClothingStore',
  'ElectronicsStore', 'GroceryStore', 'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'Dentist', 'MedicalBusiness',
  'LegalService', 'AccountingService', 'FinancialService', 'RealEstateAgent', 'AutoRepair', 'LodgingBusiness', 'Hotel',
  'ProfessionalService', 'HomeAndConstructionBusiness', 'SportsActivityLocation',
];

const fields = [
  f('businessType', 'Business type', 'select', { options: TYPES, default: 'LocalBusiness' }),
  f('name', 'Business name', 'text', { required: true, ld: 'name' }),
  f('images', 'Image URLs (one per line)', 'list', { format: 'url', ld: 'image' }),
  f('url', 'Website URL', 'url', { ld: 'url' }),
  f('telephone', 'Telephone', 'text', { ld: 'telephone', placeholder: '+880 1700-000000' }),
  f('priceRange', 'Price range', 'text', { ld: 'priceRange', placeholder: '$$' }),
  ...addressFields.map((a) => ({ ...a, ld: 'address.' + ({ street: 'streetAddress', city: 'addressLocality', region: 'addressRegion', postal: 'postalCode', country: 'addressCountry' })[a.key] })),
  f('lat', 'Latitude', 'number', {
    ld: 'geo', check: (v, all) => (!v && all.lng ? 'Latitude is required when longitude is set.' : v && (+v < -90 || +v > 90) ? 'Latitude must be between -90 and 90.' : ''),
  }),
  f('lng', 'Longitude', 'number', {
    check: (v, all) => (!v && all.lat ? 'Longitude is required when latitude is set.' : v && (+v < -180 || +v > 180) ? 'Longitude must be between -180 and 180.' : ''),
  }),
  f('hours', 'Opening hours', 'rows', {
    itemLabel: 'opening hours row', ld: 'openingHoursSpecification',
    fields: [
      f('days', 'Days', 'days', { required: true }),
      f('opens', 'Opens', 'time', { required: true }),
      f('closes', 'Closes', 'time', { required: true }),
    ],
  }),
  f('sameAs', 'Profile URLs / sameAs (one per line)', 'list', { format: 'url', ld: 'sameAs' }),
];

export default {
  id: 'localbusiness',
  label: 'LocalBusiness',
  types: TYPES,
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
  fields,
  rules: {
    required: ['name', 'address'],
    recommended: [
      'address.streetAddress', 'address.addressLocality', 'address.addressCountry', 'geo', 'openingHoursSpecification',
      'telephone', 'url', 'image', 'priceRange', 'sameAs',
    ],
  },
  build(v) {
    const hasGeo = num(v.lat) !== undefined && num(v.lng) !== undefined;
    return clean({
      '@context': CONTEXT,
      '@type': v.businessType || 'LocalBusiness',
      name: v.name,
      image: one(lines(v.images)),
      url: v.url,
      telephone: v.telephone,
      priceRange: v.priceRange,
      address: buildAddress(v),
      geo: hasGeo ? { '@type': 'GeoCoordinates', latitude: num(v.lat), longitude: num(v.lng) } : undefined,
      openingHoursSpecification: asArray(v.hours)
        .filter((r) => !isEmpty(r.days) && r.opens && r.closes)
        .map((r) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: one(DAYS.filter((d) => r.days.includes(d))),
          opens: r.opens,
          closes: r.closes,
        })),
      sameAs: one(lines(v.sameAs)),
    });
  },
  parse(n) {
    return defined({
      businessType: pickType(n, TYPES),
      name: str(n.name),
      images: joinLines(n.image),
      url: str(n.url),
      telephone: str(n.telephone),
      priceRange: str(n.priceRange),
      ...parseAddress(n.address),
      lat: n.geo?.latitude !== undefined ? str(n.geo.latitude) : '',
      lng: n.geo?.longitude !== undefined ? str(n.geo.longitude) : '',
      hours: asArray(n.openingHoursSpecification).map((s) => ({
        days: asArray(s.dayOfWeek).map(bare).filter((d) => DAYS.includes(d)),
        opens: str(s.opens).slice(0, 5),
        closes: str(s.closes).slice(0, 5),
      })),
      sameAs: asArray(n.sameAs).map(urlOf).join('\n'),
    });
  },
};
