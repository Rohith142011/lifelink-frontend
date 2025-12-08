// LifeLink Platform with Firebase Backend

// Import Firebase SDKs
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

// ----- Firebase config -----
const firebaseConfig = {
  apiKey: "AIzaSyBZpzbJ5Ufva6wFhTMh3VaVpRTKHEe4M6c",
  authDomain: "lifelink-27c1b.firebaseapp.com",
  projectId: "lifelink-27c1b",
  storageBucket: "lifelink-27c1b.firebasestorage.app",
  messagingSenderId: "308747359458",
  appId: "1:308747359458:web:06f099726c69b65d333abb",
  measurementId: "G-JPXGVRR4LK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM references ----------
const navHome = document.getElementById('nav-home');
const navFeatures = document.getElementById('nav-features');
const navRegister = document.getElementById('nav-register');
const navLogin = document.getElementById('nav-login');
const navDashboard = document.getElementById('nav-dashboard');
const homeRegisterBtn = document.getElementById('home-register-btn');
const homeLoginBtn = document.getElementById('home-login-btn');
const registerLink = document.getElementById('register-link');

// Page Sections
const homeSection = document.getElementById('home-section');
const featuresSection = document.getElementById('features-section');
const registerSection = document.getElementById('register-section');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');

// Registration Form Elements
const registrationForm = document.getElementById('registration-form');
const formStepper = document.querySelector('.form-stepper');
const formSteps = document.querySelectorAll('.form-step');
const steps = document.querySelectorAll('.step');

// Login Elements
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// Dashboard Elements
const dashboardHospitalName = document.getElementById('dashboard-hospital-name');
const verificationStatusText = document.getElementById('verification-status-text');
const verificationStatusDesc = document.getElementById('verification-status-desc');
const statusIcon = document.getElementById('status-icon');
const requestOrganBtn = document.getElementById('request-organ-btn');
const uploadDocsBtn = document.getElementById('upload-docs-btn');
const refreshOrgansBtn = document.getElementById('refresh-organs');

// Stats Elements
const totalDonorsEl = document.getElementById('total-donors');
const availableOrgansEl = document.getElementById('available-organs');
const pendingDeliveriesEl = document.getElementById('pending-deliveries');
const completedTransplantsEl = document.getElementById('completed-transplants');

// Table Elements
const organsTableBody = document.getElementById('organs-table-body');
const alertsList = document.getElementById('alerts-list');
const activityList = document.getElementById('activity-list');

// Modal Elements
const organRequestModal = document.getElementById('organ-request-modal');
const successModal = document.getElementById('success-modal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const submitOrganRequestBtn = document.getElementById('submit-organ-request');

// State Management
let currentUser = null;
let currentHospital = null;
let donorsUnsub = null;
let requestsUnsub = null;

// Current form step
let currentStep = 1;

// ---------- Helper functions ----------
function qs(id) { return document.getElementById(id); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function showSuccessModal(title, message) {
    document.getElementById('success-message').textContent = message;
    successModal.classList.add('active');
    
    setTimeout(() => {
        successModal.classList.remove('active');
    }, 3000);
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
    });
}

// Navigation functions
function showHome() {
    setActivePage(homeSection);
    setActiveNavLink(navHome);
    updateStats();
}

function showFeatures() {
    setActivePage(featuresSection);
    setActiveNavLink(navFeatures);
}

function showRegister() {
    setActivePage(registerSection);
    setActiveNavLink(navRegister);
    showStep(1);
    currentStep = 1;
    if (registrationForm) registrationForm.reset();
    document.getElementById('file-name').textContent = '';
}

function showLogin() {
    setActivePage(loginSection);
    setActiveNavLink(navLogin);
    if (loginForm) loginForm.reset();
    document.getElementById('login-error').textContent = '';
}

function showDashboard() {
    setActivePage(dashboardSection);
    setActiveNavLink(navDashboard);
    navDashboard.style.display = 'flex';
}

function setActivePage(page) {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the requested page
    page.classList.add('active');
}

function setActiveNavLink(link) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-links a').forEach(navLink => {
        navLink.classList.remove('active');
    });
    
    // Add active class to the requested link
    link.classList.add('active');
}

