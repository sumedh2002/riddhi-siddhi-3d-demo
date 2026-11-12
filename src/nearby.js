/* =========================================================
   NEARBY — what is around the project, for the neighbourhood map.
   Published per project, like project-data.js.

   SITE is where the centre of the building stands, and which way its front (the 11 m road side) faces
   as a compass bearing. The Google Maps pin for the plot is plus code X3FF+VF, at the street corner;
   the building's centre is set about 22 m back from it and the front faces south-west, both read off
   the satellite view — nudge lat / lng / heading here if the building does not sit square on its plot.
   PLACES are real places with their names and positions as listed on
   Google Maps (checked November 2026). Distances are worked out here,
   in a straight line from the plot — edit the list freely, nothing else
   needs to change.
   ========================================================= */
import { PROJECT } from './project-data.js';
import { distM } from './mapground.js';

export const SITE = { lat: 18.97488, lng: 73.07362, heading: 230, name: PROJECT.short || PROJECT.name.replace(/\s+Apartments?$/i, ''), area: 'Sector 3, Pushpak Nagar' };
/** Distance rings, in km. The last one is also how far the map looks for places. */
export const RADII = [0.5, 1, 2, 5];

const ic = d => d; // 24 × 24 line icons, drawn white on the category colour
export const CATS = {
  hospital: { label: 'Healthcare', one: 'Healthcare', color: '#DC2626', icon: ic('<path d="M12 5v14M5 12h14"/>') },
  school: { label: 'Schools', one: 'School', color: '#7C3AED', icon: ic('<path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11.5V15c0 1 2.3 2.5 5 2.5s5-1.5 5-2.5v-3.5"/>') },
  airport: { label: 'Airport', one: 'Airport', color: '#0369A1', icon: ic('<path d="M12 3c.9 0 1.5 1 1.5 2.3V9l7 4v2l-7-2v4l2 1.6V20L12 19l-3.5 1v-1.400l2-1.600v-4l-7 2v-2l7-4V5.300C10.500 4 11.100 3 12 3z"/>') },
  rail: { label: 'Railway & metro', one: 'Station', color: '#2563EB', icon: ic('<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10.500h12M9 16l-2.500 4M15 16l2.500 4M9.500 13h.010M14.500 13h.010"/>') },
  bus: { label: 'Bus stops', one: 'Bus stop', color: '#0F766E', icon: ic('<rect x="5" y="4" width="14" height="13" rx="2.500"/><path d="M5 11h14M8 17v3M16 17v3M8.500 14h.010M15.500 14h.010"/>') },
  bank: { label: 'Banks', one: 'Bank', color: '#92400E', icon: ic('<path d="M4 10l8-5 8 5M6 10v8M10 10v8M14 10v8M18 10v8M3 19h18"/>') },
  shop: { label: 'Shopping', one: 'Shopping', color: '#BE185D', icon: ic('<path d="M5 8h14l-1.200 12H6.200L5 8z"/><path d="M9 8V6.500a3 3 0 0 1 6 0V8"/>') },
  fuel: { label: 'Fuel & EV', one: 'Fuel', color: '#C2410C', icon: ic('<path d="M5 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h11M5 11h9M14 8l3 3v6a1.500 1.500 0 0 0 3 0V9.500L17.500 7"/>') },
  worship: { label: 'Temples', one: 'Place of worship', color: '#A16207', icon: ic('<path d="M12 3v3M8 21V11l4-5 4 5v10M5 21v-6l3-2M19 21v-6l-3-2M3 21h18"/>') },
  park: { label: 'Parks & grounds', one: 'Park', color: '#15803D', icon: ic('<path d="M12 21v-7M12 14c-3.600 0-6-2.400-6-5.500S8.600 3 12 3s6 2.400 6 5.500S15.600 14 12 14z"/>') },
  road: { label: 'Roads', one: 'Road link', color: '#475569', icon: ic('<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.500v3M12 17v3"/>') }
};

