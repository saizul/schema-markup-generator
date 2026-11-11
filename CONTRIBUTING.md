# Contributing

Thanks for helping improve the Schema Markup Generator. The project has no build step and no dependencies,
so you only need a text editor and Node.js 20 or newer for the tests.

## Setup

```bash
git clone <your fork>
cd schema-markup-generator
node --test                 # run the unit tests
python3 -m http.server 8080 # or any static server, then open http://localhost:8080
```

## Layout

| Path | Purpose |
| --- | --- |
| `assets/js/schemas/<type>.js` | One module per schema type: `fields`, `rules`, `build`, `parse` |
| `assets/js/schemas/util.js` | Pure helpers and validators shared by the modules |
| `assets/js/graph.js` | `@graph` builder and `@id` wiring |
| `assets/js/lint.js` | Required/recommended property checker |
| `assets/js/extract.js`, `importer.js` | Page HTML and JSON-LD import |
| `assets/js/markup.js` | Microdata and RDFa output built from the JSON-LD document |
| `assets/js/share.js`, `i18n.js`, `templates.js` | URL sharing, translations, presets |
| `assets/js/app.js` | The only file that touches the DOM |
| `tests/` | `node --test` suites |

## Adding a schema type

1. Copy a similar module in `assets/js/schemas/` and give it a unique `id`.
2. Export a default object with:
   - `fields`: form definition. Mark a field `required: true` only when Google requires it. Set `ld` to the
     JSON-LD path the field feeds so checker messages appear next to it.
   - `rules`: `required`, `recommended`, optional `oneOf` and `extra(node)`, taken from the Google documentation page
     linked in `docs`.
   - `build(values)`: pure, returns a node with `@context`. Wrap everything in `clean()` so empty values are omitted.
   - `parse(node)`: reverse of `build`, used by the importer.
3. Register the module in `assets/js/schemas/index.js`.
4. Add tests: an empty form builds `{}`, a filled form builds the expected node, and `parse(build(x))` round trips.
5. If the checker emits a new message code, add it to both languages in `assets/js/i18n.js`.

## Guidelines

- Keep builders pure. They must not read the DOM, `window` or `localStorage`.
- Only emit properties that schema.org or Google documents. Prefer omitting a field over guessing.
- Keep the UI accessible: every control needs a label, and state must not rely on colour alone.
- New UI strings need English and Bangla entries (the i18n test fails if the key sets differ).
- Run `node --test` before opening a pull request and describe the Google documentation your change follows.

## Reporting issues

Please include the schema type, the values you entered (or the share link) and the output you expected.
