/* =========================================================
   PROJECT DATA — Riddhi Siddhi Apartment
   Traced from the brochure "2nd to 5th floor plan".
   Plan units: metres. x → right, y → toward the 11 m road (front).
   In the product this file is what we publish per project; the
   3D viewer and the sales console both read it.
   ========================================================= */
export const PROJECT = { id: 'riddhi-siddhi', name: 'Riddhi Siddhi Apartment', location: 'Sector 3, Pushpak Nagar, Navi Mumbai', wings: ['A', 'B'] };
export const FH = 3.0, NF = 7, MIRX = 43.12, CX = 21.56, CY = 12.65;
export const BLOCKS = [
  { r: [1.0, 0.3, 8.8, 16.5], w: 'A' }, { r: [8.8, 0.7, 19.9, 7.7], w: 'A' }, { r: [8.8, 7.7, 16.3, 16.5], w: 'A' }, { r: [1.0, 16.5, 21.56, 25.0], w: 'A' },
  { r: [34.32, 0.3, 42.12, 16.5], w: 'B' }, { r: [23.22, 0.7, 34.32, 7.7], w: 'B' }, { r: [26.82, 7.7, 34.32, 16.5], w: 'B' }, { r: [21.56, 16.5, 42.12, 25.0], w: 'B' }
];
// rooms: [name, kind, x0, y0, x1, y1, brochure size]
const FLATS_A = {
  '01': { bhk: 1, view: 'Garden court', door: [11.37, 14.85], rooms: [['W.C.', 'W', 11.86, 7.84, 13.03, 8.72, "4'0\" × 3'0\""], ['Bedroom', 'B', 13.03, 7.84, 16.17, 10.49, "10'0\" × 9'0\""], ['Kitchen', 'K', 13.03, 10.49, 16.17, 12.45, "10'0\" × 6'6\""], ['Toilet', 'T', 11.17, 11.37, 13.03, 12.45, "6'0\" × 4'0\""], ['Living', 'L', 11.37, 12.45, 15.48, 15.29, "13'0\" × 9'0\""]] },
  '02': { bhk: 1, view: 'Rear open side', door: [13.67, 6.24], rooms: [['Living', 'L', 13.13, 1.67, 15.88, 6.24, "9'0\" × 14'0\""], ['Bedroom', 'B', 15.88, 0.98, 18.82, 4.21, "9'0\" × 10'6\""], ['W.C.', 'W', 18.82, 2.72, 19.8, 4.21, "3'0\" × 5'0\""], ['Passage', 'E', 15.88, 4.21, 16.95, 5.68, ''], ['Toilet', 'T', 16.95, 4.21, 18.91, 5.68, "6'3\" × 4'0\""], ['Kitchen', 'K', 15.88, 5.68, 18.23, 7.64, "7'0\" × 6'6\""]] },
  '03': { bhk: 1, view: 'Rear open side', door: [12.74, 6.27], rooms: [['W.C.', 'W', 4.41, 2.75, 5.39, 4.31, "3'0\" × 5'0\""], ['Bedroom', 'B', 5.39, 1.08, 8.23, 4.31, "9'0\" × 10'6\""], ['Kitchen', 'K', 8.23, 1.08, 10.29, 4.31, "6'6\" × 10'6\""], ['Toilet', 'T', 9.02, 4.31, 10.29, 6.08, "4'0\" × 6'0\""], ['Living', 'L', 10.29, 1.76, 13.13, 6.27, "9'3\" × 14'0\""]] },
  '04': { bhk: 1, view: 'Side & rear', door: [7.74, 8.6], rooms: [['W.C.', 'W', 2.84, 0.39, 4.41, 1.08, "5'0\" × 3'0\""], ['Bedroom', 'B', 1.08, 1.08, 4.41, 4.21, "10'6\" × 9'0\""], ['Kitchen', 'K', 1.08, 4.21, 4.41, 6.27, "10'6\" × 6'6\""], ['Toilet', 'T', 4.41, 4.31, 5.69, 6.27, "4'0\" × 6'0\""], ['Living', 'L', 3.43, 6.27, 7.74, 9.02, "14'0\" × 9'0\""]] },
  '05': { bhk: 1, view: 'Side open', door: [8.72, 9.45], rooms: [['Living', 'L', 4.41, 9.02, 8.72, 11.56, "14'6\" × 9'0\""], ['Kitchen', 'K', 1.96, 11.56, 5.29, 13.72, "10'6\" × 6'6\""], ['Toilet', 'T', 5.29, 11.56, 7.45, 13.13, "7'0\" × 4'0\""], ['W.C.', 'W', 5.29, 13.13, 6.37, 14.7, "3'0\" × 5'0\""], ['Bedroom', 'B', 1.96, 13.72, 5.29, 16.46, "10'6\" × 9'0\""]] },
  '06': { bhk: 2, view: 'Road & side corner', door: [8.23, 18.9], rooms: [['Bedroom 2', 'B', 1.08, 16.56, 4.51, 19.4, "11'0\" × 9'0\""], ['Toilet', 'T', 4.51, 16.56, 5.8, 18.42, "4'6\" × 6'0\""], ['Toilet', 'T', 5.8, 16.56, 7.15, 18.42, "4'6\" × 6'0\""], ['Entry', 'E', 4.51, 18.42, 8.23, 19.4, ''], ['Bedroom 1', 'B', 1.08, 19.4, 4.21, 22.44, "10'6\" × 9'0\""], ['Dining', 'D', 4.21, 19.4, 5.49, 22.44, "9'0\" × 4'0\""], ['Living', 'L', 5.49, 19.4, 8.23, 24.11, "9'0\" × 15'0\""], ['Kitchen', 'K', 3.04, 22.44, 5.49, 24.99, "7'0\" × 8'6\""]] },
  '07': { bhk: 1, view: 'Road facing', door: [10.3, 19.31], rooms: [['Living', 'L', 8.23, 19.31, 11.07, 24.21, "9'0\" × 15'0\""], ['Toilet', 'T', 11.07, 19.5, 12.35, 21.27, "4'0\" × 7'0\""], ['Passage', 'E', 11.07, 21.27, 13.13, 22.15, ''], ['Kitchen', 'K', 11.07, 22.15, 13.13, 24.99, "6'6\" × 10'6\""], ['Bedroom', 'B', 13.13, 21.27, 15.88, 24.99, "9'0\" × 10'6\""], ['W.C.', 'W', 14.9, 20.09, 15.88, 21.27, "3'0\" × 5'0\""]] },
  '08': { bhk: 1, view: 'Road facing', door: [15.97, 18.5], rooms: [['Entry', 'E', 15.97, 17.93, 17.05, 19.01, ''], ['Bath', 'T', 17.05, 17.93, 18.33, 19.01, "4'0\" × 4'6\""], ['W.C.', 'W', 18.33, 17.25, 19.21, 18.52, "3'0\" × 4'0\""], ['Living', 'L', 15.97, 19.01, 18.72, 23.72, "9'0\" × 14'0\""], ['Passage', 'E', 18.72, 18.52, 19.31, 20.48, ''], ['Kitchen', 'K', 19.31, 17.93, 21.56, 20.48, "7'3\" × 8'0\""], ['Bedroom', 'B', 18.82, 20.48, 21.56, 23.72, "9'0\" × 10'6\""]] }
};
export const COMMON_A = [[8.82, 6.24, 10.58, 18.13], [7.74, 6.24, 15.88, 7.64], [7.74, 7.64, 8.82, 9.02], [8.23, 18.13, 15.97, 19.31], [10.58, 15.29, 15.97, 18.13]];
export const CORE_A = [[10.68, 15.39, 12.45, 17.35], [12.65, 15.39, 15.88, 18.13]];

