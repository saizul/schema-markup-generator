import { CONTEXT, clean, lines, one, f, urlOf, str, asArray, text } from './util.js';

const fields = [
  f('name', 'Full name', 'text', { required: true, ld: 'name' }),
  f('url', 'Website URL', 'url', { ld: 'url' }),
  f('image', 'Image URL', 'url', { ld: 'image' }),
  f('jobTitle', 'Job title', 'text', { ld: 'jobTitle' }),
  f('worksFor', 'Works for (organization)', 'text', { ld: 'worksFor' }),
  f('email', 'Email', 'email'),
  f('telephone', 'Telephone', 'text'),
  f('description', 'Description', 'textarea'),
  f('sameAs', 'Profile URLs / sameAs (one per line)', 'list', { format: 'url', ld: 'sameAs' }),
];

export default {
  id: 'person',
  label: 'Person',
  types: ['Person'],
  docs: 'https://schema.org/Person',
  fields,
  rules: { required: ['name'], recommended: ['url', 'image', 'jobTitle', 'worksFor', 'sameAs'] },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'Person',
      name: v.name, url: v.url, image: v.image, jobTitle: v.jobTitle,
      worksFor: v.worksFor ? { '@type': 'Organization', name: v.worksFor } : undefined,
      email: v.email, telephone: v.telephone, description: v.description,
      sameAs: one(lines(v.sameAs)),
    });
  },
  parse(n) {
    return {
      name: str(n.name), url: str(n.url), image: urlOf(n.image), jobTitle: str(n.jobTitle),
      worksFor: text(asArray(n.worksFor)[0]), email: str(n.email), telephone: str(n.telephone),
      description: str(n.description), sameAs: asArray(n.sameAs).map(urlOf).join('\n'),
    };
  },
};