// Form stepper functions
function initFormStepper() {
    showStep(1);
}

function showStep(stepNumber) {
    // Hide all steps
    formSteps.forEach(step => step.classList.remove('active'));
    
    // Show current step
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    
    // Update stepper UI
    steps.forEach(step => {
        const stepNum = parseInt(step.getAttribute('data-step'));
        if (stepNum <= stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    currentStep = stepNumber;
}

function validateCurrentStep() {
    const currentStepElement = document.getElementById(`step-${currentStep}`);
    const inputs = currentStepElement.querySelectorAll('input[required], select[required], textarea[required]');
    
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#ef4444';
        } else {
            input.style.borderColor = '';
        }
        
        // Special validation for email
        if (input.type === 'email' && input.value) {
            if (!validateEmail(input.value)) {
                isValid = false;
                input.style.borderColor = '#ef4444';
            }
        }
        
        // Special validation for password
        if (input.type === 'password' && input.value) {
            if (input.id === 'password' && input.value.length < 8) {
                isValid = false;
                input.style.borderColor = '#ef4444';
            }
            if (input.id === 'confirm-password') {
                const password = document.getElementById('password').value;
                if (input.value !== password) {
                    isValid = false;
                    input.style.borderColor = '#ef4444';
                }
            }
        }
    });
    
    return isValid;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ---------- Firebase Authentication ----------

// 1) Registration with Firebase
async function handleRegistration(e) {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
        showSuccessModal('Validation Error', 'Please fill in all required fields correctly.');
        return;
    }
    
    try {
        // Get form values
        const hospitalName = document.getElementById('hospital-name').value.trim();
        const registrationNumber = document.getElementById('registration-number').value.trim();
        const hospitalType = document.getElementById('hospital-type').value;
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const address = document.getElementById('address').value.trim();
        const contactPerson = document.getElementById('contact-person').value.trim();
        const contactRole = document.getElementById('contact-role').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        
        // 1. Create user in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;
        
        // 2. Create hospital document in Firestore
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
            status: 'pending',
            verification: {
                verifiedAt: null,
                reason: null
            }
        });
        
        // 3. Send verification email (optional)
        try {
            await sendEmailVerification(credential.user);
        } catch (err) {
            console.warn('Email verification failed:', err.message);
        }
        
        // 4. Show success and auto-login
        showSuccessModal('Registration Successful', 'Your hospital has been registered. You can now access the dashboard.');
        
        // Auto login
        await signInWithEmailAndPassword(auth, email, password);
        
    } catch (error) {
        console.error('Registration error:', error);
        showSuccessModal('Registration Failed', error.message);
    }
}

// 2) Login with Firebase (with demo mode fallback)
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Clear previous errors
    document.getElementById('login-error').textContent = '';
    
    try {
        // Try Firebase login
        await signInWithEmailAndPassword(auth, email, password);
        showSuccessModal('Login Successful', 'Welcome to LifeLink Dashboard');
    } catch (error) {
        console.error('Login error:', error);
        
        // DEMO MODE: If Firebase login fails, use demo mode
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            // Create a demo hospital document
            currentHospital = {
                hospitalName: email.includes('citygeneral') ? 'City General Hospital' : 
                            email.includes('stmarys') ? 'St. Mary\'s Medical Center' :
                            email.includes('universitymed') ? 'University Medical Center' :
                            'Demo Hospital',
                registrationNumber: 'DEMO-' + Date.now().toString(36),
                email: email,
                status: 'verified'
            };
            
            // Show dashboard in demo mode
            populateDashboard(currentHospital);
            showDashboard();
            loadDemoData();
            
            showSuccessModal('Demo Mode', 'Logged in with demo credentials. No Firebase connection.');
        } else {
            document.getElementById('login-error').textContent = error.message;
        }
    }
}

