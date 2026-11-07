import { CONTEXT, clean, lines, one, f, defined, pickType, joinLines, urlOf, text, str, asArray } from './util.js';

export const TYPES = ['Article', 'BlogPosting', 'NewsArticle'];

/** @type {import('../types.js').Field[]} */
const fields = [
  f('type', 'Article type', 'select', { options: TYPES, default: 'BlogPosting' }),
  f('headline', 'Headline', 'text', { ld: 'headline', help: 'Keep it under about 110 characters.' }),
  f('url', 'Page URL', 'url', { ld: 'mainEntityOfPage' }),
  f('images', 'Image URLs (one per line)', 'list', { format: 'url', ld: 'image', help: 'Use high-resolution images, at least 1200 px wide.' }),
  f('datePublished', 'Date published', 'text', { format: 'date', ld: 'datePublished', placeholder: '2026-01-15T08:00:00+06:00' }),
  f('dateModified', 'Date modified', 'text', { format: 'date', ld: 'dateModified', placeholder: '2026-02-01T10:30:00+06:00' }),
  f('authorType', 'Author type', 'select', { options: ['Person', 'Organization'], default: 'Person' }),
  f('authorName', 'Author name', 'text', { ld: 'author.name' }),
  f('authorUrl', 'Author URL', 'url', { ld: 'author.url' }),
  f('publisherName', 'Publisher name', 'text', { ld: 'publisher.name' }),
  f('publisherLogo', 'Publisher logo URL', 'url', { ld: 'publisher.logo' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
];

export default {
  id: 'article',
  label: 'Article / BlogPosting',
  types: TYPES,
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  fields,
  rules: {
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'author.name', 'author.url'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': v.type || 'Article',
      headline: v.headline,
      description: v.description,
      mainEntityOfPage: v.url ? { '@type': 'WebPage', '@id': v.url } : undefined,
      image: one(lines(v.images)),
      datePublished: v.datePublished,
      dateModified: v.dateModified,
      author: { '@type': v.authorType || 'Person', name: v.authorName, url: v.authorUrl },
      publisher: { '@type': 'Organization', name: v.publisherName, logo: { '@type': 'ImageObject', url: v.publisherLogo } },
    });
  },
  parse(n) {
    const a = asArray(n.author)[0] || {};
    const p = asArray(n.publisher)[0] || {};
    return defined({
      type: pickType(n, TYPES),
      headline: str(n.headline),
      url: urlOf(n.mainEntityOfPage),
      images: joinLines(n.image),
      datePublished: str(n.datePublished),
      dateModified: str(n.dateModified),
      authorType: a['@type'] === 'Organization' ? 'Organization' : 'Person',
      authorName: text(a),
      authorUrl: str(a.url),
      publisherName: text(p),
      publisherLogo: urlOf(p.logo),
      description: str(n.description),
    });
  },
};
