// UI wiring. All JSON building lives in pure modules (schemas/, graph.js, lint.js, share.js, importer.js).
import { SCHEMAS, byId } from './schemas/index.js';
import { DAYS, defaultsFor, validate, toJson, toScriptTag, isEmpty } from './schemas/util.js';
import { lintNode, fieldForIssue } from './lint.js';
import { buildGraph, lintGraph } from './graph.js';
import { t as tr, tl as trl } from './i18n.js';
import { TEMPLATES, applyTemplate } from './templates.js';
import { toHash, fromHash } from './share.js';
import { parseInput, toStatePatch } from './importer.js';

const KEY = 'schema-markup-generator:v2';
const THEME_KEY = 'schema-markup-generator:theme';
const $ = (s) => document.querySelector(s);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

// ---- state ------------------------------------------------------------------
/** @returns {import('./types.js').AppState} */
const fresh = () => ({
  lang: (navigator.language || '').startsWith('bn') ? 'bn' : 'en',
  mode: 'single', type: 'article', values: {}, graph: { base: '', entities: [], active: 0 }, wrap: true,
});

function sanitize(s) {
  const out = { ...fresh(), ...s };
  if (!byId(out.type)) out.type = 'article';
  const values = {};
  for (const [id, v] of Object.entries(s.values || {})) if (byId(id)) values[id] = { ...defaultsFor(byId(id).fields), ...v };
  values[out.type] ||= defaultsFor(byId(out.type).fields);
  out.values = values;
  const g = s.graph || {};
  const entities = (g.entities || []).filter((e) => e && byId(e.type)).map((e) => ({ type: e.type, values: { ...defaultsFor(byId(e.type).fields), ...e.values } }));
  out.graph = { base: String(g.base || ''), entities, active: Math.min(Math.max(+g.active || 0, 0), Math.max(entities.length - 1, 0)) };
  if (out.mode === 'graph' && !entities.length) out.mode = 'single';
  if (out.mode !== 'graph') out.mode = 'single';
  out.lang = out.lang === 'bn' ? 'bn' : 'en';
  out.wrap = out.wrap !== false;
  return out;
}

function loadState() {
  let s = fresh();
  try {
    const saved = JSON.parse(store.get(KEY) || 'null');
    s = saved ? sanitize({ ...s, ...saved }) : sanitize({ ...s, ...applyTemplate('blog-post') });
  } catch {
    s = sanitize({ ...s, ...applyTemplate('blog-post') });
  }
  const shared = fromHash(location.hash);
  if (shared) s = sanitize({ ...s, ...shared, values: { ...s.values, ...(shared.values || {}) } });
  return s;
}

let state = loadState();
const touched = new Set();
let showAll = false;

function patchState(patch) {
  state = sanitize({ ...state, ...patch, values: { ...state.values, ...(patch.values || {}) }, graph: patch.graph || state.graph });
}

const current = () => {
  if (state.mode === 'graph') {
    const e = state.graph.entities[state.graph.active];
    return { schema: byId(e.type), values: e.values };
  }
  return { schema: byId(state.type), values: state.values[state.type] };
};

// ---- tiny DOM helper -----------------------------------------------------------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  for (const k of kids.flat()) if (k !== undefined && k !== null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const T = (k, p) => tr(k, p, state.lang);
const L = (label) => trl(label, state.lang);

// ---- value paths -------------------------------------------------------------------
function setPath(obj, parts, value) {
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
}
const getPath = (obj, parts) => parts.reduce((o, k) => o?.[k], obj);