// [category, name, latitude, longitude, note?]
const LIST = [
  ['shop', 'Samir Supermarket', 18.97420, 73.07323],
  ['hospital', 'Gauri Medical', 18.97636, 73.07698, 'Medical store'],
  ['bus', 'Pushpaknagar Dapoli', 18.97258, 73.07714],
  ['shop', 'Bhawani Super Market', 18.97306, 73.07776],
  ['bus', 'Pushpak Nagar / Maruti Vajan Kata', 18.96989, 73.07300],
  ['bank', 'IDBI Bank', 18.97951, 73.07470],
  ['worship', 'Shree Vishnu Laxmi Mandir', 18.97956, 73.07517],
  ['hospital', 'Sai Seva Clinic', 18.98082, 73.07378, 'Clinic'],
  ['hospital', 'Gauri Medical & General Stores', 18.98101, 73.07422, 'Medical store'],
  ['worship', 'Datta Mandir', 18.98152, 73.07406],
  ['school', 'Gurukul School', 18.97990, 73.06883],
  ['worship', 'Ranumata Temple', 18.97311, 73.08123],
  ['shop', 'Shree Sai Kirana & General Store', 18.97678, 73.06535],
  ['road', 'Dungi river bridge', 18.97964, 73.06584, 'Uran–Panvel Road'],
  ['hospital', 'Virekha Clinic', 18.96737, 73.08016, 'Clinic'],
  ['hospital', 'Icchapurti Medical & General Stores', 18.97678, 73.06334, 'Medical store'],
  ['park', 'Owale cricket ground', 18.97875, 73.06352],
  ['hospital', 'Metkari Clinic', 18.97704, 73.08972, 'Clinic'],
  ['school', 'Mahatma Phule Arts, Science & Commerce College', 18.97480, 73.09371, 'College'],
  ['bus', 'Karanjade (Vadghar)', 18.98500, 73.09190],
  ['fuel', 'Koreshwar Petroleum', 18.96485, 73.05502, 'Petrol · diesel · CNG'],
  ['school', 'DVK Public School', 18.98586, 73.09382],
  ['school', 'SGT International School, Karanjade', 18.98169, 73.09677],
  ['airport', 'Navi Mumbai International Airport · Terminal 1', 18.98838, 73.05403],
  ['hospital', 'Life Care Hospital', 18.98655, 73.09517, 'Hospital'],
  ['worship', 'Shree Kalbhairav Mandir, Chinchpada', 18.98535, 73.09268],
  ['worship', 'Laxmi Narayan Temple', 18.98782, 73.09452],
  ['shop', 'Reliance SMART Superstore', 18.97749, 73.10041],
  ['school', 'Ved Gruh Public School', 18.97823, 73.10233],
  ['hospital', 'Leo Care Hospital', 18.97803, 73.10262, 'Hospital'],
  ['shop', 'DMart Ready', 18.98117, 73.10273],
  ['hospital', 'Pushpak Multi-speciality Hospital & ICU', 18.98149, 73.10317, 'Hospital'],
  ['bank', 'State Bank of India, Karanjade', 18.97910, 73.10439],
  ['hospital', 'Sukham Hospital, Karanjade', 18.98166, 73.10544, 'Hospital'],
  ['bank', 'ICICI Bank, Karanjade', 18.97283, 73.10999],
  ['park', 'Panvel Municipal Corporation Garden', 18.98936, 73.10818],
  ['park', 'Kailash Uptown Garden', 18.97227, 73.11225],
  ['rail', 'Khandeshwar', 19.00737, 73.09526, 'Railway station'],
  ['rail', 'Targhar', 18.99188, 73.03705, 'Railway station'],
  ['fuel', 'Bharat Petroleum, Panvel', 18.98032, 73.11568, 'Petrol · diesel'],
  ['fuel', 'Tata Power Charging Station', 18.98174, 73.11562, 'EV charging'],
  ['rail', 'Mansarovar', 19.01605, 73.08355, 'Railway station'],
  ['bus', 'Panvel S.T. Bus Stand', 18.99217, 73.11540, 'Bus depot'],
  ['school', "St. Wilfred's School, Ulwe", 18.98191, 73.02844],
  ['school', 'Radcliffe School, Ulwe', 18.97777, 73.02718, 'CBSE school'],
  ['shop', 'Orion Mall, Panvel', 18.99336, 73.11588, 'Mall'],
  ['worship', 'Shree Ballaleshwar Mandir, Panvel', 18.99209, 73.11039],
  ['rail', 'Panvel', 18.99112, 73.12065, 'Railway station']
];
const LOOK = RADII[RADII.length - 1] * 1000 * 1.12; // a little slack past the last ring, so e.g. Panvel station (5.3 km) is still listed
export const PLACES = LIST.map(([c, n, lat, lng, note], i) => ({ id: 'p' + i, c, n, lat, lng, note: note || CATS[c].one, d: distM(SITE, { lat, lng }) }))
  .filter(p => p.d <= LOOK).sort((a, b) => a.d - b.d);
