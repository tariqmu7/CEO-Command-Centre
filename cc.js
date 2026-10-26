// Rebuilding the CEO Command Centre from the eTaske `commandCentre` store.
// A plain-JS copy of the reading half of ETaske/src/lib/commandCentre.ts —
// keep the two in step. The page and its figures are NOT in this repo: BD's
// refresh script uploads them to Firestore, and they are read after sign-in.
//
//   commandCentre/current                 { version, built, pageChunks, dataChunks, pageLength, dataLength, uploadedAt }
//   commandCentre/current/chunks/{id}     { version, part, i, text }   id = chunkId(version, part, i)

export const CC_COLLECTION = 'commandCentre';
export const CC_CURRENT = 'current';

export const chunkId = (version, part, i) => `${version}_${part}_${String(i).padStart(3, '0')}`;

// Rejoins one part, refusing anything that is not exactly chunks 0..count-1 of one version.
export function joinChunks(chunks, version, part, count, length) {
  const mine = chunks.filter(c => c.part === part).sort((a, b) => a.i - b.i);
  if (mine.length !== count || mine.some((c, k) => c.i !== k || c.version !== version)) {
    throw new Error(`Command Centre ${part}: expected ${count} chunks of ${version}, got ${mine.length}`);
  }
  const text = mine.map(c => c.text).join('');
  if (text.length !== length) throw new Error(`Command Centre ${part}: length ${text.length}, expected ${length}`);
  return text;
}

// Every figure sits behind a mark like __CC_MAP_LEFT__ in the page, and the data
// JSON holds its text. The marks sit inside the two frames' srcdoc attributes,
// so each value is escaped exactly as Python's html.escape.
const CC_MARK = /__CC_[A-Z]+_[A-Z]+__/g;
export const escapeHtml = s => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

export function fillMarks(page, values) {
  return page.replace(CC_MARK, k => {
    const v = values[k];
    if (typeof v !== 'string') throw new Error(`Command Centre data has no value for ${k}`);
    return escapeHtml(v);
  });
}

// Deterrents only — a determined viewer can still photograph the screen. In the
// outer page and in each of its two frames: the "Save as PDF" buttons hidden,
// printing blanked, right-click / Ctrl+P / Ctrl+S / dragging stopped.
const LOCK = '<style>.pdf{display:none!important}@media print{html,body{display:none!important}}</style>'
  + '<script>addEventListener("contextmenu",e=>e.preventDefault());'
  + 'addEventListener("dragstart",e=>e.preventDefault());'
  + 'addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&/^[ps]$/i.test(e.key))e.preventDefault()},true);</script>';

// Runs on the page BEFORE its figures go in, so no figure can be mistaken for a head tag.
export function lockPage(page) {
  const outer = page.split('</head>');
  const inner = page.split('&lt;/head&gt;');
  if (outer.length !== 2 || inner.length !== 3) {
    throw new Error('Command Centre page is not the expected shape (one page + two frames)');
  }
  return page.replace('</head>', LOCK + '</head>').split('&lt;/head&gt;').join(escapeHtml(LOCK) + '&lt;/head&gt;');
}

// The data JSON is { built, values }.
export function buildCommandCentre(page, dataJson) {
  const data = JSON.parse(dataJson);
  if (!data || typeof data.values !== 'object' || !data.values) throw new Error('Command Centre data has no values');
  return { html: fillMarks(lockPage(page), data.values), built: typeof data.built === 'string' ? data.built : '' };
}

// Reads `current`, then every chunk BY ID (the rules allow no listing), then
// rebuilds the page. A refresh can swap versions mid-read, so one retry.
// Returns null when nothing has been uploaded yet.
export async function readCommandCentre(fs, db) {
  const { doc, getDoc } = fs;
  for (let attempt = 0; ; attempt++) {
    const cur = await getDoc(doc(db, CC_COLLECTION, CC_CURRENT));
    if (!cur.exists()) return null;
    const c = cur.data();
    const ids = (part, n) => Array.from({ length: n }, (_, i) => chunkId(c.version, part, i));
    const snaps = await Promise.all([...ids('page', c.pageChunks), ...ids('data', c.dataChunks)]
      .map(id => getDoc(doc(db, CC_COLLECTION, CC_CURRENT, 'chunks', id))));
    try {
      const chunks = snaps.filter(s => s.exists()).map(s => s.data());
      const page = joinChunks(chunks, c.version, 'page', c.pageChunks, c.pageLength);
      const data = joinChunks(chunks, c.version, 'data', c.dataChunks, c.dataLength);
      return buildCommandCentre(page, data);
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
}
