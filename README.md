# Business Development Dashboard

The EPROM Business Development Dashboard (company map + corporate dashboard), opened from eTaske
(Insights → Command Centre).

**This repo holds no figures.** The page signs in with an eTaske account and reads the
dashboard and its numbers from the eTaske Firestore store `commandCentre`, which only
approved Managers and Admins can read (see `firestore.rules` in the eTaske repo). The BD
refresh script uploads new figures there; nothing here needs changing when they change.

- `index.html` — the shell: sign-in, top bar, the sealed frame.
- `app.js` — Firebase sign-in, loading.
- `cc.js` — rebuilds the page from the stored chunks (copy of eTaske `src/lib/commandCentre.ts`, keep in step).

Local test against the Firebase emulators: serve this folder and open `http://localhost:<port>/?emu=1`.
