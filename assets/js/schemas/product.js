import { CONTEXT, clean, lines, one, num, f, schemaUrl, bare, joinLines, str, asArray, text } from './util.js';

export const AVAILABILITY = ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder', 'LimitedAvailability', 'SoldOut', 'OnlineOnly', 'InStoreOnly', 'Discontinued'];
export const CONDITIONS = ['NewCondition', 'UsedCondition', 'RefurbishedCondition', 'DamagedCondition'];

const fields = [
  f('name', 'Product name', 'text', { required: true, ld: 'name' }),
  f('images', 'Image URLs (one per line)', 'list', { required: true, format: 'url', ld: 'image' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('brand', 'Brand', 'text', { ld: 'brand' }),
  f('sku', 'SKU', 'text', { ld: 'sku' }),
  f('mpn', 'MPN', 'text'),
  f('gtin', 'GTIN (UPC / EAN / ISBN)', 'text', { ld: 'gtin' }),
  f('price', 'Price', 'number', {
    ld: 'offers.price', check: (v, a) => (!v && a.currency ? 'Price is required when a currency is set.' : ''),
  }),
  f('currency', 'Currency (ISO 4217)', 'text', {
    format: 'currency', ld: 'offers.priceCurrency', placeholder: 'USD',
    check: (v, a) => (!v && a.price ? 'Currency is required when a price is set.' : ''),
  }),
  f('availability', 'Availability', 'select', { options: AVAILABILITY, ld: 'offers.availability' }),
  f('condition', 'Item condition', 'select', { options: CONDITIONS }),
  f('offerUrl', 'Offer URL', 'url', { ld: 'offers.url' }),
  f('priceValidUntil', 'Price valid until', 'text', { format: 'date', ld: 'offers.priceValidUntil', placeholder: '2026-12-31' }),
  f('ratingValue', 'Average rating', 'number', { ld: 'aggregateRating.ratingValue' }),
  f('reviewCount', 'Number of reviews', 'number', {
    ld: 'aggregateRating.reviewCount', check: (v, a) => (!v && a.ratingValue ? 'Review count is required with a rating.' : ''),
  }),
  f('bestRating', 'Best possible rating', 'number', { placeholder: '5' }),
];

export default {
  id: 'product',
  label: 'Product',
  types: ['Product'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/product-snippet',
  fields,
  rules: {
    required: ['name'],
    oneOf: [['offers', 'review', 'aggregateRating']],
    recommended: ['image', 'description', 'brand', 'sku', 'gtin', 'offers.price', 'offers.priceCurrency', 'offers.availability', 'offers.url'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'Product',
      name: v.name,
      image: one(lines(v.images)),
      description: v.description,
      sku: v.sku,
      mpn: v.mpn,
      gtin: v.gtin,
      brand: v.brand ? { '@type': 'Brand', name: v.brand } : undefined,
      offers: {
        '@type': 'Offer',
        url: v.offerUrl,
        price: num(v.price),
        priceCurrency: v.currency,
        priceValidUntil: v.priceValidUntil,
        availability: schemaUrl(v.availability),
        itemCondition: schemaUrl(v.condition),
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: num(v.ratingValue),
        reviewCount: num(v.reviewCount),
        bestRating: num(v.bestRating),
      },
    });
  },
  parse(n) {
    const o = asArray(n.offers)[0] || {};
    const r = n.aggregateRating || {};
    return {
      name: str(n.name), images: joinLines(n.image), description: str(n.description),
      brand: text(n.brand), sku: str(n.sku), mpn: str(n.mpn), gtin: str(n.gtin ?? n.gtin13 ?? n.gtin12 ?? n.gtin14 ?? n.gtin8),
      price: str(o.price), currency: str(o.priceCurrency), availability: bare(o.availability), condition: bare(o.itemCondition),
      offerUrl: str(o.url), priceValidUntil: str(o.priceValidUntil),
      ratingValue: str(r.ratingValue), reviewCount: str(r.reviewCount ?? r.ratingCount), bestRating: str(r.bestRating),
    };
  },
};
