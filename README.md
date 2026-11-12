# Riddhi Siddhi Apartment — 3D explorer (concept demo)

A sample builder project page with an embedded, interactive 3D building explorer:
rotate the building, pick a wing, floor and flat, see it in an X-ray cut-away, and walk
around the flat's real layout. Built from the project's e-brochure.

Concept demo only: availability is sample data, carpet areas are indicative, and this is
not the official project website.

## The map under the building

In the project view the 3D building stands on the real map, centred on its plot. Zoom out (or press
**Nearby**) and the neighbourhood takes over: distance rings at 500 m, 1 km, 2 km and 5 km around the
building, pins for nearby places, and a list of what falls inside the ring in view. Zoom back in and
the building works exactly as before.

- `src/nearby.js` holds the building's position and bearing, the rings, and the list of places.
- `src/config.js` chooses the map: OpenStreetMap needs no key; `GOOGLE_MAPS_KEY` (a browser key with the
  Map Tiles API enabled, restricted to your websites) switches the ground to Google satellite imagery.
  `MAP = false` turns the map off.
- To try a Google key without rebuilding, open the page with `?gmaps_key=YOUR_KEY`.
- `?view=nearby&r=2` opens straight on the 2 km ring.

If the map cannot be reached the viewer shows its plain surroundings, as it always did.
