# SKM Campus Navigator

A browser-based indoor/outdoor campus wayfinding app for Shaukat Khanum.
Real map + live phone GPS + shortest-path routing along campus walkways.

## Live deploy (GitHub Pages)
1. Create a repo (e.g. `skm-navigator`) and add these files at the root.
2. Push to the `main` branch.
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
4. Branch: `main` / folder: `/ (root)` → **Save**.
5. Wait ~1 min, then open the `https://<user>.github.io/skm-navigator/` URL **on your phone**.
6. Tap **Allow** when the browser asks for location. The green dot is your live GPS.

> GPS only works over HTTPS (Pages provides this) or on localhost.
> Plain http:// will block location — that's a browser security rule, not a bug.

## Files
- `index.html` — the whole app (self-contained; loads Leaflet from a CDN)
- `skm-campus-data.json` — the 49 locations + walkable network (the data model)

## Editing the map
Use the in-app tools (Trace / Add place / Link / Delete) or the
**Drop node here (GPS)** button while walking the campus, then **Export**
to save the updated JSON back into this repo.
