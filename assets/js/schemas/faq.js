import { CONTEXT, clean, f, nonEmptyRows, asArray, str } from './util.js';

const fields = [
  f('items', 'Questions', 'rows', {
    required: true, itemLabel: 'question', ld: 'mainEntity',
    fields: [
      f('q', 'Question', 'text', { required: true, ld: 'mainEntity[].name' }),
      f('a', 'Answer (basic HTML allowed)', 'textarea', { required: true, ld: 'mainEntity[].acceptedAnswer.text' }),
    ],
  }),
];

export default {
  id: 'faq',
  label: 'FAQPage',
  types: ['FAQPage'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/faqpage',
  note: 'Google only shows FAQ rich results for well-known government and health sites, but the markup is still valid schema.org.',
  fields,
  rules: {
    required: ['mainEntity', 'mainEntity[].name', 'mainEntity[].acceptedAnswer', 'mainEntity[].acceptedAnswer.text'],
    recommended: [],
    info: ['faq-restricted'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'FAQPage',
      mainEntity: nonEmptyRows(v.items, ['q', 'a']).map((r) => ({
        '@type': 'Question',
        name: r.q,
        acceptedAnswer: { '@type': 'Answer', text: r.a },
      })),
    });
  },
  parse(n) {
    const items = asArray(n.mainEntity).map((q) => ({
      q: str(q.name),
      a: str(asArray(q.acceptedAnswer)[0]?.text),
    }));
    return items.length ? { items } : {};
  },
};
