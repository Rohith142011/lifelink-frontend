// script.js (use as a module: <script type="module" src="script.js"></script>)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ----- 1) Firebase config (you provided) -----
const firebaseConfig = {
  apiKey: "AIzaSyBZpzbJ5Ufva6wFhTMh3VaVpRTKHEe4M6c",
  authDomain: "lifelink-27c1b.firebaseapp.com",
  projectId: "lifelink-27c1b",
  storageBucket: "lifelink-27c1b.firebasestorage.app",
  messagingSenderId: "308747359458",
  appId: "1:308747359458:web:06f099726c69b65d333abb",
  measurementId: "G-JPXGVRR4LK"
};

// Initialize Firebase app, auth, and firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM references (adjust to your HTML IDs) ----------
const registrationForm = document.getElementById('registration-form');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

const dashboardHospitalName = document.getElementById('dashboard-hospital-name');
const verificationStatusText = document.getElementById('verification-status-text');
const verificationStatusDesc = document.getElementById('verification-status-desc');
const statusIcon = document.getElementById('status-icon');

const organsTableBody = document.getElementById('organs-table-body');
const totalDonorsEl = document.getElementById('total-donors');
const availableOrgansEl = document.getElementById('available-organs');
const pendingDeliveriesEl = document.getElementById('pending-deliveries');
const completedTransplantsEl = document.getElementById('completed-transplants');

const requestOrganBtn = document.getElementById('request-organ-btn');
const refreshOrgansBtn = document.getElementById('refresh-organs');

// ---------- Helper utilities ----------
function qs(id) { return document.getElementById(id); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function showSuccess(msg) { console.log('SUCCESS:', msg); /* replace with UI modal if needed */ }
function showError(msg) { console.error('ERROR:', msg); }

/* simple UI helpers depending on your markup */
function showDashboardUI() {
  // switch to dashboard section
  document.getElementById('home-section').classList.remove('active');
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('register-section').classList.remove('active');
  document.getElementById('dashboard-section').classList.add('active');
}
function showHomeUI() {
  document.getElementById('home-section').classList.add('active');
  document.getElementById('login-section').classList.remove('active');
  document.getElementById('register-section').classList.remove('active');
  document.getElementById('dashboard-section').classList.remove('active');
}

// ---------- Auth + Firestore flows ----------

// 1) Registration: createUserWithEmailAndPassword -> create hospital document in Firestore
async function handleRegistration(e) {
  e.preventDefault();
  try {
    // read form fields (IDs must match)
    const hospitalName = qs('hospital-name').value.trim();
    const registrationNumber = qs('registration-number').value.trim();
    const hospitalType = qs('hospital-type').value;
    const city = qs('city').value.trim();
    const state = qs('state').value.trim();
    const address = qs('address').value.trim();
    const contactPerson = qs('contact-person').value.trim();
    const contactRole = qs('contact-role').value.trim();
    const email = qs('email').value.trim();
    const phone = qs('phone').value.trim();
    const password = qs('password').value;

    if (!hospitalName || !email || !password) {
      showError('Please fill required fields.');
      return;
    }

    // 1. Create user in Firebase Auth
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // 2. Create hospital doc in Firestore
    const hospitalDocRef = doc(db, 'hospitals', uid);
    await setDoc(hospitalDocRef, {
      uid,
      hospitalName,
      registrationNumber,
      hospitalType,
      city,
      state,
      address,
      contactPerson,
      contactRole,
      email,
      phone,
      createdAt: serverTimestamp(),
      status: 'pending', // admin will update to 'verified' later
      verification: {
        reason: null,
        verifiedAt: null
      }
    });

    // 3. Send client-side verification email (optional)
    try {
      await sendEmailVerification(credential.user);
    } catch (err) {
      console.warn('Email verification send failed (client):', err.message);
    }

    showSuccess('Registered. Verification in progress. A welcome email will be sent shortly.');
    registrationForm.reset();
  } catch (err) {
    showError(err.message);
    document.getElementById('verification-result').textContent = err.message;
  }
}

// 2) Login
async function handleLogin(e) {
  e.preventDefault();
  try {
    const email = qs('login-email').value.trim();
    const password = qs('login-password').value;
    if (!email || !password) {
      showError('Enter credentials');
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    showSuccess('Logged in');
  } catch (err) {
    showError(err.message);
    qs('login-error').textContent = "Invalid email/password";
  }
}

// 3) Logout
async function handleLogout() {
  try {
    await signOut(auth);
    showHomeUI();
    showSuccess('Logged out');
  } catch (err) {
    showError(err.message);
  }
}

// 4) When auth state changes, load dashboard or show home
let currentHospital = null;
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // user logged in: load hospital doc
    const hospitalDoc = await getDoc(doc(db, 'hospitals', user.uid));
    if (hospitalDoc.exists()) {
      currentHospital = hospitalDoc.data();
      populateDashboard(currentHospital);
      subscribeDashboardRealtime();
      showDashboardUI();
    } else {
      // If hospital doc missing, still let them create
      currentHospital = null;
      showHomeUI();
    }
  } else {
    // logged out
    currentHospital = null;
    showHomeUI();
    detachRealtimeListeners();
  }
});

