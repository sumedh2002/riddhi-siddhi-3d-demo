/* =========================================================
   PREMIUM — photo-quality views of a flat at eye level.
   Made with an AI image model from eye-level shots of the flat's own
   3D model, so walls, windows, doors and furniture stay where the plan
   puts them. Images live in /premium/<flat>/ next to the page.
   Shot names: <view>-<time>-<finish>, e.g. living-day-wood.
   ========================================================= */
export const PREMIUM_FINISHES = { tile: 'Vitrified tile', wood: 'Wooden', marble: 'Italian marble' };
export const PREMIUM = {
  A06: {
    dir: 'premium/a-506/',
    views: [
      { id: 'living', name: 'Living room', room: 6, shots: { 'day-tile': 'living-day-tile', 'day-wood': 'living-day-wood', 'day-marble': 'living-day-marble', 'evening-tile': 'living-evening-tile' } },
      { id: 'dining', name: 'Dining', room: 5, shots: { 'day-tile': 'dining-day' } },
      { id: 'bed1', name: 'Bedroom 1', room: 4, shots: { 'day-tile': 'bedroom1-day', 'evening-tile': 'bedroom1-evening' } },
      { id: 'bed2', name: 'Bedroom 2', room: 0, shots: { 'day-tile': 'bedroom2-day' } },
      { id: 'kitchen', name: 'Kitchen', room: 7, shots: { 'day-tile': 'kitchen-day' } }
    ]
  }
};
/** the shot to show for a view, time and finish (falls back to what exists) */
export function premiumShot(view, tod, fin) {
  const s = view.shots;
  for (const k of [`${tod}-${fin}`, `${tod}-tile`, `day-${fin}`, 'day-tile']) if (s[k]) { const [t, f] = k.split('-'); return { file: s[k], tod: t, fin: f }; }
  return null;
}
