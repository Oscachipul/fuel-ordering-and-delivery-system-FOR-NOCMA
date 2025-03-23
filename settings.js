import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDfzdnF8mh9sJHlMivPaT88nXTNF2Nw3c4",
    authDomain: "national-oil-company-malawi.firebaseapp.com",
    projectId: "national-oil-company-malawi",
    storageBucket: "national-oil-company-malawi.firebasestorage.app",
    messagingSenderId: "391745179096",
    appId: "1:391745179096:web:45d8889fe92d3d9a43b6ad"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Add default avatar constant at the top of the file after Firebase initialization
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzk0YTNiOCIvPjxwYXRoIGQ9Ik0xMCw4NWMwLTIyLjA5MTM5LDE3LjkwODYxLTQwLDQwLTQwczQwLDE3LjkwODYxLDQwLDQwIiBmaWxsPSIjOTRhM2I4Ii8+PC9zdmc+';

// Create toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

// Show notification function
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
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toastContainer.removeChild(toast), 300);
    }, 3000);
}

// Handle profile picture preview
function handleProfilePicturePreview(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const headerProfilePic = document.getElementById('headerProfilePic');
            const mainProfilePic = document.getElementById('currentProfilePic');
            
            headerProfilePic.src = e.target.result;
            mainProfilePic.src = e.target.result;
            
            headerProfilePic.style.opacity = '1';
            mainProfilePic.style.opacity = '1';
            headerProfilePic.classList.remove('error');
        };
        reader.readAsDataURL(file);
    }
}

// Upload profile picture
async function uploadProfilePicture(file) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size exceeds 5MB limit');
        }

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }

        // Create a simple storage path
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `profile_pictures/${fileName}`);
        
        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);
        console.log('File uploaded successfully');
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Download URL obtained');
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        if (error.code === 'storage/unauthorized') {
            throw new Error('Permission denied. Please make sure you are logged in.');
        }
        throw error;
    }
}

// Delete old profile picture
async function deleteOldProfilePicture(photoURL) {
    try {
        if (!photoURL) return;

        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');

        // Only delete if it's a Firebase Storage URL from our bucket
        if (photoURL.includes('profile_pictures')) {
            const storageRef = ref(storage, photoURL);
            await deleteObject(storageRef);
        }
    } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Don't throw the error as this is not critical
    }
}

// Load user profile data
async function loadUserProfile() {
    try {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Update user info in header
            const initials = userData.companyName ? userData.companyName.charAt(0).toUpperCase() : 'U';
            document.getElementById('userInitials').textContent = initials;
            document.getElementById('userName').textContent = userData.companyName || 'User';
            document.getElementById('userEmail').textContent = user.email;
            
            // Update both profile pictures with proper fallback
            const headerProfilePic = document.getElementById('headerProfilePic');
            const mainProfilePic = document.getElementById('currentProfilePic');
            
            // Set default avatar first
            headerProfilePic.src = DEFAULT_AVATAR;
            mainProfilePic.src = DEFAULT_AVATAR;
            
            // Then try to load the user's profile picture if it exists
            if (userData.photoURL) {
                headerProfilePic.src = userData.photoURL;
                mainProfilePic.src = userData.photoURL;
            }
            
            // Error handling for both images
            headerProfilePic.onerror = () => {
                headerProfilePic.src = DEFAULT_AVATAR;
                headerProfilePic.classList.add('error');
            };
            
            mainProfilePic.onerror = () => {
                mainProfilePic.src = DEFAULT_AVATAR;
            };

            // Update profile preview
            document.getElementById('previewName').textContent = userData.companyName || 'Company Name';
            document.getElementById('previewEmail').textContent = user.email;
            
            // Fill form fields
            document.getElementById('companyName').value = userData.companyName || '';
            document.getElementById('contactPerson').value = userData.contactPerson || '';
            document.getElementById('email').value = user.email || '';
            document.getElementById('phone').value = userData.phone || '';
            document.getElementById('address').value = userData.address || '';
            document.getElementById('businessType').value = userData.businessType || '';
            document.getElementById('licenseNumber').value = userData.licenseNumber || '';

            // Load notification settings
            document.getElementById('emailNotifications').checked = userData.notifications?.email ?? true;
            document.getElementById('orderUpdates').checked = userData.notifications?.orders ?? true;
            document.getElementById('deliveryAlerts').checked = userData.notifications?.deliveries ?? true;
            document.getElementById('invoiceNotifications').checked = userData.notifications?.invoices ?? true;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showNotification('Failed to load user profile', 'error');
    }
}