// ---- chrome (static strings, selects) -----------------------------------------------------
function renderChrome() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', T(el.dataset.i18nAria)));
  $('#lang').value = state.lang;
  $('#wrap').checked = state.wrap;
  document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === state.mode; });

  const tpl = $('#template');
  tpl.replaceChildren(h('option', { value: '' }, T('template.none')), ...TEMPLATES.map((x) => h('option', { value: x.id }, x.title[state.lang] || x.title.en)));

  const opts = () => SCHEMAS.map((s) => h('option', { value: s.id }, s.label));
  const typeSel = $('#type');
  typeSel.replaceChildren(...opts());
  typeSel.value = state.type;
  $('#entity-type').replaceChildren(...opts());

  const graph = state.mode === 'graph';
  $('#graph-bar').hidden = !graph;
  $('#type-bar').hidden = graph;
  $('#graph-base').value = state.graph.base;
  if (graph) renderEntities();
}

function renderEntities() {
  const list = $('#entity-list');
  list.replaceChildren(...state.graph.entities.map((e, i) => {
    const s = byId(e.type);
    return h('li', {},
      h('button', { type: 'button', class: 'btn pick', 'data-action': 'pick', 'data-i': i, 'aria-current': String(i === state.graph.active) }, `${i + 1}. ${s.label}`),
      h('button', { type: 'button', class: 'btn small', 'data-action': 'up', 'data-i': i, 'aria-label': T('graph.up'), disabled: i === 0 }, '↑'),
      h('button', { type: 'button', class: 'btn small', 'data-action': 'down', 'data-i': i, 'aria-label': T('graph.down'), disabled: i === state.graph.entities.length - 1 }, '↓'),
      h('button', { type: 'button', class: 'btn small danger', 'data-action': 'remove', 'data-i': i, 'aria-label': T('graph.remove') }, '×'));
  }));
}

// ---- form ----------------------------------------------------------------------------
function fieldEl(fd, vals, path, top, schema) {
  const pathStr = path.join('.');
  const id = 'f-' + path.join('-');
  const label = L(fd.label);

  if (fd.type === 'rows') {
    const rows = vals[fd.key];
    const item = fd.itemLabel ? T('item.' + fd.itemLabel) : '';
    const shown = item.startsWith('item.') ? fd.itemLabel || '' : item;
    const fs = h('fieldset', { class: 'rows' }, h('legend', {}, label, fd.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null));
    const ul = h('ul');
    rows.forEach((row, i) => {
      ul.append(h('li', { class: 'row' },
        h('div', { class: 'row-head' }, h('span', {}, T('form.row', { item: shown, n: i + 1 })),
          h('button', { type: 'button', class: 'btn small danger', 'data-action': 'remove-row', 'data-path': pathStr, 'data-index': i }, T('form.removeRow'))),
        fd.fields.map((sf) => fieldEl(sf, row, [...path, i, sf.key], false, schema))));
    });
    fs.append(ul, h('button', { type: 'button', class: 'btn small', 'data-action': 'add-row', 'data-path': pathStr }, '+ ' + T('form.addRow', { item: shown })),
      h('div', { class: 'err', 'data-err': pathStr, id: 'err-' + id }), top ? h('div', { class: 'lint', 'data-lint': fd.key }) : null);
    return fs;
  }

  if (fd.type === 'days') {
    const sel = vals[fd.key] || [];
    const fs = h('fieldset', { class: 'days' }, h('legend', {}, label, fd.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null));
    DAYS.forEach((d) => fs.append(h('label', {}, h('input', { type: 'checkbox', 'data-path': pathStr, 'data-day': d, value: d, checked: sel.includes(d) }), ' ' + d)));
    fs.append(h('div', { class: 'err', 'data-err': pathStr, id: 'err-' + id }));
    return fs;
  }

  const val = vals[fd.key] ?? '';
  const common = { id, 'data-path': pathStr, 'aria-describedby': `err-${id} help-${id}` };
  if (fd.required) common['aria-required'] = 'true';
  let input;
  if (fd.type === 'select') {
    input = h('select', common, fd.default ? null : h('option', { value: '' }, T('form.selectBlank')),
      fd.options.map((o) => h('option', { value: o }, o)));
    input.value = val;
  } else if (fd.type === 'textarea' || fd.type === 'list') {
    input = h('textarea', { ...common, rows: fd.type === 'list' ? 3 : 4, placeholder: fd.placeholder, spellcheck: fd.type === 'list' ? 'false' : undefined });
    input.value = val;
  } else {
    const type = { url: 'url', email: 'email', time: 'time' }[fd.type] || 'text';
    input = h('input', { ...common, type, inputmode: fd.type === 'number' ? 'decimal' : undefined, placeholder: fd.placeholder, spellcheck: 'false' });
    input.value = val;
  }
  const rec = top && schema.rules.recommended.includes(fd.ld);
  return h('div', { class: 'field' + (fd.type === 'textarea' || fd.type === 'list' ? ' wide' : '') },
    h('label', { for: id }, label,
      fd.required ? [h('span', { class: 'req', 'aria-hidden': 'true' }, '*'), h('span', { class: 'sr-only' }, ' (' + T('form.required') + ')')] : null,
      rec ? h('span', { class: 'rec' }, T('form.recommended')) : null),
    input,
    fd.help ? h('p', { class: 'help', id: 'help-' + id }, fd.help) : h('span', { id: 'help-' + id }),
    h('div', { class: 'err', 'data-err': pathStr, id: 'err-' + id }),
    top ? h('div', { class: 'lint', 'data-lint': fd.key }) : null);
}