// 3) Logout
async function handleLogout() {
    try {
        await signOut(auth);
        currentHospital = null;
        navDashboard.style.display = 'none';
        detachRealtimeListeners();
        showHome();
        showSuccessModal('Logged Out', 'You have been successfully logged out.');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ---------- Dashboard Functions ----------

// Populate dashboard with hospital data
function populateDashboard(hospital) {
    if (!hospital) return;
    
    dashboardHospitalName.textContent = hospital.hospitalName || 'Hospital Dashboard';
    document.getElementById('verify-hospital-name').textContent = hospital.hospitalName || '-';
    document.getElementById('verify-reg-number').textContent = hospital.registrationNumber || '-';
    document.getElementById('verify-date').textContent = new Date().toLocaleDateString();
    
    // Update verification status
    verificationStatusText.textContent = hospital.status === 'verified' 
        ? 'Verified Hospital' 
        : hospital.status === 'rejected' 
            ? 'Verification Rejected' 
            : 'Pending Verification';
    
    verificationStatusDesc.textContent = hospital.status === 'verified' 
        ? 'Your hospital has been successfully verified and is now visible in the network.' 
        : hospital.status === 'rejected' 
            ? `Verification failed: ${hospital.verification?.reason || 'Invalid documentation'}. Please upload new documents.` 
            : 'Your documents are under review. This usually takes 24-48 hours.';
    
    // Update status icon
    statusIcon.className = 'status-icon';
    if (hospital.status === 'verified') {
        statusIcon.classList.add('verified');
        statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    } else if (hospital.status === 'rejected') {
        statusIcon.classList.add('rejected');
        statusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
    } else {
        statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
    }
}

// Load realtime data from Firebase
function subscribeDashboardRealtime() {
    // Listen to donors collection
    const donorsRef = collection(db, 'donors');
    donorsUnsub = onSnapshot(donorsRef, (snapshot) => {
        const donors = [];
        snapshot.forEach(doc => donors.push({ id: doc.id, ...doc.data() }));
        renderDonors(donors);
        updateStats(donors);
    });
    
    // Listen to requests collection
    const requestsRef = collection(db, 'requests');
    requestsUnsub = onSnapshot(requestsRef, (snapshot) => {
        const requests = [];
        snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
        renderRequests(requests);
        updateActivity(requests);
    });
}

// Detach realtime listeners
function detachRealtimeListeners() {
    if (donorsUnsub) donorsUnsub();
    if (requestsUnsub) requestsUnsub();
    donorsUnsub = requestsUnsub = null;
}

// Update stats
function updateStats(donors = []) {
    const totalDonors = donors.length;
    const availableOrgans = donors.filter(donor => donor.status === 'available').length;
    
    totalDonorsEl.textContent = totalDonors;
    availableOrgansEl.textContent = availableOrgans;
    
    // Update badges
    document.getElementById('alerts-count').textContent = Math.min(availableOrgans, 9);
}

// Render donors table
function renderDonors(donors) {
    if (!organsTableBody) return;
    
    organsTableBody.innerHTML = '';
    
    if (donors.length === 0) {
        organsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted)">
                    No organs currently available in the network.
                </td>
            </tr>
        `;
        return;
    }
    
    donors.forEach(donor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${donor.organ || 'Unknown'}</td>
            <td>${donor.bloodGroup || '--'}</td>
            <td>${donor.age || '--'}</td>
            <td>${donor.hospitalName || donor.hospital || '--'}</td>
            <td><span class="tag" style="background: rgba(34, 197, 94, 0.1); color: var(--neon-green); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">${donor.status || 'available'}</span></td>
            <td>
                <button class="btn btn-small request-organ-btn" data-id="${donor.id}" style="padding: 6px 12px; font-size: 0.8rem;">
                    Request
                </button>
            </td>
        `;
        organsTableBody.appendChild(row);
    });
    
    // Add event listeners to request buttons
    document.querySelectorAll('.request-organ-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const donorId = btn.getAttribute('data-id');
            const donor = donors.find(d => d.id === donorId);
            if (donor) requestOrgan(donor);
        });
    });
}

// Render requests
function renderRequests(requests) {
    const pending = requests.filter(req => req.status === 'pending').length;
    const completed = requests.filter(req => req.status === 'completed').length;
    
    pendingDeliveriesEl.textContent = pending;
    completedTransplantsEl.textContent = completed;
}

