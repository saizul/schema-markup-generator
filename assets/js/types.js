// JSDoc type definitions shared across modules. This file has no runtime code.

/**
 * @typedef {'text'|'url'|'email'|'textarea'|'select'|'list'|'rows'|'days'|'time'|'number'} FieldType
 */

/**
 * @typedef {Object} Field
 * @property {string} key            Key in the values object.
 * @property {string} label          English label (translated through i18n when available).
 * @property {FieldType} type
 * @property {boolean} [required]    Required by Google (or by the form to build anything useful).
 * @property {string} [format]       Validation format: url, date, duration, time, email, number, currency.
 * @property {string} [ld]           JSON-LD property path this field feeds, used to place validator messages.
 * @property {string} [help]
 * @property {string} [placeholder]
 * @property {string[]} [options]    For select fields.
 * @property {string} [default]
 * @property {Field[]} [fields]      Sub-fields for rows.
 * @property {string} [itemLabel]    Noun for one row, e.g. "question".
 * @property {(value: any, values: Object) => string} [check] Extra validation; returns a message or "".
 */

/**
 * @typedef {Object} Rules
 * @property {string[]} required     Paths that must be present (Google "required").
 * @property {string[]} recommended  Paths that should be present (Google "recommended").
 * @property {string[][]} [oneOf]    Groups where at least one path must be present.
 * @property {string[]} [info]       Informational notice codes.
 * @property {(node: Object) => LintIssue[]} [extra]
 */

/**
 * @typedef {Object} LintIssue
 * @property {'error'|'warning'|'info'} severity
 * @property {string} code           missing-required | missing-recommended | one-of | or a custom code.
 * @property {string} [path]
 * @property {string[]} [paths]
 */

/**
 * @typedef {Object} SchemaModule
 * @property {string} id
 * @property {string} label
 * @property {string[]} types        schema.org @type values this module understands.
 * @property {string} [note]
 * @property {string} [docs]         Link to the Google documentation page.
 * @property {Field[]} fields
 * @property {Rules} rules
 * @property {(values: Object) => Object} build   Pure: values to JSON-LD node (with @context).
 * @property {(node: Object) => Object} parse     Pure: JSON-LD node to (partial) values.
 */

/**
 * @typedef {Object} GraphEntity
 * @property {string} type           Schema module id.
 * @property {Object} values
 */

/**
 * @typedef {Object} AppState
 * @property {'en'|'bn'} lang
 * @property {'single'|'graph'} mode
 * @property {string} type
 * @property {Object<string, Object>} values   Values per schema id (single mode).
 * @property {{base: string, entities: GraphEntity[], active: number}} graph
 * @property {boolean} wrap
 * @property {boolean} minify
 * @property {'jsonld'|'microdata'|'rdfa'} format  Output syntax.
 */
export {};
