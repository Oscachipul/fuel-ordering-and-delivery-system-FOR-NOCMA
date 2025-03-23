// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDfzdnF8mh9sJHlMivPaT88nXTNF2Nw3c4",
    authDomain: "national-oil-company-malawi.firebaseapp.com",
    projectId: "national-oil-company-malawi",
    storageBucket: "national-oil-company-malawi.appspot.com",
    messagingSenderId: "391745179096",
    appId: "1:391745179096:web:45d8889fe92d3d9a43b6ad"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin email constant
const ADMIN_EMAIL = "nocma29@gmail.com";

// Create toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

// Notification function
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        </div>
        <div class="toast-progress">
            <div class="toast-progress-bar"></div>
        </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toastContainer.removeChild(toast), 300);
    }, 5000);
}

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Add auth state change listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            showNotification("Please login to access the admin dashboard", "warning");
            window.location.href = 'index.html';
            return;
        }

        try {
            console.log("User authenticated, checking admin status");
            
            // Get user data
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (!userDoc.exists()) {
                console.log("No user document found");
                showNotification("User data not found", "error");
                await signOut(auth);
                window.location.href = 'index.html';
                return;
            }

            const userData = userDoc.data();
            
            // Check if user is admin
            if (userData.email !== ADMIN_EMAIL) {
                console.log("Non-admin user attempting to access admin dashboard");
                showNotification("Unauthorized access. Redirecting to user dashboard.", "error");
                window.location.href = 'user_dashboard.html';
                return;
            }

            console.log("Admin access confirmed");
            showNotification("Welcome back, Admin!", "success");

            // Load admin dashboard data here
            // TODO: Implement dashboard data loading functions

        } catch (error) {
            console.error("Error in auth state change:", error);
            showNotification("Failed to load admin data", "error");
        }
    });

    // Add logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error signing out:", error);
            showNotification("Failed to sign out", "error");
        }
    });
}); 