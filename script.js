// --------------------------------------------------
// script.js (Firebase + Dashboard Logic)
// --------------------------------------------------

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

// --------------------------------------------------
// 1. Firebase Config
// --------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBZpzbJ5Ufva6wFhTMh3VaVpRTKHEe4M6c",
  authDomain: "lifelink-27c1b.firebaseapp.com",
  projectId: "lifelink-27c1b",
  storageBucket: "lifelink-27c1b.firebasestorage.app",
  messagingSenderId: "308747359458",
  appId: "1:308747359458:web:06f099726c69b65d333abb",
  measurementId: "G-JPXGVRR4LK"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase Initialized");

// --------------------------------------------------
// Helper functions
// --------------------------------------------------
const qs = (id) => document.getElementById(id);
const safe = (el) => (el ? true : false);

function showSuccess(msg) {
  console.log("%cSUCCESS: " + msg, "color: #00c853");
}

function showError(msg) {
  console.log("%cERROR: " + msg, "color: red");
}

// --------------------------------------------------
// UI switching
// --------------------------------------------------
function showSection(id) {
  ["home-section", "login-section", "register-section", "dashboard-section"].forEach(sec => {
    const element = qs(sec);
    if (element) element.classList.remove("active");
  });

  const target = qs(id);
  if (target) target.classList.add("active");
}

function showDashboardUI() { showSection("dashboard-section"); }
function showHomeUI() { showSection("home-section"); }

// --------------------------------------------------
// Registration
// --------------------------------------------------
async function handleRegistration(e) {
  e.preventDefault();

  try {
    const data = {
      hospitalName: qs("hospital-name")?.value.trim(),
      registrationNumber: qs("registration-number")?.value.trim(),
      hospitalType: qs("hospital-type")?.value,
      city: qs("city")?.value.trim(),
      state: qs("state")?.value.trim(),
      address: qs("address")?.value.trim(),
      contactPerson: qs("contact-person")?.value.trim(),
      contactRole: qs("contact-role")?.value.trim(),
      email: qs("email")?.value.trim(),
      phone: qs("phone")?.value.trim(),
      password: qs("password")?.value
    };

    if (!data.hospitalName || !data.email || !data.password) {
      return showError("Fill required fields");
    }

    // Create user
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = cred.user.uid;

    // Save hospital document
    await setDoc(doc(db, "hospitals", uid), {
      ...data,
      uid,
      createdAt: serverTimestamp(),
      status: "pending",
      verification: {
        reason: null,
        verifiedAt: null
      }
    });

    try { await sendEmailVerification(cred.user); } catch {}

    showSuccess("Registration completed.");
    e.target.reset();

  } catch (err) {
    showError(err.message);
    if (qs("verification-result")) qs("verification-result").textContent = err.message;
  }
}

// --------------------------------------------------
// Login
// --------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  try {
    const email = qs("login-email")?.value.trim();
    const password = qs("login-password")?.value;

    if (!email || !password) return showError("Enter credentials");

    await signInWithEmailAndPassword(auth, email, password);
    showSuccess("Logged in");
  } catch (err) {
    showError(err.message);
    if (qs("login-error")) qs("login-error").textContent = "Invalid email/password";
  }
}

// --------------------------------------------------
// Logout
// --------------------------------------------------
async function handleLogout() {
  try {
    await signOut(auth);
    showHomeUI();
    showSuccess("Logged out");
  } catch (err) {
    showError(err.message);
  }
}

// --------------------------------------------------
// Dashboard + Realtime
// --------------------------------------------------
let currentHospital = null;
let donorsUnsub = null;
let requestsUnsub = null;
let hospitalsUnsub = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showHomeUI();
    detachRealtimeListeners();
    return;
  }

  const hospitalDoc = await getDoc(doc(db, "hospitals", user.uid));

  if (hospitalDoc.exists()) {
    currentHospital = hospitalDoc.data();
    populateDashboard(currentHospital);
    subscribeRealtime();
    showDashboardUI();
  } else {
    currentHospital = null;
    showHomeUI();
  }
});

// Dashboard UI fill
function populateDashboard(h) {
  if (!h) return;

  qs("dashboard-hospital-name").textContent = h.hospitalName;
  qs("verification-status-text").textContent =
    h.status === "verified"
      ? "Verified Hospital"
      : h.status === "rejected"
      ? "Verification Rejected"
      : "Pending Verification";

  qs("verification-status-desc").textContent =
    h.status === "verified"
      ? "Your hospital is verified."
      : "Your documents are under review.";
}

function subscribeRealtime() {
  donorsUnsub = onSnapshot(collection(db, "donors"), (snap) => {
    const donors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDonors(donors);
  });

  requestsUnsub = onSnapshot(collection(db, "requests"), (snap) => {
    const requests = snap.docs.map(r => ({ id: r.id, ...r.data() }));
    updateRequestStats(requests);
  });
}

function detachRealtimeListeners() {
  donorsUnsub?.(); requestsUnsub?.(); hospitalsUnsub?.();
}

// Render donors in table
function renderDonors(list) {
  if (!qs("organs-table-body")) return;

  qs("total-donors").textContent = list.length;
  qs("available-organs").textContent = list.filter(d => d.status === "available").length;

  const tbody = qs("organs-table-body");
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No organs available</td></tr>`;
    return;
  }

  list.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.organ}</td>
      <td>${d.bloodGroup || "--"}</td>
      <td>${d.age || "--"}</td>
      <td>${d.hospitalName || "--"}</td>
      <td><span class="tag">${d.status}</span></td>
      <td><button class="btn btn-small" data-id="${d.id}">Request</button></td>
    `;
    tbody.appendChild(tr);

    tr.querySelector("button").addEventListener("click", () => requestOrgan(d));
  });
}

function updateRequestStats(list) {
  qs("pending-deliveries").textContent = list.filter(r => r.status === "pending").length;
  qs("completed-transplants").textContent = list.filter(r => r.status === "completed").length;
}

// Submit organ request
async function requestOrgan(d) {
  if (!auth.currentUser) return showError("Login required");

  try {
    await addDoc(collection(db, "requests"), {
      hospitalId: auth.currentUser.uid,
      hospitalName: currentHospital?.hospitalName,
      organ: d.organ,
      donorId: d.id,
      urgency: "High",
      status: "pending",
      createdAt: serverTimestamp()
    });

    showSuccess("Organ request submitted");
  } catch (err) {
    showError(err.message);
  }
}

// --------------------------------------------------
// Manual refresh
// --------------------------------------------------
async function refreshData() {
  const snap = await getDocs(collection(db, "donors"));
  const donors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderDonors(donors);
}

// --------------------------------------------------
// Attach listeners
// --------------------------------------------------
qs("registration-form")?.addEventListener("submit", handleRegistration);
qs("login-form")?.addEventListener("submit", handleLogin);
qs("logout-btn")?.addEventListener("click", handleLogout);
qs("refresh-organs")?.addEventListener("click", refreshData);

window.LifeLink = { requestOrgan, refreshData };
