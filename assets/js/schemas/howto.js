import { CONTEXT, clean, lines, one, f, nonEmptyRows, num, joinLines, urlOf, str, asArray, text } from './util.js';

const fields = [
  f('name', 'Title', 'text', { required: true, ld: 'name' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('image', 'Image URL', 'url', { ld: 'image' }),
  f('totalTime', 'Total time (ISO 8601 duration)', 'text', { format: 'duration', ld: 'totalTime', placeholder: 'PT45M' }),
  f('costValue', 'Estimated cost', 'number', { ld: 'estimatedCost' }),
  f('costCurrency', 'Cost currency', 'text', { format: 'currency', placeholder: 'USD' }),
  f('supply', 'Supplies (one per line)', 'list', { ld: 'supply' }),
  f('tool', 'Tools (one per line)', 'list', { ld: 'tool' }),
  f('steps', 'Steps', 'rows', {
    required: true, itemLabel: 'step', ld: 'step',
    fields: [
      f('name', 'Step name', 'text', { ld: 'step[].name' }),
      f('text', 'Instruction', 'textarea', { required: true, ld: 'step[].text' }),
      f('url', 'Step URL', 'url'),
      f('image', 'Step image URL', 'url'),
    ],
  }),
];

export default {
  id: 'howto',
  label: 'HowTo',
  types: ['HowTo'],
  docs: 'https://schema.org/HowTo',
  note: 'Google stopped showing HowTo rich results in 2023. The markup remains valid schema.org and may be read by other consumers.',
  fields,
  rules: {
    required: ['name', 'step', 'step[].text'],
    recommended: ['image', 'totalTime', 'estimatedCost', 'supply', 'tool', 'description'],
    info: ['howto-deprecated'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'HowTo',
      name: v.name,
      description: v.description,
      image: v.image,
      totalTime: v.totalTime,
      estimatedCost: { '@type': 'MonetaryAmount', currency: v.costCurrency, value: num(v.costValue) },
      supply: lines(v.supply).map((s) => ({ '@type': 'HowToSupply', name: s })),
      tool: lines(v.tool).map((s) => ({ '@type': 'HowToTool', name: s })),
      step: nonEmptyRows(v.steps, ['name', 'text', 'url', 'image']).map((s) => ({
        '@type': 'HowToStep', name: s.name, text: s.text, url: s.url, image: s.image,
      })),
    });
  },
  parse(n) {
    const steps = asArray(n.step).map((s) => ({ name: str(s.name), text: str(s.text), url: str(s.url), image: urlOf(s.image) }));
    return {
      name: str(n.name), description: str(n.description), image: joinLines(n.image).split('\n')[0],
      totalTime: str(n.totalTime), costValue: str(n.estimatedCost?.value), costCurrency: str(n.estimatedCost?.currency),
      supply: asArray(n.supply).map(text).join('\n'), tool: asArray(n.tool).map(text).join('\n'),
      ...(steps.length ? { steps } : {}),
    };
  },
};