// ---------- Dashboard population & realtime ----------

let donorsUnsub = null;
let requestsUnsub = null;
let hospitalsUnsub = null;

function populateDashboard(hospital) {
  if (!hospital) return;
  dashboardHospitalName.textContent = hospital.hospitalName || 'Hospital Dashboard';
  verificationStatusText.textContent = hospital.status === 'verified' ? 'Verified Hospital' : (hospital.status === 'rejected' ? 'Verification Rejected' : 'Pending Verification');
  verificationStatusDesc.textContent = hospital.status === 'verified' ? 'Your hospital is verified.' : 'Your documents are under review.';
  statusIcon.className = 'status-icon ' + (hospital.status === 'verified' ? 'verified' : (hospital.status === 'rejected' ? 'rejected' : ''));
  // update stats (simple)
  // we'll load donors & requests via realtime below
}

function subscribeDashboardRealtime() {
  // donors (organs) collection
  const donorsRef = collection(db, 'donors');
  donorsUnsub = onSnapshot(donorsRef, (snapshot) => {
    const donors = [];
    snapshot.forEach(doc => donors.push({ id: doc.id, ...doc.data() }));
    renderDonors(donors);
  });

  // organ requests
  const requestsRef = collection(db, 'requests');
  requestsUnsub = onSnapshot(requestsRef, (snapshot) => {
    const requests = [];
    snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
    renderRequests(requests);
  });

  // hospitals list (for network)
  const hospitalsRef = collection(db, 'hospitals');
  hospitalsUnsub = onSnapshot(hospitalsRef, (snapshot) => {
    // optionally render hospital network
    // you can show verified hospitals list
  });
}

function detachRealtimeListeners() {
  if (donorsUnsub) donorsUnsub();
  if (requestsUnsub) requestsUnsub();
  if (hospitalsUnsub) hospitalsUnsub();
  donorsUnsub = requestsUnsub = hospitalsUnsub = null;
}

function renderDonors(donors) {
  // update stats
  totalDonorsEl.textContent = donors.length;
  const available = donors.filter(d => d.status === 'available').length;
  availableOrgansEl.textContent = available;
  // render table
  if (!organsTableBody) return;
  organsTableBody.innerHTML = '';
  if (donors.length === 0) {
    organsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No organs available</td></tr>`;
    return;
  }
  donors.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.organ}</td>
      <td>${d.bloodGroup || '--'}</td>
      <td>${d.age || '--'}</td>
      <td>${d.hospitalName || d.hospital || '--'}</td>
      <td><span class="tag">${d.status || 'available'}</span></td>
      <td><button class="btn btn-small" data-id="${d.id}">Request</button></td>
    `;
    organsTableBody.appendChild(tr);

    tr.querySelector('button')?.addEventListener('click', () => requestOrgan(d));
  });
}

function renderRequests(requests) {
  pendingDeliveriesEl.textContent = requests.filter(r => r.status === 'pending').length;
  completedTransplantsEl.textContent = requests.filter(r => r.status === 'completed').length;
  // Optionally update UI list
}

// ---------- Actions ----------

async function requestOrgan(donor) {
  if (!auth.currentUser) {
    showError('Login required');
    return;
  }
  try {
    await addDoc(collection(db, 'requests'), {
      hospitalId: auth.currentUser.uid,
      hospitalName: currentHospital?.hospitalName || 'Unknown',
      organ: donor.organ,
      donorId: donor.id,
      urgency: 'High',
      status: 'pending',
      createdAt: serverTimestamp()
    });
    showSuccess('Organ request submitted');
  } catch (err) {
    showError(err.message);
  }
}

// create a donor (example form not included in HTML — you can create a simple modal in UI)
async function createDonor(payload) {
  // payload = { name, age, bloodGroup, organ, hospital, status: 'available' }
  try {
    await addDoc(collection(db, 'donors'), {
      ...payload,
      createdAt: serverTimestamp()
    });
    showSuccess('Donor added');
  } catch (err) {
    showError(err.message);
  }
}

// refresh button handler (just forces reloads by refetching)
async function refreshData() {
  // simple refetch for now
  const donorsSnapshot = await getDocs(collection(db, 'donors'));
  renderDonors(donorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
}

// ---------- Wire up form events ----------
if (registrationForm) registrationForm.addEventListener('submit', handleRegistration);
if (loginForm) loginForm.addEventListener('submit', handleLogin);
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
if (refreshOrgansBtn) refreshOrgansBtn.addEventListener('click', refreshData);

// Optional: expose functions to window for debugging
window.LifeLink = {
  createDonor,
  requestOrgan,
  refreshData
};

console.log('script.js loaded — Firebase initialized.');
