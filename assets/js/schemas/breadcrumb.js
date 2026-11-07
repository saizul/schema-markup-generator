import { CONTEXT, clean, f, nonEmptyRows, asArray, str } from './util.js';

const fields = [
  f('items', 'Breadcrumb trail (first to last)', 'rows', {
    required: true, itemLabel: 'breadcrumb', ld: 'itemListElement',
    fields: [
      f('name', 'Name', 'text', { required: true, ld: 'itemListElement[].name' }),
      f('url', 'URL (optional for the last item)', 'url', { ld: 'itemListElement[].item' }),
    ],
  }),
];

export default {
  id: 'breadcrumb',
  label: 'BreadcrumbList',
  types: ['BreadcrumbList'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
  fields,
  rules: {
    required: ['itemListElement', 'itemListElement[].position', 'itemListElement[].name'],
    recommended: [],
    extra(node) {
      const list = asArray(node.itemListElement);
      const out = [];
      if (list.length === 1) out.push({ severity: 'warning', code: 'breadcrumb-short', path: 'itemListElement' });
      list.slice(0, -1).forEach((it, i) => {
        if (!it.item) out.push({ severity: 'error', code: 'breadcrumb-item-url', path: 'itemListElement[].item', params: { n: i + 1 } });
      });
      return out;
    },
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'BreadcrumbList',
      itemListElement: nonEmptyRows(v.items, ['name', 'url']).map((r, i) => ({
        '@type': 'ListItem', position: i + 1, name: r.name, item: r.url,
      })),
    });
  },
  parse(n) {
    const items = asArray(n.itemListElement)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((it) => ({ name: str(it.name ?? it.item?.name), url: str(typeof it.item === 'string' ? it.item : it.item?.['@id'] ?? it.item?.url) }));
    return items.length ? { items } : {};
  },
};