function renderForm() {
  const { schema, values } = current();
  const form = $('#form');
  form.replaceChildren(...schema.fields.map((fd) => fieldEl(fd, values, [fd.key], true, schema)));
  const note = $('#note');
  note.hidden = !schema.note;
  note.textContent = schema.note || '';
  const docs = $('#docs-link');
  docs.hidden = !schema.docs;
  docs.href = schema.docs || '#';
  docs.textContent = T('check.docs');
}

// ---- compute + render output -------------------------------------------------------------
function compute() {
  if (state.mode === 'graph') {
    const json = buildGraph(state.graph);
    const entityIssues = lintGraph(state.graph);
    let fieldErrors = 0;
    for (const e of state.graph.entities) fieldErrors += Object.keys(validate(byId(e.type).fields, e.values)).length;
    return { json, entityIssues, fieldErrors };
  }
  const schema = byId(state.type);
  const values = state.values[state.type];
  const json = schema.build(values);
  return { json, entityIssues: [{ index: 0, type: schema.id, issues: lintNode(schema.rules, json) }], fieldErrors: Object.keys(validate(schema.fields, values)).length };
}

const issueText = (i) => T('lint.' + i.code, { path: i.path || '', paths: (i.paths || []).join(', '), n: i.params?.n ?? '' });

function renderChecks(entityIssues) {
  const box = $('#checks');
  const parts = [];
  for (const { index, type, issues } of entityIssues) {
    if (!issues.length) continue;
    if (state.mode === 'graph') parts.push(h('h4', {}, `${index + 1}. ${byId(type).label}`));
    parts.push(h('ul', {}, issues.map((i) => h('li', {}, h('span', { class: 'sev sev-' + i.severity }, T('sev.' + i.severity)), issueText(i)))));
  }
  box.replaceChildren(...(parts.length ? parts : [h('p', { class: 'help' }, T('check.none'))]));
}

function renderFieldFeedback(entityIssues, fieldErrorMap) {
  const { schema } = current();
  document.querySelectorAll('[data-err]').forEach((el) => {
    const e = fieldErrorMap[el.dataset.err];
    const visible = e && (!e.required || touched.has(el.dataset.err) || showAll);
    el.textContent = visible ? e.msg : '';
    const input = document.getElementById(el.id.replace('err-', ''));
    if (input) input.setAttribute('aria-invalid', visible ? 'true' : 'false');
  });
  const mine = state.mode === 'graph' ? entityIssues[state.graph.active]?.issues : entityIssues[0].issues;
  const byField = {};
  for (const i of mine || []) {
    if (i.severity === 'info') continue;
    const k = fieldForIssue(schema.fields, i);
    if (k) (byField[k] ||= []).push(i);
  }
  document.querySelectorAll('[data-lint]').forEach((el) => {
    const list = byField[el.dataset.lint] || [];
    el.replaceChildren(...list.map((i) => h('div', {}, h('span', { class: i.severity === 'error' ? 'e' : '' }, T('sev.' + i.severity) + ': '), issueText(i))));
  });
}

