import { CONTEXT, clean, lines, one, num, f, joinLines, str } from './util.js';

const fields = [
  f('name', 'Video title', 'text', { required: true, ld: 'name' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('thumbnails', 'Thumbnail URLs (one per line)', 'list', { required: true, format: 'url', ld: 'thumbnailUrl' }),
  f('uploadDate', 'Upload date', 'text', { required: true, format: 'date', ld: 'uploadDate', placeholder: '2026-04-10T09:00:00+06:00' }),
  f('contentUrl', 'Video file URL', 'url', { ld: 'contentUrl' }),
  f('embedUrl', 'Embed URL', 'url', { ld: 'embedUrl' }),
  f('duration', 'Duration (ISO 8601)', 'text', { format: 'duration', ld: 'duration', placeholder: 'PT5M30S' }),
  f('expires', 'Expiry date', 'text', { format: 'date', ld: 'expires' }),
  f('views', 'View count', 'number', { ld: 'interactionStatistic' }),
];

export default {
  id: 'video',
  label: 'VideoObject',
  types: ['VideoObject'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/video',
  fields,
  rules: {
    required: ['name', 'thumbnailUrl', 'uploadDate'],
    oneOf: [['contentUrl', 'embedUrl']],
    recommended: ['description', 'duration', 'expires', 'interactionStatistic'],
  },
  build(v) {
    return clean({
      '@context': CONTEXT,
      '@type': 'VideoObject',
      name: v.name,
      description: v.description,
      thumbnailUrl: one(lines(v.thumbnails)),
      uploadDate: v.uploadDate,
      contentUrl: v.contentUrl,
      embedUrl: v.embedUrl,
      duration: v.duration,
      expires: v.expires,
      interactionStatistic: num(v.views) !== undefined
        ? { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: num(v.views) }
        : undefined,
    });
  },
  parse(n) {
    return {
      name: str(n.name), description: str(n.description), thumbnails: joinLines(n.thumbnailUrl), uploadDate: str(n.uploadDate),
      contentUrl: str(n.contentUrl), embedUrl: str(n.embedUrl), duration: str(n.duration), expires: str(n.expires),
      views: str(n.interactionStatistic?.userInteractionCount),
    };
  },
};
