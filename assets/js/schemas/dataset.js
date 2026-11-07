import { CONTEXT, clean, f, csv, bool, str, asArray, text, urlOf } from './util.js';

const fields = [
  f('name', 'Dataset name', 'text', { required: true, ld: 'name' }),
  f('description', 'Description (50 to 5000 characters)', 'textarea', {
    required: true, ld: 'description', check: (v) => (v.length < 50 ? 'Google asks for at least 50 characters.' : v.length > 5000 ? 'Google allows at most 5000 characters.' : ''),
  }),
  f('url', 'Landing page URL', 'url', { ld: 'url' }),
  f('keywords', 'Keywords (comma separated)', 'text', { ld: 'keywords' }),
  f('license', 'License URL', 'url', { ld: 'license' }),
  f('creatorName', 'Creator name', 'text', { ld: 'creator' }),
  f('creatorType', 'Creator type', 'select', { options: ['Organization', 'Person'], default: 'Organization' }),
  f('free', 'Accessible for free', 'select', { options: ['true', 'false'] }),
  f('temporal', 'Temporal coverage', 'text', { ld: 'temporalCoverage', placeholder: '2020-01-01/2025-12-31' }),
  f('spatial', 'Spatial coverage', 'text', { ld: 'spatialCoverage' }),
  f('distUrl', 'Download URL', 'url', { ld: 'distribution' }),
  f('distFormat', 'Download format (MIME or name)', 'text', { placeholder: 'text/csv' }),
  f('sameAs', 'sameAs URL', 'url'),
];

export default {
  id: 'dataset',
  label: 'Dataset',
  types: ['Dataset'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/dataset',
  fields,
  rules: {
    required: ['name', 'description'],
    recommended: ['url', 'keywords', 'license', 'creator', 'isAccessibleForFree', 'temporalCoverage', 'spatialCoverage', 'distribution', 'sameAs'],
  },
  build(v) {
    const kw = csv(v.keywords);
    return clean({
      '@context': CONTEXT,
      '@type': 'Dataset',
      name: v.name,
      description: v.description,
      url: v.url,
      sameAs: v.sameAs,
      keywords: kw.length > 1 ? kw : kw[0],
      license: v.license,
      creator: { '@type': v.creatorType || 'Organization', name: v.creatorName },
      isAccessibleForFree: bool(v.free),
      temporalCoverage: v.temporal,
      spatialCoverage: v.spatial,
      distribution: { '@type': 'DataDownload', contentUrl: v.distUrl, encodingFormat: v.distFormat },
    });
  },
  parse(n) {
    const c = asArray(n.creator)[0] || {};
    const d = asArray(n.distribution)[0] || {};
    return {
      name: str(n.name), description: str(asArray(n.description)[0]), url: str(n.url), sameAs: str(asArray(n.sameAs)[0]),
      keywords: asArray(n.keywords).join(', '), license: urlOf(n.license), creatorName: text(c),
      creatorType: c['@type'] === 'Person' ? 'Person' : 'Organization', free: n.isAccessibleForFree === undefined ? '' : String(n.isAccessibleForFree),
      temporal: str(n.temporalCoverage), spatial: text(asArray(n.spatialCoverage)[0]), distUrl: str(d.contentUrl), distFormat: str(d.encodingFormat),
    };
  },
};
