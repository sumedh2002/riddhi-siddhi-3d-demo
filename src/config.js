/* Arch3 cloud settings for this project.
   The publishable key is meant to be public: it can only do what the
   database's security rules allow (read flat statuses; staff changes
   need a signed-in staff account). Never put a secret/service_role key here. */
export const SUPABASE_URL = 'https://cfkkzduvxdqhtvpdtcwq.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_xSXY93bz8TRgnSf7fmxuRg_7ReGhcNf';

/* The map under the 3D building (the project view stands on the real map; zooming out shows what is nearby).
   GOOGLE_MAPS_KEY: a Google Maps Platform browser key with the "Map Tiles API" enabled, restricted to your
   websites (HTTP referrers). With it the ground is Google satellite imagery with road names. Like the
   Supabase key it is visible in the page, which is normal for a browser key: the website restriction
   is what protects it. Never put an unrestricted key here.
   Left empty, the ground is OpenStreetMap, which needs no key (fine for demos and modest traffic).
   MAP_TILES: optional, any other map provider instead: { url: 'https://…/{z}/{x}/{y}.png', credit: '© …', maxZoom: 19 }.
   MAP: set to false to switch the map off and keep the plain surroundings. */
export const GOOGLE_MAPS_KEY = '';
export const MAP_TILES = null;
export const MAP = true;
