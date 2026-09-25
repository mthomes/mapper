# Street Marker (web prototype)

Highlights the streets you've driven, like running a marker over a map, so you
can see at a glance which parts of a neighborhood you've already covered.

## Using it
- **Start / Stop** – records your GPS track as a thick yellow highlight.
- **Follow** – keeps the map centered on you (dragging the map turns it off).
- **Draw** – tap along streets to mark them by hand (e.g. routes from before you had the app).
- **⋯** – undo last line, export/import GeoJSON, clear everything.

Everything is saved in the browser on your device (localStorage).

## Running it
Geolocation only works over **HTTPS** (or `localhost`). Easiest options:
- Enable GitHub Pages on this repo (Settings → Pages → deploy from branch), then open the URL on your phone.
- Locally: `npx serve .` and open `http://localhost:3000`.

On iPhone, open it in Safari → Share → **Add to Home Screen** for a full-screen app feel.

## Known limits of the web version
- **Keep the screen on and the app in front.** Browsers stop GPS when the phone
  locks or you switch apps. The app requests a screen wake lock to help. Mount the phone.
- Lines follow raw GPS, not snapped to roads. Noisy points (accuracy worse than 35 m)
  are skipped.
- Map tiles are OpenStreetMap. Apple Maps on the web (MapKit JS) needs a paid Apple
  Developer token, so it's left for the native version.

## Path to a native iOS app
A SwiftUI + MapKit version would add real Apple Maps, background location
(recording while locked), and snap-to-road. The storage format (lines of lat/lng) carries over.
