// Business Development Dashboard — its own page, opened from eTaske (Insights → Command Centre).
// Signs in with the same eTaske accounts, reads the page + figures from the
// eTaske Firestore store (managers + admins only, see ETaske/firestore.rules)
// and shows them in a frame sandboxed to scripts only. Nothing on this site
// holds a figure.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, connectAuthEmulator, browserSessionPersistence, setPersistence,
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import {
  initializeFirestore, connectFirestoreEmulator, doc, getDoc,
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { readCommandCentre } from './cc.js';

// eTaske's public web config (the same values ship in the eTaske site).
const CONFIG = {
  projectId: 'gen-lang-client-0893475577',
  appId: '1:1052151865674:web:9f949b2fa3914f046de1b3',
  apiKey: 'AIzaSyA5lIYwb7w2KyNcmC4bVpBcwa__EfkNxr4',
  authDomain: 'gen-lang-client-0893475577.firebaseapp.com',
  storageBucket: 'gen-lang-client-0893475577.firebasestorage.app',
  messagingSenderId: '1052151865674',
};
const DATABASE_ID = 'ai-studio-82d500c4-619e-4632-9bd3-9466532da5e6';
export const ETASKE_URL = 'https://tariqmu7.github.io/ETaske/';

// Local testing only: http://localhost:<port>/?emu=1 talks to the Firebase emulators.
const EMU = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emu');

const app = initializeApp(EMU ? { ...CONFIG, projectId: 'demo-etaske' } : CONFIG);
const auth = getAuth(app);
// Long polling: the same choice as eTaske. No persistent cache, so the figures
// are not left on the device after the tab closes.
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, DATABASE_ID);
if (EMU) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
// Signed in for this tab only: closing the browser signs the viewer out.
setPersistence(auth, browserSessionPersistence).catch(() => {});

const $ = id => document.getElementById(id);
const show = name => document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.dataset.view !== name; });
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function message(text) {
  $('msg-text').textContent = text;
  show('message');
}

let loading = false;
async function load(user) {
  if (loading) return;
  loading = true;
  $('reload').disabled = true;
  $('built').hidden = true;
  $('frame').removeAttribute('srcdoc');
  show('loading');
  try {
    const cc = await readCommandCentre({ doc, getDoc }, db);
    if (!cc) {
      message('Nothing has been uploaded yet. Run the dashboard refresh on the BD computer.');
      return;
    }
    $('frame').srcdoc = cc.html;
    if (cc.built) { $('built').textContent = `Figures to ${fmtDate(cc.built)}`; $('built').hidden = false; }
    show('stage');
  } catch (e) {
    console.warn('Command Centre:', e);
    message(e?.code === 'permission-denied'
      ? 'This page is for eTaske managers only. If you are a manager, ask the eTaske admin to check your account.'
      : 'The dashboard could not be loaded. Check the connection and press Reload.');
  } finally {
    loading = false;
    $('reload').disabled = false;
  }
}

function signInError(e) {
  const code = e?.code || '';
  $('login-error').textContent =
    code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? ''
    : code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' ? 'Wrong e-mail or password.'
    : code === 'auth/popup-blocked' ? 'The browser blocked the sign-in window. Allow pop-ups for this page and try again.'
    : 'Sign-in failed. Please try again.';
}

$('google').addEventListener('click', () => {
  $('login-error').textContent = '';
  signInWithPopup(auth, new GoogleAuthProvider()).catch(signInError);
});
$('email-form').addEventListener('submit', e => {
  e.preventDefault();
  $('login-error').textContent = '';
  signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value).catch(signInError);
});
$('reload').addEventListener('click', () => auth.currentUser && load(auth.currentUser));
$('signout').addEventListener('click', () => signOut(auth));
document.querySelectorAll('a[data-etaske]').forEach(a => { a.href = ETASKE_URL; });

onAuthStateChanged(auth, user => {
  $('who').textContent = user ? (user.email || '') : '';
  document.body.classList.toggle('signed-in', !!user);
  if (user) load(user);
  else { $('frame').removeAttribute('srcdoc'); $('built').hidden = true; show('login'); }
});
