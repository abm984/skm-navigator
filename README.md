# SKM Campus Navigator — integrated outdoor + indoor wayfinding

One web app that navigates you **outdoors along real campus roads (live GPS)** and
**indoors across floors (accelerometer-assisted)**, handing off at each building's entrance.

## Live deploy (GitHub Pages → HTTPS → phone GPS + motion sensors)
1. Put this whole folder in a repo (keep the structure; `index.html` at the root).
2. Push to `main`.
3. Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
4. Open the `https://<user>.github.io/<repo>/` link **on your phone**; tap **Allow** for location.
5. Inside a building, tap **Enable motion sensors** and **Allow** (needed for floor detection).

> GPS **and** DeviceMotion both require HTTPS. Pages provides it. Plain http:// blocks both.

## How it works
- **Outdoor**: Leaflet + OpenStreetMap. On load it pulls the campus roads live from OSM
  and routes along them with A*. Your 49 SKM places are searchable; buildings show as pins.
- **Indoor**: each building has G/1/2/3/4 floors you edit from the front end — place rooms,
  path corners, and **stairs/lifts** (same group name on each floor links them). Floor-aware
  A* routes you to the nearest connector → up/down → the room.
- **Hand-off**: search an office → GPS routes you to that building's **entrance** → tap
  **Enter <building>** → indoor floor directions take over.
- **Floor detection**: accelerometer counts steps (stairs) and integrates the lift ride to
  guess your floor. The **G/1/2/3/4 chips are the source of truth** — sensors only pre-fill a
  guess. (Browsers don't expose the barometer, which is why floor detection is assistive.)

## Files
```
index.html          app shell: outdoor + indoor views, script load order
css/style.css       all styling
js/geo.js           haversine, projection, point-to-segment snapping
js/graph.js         generic weighted graph + A*
js/data.js          embedded 49-place campus + editable building store (+ seed building)
js/sensors.js       accelerometer: step counter + floor-change estimator
js/outdoor.js       Leaflet map, live GPS, OSM road fetch + routing, pins
js/indoor.js        per-building multi-floor editor + floor-aware routing
js/search.js        unified search (outdoor places + indoor rooms)
js/app.js           orchestrator: mode switching, entrance hand-off, boot
data/skm-campus.json  the campus data as JSON (for versioning; app reads the embedded copy)
```

## Editing / data
All building edits autosave in the browser and can be Exported/Imported as JSON from the
indoor panel. The outdoor "Show roads" toggle reveals the routable network; "Reload roads"
refetches OSM (do this after adding missing paths to OpenStreetMap).

## Known limits (by design)
- No live "you are here" dot **indoors** (needs BLE/WiFi beacons — a hardware add-on).
- Accelerometer floor detection is a best-effort guess; correct it with the floor chips.
- Outdoor routing quality depends on OSM having the campus paths mapped.
