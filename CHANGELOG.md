# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Product: merchant listing fields for shipping (`offers.shippingDetails` with rate, destination, handling and transit days) and returns (`offers.hasMerchantReturnPolicy` with category, window, country, method and fees), including import support.
- "Minify output" toggle for the copied and downloaded JSON-LD (single line, no whitespace).

### Fixed
- `</script>` inside field text can no longer close the generated script tag early (`</` is escaped as `<\/`).

## [1.0.0]

### Added
- 19 schema types: Article/BlogPosting/NewsArticle, FAQPage, LocalBusiness, Organization, Person, Product,
  BreadcrumbList, HowTo, Event, WebSite with SearchAction, WebPage, Recipe, JobPosting, Course, VideoObject,
  SoftwareApplication, Review, Service and Dataset.
- Combined `@graph` mode with automatic `@id` references between entities.
- Built-in checker for required and recommended properties, with messages placed next to the matching form fields.
- Templates, including "Local shop in Dhaka", "Blog post" and "SaaS product".
- Shareable URL hash that stores the current form state.
- English and Bangla interface.
- Importer for JSON-LD, script blocks and full page HTML (JSON-LD plus basic microdata).
- Copy, download as `.json`, and optional `<script type="application/ld+json">` wrapper.
- Dark and light theme, saved state in `localStorage`, keyboard and screen reader friendly form.
- Test suite for the pure builders (`node --test`) and a GitHub Actions workflow that tests and deploys to Pages.
