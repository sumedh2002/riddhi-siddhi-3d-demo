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
/* ESRI_KEY: an ArcGIS Location Platform API key (basemap tiles), restricted to arch3.in. Empty: satellite only on localhost.
   SATELLITE: the imagery's credit line (capture date from Esri's metadata for this plot). */
export const ESRI_KEY = 'AAPTaIaC2L1ck3WPe9odVlo-GAg..BFNLTsLZrOCNu0esZ6tto8E5D3chDfDnMEWEiV79XwW5azJ1Pg6bU8fmP-krsN8Da270pNAZohhpWQgCJj-aaviewtYjEYviUsSTSJWHNAv7BacsvvZJwXUYiRWPiDpdga4Na8xwSo8RfFiv_anK_-gl9WOibFH-DDWIa62ku8mCuTcz797fYILVBhwWRGybz2xigB22cjThS98T1gkzYbTCkmdgC8BLSlV_Rt3Dbaez0Tq_9gaxG7axHg..AT1_u4qjErKX';
export const SATELLITE = { credit: 'Imagery © Vantor via Esri · captured Oct 2025' };
export const MAP = true;
