import { CONTEXT, clean, lines, one, num, f, schemaUrl, bare, joinLines, str, asArray, text } from './util.js';

export const AVAILABILITY = ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder', 'LimitedAvailability', 'SoldOut', 'OnlineOnly', 'InStoreOnly', 'Discontinued'];
export const CONDITIONS = ['NewCondition', 'UsedCondition', 'RefurbishedCondition', 'DamagedCondition'];

export const RETURN_CATEGORIES = ['MerchantReturnFiniteReturnWindow', 'MerchantReturnUnlimitedWindow', 'MerchantReturnNotPermitted'];
export const RETURN_METHODS = ['ReturnByMail', 'ReturnInStore', 'ReturnAtKiosk'];
export const RETURN_FEES = ['FreeReturn', 'ReturnFeesCustomerResponsibility', 'OriginalShippingFees', 'RestockingFees', 'ReturnShippingFees'];

const country = (v) => (!v || /^[A-Z]{2}$/.test(String(v).trim()) ? '' : 'Use a 2-letter ISO 3166-1 code, e.g. BD.');
const wholeDays = (v) => (!v || /^\d+$/.test(String(v).trim()) ? '' : 'Enter a whole number of days.');
const rangeCheck = (minKey) => (v, a) => wholeDays(v)
  || (v && a[minKey] && Number(v) < Number(a[minKey]) ? 'Maximum must not be lower than the minimum.' : '');

/** QuantitativeValue in days, or undefined when neither bound is given. */
function days(min, max) {
  const [lo, hi] = [num(min), num(max)];
  if (lo === undefined && hi === undefined) return undefined;
  return { '@type': 'QuantitativeValue', minValue: lo, maxValue: hi, unitCode: 'DAY' };
}

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
  f('shippingRate', 'Shipping cost (0 for free shipping)', 'number', {
    ld: 'offers.shippingDetails.shippingRate.value',
    check: (v, a) => (!v && a.shippingCurrency ? 'Shipping cost is required when a shipping currency is set.' : ''),
  }),
  f('shippingCurrency', 'Shipping currency (ISO 4217)', 'text', {
    format: 'currency', placeholder: 'USD', ld: 'offers.shippingDetails.shippingRate.currency',
    check: (v, a) => (!v && a.shippingRate ? 'Shipping currency is required when a shipping cost is set.' : ''),
  }),
  f('shippingCountry', 'Ships to (ISO 3166-1 country)', 'text', {
    placeholder: 'BD', ld: 'offers.shippingDetails.shippingDestination.addressCountry', check: country,
  }),
  f('handlingMin', 'Handling time, min days', 'number', { check: wholeDays }),
  f('handlingMax', 'Handling time, max days', 'number', { check: rangeCheck('handlingMin') }),
  f('transitMin', 'Transit time, min days', 'number', { check: wholeDays }),
  f('transitMax', 'Transit time, max days', 'number', { check: rangeCheck('transitMin') }),
  f('returnCategory', 'Return policy', 'select', { options: RETURN_CATEGORIES, ld: 'offers.hasMerchantReturnPolicy.returnPolicyCategory' }),
  f('returnDays', 'Return window (days)', 'number', {
    ld: 'offers.hasMerchantReturnPolicy.merchantReturnDays',
    check: (v, a) => wholeDays(v)
      || (v && a.returnCategory && a.returnCategory !== 'MerchantReturnFiniteReturnWindow'
        ? 'A return window only applies to the finite return window policy.' : '')
      || (!v && a.returnCategory === 'MerchantReturnFiniteReturnWindow' ? 'Return window is required for a finite return window.' : ''),
  }),
  f('returnCountry', 'Returns accepted in (ISO 3166-1 country)', 'text', {
    placeholder: 'BD', ld: 'offers.hasMerchantReturnPolicy.applicableCountry', check: country,
  }),
  f('returnMethod', 'Return method', 'select', { options: RETURN_METHODS }),
  f('returnFees', 'Return fees', 'select', { options: RETURN_FEES }),
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
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing',
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
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: num(v.shippingRate), currency: v.shippingCurrency },
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: v.shippingCountry },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: days(v.handlingMin, v.handlingMax),
            transitTime: days(v.transitMin, v.transitMax),
          },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: v.returnCountry,
          returnPolicyCategory: schemaUrl(v.returnCategory),
          merchantReturnDays: num(v.returnDays),
          returnMethod: schemaUrl(v.returnMethod),
          returnFees: schemaUrl(v.returnFees),
        },
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
    const sd = asArray(o.shippingDetails)[0] || {};
    const dt = sd.deliveryTime || {};
    const rp = asArray(o.hasMerchantReturnPolicy)[0] || {};
    const qv = (x) => ({ min: str(x?.minValue ?? x?.value), max: str(x?.maxValue ?? x?.value) });
    const rate = sd.shippingRate || {};
    return {
      name: str(n.name), images: joinLines(n.image), description: str(n.description),
      brand: text(n.brand), sku: str(n.sku), mpn: str(n.mpn), gtin: str(n.gtin ?? n.gtin13 ?? n.gtin12 ?? n.gtin14 ?? n.gtin8),
      price: str(o.price), currency: str(o.priceCurrency), availability: bare(o.availability), condition: bare(o.itemCondition),
      offerUrl: str(o.url), priceValidUntil: str(o.priceValidUntil),
      shippingRate: str(rate.value), shippingCurrency: str(rate.currency),
      shippingCountry: text(asArray(sd.shippingDestination)[0]?.addressCountry),
      handlingMin: qv(dt.handlingTime).min, handlingMax: qv(dt.handlingTime).max,
      transitMin: qv(dt.transitTime).min, transitMax: qv(dt.transitTime).max,
      returnCategory: bare(rp.returnPolicyCategory), returnDays: str(rp.merchantReturnDays),
      returnCountry: text(asArray(rp.applicableCountry)[0]), returnMethod: bare(rp.returnMethod), returnFees: bare(rp.returnFees),
      ratingValue: str(r.ratingValue), reviewCount: str(r.reviewCount ?? r.ratingCount), bestRating: str(r.bestRating),
    };
  },
};
