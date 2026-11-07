import { CONTEXT, clean, lines, one, num, f, joinLines, str, asArray, text } from './util.js';

const fields = [
  f('name', 'Service name', 'text', { required: true, ld: 'name' }),
  f('serviceType', 'Service type', 'text', { ld: 'serviceType', placeholder: 'Technical SEO audit' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('url', 'Service URL', 'url'),
  f('images', 'Image URLs (one per line)', 'list', { format: 'url' }),
  f('providerType', 'Provider type', 'select', { options: ['Organization', 'LocalBusiness', 'Person'], default: 'Organization' }),
  f('providerName', 'Provider name', 'text', { ld: 'provider.name' }),
  f('providerUrl', 'Provider URL', 'url'),
  f('areaServed', 'Areas served (one per line)', 'list', { ld: 'areaServed' }),
  f('price', 'Price', 'number', { ld: 'offers', check: (v, a) => (!v && a.currency ? 'Price is required when a currency is set.' : '') }),
  f('currency', 'Currency (ISO 4217)', 'text', { format: 'currency' }),
];

export default {
  id: 'service',
  label: 'Service',
  types: ['Service'],
  docs: 'https://schema.org/Service',
  note: 'Service has no dedicated Google rich result, but it helps search engines understand what you offer.',
  fields,
  rules: { required: ['name'], recommended: ['provider', 'provider.name', 'description', 'serviceType', 'areaServed', 'offers'] },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'Service',
      name: v.name,
      serviceType: v.serviceType,
      description: v.description,
      url: v.url,
      image: one(lines(v.images)),
      provider: { '@type': v.providerType || 'Organization', name: v.providerName, url: v.providerUrl },
      areaServed: one(lines(v.areaServed)),
      offers: { '@type': 'Offer', price: num(v.price), priceCurrency: v.currency },
    });
  },
  parse(n) {
    const p = asArray(n.provider)[0] || {};
    const o = asArray(n.offers)[0] || {};
    return {
      name: str(n.name), serviceType: str(n.serviceType), description: str(n.description), url: str(n.url), images: joinLines(n.image),
      providerType: ['Organization', 'LocalBusiness', 'Person'].includes(p['@type']) ? p['@type'] : 'Organization',
      providerName: text(p), providerUrl: str(p.url), areaServed: asArray(n.areaServed).map(text).join('\n'),
      price: str(o.price), currency: str(o.priceCurrency),
    };
  },
};