// Update activity feed
function updateActivity(requests) {
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    // Get recent requests (last 4)
    const recentRequests = requests.slice(-4).reverse();
    
    if (recentRequests.length === 0) {
        activityList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted)">
                No recent activity
            </div>
        `;
        return;
    }
    
    recentRequests.forEach(request => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas fa-heartbeat"></i>
            </div>
            <div class="activity-content">
                <h4>${request.organ} Request</h4>
                <p>${request.patientName || 'Patient'} • ${request.hospitalName || 'Hospital'}</p>
            </div>
            <div class="activity-time">Just now</div>
        `;
        activityList.appendChild(activityItem);
    });
}

// Load demo data (when Firebase is not available)
function loadDemoData() {
    const demoDonors = [
        { 
            id: '1', 
            organ: 'Kidney', 
            bloodGroup: 'O+', 
            age: 32, 
            hospitalName: 'City General Hospital',
            status: 'available'
        },
        { 
            id: '2', 
            organ: 'Liver', 
            bloodGroup: 'A-', 
            age: 28, 
            hospitalName: 'St. Mary\'s Medical Center',
            status: 'available'
        },
        { 
            id: '3', 
            organ: 'Heart', 
            bloodGroup: 'B+', 
            age: 45, 
            hospitalName: 'University Medical Center',
            status: 'available'
        }
    ];
    
    renderDonors(demoDonors);
    updateStats(demoDonors);
    
    // Load demo alerts
    if (alertsList) {
        alertsList.innerHTML = `
            <div class="alert-item">
                <div class="alert-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div>
                    <p>3 organs available in network</p>
                    <small>Just now</small>
                </div>
            </div>
            <div class="alert-item urgent">
                <div class="alert-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div>
                    <p>2 pending organ requests</p>
                    <small>2 hours ago</small>
                </div>
            </div>
        `;
    }
}

// ---------- Organ Request Functions ----------

// Show organ request modal
function showOrganRequestModal() {
    organRequestModal.classList.add('active');
}

