import { CONTEXT, clean, num, f, str, asArray, text } from './util.js';

export const ITEM_TYPES = ['Product', 'Book', 'Movie', 'Restaurant', 'LocalBusiness', 'Organization', 'SoftwareApplication', 'Course', 'Recipe', 'Event', 'CreativeWorkSeries'];

const fields = [
  f('itemType', 'Reviewed item type', 'select', { options: ITEM_TYPES, default: 'Product' }),
  f('itemName', 'Reviewed item name', 'text', { required: true, ld: 'itemReviewed.name' }),
  f('itemImage', 'Reviewed item image URL', 'url'),
  f('ratingValue', 'Rating', 'number', { required: true, ld: 'reviewRating.ratingValue' }),
  f('bestRating', 'Best possible rating', 'number', { ld: 'reviewRating.bestRating', placeholder: '5' }),
  f('worstRating', 'Worst possible rating', 'number', { placeholder: '1' }),
  f('authorType', 'Author type', 'select', { options: ['Person', 'Organization'], default: 'Person' }),
  f('authorName', 'Reviewer name', 'text', { required: true, ld: 'author.name' }),
  f('datePublished', 'Date published', 'text', { format: 'date', ld: 'datePublished' }),
  f('reviewBody', 'Review text', 'textarea', { ld: 'reviewBody' }),
  f('publisherName', 'Publisher name', 'text'),
];

export default {
  id: 'review',
  label: 'Review snippet',
  types: ['Review'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
  fields,
  rules: {
    required: ['itemReviewed', 'itemReviewed.name', 'reviewRating', 'reviewRating.ratingValue', 'author', 'author.name'],
    recommended: ['datePublished', 'reviewRating.bestRating', 'reviewBody'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'Review',
      itemReviewed: { '@type': v.itemType || 'Product', name: v.itemName, image: v.itemImage },
      reviewRating: { '@type': 'Rating', ratingValue: num(v.ratingValue), bestRating: num(v.bestRating), worstRating: num(v.worstRating) },
      author: { '@type': v.authorType || 'Person', name: v.authorName },
      datePublished: v.datePublished,
      reviewBody: v.reviewBody,
      publisher: v.publisherName ? { '@type': 'Organization', name: v.publisherName } : undefined,
    });
  },
  parse(n) {
    const item = asArray(n.itemReviewed)[0] || {};
    const r = n.reviewRating || {};
    const a = asArray(n.author)[0] || {};
    return {
      itemType: ITEM_TYPES.includes(item['@type']) ? item['@type'] : 'Product',
      itemName: str(item.name), itemImage: str(typeof item.image === 'string' ? item.image : item.image?.url),
      ratingValue: str(r.ratingValue), bestRating: str(r.bestRating), worstRating: str(r.worstRating),
      authorType: a['@type'] === 'Organization' ? 'Organization' : 'Person', authorName: text(a),
      datePublished: str(n.datePublished), reviewBody: str(n.reviewBody), publisherName: text(asArray(n.publisher)[0]),
    };
  },
};
