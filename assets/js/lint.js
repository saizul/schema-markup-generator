// Built-in structured data checker. Pure: takes rule tables from the schema modules and a JSON-LD node.
import { isEmpty } from './schemas/util.js';

const isRef = (o) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 1 && '@id' in o;

/** True when `segs` resolves to a non-empty value. Arrays require every item to match. */
export function present(v, segs) {
  if (Array.isArray(v)) return v.length > 0 && v.every((x) => present(x, segs));
  if (!segs.length) return !isEmpty(v);
  if (isRef(v)) return true; // resolved elsewhere in an @graph
  if (v === null || typeof v !== 'object') return false;
  return present(v[segs[0]], segs.slice(1));
}

/** Path helper: "step[].text" and "step.text" are treated the same. */
export const has = (node, path) => present(node, path.replace(/\[\]/g, '').split('.'));

/**
 * @param {import('./types.js').Rules} rules
 * @param {Object} node JSON-LD node (with or without @context)
 * @returns {import('./types.js').LintIssue[]}
 */
export function lintNode(rules, node) {
  const issues = [];
  const missing = [];
  const covered = (p) => missing.some((q) => p.startsWith(q + '.') || p.startsWith(q + '[]'));
  const n = node || {};

  for (const p of rules.required || []) {
    if (!has(n, p) && !covered(p)) {
      missing.push(p);
      issues.push({ severity: 'error', code: 'missing-required', path: p });
    }
  }
  for (const group of rules.oneOf || []) {
    if (!group.some((p) => has(n, p))) issues.push({ severity: 'error', code: 'one-of', paths: group });
  }
  for (const p of rules.recommended || []) {
    if (!has(n, p) && !covered(p)) {
      missing.push(p);
      issues.push({ severity: 'warning', code: 'missing-recommended', path: p });
    }
  }
  if (rules.extra && !isEmpty(n)) issues.push(...rules.extra(n));
  for (const code of rules.info || []) issues.push({ severity: 'info', code });
  return issues;
}

/** Counts issues by severity. */
export function summarize(issues) {
  const out = { error: 0, warning: 0, info: 0 };
  for (const i of issues) out[i.severity]++;
  return out;
}

/**
 * Finds the top-level form field a lint issue should be shown next to.
 * @param {import('./types.js').Field[]} fields
 * @param {import('./types.js').LintIssue} issue
 * @returns {string|null} field key
 */
export function fieldForIssue(fields, issue) {
  const p = (issue.path || (issue.paths && issue.paths[0]) || '').replace(/\[\]/g, '');
  if (!p) return null;
  const norm = (s) => String(s || '').replace(/\[\]/g, '');
  const exact = fields.find((f) => f.ld && norm(f.ld) === p);
  if (exact) return exact.key;
  const rows = fields.find((f) => f.type === 'rows' && f.ld && (p === norm(f.ld) || p.startsWith(norm(f.ld) + '.')));
  if (rows) return rows.key;
  const child = fields.find((f) => f.ld && norm(f.ld).startsWith(p + '.'));
  return child ? child.key : null;
}
