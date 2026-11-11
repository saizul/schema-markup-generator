# Schema Markup Generator

[![CI](https://github.com/saizul/schema-markup-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/saizul/schema-markup-generator/actions/workflows/ci.yml) ![JavaScript](https://img.shields.io/badge/JavaScript-ready-blue?logo=javascript&logoColor=white) ![License: MIT](https://img.shields.io/badge/License-MIT-green.svg) [![Live demo](https://img.shields.io/badge/demo-live-8b5cf6)](https://saizul.github.io/schema-markup-generator/)

A free, open-source JSON-LD generator for structured data. Pick a schema type, fill in the form, and get valid
markup that updates as you type. No build step, no dependencies, no tracking: plain HTML, CSS and ES modules.

Made by [Saizul Amin](https://saizul.com), web developer and technical SEO specialist.

## Live demo

Enable GitHub Pages from the **main branch root** (Settings, Pages, "Deploy from a branch", `main` and `/ (root)`).
The included workflow (`.github/workflows/ci.yml`) can also run the tests and deploy with GitHub Actions: choose
"GitHub Actions" as the Pages source instead.

## Features

- **19 schema types**: Article / BlogPosting / NewsArticle, FAQPage, LocalBusiness (opening hours, geo, sameAs),
  Organization, Person, Product (offers, shipping details, return policy, aggregateRating), BreadcrumbList, HowTo, Event, WebSite with SearchAction,
  WebPage, Recipe, JobPosting, Course, VideoObject, SoftwareApplication, Review, Service and Dataset.
- **Combined `@graph` mode**: build Organization + WebSite + WebPage + BreadcrumbList + Article (and more) in one
  document. Entities are linked automatically with `@id` references (WebSite publisher, WebPage isPartOf/breadcrumb,
  Article author/publisher/isPartOf).
- **Built-in checker** based on the Google structured data documentation: required properties are errors,
  recommended ones are warnings, and notes explain retired or restricted rich results. Messages also appear next to
  the related form field.
- **Field validation**: required markers, URL, ISO 8601 date and duration, time, currency, email and number checks.
  Empty fields are omitted from the output.
- **Templates**: "Blog post", "Local shop in Dhaka", "SaaS product", FAQ, product, event, recipe, job, course, video and
  two graph presets.
- **Import**: paste JSON-LD, a `<script>` block, or the full HTML of a page. JSON-LD blocks and basic microdata
  (`itemscope`, `itemtype`, `itemprop`) are extracted and loaded into the form.
- **Microdata and RDFa output**: switch the output format to get the same data as inline HTML markup instead of
  JSON-LD (see [Output formats](#output-formats)).
- **Share**: the form state is stored in the URL hash, so a link restores your work.
- **English and Bangla** interface.
- Copy button, download as `.json`, optional `<script type="application/ld+json">` wrapper, and links to the
  [Google Rich Results Test](https://search.google.com/test/rich-results) and the
  [Schema.org validator](https://validator.schema.org/).
- Dark and light theme (follows `prefers-color-scheme`, with a toggle), responsive layout, keyboard friendly,
  state saved in `localStorage` (failures are ignored).

## Output formats

JSON-LD is the format Google recommends and stays the default. The "Output format" selector next to the copy buttons
converts the generated document to two other syntaxes that search engines read:

| Format | Markup | Download |
| --- | --- | --- |
| JSON-LD | `<script type="application/ld+json">` block | `.json` |
| Microdata | `itemscope`, `itemtype`, `itemprop`, `itemid` | `.html` |
| RDFa | `vocab`, `typeof`, `property`, `resource` (RDFa Lite) | `.html` |

Microdata and RDFa are written as invisible `<meta>` and `<link>` elements inside nested `<div>` blocks, so the snippet
can be pasted anywhere in the page `<body>` (useful for page builders and platforms that strip `<script>` tags):

```html
<div itemscope itemtype="https://schema.org/Article">
  <meta itemprop="headline" content="How to brew tea">
  <link itemprop="image" href="https://example.com/tea.jpg">
  <div itemprop="author" itemscope itemtype="https://schema.org/Person">
    <meta itemprop="name" content="Rahim Uddin">
  </div>
</div>
```

URLs become `<link>` elements and every other value a `<meta>` element. In graph mode each entity is a top-level
block; `@id` values are kept as `itemid` / `resource` and references between entities point at them. "Minify output"
applies to all formats, while the script wrapper only applies to JSON-LD. The conversion lives in
`assets/js/markup.js` (`toMicrodata`, `toRdfa`) and is covered by tests that read the microdata back with the importer.

## Run locally

Use any static file server. ES modules do not load from `file://`.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Tests

The JSON builders, validators, checker, graph wiring, importer, sharing and i18n are pure modules covered by the
Node test runner (Node 20 or newer, no packages needed):

```bash
node --test
```

## Project layout

```
index.html
assets/css/style.css
assets/js/app.js            UI only
assets/js/graph.js          @graph builder
assets/js/lint.js           required / recommended checker
assets/js/extract.js        HTML, JSON-LD and microdata extraction
assets/js/importer.js       pasted markup to form state
assets/js/markup.js         Microdata and RDFa output
assets/js/share.js          URL hash encoding
assets/js/i18n.js           English and Bangla strings
assets/js/templates.js      presets
assets/js/types.js          shared JSDoc types
assets/js/schemas/          one module per schema type, plus util.js and index.js
tests/                      node --test suites
```

## Notes on Google support

Rich result eligibility changes over time. FAQ rich results are limited to well-known government and health sites,
HowTo rich results were discontinued, and the sitelinks search box was retired. The markup stays valid schema.org,
and the checker shows a note for each of these. Always confirm with the Rich Results Test before publishing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Release notes are in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) &copy; Saizul Amin
