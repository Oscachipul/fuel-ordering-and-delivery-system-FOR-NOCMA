// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Default avatar as base64 SVG
export const defaultAvatar = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAxMmMzLjMxIDAgNi0yLjY5IDYtNnMtMi42OS02LTYtNi02IDIuNjkgNiA2IDIuNjkgNiA2IDZ6bTAgMmMtMi42NyAwLTggMS4zNC04IDR2MmgxNnYtMmMwLTIuNjYtNS4zMy00LTgtNHoiLz48L3N2Zz4=`;

// Create toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

// Show notification function
export function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-times-circle"></i>',
        warning: '<i class="fas fa-exclamation-circle"></i>',
        info: '<i class="fas fa-info-circle"></i>'
    };

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Remove the toast after 5 seconds
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// Load user header function
export async function loadUserHeader() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        
        // Update header elements
        document.getElementById('userName').textContent = userData.companyName || 'User';
        document.getElementById('userEmail').textContent = userData.email || '';

        // Set initials
        const initials = (userData.companyName || 'U')
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
        
        // Update both header and main profile pictures if they exist
        const headerProfilePic = document.getElementById('headerProfilePic');
        const headerInitials = document.getElementById('headerInitials');
        
        if (headerProfilePic && headerInitials) {
            if (userData.profilePicture) {
                try {
                    const url = await getDownloadURL(ref(storage, userData.profilePicture));
                    headerProfilePic.src = url;
                    headerProfilePic.style.display = 'block';
                    headerInitials.style.display = 'none';
                } catch (error) {
                    console.error("Error loading profile picture:", error);
                    headerProfilePic.style.display = 'none';
                    headerInitials.textContent = initials;
                    headerInitials.style.display = 'block';
                }
            } else {
                headerProfilePic.style.display = 'none';
                headerInitials.textContent = initials;
                headerInitials.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error loading user header:", error);
    }
}

// Initialize header
export function initializeHeader() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserHeader();
        } else {
            window.location.href = 'index.html';
        }
    });
}

// Logout function
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
} 