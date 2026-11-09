/* =========================================================
   PREMIUM — photo-quality 360° walkthrough of a flat.
   Each viewpoint is a 360° panorama (6 cube faces) made with an AI image
   model from 360° renders of the flat's own 3D model, so walls, windows,
   doors and furniture stay where the plan puts them.
   Files: <dir>360/<set>-<face>.jpg (faces n e s w u d), thumbs <dir>360/t-<view>.jpg
   Sets are named <time>-<finish>, e.g. day-tile, day-wood, evening-tile.
   Positions (p, look, at) are plan metres, the same as project-data.js.
   ========================================================= */
export const PREMIUM_FINISHES = { tile: 'Vitrified tile', wood: 'Wooden', marble: 'Italian marble' };
export const FACE_KEYS = ['n', 'e', 's', 'w', 'u', 'd'];
export const PREMIUM = {
  A06: {
    dir: 'premium/a-506/',
    start: 'living',
    views: [
      { id: 'living', name: 'Living room', room: 6, p: [6.9, 21.3], look: [4.4, 20.9], sets: { 'day-tile': 'living' },
        links: [{ to: 'dining', at: [5.0, 19.78] }, { to: 'kitchen', at: [4.85, 22.75] }, { to: 'bed1', at: [3.95, 19.95] }, { to: 'bed2', at: [4.25, 18.91] }] },
      { id: 'dining', name: 'Dining', room: 5, p: [5.0, 19.78], look: [7.6, 22.9], sets: { 'day-tile': 'dining' },
        links: [{ to: 'living', at: [6.9, 21.3] }, { to: 'kitchen', at: [4.85, 22.75] }, { to: 'bed1', at: [3.95, 19.95] }, { to: 'bed2', at: [4.25, 18.91] }] },
      { id: 'bed1', name: 'Bedroom 1', room: 4, p: [3.92, 20.9], look: [1.2, 20.6], sets: { 'day-tile': 'bed1' },
        links: [{ to: 'dining', at: [4.5, 19.95] }] },
      { id: 'bed2', name: 'Bedroom 2', room: 0, p: [4.2, 18.78], look: [1.5, 17.6], sets: { 'day-tile': 'bed2' },
        links: [{ to: 'dining', at: [4.8, 18.91] }] },
      { id: 'kitchen', name: 'Kitchen', room: 7, p: [4.2, 23.4], look: [3.2, 24.6], sets: { 'day-tile': 'kitchen' },
        links: [{ to: 'dining', at: [4.85, 22.15] }] }
    ]
  }
};
/** the panorama to show for a view, time and finish (falls back to what exists) */
export function premiumSet(view, tod, fin) {
  const s = view.sets;
  for (const k of [`${tod}-${fin}`, `${tod}-tile`, `day-${fin}`, 'day-tile']) if (s[k]) { const [t, f] = k.split('-'); return { prefix: s[k], tod: t, fin: f }; }
  return null;
}