// Submit organ request
async function submitOrganRequest() {
    const organ = document.getElementById('request-organ-type').value;
    const patient = document.getElementById('request-patient').value.trim();
    const urgency = document.getElementById('request-urgency').value;
    const notes = document.getElementById('request-notes').value.trim();
    
    if (!organ || !patient) {
        showSuccessModal('Error', 'Please fill in all required fields.');
        return;
    }
    
    try {
        // Add to Firestore
        await addDoc(collection(db, 'requests'), {
            hospitalId: auth.currentUser?.uid || 'demo',
            hospitalName: currentHospital?.hospitalName || 'Demo Hospital',
            organ,
            patientName: patient,
            urgency,
            notes,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        // Close modal and show success
        closeAllModals();
        showSuccessModal('Request Submitted', 'Your organ request has been submitted to the network.');
        
    } catch (error) {
        console.error('Request error:', error);
        showSuccessModal('Error', 'Failed to submit request: ' + error.message);
    }
}

// Request organ from donor
async function requestOrgan(donor) {
    try {
        // Add request to Firestore
        await addDoc(collection(db, 'requests'), {
            hospitalId: auth.currentUser?.uid || 'demo',
            hospitalName: currentHospital?.hospitalName || 'Demo Hospital',
            organ: donor.organ,
            donorId: donor.id,
            donorName: donor.name || 'Unknown',
            urgency: 'High',
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        // Update donor status
        const donorRef = doc(db, 'donors', donor.id);
        await updateDoc(donorRef, {
            status: 'requested',
            requestedBy: currentHospital?.hospitalName || 'Demo Hospital'
        });
        
        showSuccessModal('Request Sent', `Your request for ${donor.organ} has been submitted.`);
        
    } catch (error) {
        console.error('Request organ error:', error);
        showSuccessModal('Error', 'Failed to request organ: ' + error.message);
    }
}

// Close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Refresh organs
async function refreshData() {
    try {
        const donorsSnapshot = await getDocs(collection(db, 'donors'));
        const donors = donorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDonors(donors);
        updateStats(donors);
        showSuccessModal('Refreshed', 'Organ availability data has been refreshed.');
    } catch (error) {
        console.error('Refresh error:', error);
        // Fallback to demo data
        loadDemoData();
    }
}

// ---------- Event Listeners ----------
function setupEventListeners() {
    // Navigation
    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        showHome();
    });
    
    navFeatures.addEventListener('click', (e) => {
        e.preventDefault();
        showFeatures();
    });
    
    navRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });
    
    navLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    // Home buttons
    homeRegisterBtn.addEventListener('click', () => showRegister());
    homeLoginBtn.addEventListener('click', () => showLogin());
    
    // Footer navigation
    document.getElementById('footer-home').addEventListener('click', (e) => {
        e.preventDefault();
        showHome();
    });
    
    document.getElementById('footer-features').addEventListener('click', (e) => {
        e.preventDefault();
        showFeatures();
    });
    
    document.getElementById('footer-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });
    
    document.getElementById('footer-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });
    
    // Demo login buttons
    document.querySelectorAll('.demo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const email = this.getAttribute('data-email');
            const password = this.getAttribute('data-password');
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = password;
        });
    });
    
    // Form stepper navigation
    document.getElementById('next-step-1').addEventListener('click', () => {
        if (validateCurrentStep()) showStep(2);
    });
    
    document.getElementById('prev-step-2').addEventListener('click', () => showStep(1));
    document.getElementById('next-step-2').addEventListener('click', () => {
        if (validateCurrentStep()) showStep(3);
    });
    document.getElementById('prev-step-3').addEventListener('click', () => showStep(2));
    
    // Forms
    if (registrationForm) registrationForm.addEventListener('submit', handleRegistration);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Dashboard actions
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (requestOrganBtn) requestOrganBtn.addEventListener('click', showOrganRequestModal);
    if (uploadDocsBtn) uploadDocsBtn.addEventListener('click', () => {
        showSuccessModal('Upload', 'Document upload functionality will be available soon.');
    });
    if (refreshOrgansBtn) refreshOrgansBtn.addEventListener('click', refreshData);
    
    // Modals
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    if (submitOrganRequestBtn) submitOrganRequestBtn.addEventListener('click', submitOrganRequest);
    
    // Register link in login page
    if (registerLink) registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });
    
    // Mobile menu
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
    
    // File upload
    const fileInput = document.getElementById('documents');
    const fileName = document.getElementById('file-name');
    
    if (fileInput) {
        document.getElementById('file-upload-area').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileName.textContent = `Selected: ${fileInput.files[0].name}`;
                fileName.style.display = 'block';
            } else {
                fileName.textContent = '';
                fileName.style.display = 'none';
            }
        });
    }
}

// ---------- Initialize App ----------
function initApp() {
    // Set up event listeners
    setupEventListeners();
    
    // Initialize form stepper
    initFormStepper();
    
    // Listen to auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            try {
                // Get hospital data from Firestore
                const hospitalDoc = await getDoc(doc(db, 'hospitals', user.uid));
                if (hospitalDoc.exists()) {
                    currentHospital = hospitalDoc.data();
                    populateDashboard(currentHospital);
                    subscribeDashboardRealtime();
                    showDashboard();
                } else {
                    // Create demo hospital if doc doesn't exist
                    currentHospital = {
                        hospitalName: 'Demo Hospital',
                        registrationNumber: 'DEMO-' + user.uid.slice(0, 8),
                        email: user.email,
                        status: 'verified'
                    };
                    populateDashboard(currentHospital);
                    loadDemoData();
                    showDashboard();
                }
            } catch (error) {
                console.error('Error loading hospital data:', error);
                // Fallback to demo mode
                currentHospital = {
                    hospitalName: 'Demo Hospital',
                    email: user.email,
                    status: 'verified'
                };
                populateDashboard(currentHospital);
                loadDemoData();
                showDashboard();
            }
        } else {
            // User is signed out
            currentHospital = null;
            navDashboard.style.display = 'none';
            detachRealtimeListeners();
            showHome();
        }
    });
    
    // Update stats
    updateStats();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export for debugging
window.LifeLink = {
    auth,
    db,
    currentHospital,
    refreshData
};

console.log('LifeLink Platform initialized with Firebase');