export const mx = x => MIRX - x;
function mirrorRoom(r) { return [r[0], r[1], mx(r[4]), r[3], mx(r[2]), r[5], r[6]]; }
export const FLATS = {};
for (const n in FLATS_A) {
  const f = FLATS_A[n];
  FLATS['A' + n] = { wing: 'A', n, ...f };
  FLATS['B' + n] = { wing: 'B', n, bhk: f.bhk, view: f.view, door: [mx(f.door[0]), f.door[1]], rooms: f.rooms.map(mirrorRoom) };
}
export const COMMON = COMMON_A.concat(COMMON_A.map(c => [mx(c[2]), c[1], mx(c[0]), c[3]]));
function ftIn(s) { const m = s.match(/(\d+)'(\d+)"\s*×\s*(\d+)'(\d+)"/); if (!m) return 0; return (+m[1] + m[2] / 12) * (+m[3] + m[4] / 12); }
for (const k in FLATS) { const f = FLATS[k]; f.carpet = Math.round(f.rooms.reduce((a, r) => a + ftIn(r[6]), 0) / 5) * 5; }

export function unitId(w, fl, n) { return `${w}-${fl}${n}`; }
/** Every flat in the project: [{ id: 'A-506', key: 'A06', wing: 'A', floor: 5, n: '06' }, …] */
export function allUnits() {
  const out = [];
  for (const w of PROJECT.wings) for (let fl = 1; fl <= NF; fl++) for (const n of Object.keys(FLATS_A).sort()) out.push({ id: unitId(w, fl, n), key: w + n, wing: w, floor: fl, n });
  return out;
}