function update() {
  const { schema, values } = current();
  const fieldErrorMap = validate(schema.fields, values);
  const { json, entityIssues, fieldErrors } = compute();
  const empty = isEmpty(json);
  $('#out').textContent = empty ? '' : state.wrap ? toScriptTag(json) : toJson(json);
  $('#out-empty').hidden = !empty;
  $('#download').disabled = $('#copy').disabled = $('#share').disabled = false;

  const all = entityIssues.flatMap((e) => e.issues);
  const errors = all.filter((i) => i.severity === 'error').length;
  const warnings = all.filter((i) => i.severity === 'warning').length;
  const st = $('#status');
  const bits = [];
  if (errors) bits.push(T('status.errors', { n: errors }));
  if (warnings) bits.push(T('status.warnings', { n: warnings }));
  if (fieldErrors) bits.push(T('status.fields', { n: fieldErrors }));
  st.textContent = empty ? '' : bits.length ? bits.join(' / ') : T('status.ok');
  st.className = 'status ' + (empty ? '' : errors || fieldErrors ? 'bad' : 'ok');

  renderChecks(entityIssues);
  renderFieldFeedback(entityIssues, fieldErrorMap);
  persist();
  return json;
}

let timer;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    store.set(KEY, JSON.stringify(state));
    try { history.replaceState(null, '', toHash(state)); } catch { /* sandboxed */ }
  }, 250);
}

function renderAll() {
  renderChrome();
  renderForm();
  update();
}

// ---- helpers: clipboard, download -----------------------------------------------------------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

function flash(btn, key) {
  const old = btn.textContent;
  btn.textContent = T(key);
  setTimeout(() => { btn.textContent = old; }, 1500);
}

// ---- events -------------------------------------------------------------------------------------
const form = $('#form');
form.addEventListener('input', (e) => {
  const el = e.target;
  const path = el.dataset.path;
  if (!path) return;
  const { values } = current();
  if (el.dataset.day) {
    const group = [...form.querySelectorAll(`input[data-path="${path}"]`)].filter((c) => c.checked).map((c) => c.value);
    setPath(values, path.split('.'), DAYS.filter((d) => group.includes(d)));
  } else {
    setPath(values, path.split('.'), el.value);
  }
  update();
});
form.addEventListener('focusout', (e) => { if (e.target.dataset?.path) { touched.add(e.target.dataset.path); update(); } });
form.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { schema, values } = current();
  const path = btn.dataset.path;
  const rowsField = schema.fields.find((x) => x.key === path);
  const arr = getPath(values, [path]);
  if (btn.dataset.action === 'add-row') {
    arr.push(defaultsFor(rowsField.fields));
    renderForm(); update();
    const rows = form.querySelectorAll(`[data-path^="${path}."]`);
    const last = [...rows].filter((r) => r.dataset.path.startsWith(`${path}.${arr.length - 1}.`))[0];
    last?.focus();
  } else if (btn.dataset.action === 'remove-row') {
    arr.splice(+btn.dataset.index, 1);
    if (!arr.length) arr.push(defaultsFor(rowsField.fields));
    renderForm(); update();
    form.querySelector(`[data-action="add-row"][data-path="${path}"]`)?.focus();
  }
});

$('#type').addEventListener('change', (e) => {
  state.type = e.target.value;
  state.values[state.type] ||= defaultsFor(byId(state.type).fields);
  touched.clear(); showAll = false;
  renderForm(); update();
});

