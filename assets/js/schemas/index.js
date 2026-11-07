import article from './article.js';
import faq from './faq.js';
import localbusiness from './localbusiness.js';
import organization from './organization.js';
import person from './person.js';
import product from './product.js';
import breadcrumb from './breadcrumb.js';
import howto from './howto.js';
import event from './event.js';
import website from './website.js';
import webpage from './webpage.js';
import recipe from './recipe.js';
import jobposting from './jobposting.js';
import course from './course.js';
import video from './video.js';
import software from './software.js';
import review from './review.js';
import service from './service.js';
import dataset from './dataset.js';
import { asArray, defaultsFor } from './util.js';

/** @type {import('../types.js').SchemaModule[]} */
export const SCHEMAS = [
  article, faq, localbusiness, organization, person, product, breadcrumb, howto, event, website,
  webpage, recipe, jobposting, course, video, software, review, service, dataset,
];

export const byId = (id) => SCHEMAS.find((s) => s.id === id);

/** Schema module whose `types` include the given schema.org type name. */
export const byType = (type) => SCHEMAS.find((s) => s.types.includes(type));

/** Flattens arrays and @graph containers into a list of node objects. */
export function flatten(input) {
  const out = [];
  const walk = (x) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== 'object') return;
    if (x['@graph']) {
      walk(x['@graph']);
      if (x['@type']) out.push(x);
      return;
    }
    out.push(x);
  };
  walk(input);
  return out;
}

/**
 * Replaces `{ "@id": ... }` references with a shallow copy of the referenced node
 * when it exists in the list, and drops unresolved reference-only objects.
 */
export function dereference(nodes) {
  const map = new Map(nodes.filter((n) => n['@id']).map((n) => [n['@id'], n]));
  const isRef = (o) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 1 && o['@id'];
  const fix = (val, top) => {
    if (Array.isArray(val)) return val.map((x) => fix(x, top)).filter((x) => x !== undefined);
    if (isRef(val)) return top && map.has(val['@id']) ? { ...map.get(val['@id']) } : undefined;
    return val;
  };
  return nodes.map((n) => {
    const copy = {};
    for (const [k, val] of Object.entries(n)) {
      const r = fix(val, true);
      if (r !== undefined && !(Array.isArray(r) && r.length === 0 && Array.isArray(val))) copy[k] = r;
    }
    return copy;
  });
}

/**
 * Finds every node in a JSON-LD document that one of the schema modules understands.
 * @returns {{schema: import('../types.js').SchemaModule, node: Object, values: Object}[]}
 */
export function recognize(input) {
  const nodes = dereference(flatten(input));
  const found = [];
  for (const node of nodes) {
    const type = asArray(node['@type']).find((t) => byType(t));
    if (!type) continue;
    const schema = byType(type);
    found.push({ schema, node, values: { ...defaultsFor(schema.fields), ...schema.parse(node) } });
  }
  return found;
}
