import { CONTEXT, clean, num, f, bool, addressFields, buildAddress, parseAddress, urlOf, str, asArray, text } from './util.js';

export const EMPLOYMENT = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER'];
const addrKey = { street: 'streetAddress', city: 'addressLocality', region: 'addressRegion', postal: 'postalCode', country: 'addressCountry' };

const fields = [
  f('title', 'Job title', 'text', { required: true, ld: 'title' }),
  f('description', 'Job description (HTML allowed)', 'textarea', { required: true, ld: 'description' }),
  f('datePosted', 'Date posted', 'text', { required: true, format: 'date', ld: 'datePosted', placeholder: '2026-03-01' }),
  f('validThrough', 'Valid through', 'text', { format: 'date', ld: 'validThrough' }),
  f('employmentType', 'Employment type', 'select', { options: EMPLOYMENT, ld: 'employmentType' }),
  f('orgName', 'Hiring organization', 'text', { required: true, ld: 'hiringOrganization.name' }),
  f('orgUrl', 'Organization URL', 'url', { ld: 'hiringOrganization.sameAs' }),
  f('orgLogo', 'Organization logo URL', 'url', { ld: 'hiringOrganization.logo' }),
  f('remote', 'Work location type', 'select', { options: ['TELECOMMUTE'], ld: 'jobLocationType' }),
  ...addressFields.map((a) => ({ ...a, ld: 'jobLocation.address.' + addrKey[a.key] })),
  f('applicantCountry', 'Applicant country (remote jobs)', 'text', { ld: 'applicantLocationRequirements' }),
  f('salaryMin', 'Minimum salary', 'number', { ld: 'baseSalary' }),
  f('salaryMax', 'Maximum salary', 'number'),
  f('salaryCurrency', 'Salary currency', 'text', { format: 'currency', placeholder: 'USD' }),
  f('salaryUnit', 'Salary period', 'select', { options: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] }),
  f('directApply', 'Direct apply', 'select', { options: ['true', 'false'], ld: 'directApply' }),
  f('identifier', 'Job ID', 'text', { ld: 'identifier' }),
];

export default {
  id: 'jobposting',
  label: 'JobPosting',
  types: ['JobPosting'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
  fields,
  rules: {
    required: ['title', 'description', 'datePosted', 'hiringOrganization', 'hiringOrganization.name'],
    recommended: ['validThrough', 'employmentType', 'baseSalary', 'identifier', 'directApply', 'hiringOrganization.sameAs', 'hiringOrganization.logo'],
    extra(node) {
      const remote = node.jobLocationType === 'TELECOMMUTE';
      const out = [];
      if (!node.jobLocation?.address && !remote) out.push({ severity: 'error', code: 'job-location', path: 'jobLocation.address' });
      if (remote && !node.applicantLocationRequirements) out.push({ severity: 'warning', code: 'job-remote-applicant', path: 'applicantLocationRequirements' });
      return out;
    },
  },
  build(v) {
    const min = num(v.salaryMin);
    const max = num(v.salaryMax);
    const value = min !== undefined && min === max
      ? { '@type': 'QuantitativeValue', value: min, unitText: v.salaryUnit }
      : { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitText: v.salaryUnit };
    return clean({
      '@context': CONTEXT,
      '@type': 'JobPosting',
      title: v.title,
      description: v.description,
      datePosted: v.datePosted,
      validThrough: v.validThrough,
      employmentType: v.employmentType,
      identifier: v.identifier ? { '@type': 'PropertyValue', name: v.orgName, value: v.identifier } : undefined,
      hiringOrganization: { '@type': 'Organization', name: v.orgName, sameAs: v.orgUrl, logo: v.orgLogo },
      jobLocationType: v.remote,
      jobLocation: { '@type': 'Place', address: buildAddress(v) },
      applicantLocationRequirements: v.applicantCountry ? { '@type': 'Country', name: v.applicantCountry } : undefined,
      baseSalary: { '@type': 'MonetaryAmount', currency: v.salaryCurrency, value },
      directApply: bool(v.directApply),
    });
  },
  parse(n) {
    const org = asArray(n.hiringOrganization)[0] || {};
    const sal = n.baseSalary?.value || {};
    const loc = asArray(n.jobLocation)[0] || {};
    return {
      title: str(n.title), description: str(n.description), datePosted: str(n.datePosted), validThrough: str(n.validThrough),
      employmentType: str(asArray(n.employmentType)[0]), orgName: text(org), orgUrl: str(org.sameAs ?? org.url), orgLogo: urlOf(org.logo),
      remote: str(n.jobLocationType), ...parseAddress(loc.address),
      applicantCountry: text(asArray(n.applicantLocationRequirements)[0]),
      salaryMin: str(sal.minValue ?? sal.value), salaryMax: str(sal.maxValue ?? sal.value), salaryCurrency: str(n.baseSalary?.currency),
      salaryUnit: str(sal.unitText), directApply: n.directApply === undefined ? '' : String(n.directApply),
      identifier: str(n.identifier?.value ?? (typeof n.identifier === 'string' ? n.identifier : '')),
    };
  },
};
