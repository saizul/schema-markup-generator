import { CONTEXT, clean, f, defined, pickType, urlOf, str } from './util.js';

export const TYPES = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'ProfilePage', 'ItemPage'];

const fields = [
  f('type', 'Page type', 'select', { options: TYPES, default: 'WebPage' }),
  f('name', 'Page title', 'text', { ld: 'name' }),
  f('url', 'Page URL', 'url', { required: true, ld: 'url' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('language', 'Language (BCP 47)', 'text', { ld: 'inLanguage', placeholder: 'en' }),
  f('datePublished', 'Date published', 'text', { format: 'date', ld: 'datePublished' }),
  f('dateModified', 'Date modified', 'text', { format: 'date', ld: 'dateModified' }),
  f('primaryImage', 'Primary image URL', 'url'),
];

export default {
  id: 'webpage',
  label: 'WebPage',
  types: TYPES,
  docs: 'https://schema.org/WebPage',
  fields,
  rules: { required: ['url'], recommended: ['name', 'description', 'inLanguage', 'datePublished', 'dateModified'] },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': v.type || 'WebPage',
      name: v.name, url: v.url, description: v.description, inLanguage: v.language,
      datePublished: v.datePublished, dateModified: v.dateModified,
      primaryImageOfPage: v.primaryImage ? { '@type': 'ImageObject', url: v.primaryImage } : undefined,
    });
  },
  parse(n) {
    return defined({
      type: pickType(n, TYPES), name: str(n.name), url: str(n.url), description: str(n.description),
      language: str(n.inLanguage), datePublished: str(n.datePublished), dateModified: str(n.dateModified),
      primaryImage: urlOf(n.primaryImageOfPage),
    });
  },
};
