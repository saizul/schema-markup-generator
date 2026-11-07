import { CONTEXT, clean, f, str, asArray } from './util.js';

const PARAM = '{search_term_string}';

const fields = [
  f('name', 'Site name', 'text', { required: true, ld: 'name' }),
  f('alternateName', 'Alternate name', 'text', { ld: 'alternateName' }),
  f('url', 'Site URL', 'url', { required: true, ld: 'url' }),
  f('language', 'Language (BCP 47)', 'text', { placeholder: 'en' }),
  f('searchTarget', 'Search URL template', 'text', {
    ld: 'potentialAction', placeholder: 'https://example.com/?s={search_term_string}',
    help: 'Include {search_term_string} where the query goes. Leave empty to omit SearchAction.',
    check: (v) => (v && !v.includes(PARAM) ? 'The template must contain {search_term_string}.' : v && !/^https?:\/\//.test(v) ? 'Enter a full URL template.' : ''),
  }),
];

export default {
  id: 'website',
  label: 'WebSite + SearchAction',
  types: ['WebSite'],
  docs: 'https://developers.google.com/search/docs/appearance/site-names',
  note: 'Google retired the sitelinks search box in 2024, so SearchAction no longer changes results. It is still valid schema.org.',
  fields,
  rules: { required: ['name', 'url'], recommended: ['alternateName', 'inLanguage'], info: ['sitelinks-retired'] },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'WebSite',
      name: v.name,
      alternateName: v.alternateName,
      url: v.url,
      inLanguage: v.language,
      potentialAction: v.searchTarget
        ? {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: v.searchTarget },
            'query-input': 'required name=search_term_string',
          }
        : undefined,
    });
  },
  parse(n) {
    const act = asArray(n.potentialAction).find((a) => a['@type'] === 'SearchAction') || {};
    const t = act.target;
    return {
      name: str(n.name), alternateName: str(asArray(n.alternateName)[0]), url: str(n.url), language: str(n.inLanguage),
      searchTarget: typeof t === 'string' ? t : str(t?.urlTemplate),
    };
  },
};
