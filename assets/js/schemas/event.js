import {
  CONTEXT, clean, lines, one, num, f, defined, schemaUrl, bare, addressFields, buildAddress, parseAddress,
  joinLines, str, asArray, isEmpty,
} from './util.js';

export const STATUS = ['EventScheduled', 'EventCancelled', 'EventMovedOnline', 'EventPostponed', 'EventRescheduled'];
export const MODES = ['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode'];
const addrKey = { street: 'streetAddress', city: 'addressLocality', region: 'addressRegion', postal: 'postalCode', country: 'addressCountry' };

const fields = [
  f('name', 'Event name', 'text', { required: true, ld: 'name' }),
  f('startDate', 'Start date', 'text', { required: true, format: 'date', ld: 'startDate', placeholder: '2026-09-01T18:00:00+06:00' }),
  f('endDate', 'End date', 'text', { format: 'date', ld: 'endDate' }),
  f('eventStatus', 'Event status', 'select', { options: STATUS, ld: 'eventStatus' }),
  f('attendanceMode', 'Attendance mode', 'select', { options: MODES, ld: 'eventAttendanceMode' }),
  f('placeName', 'Venue name', 'text', {
    ld: 'location.name', check: (v, a) => (!v && a.attendanceMode !== 'OnlineEventAttendanceMode' ? 'A venue is required for in-person events.' : ''),
  }),
  ...addressFields.map((a) => ({ ...a, ld: 'location.address.' + addrKey[a.key] })),
  f('virtualUrl', 'Online event URL', 'url', {
    ld: 'location.url', check: (v, a) => (!v && a.attendanceMode && a.attendanceMode !== 'OfflineEventAttendanceMode' ? 'An online URL is required for online or mixed events.' : ''),
  }),
  f('images', 'Image URLs (one per line)', 'list', { format: 'url', ld: 'image' }),
  f('description', 'Description', 'textarea', { ld: 'description' }),
  f('organizerName', 'Organizer name', 'text', { ld: 'organizer' }),
  f('organizerUrl', 'Organizer URL', 'url'),
  f('performerName', 'Performer name', 'text', { ld: 'performer' }),
  f('offerUrl', 'Tickets URL', 'url', { ld: 'offers.url' }),
  f('price', 'Ticket price', 'number', { ld: 'offers.price' }),
  f('currency', 'Currency (ISO 4217)', 'text', { format: 'currency', ld: 'offers.priceCurrency' }),
  f('availability', 'Ticket availability', 'select', { options: ['InStock', 'SoldOut', 'PreOrder', 'LimitedAvailability'], ld: 'offers.availability' }),
  f('validFrom', 'Tickets on sale from', 'text', { format: 'date', ld: 'offers.validFrom' }),
];

export default {
  id: 'event',
  label: 'Event',
  types: ['Event'],
  docs: 'https://developers.google.com/search/docs/appearance/structured-data/event',
  fields,
  rules: {
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'eventAttendanceMode', 'description', 'eventStatus', 'image', 'organizer', 'performer', 'offers', 'offers.url', 'offers.price', 'offers.priceCurrency', 'offers.availability', 'offers.validFrom'],
  },
  build(v) {
    const mode = v.attendanceMode || '';
    const place = mode === 'OnlineEventAttendanceMode' ? {} : clean({ '@type': 'Place', name: v.placeName, address: buildAddress(v) });
    const virtual = mode === '' || mode === 'OfflineEventAttendanceMode' ? {} : clean({ '@type': 'VirtualLocation', url: v.virtualUrl });
    const location = [place, virtual].filter((x) => !isEmpty(x));
    return clean({
      '@context': CONTEXT,
      '@type': 'Event',
      name: v.name,
      startDate: v.startDate,
      endDate: v.endDate,
      eventStatus: schemaUrl(v.eventStatus),
      eventAttendanceMode: schemaUrl(mode) || undefined,
      location: one(location),
      image: one(lines(v.images)),
      description: v.description,
      organizer: { '@type': 'Organization', name: v.organizerName, url: v.organizerUrl },
      performer: { '@type': 'Person', name: v.performerName },
      offers: {
        '@type': 'Offer', url: v.offerUrl, price: num(v.price), priceCurrency: v.currency,
        availability: schemaUrl(v.availability), validFrom: v.validFrom,
      },
    });
  },
  parse(n) {
    const locs = asArray(n.location);
    const place = locs.find((l) => l['@type'] === 'Place' || l.address) || {};
    const virtual = locs.find((l) => l['@type'] === 'VirtualLocation') || {};
    const o = asArray(n.offers)[0] || {};
    return defined({
      name: str(n.name), startDate: str(n.startDate), endDate: str(n.endDate),
      eventStatus: bare(n.eventStatus),
      attendanceMode: n.eventAttendanceMode ? bare(n.eventAttendanceMode) : undefined,
      placeName: str(place.name), ...parseAddress(place.address), virtualUrl: str(virtual.url),
      images: joinLines(n.image), description: str(n.description),
      organizerName: str(asArray(n.organizer)[0]?.name), organizerUrl: str(asArray(n.organizer)[0]?.url),
      performerName: str(asArray(n.performer)[0]?.name),
      offerUrl: str(o.url), price: str(o.price), currency: str(o.priceCurrency),
      availability: bare(o.availability), validFrom: str(o.validFrom),
    });
  },
};
