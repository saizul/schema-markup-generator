// Combines several entities into one JSON-LD @graph and wires them together with @id references.
import { byId } from './schemas/index.js';
import { CONTEXT, isEmpty } from './schemas/util.js';
import { lintNode } from './lint.js';

/** Base URL without fragment; empty when not set. */
export const normalizeBase = (base) => String(base ?? '').trim().replace(/#.*$/, '');

const first = (nodes, ...types) => {
  for (const t of types) {
    const i = nodes.findIndex((n) => n && n.type === t);
    if (i >= 0) return i;
  }
  return -1;
};

/**
 * @param {{base?: string, entities: import('./types.js').GraphEntity[]}} input
 * @returns {{graph: Object, ids: (string|null)[], nodes: (Object|null)[]}}
 *   ids and nodes line up with input.entities; empty entities yield null.
 */
export function buildGraphDetailed({ base, entities }) {
  const root = normalizeBase(base);
  const used = new Map();
  const items = entities.map((e) => {
    const schema = byId(e.type);
    if (!schema) return null;
    const { ['@context']: _ctx, ...node } = schema.build(e.values || {});
    return isEmpty(node) ? null : { type: e.type, schema, node };
  });
  const ids = items.map((it) => {
    if (!it) return null;
    const n = (used.get(it.type) || 0) + 1;
    used.set(it.type, n);
    return `${root}#${it.type}${n > 1 ? '-' + n : ''}`;
  });
  const idAt = (i) => (i >= 0 ? ids[i] : null);
  const meta = items.map((it) => (it ? { type: it.type } : null));
  const org = first(meta, 'organization', 'localbusiness');
  const site = first(meta, 'website');
  const page = first(meta, 'webpage');
  const crumbs = first(meta, 'breadcrumb');
  const person = first(meta, 'person');

  const nodes = items.map((it, i) => {
    if (!it) return null;
    const node = { '@type': it.node['@type'], '@id': ids[i], ...it.node };
    const ref = (k, id) => { if (id) node[k] = { '@id': id }; };
    switch (it.type) {
      case 'website': ref('publisher', idAt(org)); break;
      case 'webpage': ref('isPartOf', idAt(site)); ref('breadcrumb', idAt(crumbs)); ref('about', idAt(org)); break;
      case 'article':
        ref('isPartOf', idAt(page)); ref('mainEntityOfPage', idAt(page));
        ref('author', idAt(person)); ref('publisher', idAt(org));
        break;
      case 'service': case 'course': ref('provider', idAt(org)); break;
      default: break;
    }
    return node;
  });
  return { graph: { '@context': CONTEXT, '@graph': nodes.filter(Boolean) }, ids, nodes };
}

/** Convenience wrapper returning only the JSON-LD document ({} when nothing to output). */
export function buildGraph(input) {
  const { graph } = buildGraphDetailed(input);
  return graph['@graph'].length ? graph : {};
}

/**
 * Lints each entity of a graph with its schema's rule table.
 * @returns {{index: number, type: string, issues: import('./types.js').LintIssue[]}[]}
 */
export function lintGraph(input, opts = {}) {
  const { nodes } = buildGraphDetailed(input);
  return input.entities.map((e, index) => {
    const schema = byId(e.type);
    return { index, type: e.type, issues: schema ? lintNode(schema.rules, nodes[index] || {}, opts) : [] };
  });
}
