// Ready-made starting points. Values are merged over each schema's defaults when applied.
import { byId } from './schemas/index.js';
import { defaultsFor } from './schemas/util.js';

const hours = (days, opens, closes) => ({ days, opens, closes });
const SAT_THU = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/** @typedef {{id: string, title: {en: string, bn: string}, mode: 'single'|'graph', type?: string, values?: Object, graph?: {base: string, entities: {type: string, values: Object}[]}}} Template */

/** @type {Template[]} */
export const TEMPLATES = [
  {
    id: 'blog-post', title: { en: 'Blog post', bn: 'ব্লগ পোস্ট' }, mode: 'single', type: 'article',
    values: {
      type: 'BlogPosting', headline: 'How to Audit Canonical Tags in 10 Minutes', url: 'https://example.com/blog/audit-canonical-tags/',
      images: 'https://example.com/images/canonical-audit.jpg', datePublished: '2026-03-05T09:00:00+06:00', dateModified: '2026-03-12T14:30:00+06:00',
      authorName: 'Your Name', authorUrl: 'https://example.com/about/', publisherName: 'Example Studio', publisherLogo: 'https://example.com/logo.png',
      description: 'A quick checklist for finding and fixing canonical tag problems.',
    },
  },
  {
    id: 'local-shop-dhaka', title: { en: 'Local shop in Dhaka', bn: 'ঢাকার স্থানীয় দোকান' }, mode: 'single', type: 'localbusiness',
    values: {
      businessType: 'BookStore', name: 'Banani Corner Books', images: 'https://example.com/shop.jpg', url: 'https://example.com/',
      telephone: '+880 1700-000000', priceRange: '$$', street: 'House 12, Road 11, Banani', city: 'Dhaka', region: 'Dhaka Division',
      postal: '1213', country: 'BD', lat: '23.7937', lng: '90.4066',
      hours: [hours(SAT_THU, '10:00', '21:00'), hours(['Friday'], '15:00', '21:00')],
      sameAs: 'https://www.facebook.com/example\nhttps://www.instagram.com/example',
    },
  },
  {
    id: 'saas-product', title: { en: 'SaaS product', bn: 'SaaS পণ্য' }, mode: 'single', type: 'software',
    values: {
      type: 'WebApplication', name: 'RankPilot', category: 'BusinessApplication', os: 'Web', price: '19', currency: 'USD',
      url: 'https://example.com/', description: 'Track keyword rankings and technical SEO issues in one dashboard.',
      ratingValue: '4.7', ratingCount: '312',
    },
  },
  {
    id: 'faq', title: { en: 'FAQ page', bn: 'FAQ পেজ' }, mode: 'single', type: 'faq',
    values: { items: [
      { q: 'How long does a technical SEO audit take?', a: 'Most audits take one to two weeks depending on site size.' },
      { q: 'Do you work with small businesses?', a: 'Yes. Packages start at a fixed price for sites under 100 pages.' },
    ] },
  },
  {
    id: 'product', title: { en: 'Online store product', bn: 'অনলাইন স্টোরের পণ্য' }, mode: 'single', type: 'product',
    values: {
      name: 'Handwoven Jamdani Scarf', images: 'https://example.com/images/scarf.jpg', description: 'A lightweight scarf woven in Narayanganj.',
      brand: 'Example Weaves', sku: 'JAM-001', price: '45', currency: 'USD', availability: 'InStock', offerUrl: 'https://example.com/shop/jamdani-scarf/',
      ratingValue: '4.8', reviewCount: '56',
    },
  },
  {
    id: 'event', title: { en: 'Meetup event', bn: 'মিটআপ ইভেন্ট' }, mode: 'single', type: 'event',
    values: {
      name: 'Dhaka SEO Meetup', startDate: '2026-09-12T17:00:00+06:00', endDate: '2026-09-12T20:00:00+06:00', eventStatus: 'EventScheduled',
      attendanceMode: 'OfflineEventAttendanceMode', placeName: 'Example Co-working Space', street: 'Road 27, Gulshan', city: 'Dhaka', country: 'BD',
      images: 'https://example.com/meetup.jpg', description: 'An evening of talks on technical SEO.', organizerName: 'Dhaka SEO Community', organizerUrl: 'https://example.com/',
      price: '0', currency: 'BDT', availability: 'InStock', offerUrl: 'https://example.com/tickets/',
    },
  },
  {
    id: 'recipe', title: { en: 'Recipe', bn: 'রেসিপি' }, mode: 'single', type: 'recipe',
    values: {
      name: 'Chicken Khichuri', images: 'https://example.com/khichuri.jpg', description: 'A comforting one-pot rice and lentil dish.',
      authorName: 'Your Name', datePublished: '2026-02-01', prepTime: 'PT15M', cookTime: 'PT40M', totalTime: 'PT55M', yield: '4 servings',
      category: 'Main course', cuisine: 'Bangladeshi', keywords: 'khichuri, chicken, rice', calories: '420 calories',
      ingredients: '1 cup rice\n1/2 cup moong dal\n500 g chicken\n2 onions, sliced',
      instructions: [{ name: 'Prepare', text: 'Wash the rice and dal.' }, { name: 'Cook', text: 'Cook everything together until soft.' }],
      ratingValue: '4.6', ratingCount: '88',
    },
  },
  {
    id: 'job', title: { en: 'Job posting', bn: 'চাকরির বিজ্ঞপ্তি' }, mode: 'single', type: 'jobposting',
    values: {
      title: 'Junior Technical SEO Specialist', description: '<p>Help audit and improve large websites.</p>', datePosted: '2026-04-01', validThrough: '2026-05-01',
      employmentType: 'FULL_TIME', orgName: 'Example Studio', orgUrl: 'https://example.com/', street: 'Road 5, Dhanmondi', city: 'Dhaka', country: 'BD',
      salaryMin: '30000', salaryMax: '45000', salaryCurrency: 'BDT', salaryUnit: 'MONTH', directApply: 'true',
    },
  },
  {
    id: 'course', title: { en: 'Online course', bn: 'অনলাইন কোর্স' }, mode: 'single', type: 'course',
    values: {
      name: 'Technical SEO Fundamentals', description: 'Learn crawling, indexing and site architecture from scratch.', providerName: 'Example Academy',
      providerUrl: 'https://example.com/', url: 'https://example.com/courses/technical-seo/', language: 'en', courseMode: 'Online',
    },
  },
  {
    id: 'video', title: { en: 'Video', bn: 'ভিডিও' }, mode: 'single', type: 'video',
    values: {
      name: 'Canonical Tags Explained', description: 'A five minute walkthrough.', thumbnails: 'https://example.com/thumb.jpg',
      uploadDate: '2026-03-20T10:00:00+06:00', embedUrl: 'https://example.com/embed/canonical', duration: 'PT5M12S',
    },
  },
  {
    id: 'blog-graph', title: { en: 'Blog site (graph)', bn: 'ব্লগ সাইট (গ্রাফ)' }, mode: 'graph',
    graph: {
      base: 'https://example.com/',
      entities: [
        { type: 'organization', values: { name: 'Example Studio', url: 'https://example.com/', logo: 'https://example.com/logo.png', sameAs: 'https://github.com/example' } },
        { type: 'website', values: { name: 'Example Studio Blog', url: 'https://example.com/', language: 'en' } },
        { type: 'webpage', values: { name: 'How to Audit Canonical Tags', url: 'https://example.com/blog/audit-canonical-tags/', language: 'en' } },
        { type: 'breadcrumb', values: { items: [{ name: 'Home', url: 'https://example.com/' }, { name: 'Blog', url: 'https://example.com/blog/' }, { name: 'Audit Canonical Tags', url: '' }] } },
        { type: 'person', values: { name: 'Your Name', url: 'https://example.com/about/' } },
        { type: 'article', values: { type: 'BlogPosting', headline: 'How to Audit Canonical Tags in 10 Minutes', images: 'https://example.com/images/canonical-audit.jpg', datePublished: '2026-03-05T09:00:00+06:00', dateModified: '2026-03-12T14:30:00+06:00' } },
      ],
    },
  },
  {
    id: 'shop-graph', title: { en: 'Local shop site (graph)', bn: 'স্থানীয় দোকানের সাইট (গ্রাফ)' }, mode: 'graph',
    graph: {
      base: 'https://example.com/',
      entities: [
        { type: 'localbusiness', values: { businessType: 'Store', name: 'Banani Corner Books', url: 'https://example.com/', telephone: '+880 1700-000000', street: 'House 12, Road 11, Banani', city: 'Dhaka', country: 'BD', lat: '23.7937', lng: '90.4066', images: 'https://example.com/shop.jpg' } },
        { type: 'website', values: { name: 'Banani Corner Books', url: 'https://example.com/' } },
        { type: 'webpage', values: { name: 'Home', url: 'https://example.com/' } },
      ],
    },
  },
];

/** Returns a state patch for a template id, or null when unknown. */
export function applyTemplate(id) {
  const tpl = TEMPLATES.find((t) => t.id === id);
  if (!tpl) return null;
  const withDefaults = (type, values) => ({ ...defaultsFor(byId(type).fields), ...values });
  if (tpl.mode === 'graph') {
    return {
      mode: 'graph',
      graph: { base: tpl.graph.base, active: 0, entities: tpl.graph.entities.map((e) => ({ type: e.type, values: withDefaults(e.type, e.values) })) },
    };
  }
  return { mode: 'single', type: tpl.type, values: { [tpl.type]: withDefaults(tpl.type, tpl.values) } };
}
