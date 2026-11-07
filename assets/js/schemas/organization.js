import {
  CONTEXT, clean, lines, one, f, defined, addressFields, buildAddress, parseAddress, urlOf, str, asArray, pickType,
} from './util.js';

export const TYPES = ['Organization', 'Corporation', 'NGO', 'OnlineStore', 'EducationalOrganization', 'GovernmentOrganization'];
const addrKey = { street: 'streetAddress', city: 'addressLocality', region: 'addressRegion', postal: 'postalCode', country: 'addressCountry' };

const fields = [
  f('orgType', 'Organization type', 'select', { options: TYPES, default: 'Organization' }),
  f('name', 'Name', 'text', { required: true, ld: 'name' }),
  f('legalName', 'Legal name', 'text', { ld: 'legalName' }),
  f('url', 'Website URL', 'url', { ld: 'url' }),
  f('logo', 'Logo URL', 'url', { ld: 'logo', help: 'At least 112x112 px, crawlable image.' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('email', 'Email', 'email', { ld: 'email' }),
  f('telephone', 'Telephone', 'text', { ld: 'telephone' }),
  f('contactType', 'Contact type', 'text', { placeholder: 'customer support' }),
  f('contactTelephone', 'Contact telephone', 'text', { ld: 'contactPoint' }),
  f('foundingDate', 'Founding date', 'text', { format: 'date', ld: 'foundingDate', placeholder: '2018-03-01' }),
  ...addressFields.map((a) => ({ ...a, ld: 'address.' + addrKey[a.key] })),
  f('sameAs', 'Profile URLs / sameAs (one per line)', 'list', { format: 'url', ld: 'sameAs' }),
];

export default {
  id: 'organization',
  label: 'Organization',
  types: TYPES,
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/organization',
  fields,
  rules: {
    required: ['name'],
    recommended: ['url', 'logo', 'description', 'address', 'contactPoint', 'sameAs', 'email', 'telephone', 'legalName', 'foundingDate'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': v.orgType || 'Organization',
      name: v.name,
      legalName: v.legalName,
      url: v.url,
      logo: v.logo,
      description: v.description,
      email: v.email,
      telephone: v.telephone,
      foundingDate: v.foundingDate,
      address: buildAddress(v),
      contactPoint: { '@type': 'ContactPoint', contactType: v.contactType, telephone: v.contactTelephone },
      sameAs: one(lines(v.sameAs)),
    });
  },
  parse(n) {
    const cp = asArray(n.contactPoint)[0] || {};
    return defined({
      orgType: pickType(n, TYPES),
      name: str(n.name), legalName: str(n.legalName), url: str(n.url), logo: urlOf(n.logo),
      description: str(n.description), email: str(n.email), telephone: str(n.telephone),
      contactType: str(cp.contactType), contactTelephone: str(cp.telephone),
      foundingDate: str(n.foundingDate),
      ...parseAddress(n.address),
      sameAs: asArray(n.sameAs).map(urlOf).join('\n'),
    });
  },
};