document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
  if (!r.checked) return;
  if (r.value === 'graph' && !state.graph.entities.length) {
    state.graph.entities = [{ type: state.type, values: structuredClone(state.values[state.type]) }];
    state.graph.active = 0;
  }
  state.mode = r.value;
  touched.clear(); showAll = false;
  renderAll();
}));

$('#graph-base').addEventListener('input', (e) => { state.graph.base = e.target.value; update(); });
$('#entity-add').addEventListener('click', () => {
  const type = $('#entity-type').value;
  state.graph.entities.push({ type, values: defaultsFor(byId(type).fields) });
  state.graph.active = state.graph.entities.length - 1;
  renderAll();
});
$('#entity-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const i = +btn.dataset.i;
  const g = state.graph;
  const a = btn.dataset.action;
  if (a === 'pick') g.active = i;
  if (a === 'remove') {
    g.entities.splice(i, 1);
    if (!g.entities.length) { state.mode = 'single'; }
    g.active = Math.min(g.active, Math.max(g.entities.length - 1, 0));
  }
  if (a === 'up' || a === 'down') {
    const j = a === 'up' ? i - 1 : i + 1;
    [g.entities[i], g.entities[j]] = [g.entities[j], g.entities[i]];
    g.active = j;
  }
  touched.clear();
  renderAll();
  document.querySelector(`#entity-list [data-action="${a === 'remove' ? 'pick' : a}"][data-i="${Math.min(a === 'up' || a === 'down' ? g.active : i, g.entities.length - 1)}"]`)?.focus();
});

$('#template').addEventListener('change', (e) => {
  const patch = applyTemplate(e.target.value);
  e.target.value = '';
  if (!patch) return;
  patchState(patch);
  touched.clear(); showAll = false;
  renderAll();
});

$('#wrap').addEventListener('change', (e) => { state.wrap = e.target.checked; update(); });
$('#lang').addEventListener('change', (e) => { state.lang = e.target.value; renderAll(); });

$('#copy').addEventListener('click', async () => {
  showAll = true;
  update();
  if (await copyText($('#out').textContent)) flash($('#copy'), 'out.copied');
});
$('#share').addEventListener('click', async () => {
  history.replaceState(null, '', toHash(state));
  if (await copyText(location.href)) flash($('#share'), 'out.shared');
});
$('#download').addEventListener('click', () => {
  showAll = true;
  const json = update();
  const name = state.mode === 'graph' ? 'graph' : state.type;
  const a = h('a', { download: `schema-${name}.json`, href: URL.createObjectURL(new Blob([toJson(json)], { type: 'application/json' })) });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
});

// import dialog
const dlg = $('#import-dialog');
$('#import-open').addEventListener('click', () => { $('#import-msg').textContent = ''; dlg.showModal(); $('#import-text').focus(); });
$('#import-cancel').addEventListener('click', () => dlg.close());
$('#import-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('#import-msg');
  const text = $('#import-text').value;
  if (!text.trim()) { msg.textContent = T('import.empty'); return; }
  const res = parseInput(text);
  const invalid = res.errors.find((x) => x.startsWith('invalid-json'));
  const patch = res.nodes.length ? toStatePatch(res.nodes) : null;
  if (!patch) { msg.textContent = invalid ? T('import.invalid', { detail: invalid.replace('invalid-json: ', '') }) : T('import.none'); return; }
  patchState(patch);
  touched.clear(); showAll = false;
  renderAll();
  const count = patch.mode === 'graph' ? patch.graph.entities.length : 1;
  announce(T('import.ok', { count, source: T('import.source.' + res.source) }));
  dlg.close();
});

function announce(text) { $('#status').textContent = text; }

// theme
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
$('#theme').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set(THEME_KEY, next);
});

window.addEventListener('hashchange', () => {
  const shared = fromHash(location.hash);
  if (shared) { patchState(shared); renderAll(); }
});

renderAll();