// Update profile information
async function updateProfile(event) {
    event.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');

        // Show loading state
        const form = document.getElementById('profileForm');
        form.classList.add('loading');
        
        let photoURL = null; // Reset photoURL
        const profilePicInput = document.getElementById('profilePicture');
        
        if (profilePicInput.files.length > 0) {
            try {
                photoURL = await uploadProfilePicture(profilePicInput.files[0]);
                console.log('New photo URL:', photoURL);
                
                // If upload successful, delete old profile picture
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists() && userDoc.data().photoURL) {
                    await deleteOldProfilePicture(userDoc.data().photoURL);
                }
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                showNotification(error.message || 'Failed to upload profile picture', 'error');
                // Continue with the rest of the profile update even if image upload fails
            }
        } else {
            // Keep existing photo URL if no new file is uploaded
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                photoURL = userDoc.data().photoURL;
            }
        }

        // Get form data
        const formData = {
            companyName: document.getElementById('companyName').value,
            contactPerson: document.getElementById('contactPerson').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            businessType: document.getElementById('businessType').value,
            licenseNumber: document.getElementById('licenseNumber').value,
            photoURL: photoURL
        };

        // Update Firestore document
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, formData);

        // Update UI elements
        document.getElementById('userInitials').textContent = formData.companyName.charAt(0).toUpperCase();
        document.getElementById('userName').textContent = formData.companyName;
        document.getElementById('previewName').textContent = formData.companyName;
        
        // Update both profile pictures
        if (photoURL) {
            const headerProfilePic = document.getElementById('headerProfilePic');
            const mainProfilePic = document.getElementById('currentProfilePic');
            
            headerProfilePic.src = photoURL;
            mainProfilePic.src = photoURL;
            
            headerProfilePic.classList.remove('error');
            headerProfilePic.style.opacity = '1';
            mainProfilePic.style.opacity = '1';
        }

        showNotification('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification(error.message || 'Failed to update profile', 'error');
    } finally {
        // Remove loading state from the form
        const form = document.getElementById('profileForm');
        form.classList.remove('loading');
    }
}

// Reset form
function resetForm() {
    if (confirm('Are you sure you want to reset the form? All unsaved changes will be lost.')) {
        loadUserProfile();
    }
}

// Remove profile picture
async function removeProfilePicture() {
    try {
        const user = auth.currentUser;
        if (!user) {
            showNotification('Please log in to remove profile picture', 'error');
            return;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().photoURL) {
            await deleteOldProfilePicture(userDoc.data().photoURL);
            
            await updateDoc(doc(db, "users", user.uid), {
                photoURL: null
            });

            // Update both profile pictures
            document.getElementById('currentProfilePic').src = DEFAULT_AVATAR;
            const headerProfilePic = document.getElementById('headerProfilePic');
            headerProfilePic.src = DEFAULT_AVATAR;
            headerProfilePic.classList.remove('error');
            
            showNotification('Profile picture removed successfully', 'success');
        }
    } catch (error) {
        console.error('Error removing profile picture:', error);
        showNotification('Failed to remove profile picture', 'error');
    }
}

// Save notification settings
async function saveNotificationSettings() {
    try {
        const user = auth.currentUser;
        if (!user) {
            showNotification('Please log in to update settings', 'error');
            return;
        }

        const notificationSettings = {
            notifications: {
                email: document.getElementById('emailNotifications').checked,
                orders: document.getElementById('orderUpdates').checked,
                deliveries: document.getElementById('deliveryAlerts').checked,
                invoices: document.getElementById('invoiceNotifications').checked
            }
        };

        await updateDoc(doc(db, "users", user.uid), notificationSettings);
        showNotification('Notification preferences saved', 'success');
    } catch (error) {
        console.error('Error saving notification settings:', error);
        showNotification('Failed to save notification settings', 'error');
    }
}

// Change password
async function changePassword(event) {
    event.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            showNotification('Please log in to change password', 'error');
            return;
        }

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validate new password
        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        // Reauthenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, newPassword);
        
        showNotification('Password updated successfully', 'success');
        document.getElementById('securityForm').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        if (error.code === 'auth/wrong-password') {
            showNotification('Current password is incorrect', 'error');
        } else {
            showNotification('Failed to change password', 'error');
        }
    }
}

// Delete account
async function deleteAccount() {
    try {
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            showNotification('Please log in to delete account', 'error');
            return;
        }

        // Delete user data from Firestore
        await deleteDoc(doc(db, "users", user.uid));

        // Delete user authentication
        await deleteUser(user);

        showNotification('Account deleted successfully', 'success');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error deleting account:', error);
        showNotification('Failed to delete account', 'error');
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUserProfile();
        } else {
            window.location.href = 'login.html';
        }
    });

    // Add form submit handlers
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('securityForm').addEventListener('submit', changePassword);

    // Add profile picture handlers
    document.getElementById('changeProfilePicBtn').addEventListener('click', () => {
        document.getElementById('profilePicture').click();
    });

    document.getElementById('profilePicture').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
            showNotification('File size must be less than 5MB', 'error');
            event.target.value = ''; // Clear the file input
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('File must be an image', 'error');
            event.target.value = ''; // Clear the file input
            return;
        }

        // Preview the image
        handleProfilePicturePreview(file);
    });

    document.getElementById('removeProfilePicBtn').addEventListener('click', removeProfilePicture);

    // Add logout handler
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showNotification('Failed to sign out', 'error');
        }
    });

    // Add real-time preview for company name
    document.getElementById('companyName').addEventListener('input', (e) => {
        document.getElementById('previewName').textContent = e.target.value || 'Company Name';
    });
});

// Make functions available globally
window.saveNotificationSettings = saveNotificationSettings;
window.deleteAccount = deleteAccount;
window.resetForm = resetForm; 