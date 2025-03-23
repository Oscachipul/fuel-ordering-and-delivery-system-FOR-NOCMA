// Import Firebase SDK using CDN URLs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import * as Auth from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import * as Database from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import * as Firestore from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDfzdnF8mh9sJHlMivPaT88nXTNF2Nw3c4",
    authDomain: "national-oil-company-malawi.firebaseapp.com",
    databaseURL: "https://national-oil-company-malawi-default-rtdb.firebaseio.com",
    projectId: "national-oil-company-malawi",
    storageBucket: "national-oil-company-malawi.firebasestorage.app",
    messagingSenderId: "391745179096",
    appId: "1:391745179096:web:45d8889fe92d3d9a43b6ad",
    measurementId: "G-LST3Y0M1KY"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = Auth.getAuth(app);
const db = Database.getDatabase(app);
const firestore = Firestore.getFirestore(app);

// Admin Email
const ADMIN_EMAIL = "nocma29@gmail.com";

// Get form containers
const loginContainer = document.getElementById("login-container");
const signupContainer = document.getElementById("signup-container");
const forgotPasswordContainer = document.getElementById("forgot-password-container");
const otpContainer = document.getElementById("otp-container");

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

// Form switching functions
document.getElementById("switch-to-signup").addEventListener("click", function() {
    loginContainer.classList.add("hidden");
    signupContainer.classList.remove("hidden");
});

document.getElementById("switch-to-login").addEventListener("click", function() {
    signupContainer.classList.add("hidden");
    loginContainer.classList.remove("hidden");
});

document.getElementById("forgotPassword").addEventListener("click", function() {
    loginContainer.classList.add("hidden");
    forgotPasswordContainer.classList.remove("hidden");
});

document.getElementById("back-to-login").addEventListener("click", function() {
    forgotPasswordContainer.classList.add("hidden");
    loginContainer.classList.remove("hidden");
});

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    const patterns = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    strength += Object.values(patterns).filter(Boolean).length;

    const strengthBar = document.querySelector('.strength-bar');
    strengthBar.className = 'strength-bar';

    if (strength <= 2) {
        strengthBar.classList.add('strength-weak');
    } else if (strength <= 4) {
        strengthBar.classList.add('strength-medium');
    } else {
        strengthBar.classList.add('strength-strong');
    }

    return strength >= 4;
}

// Password input listener
document.getElementById("signupPassword").addEventListener('input', function() {
    checkPasswordStrength(this.value);
});

// Password visibility toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
});

// Function to store user data in Firestore
async function storeUserData(userId, userData) {
    try {
        // Create a reference to the users collection
        const userRef = Firestore.doc(firestore, "users", userId);
        
        // Store user details with proper security fields
        await Firestore.setDoc(userRef, {
            uid: userId,  // Store Firebase Auth UID
            companyName: userData.companyName,
            email: userData.email,
            createdAt: Firestore.serverTimestamp(), // Use server timestamp
            lastUpdated: Firestore.serverTimestamp(),
            role: userData.email === ADMIN_EMAIL ? 'admin' : 'user',
            isActive: true,
            authProvider: 'email',
            emailVerified: false
        });
        
        console.log("User data stored successfully in Firestore");
        return true;
    } catch (error) {
        console.error("Error storing user data in Firestore:", error);
        throw error;
    }
}

// Signup Function
document.getElementById("submt").addEventListener("click", async function(event) {
    event.preventDefault();

    const companyName = document.getElementById("CompanyName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();

    // Input validation
    if (!companyName || !email || !password) {
        showNotification("Please fill in all fields", "error");
        return;
    }

    if (!checkPasswordStrength(password)) {
        showNotification("Please meet all password requirements", "error");
        return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification("Please enter a valid email address", "error");
        document.getElementById("signupEmail").classList.add('input-error');
        return;
    }

    try {
        // Check if email exists in Auth
        const emailExists = await Auth.fetchSignInMethodsForEmail(auth, email);
        if (emailExists.length > 0) {
            showNotification("This email is already registered. Please login instead.", "warning");
            document.getElementById("signupEmail").classList.add('input-error');
            setTimeout(() => {
                signupContainer.classList.add("hidden");
                loginContainer.classList.remove("hidden");
            }, 3000);
            return;
        }

        // Create auth user
        const userCredential = await Auth.createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile in Auth
        await Auth.updateProfile(user, {
            displayName: companyName
        });

        // Store additional user data in Firestore
        await storeUserData(user.uid, {
            companyName,
            email,
            createdAt: new Date().toISOString(),
            role: email === ADMIN_EMAIL ? 'admin' : 'user'
        });

        // Send email verification
        await Auth.sendEmailVerification(user);

        // Clear form
        document.getElementById("CompanyName").value = '';
        document.getElementById("signupEmail").value = '';
        document.getElementById("signupPassword").value = '';

        showNotification("Account created successfully! Please check your email for verification.", "success");
        
        // Store registration timestamp in session
        sessionStorage.setItem('registrationTime', new Date().toISOString());
        
        setTimeout(() => {
            signupContainer.classList.add("hidden");
            loginContainer.classList.remove("hidden");
        }, 3000);

    } catch (error) {
        console.error("Signup error:", error);
        
        // Handle specific error cases
        switch (error.code) {
            case 'auth/email-already-in-use':
                showNotification("This email is already registered. Please login instead.", "warning");
                document.getElementById("signupEmail").classList.add('input-error');
                break;
            case 'auth/invalid-email':
                showNotification("Please enter a valid email address", "error");
                document.getElementById("signupEmail").classList.add('input-error');
                break;
            case 'auth/operation-not-allowed':
                showNotification("Email/password registration is currently disabled", "error");
                break;
            case 'auth/weak-password':
                showNotification("Please choose a stronger password (at least 8 characters)", "warning");
                document.getElementById("signupPassword").classList.add('input-error');
                break;
            default:
                showNotification("Registration failed. Please try again later.", "error");
        }

        // If Auth was created but Firestore failed, cleanup
        if (error.code === 'permission-denied' && userCredential?.user) {
            try {
                await userCredential.user.delete();
                console.log("Cleaned up Auth user after Firestore failure");
            } catch (deleteError) {
                console.error("Error cleaning up Auth user:", deleteError);
            }
        }
    }
});

// Login Function
document.getElementById("loginSubmit").addEventListener("click", async function(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
        showNotification("Please enter both email and password", "error");
        return;
    }

    try {
        const userCredential = await Auth.signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP in Realtime Database
        await Database.set(Database.ref(db, `otps/${user.uid}`), {
            otp: otp,
            createdAt: new Date().toISOString(),
            email: email // Store email with OTP
        });

        // Store session data
        sessionStorage.setItem("loggedInUserId", user.uid);
        sessionStorage.setItem("loggedInUserEmail", email);

        // Send OTP email
        try {
            const response = await fetch('http://localhost:5500/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    otp: otp
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                // Show OTP form
                loginContainer.classList.add("hidden");
                otpContainer.classList.remove("hidden");
                showNotification("OTP sent to your email", "success");
            } else {
                throw new Error(data.message || "Failed to send OTP");
            }
        } catch (error) {
            console.error("OTP sending error:", error);
            showNotification(error.message || "Failed to send OTP. Please try again", "error");
            
            // Clean up if OTP sending fails
            try {
                await Database.remove(Database.ref(db, `otps/${user.uid}`));
            } catch (cleanupError) {
                console.error("Error cleaning up OTP:", cleanupError);
            }
        }
    } catch (error) {
        showNotification("Invalid email or password", "error");
        console.error("Login error:", error);
    }
});

// OTP Verification Function
document.getElementById("otpSubmit").addEventListener("click", async function(event) {
    event.preventDefault();

    const enteredOtp = document.getElementById("otpInput").value.trim();
    const userId = sessionStorage.getItem("loggedInUserId");
    const userEmail = sessionStorage.getItem("loggedInUserEmail");

    // Debug logging
    console.log("Entered OTP:", enteredOtp);
    console.log("User ID:", userId);
    console.log("User Email:", userEmail);

    // Input validation
    if (!enteredOtp) {
        showNotification("Please enter your OTP code", "warning");
        return;
    }

    if (!userId || !userEmail) {
        showNotification("Session expired. Please login again", "error");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
        return;
    }

    try {
        // Verify OTP from Realtime Database
        const otpRef = Database.ref(db, `otps/${userId}`);
        const otpSnapshot = await Database.get(otpRef);

        if (!otpSnapshot.exists()) {
            showNotification("OTP expired or not found. Please login again", "error");
            return;
        }

        const otpData = otpSnapshot.val();
        console.log("Stored OTP data:", otpData); // Debug log

        // Ensure both OTPs are strings and trimmed
        const storedOtp = String(otpData.otp).trim();
        const cleanedEnteredOtp = String(enteredOtp).trim();

        console.log("Comparing OTPs - Stored:", storedOtp, "Entered:", cleanedEnteredOtp); // Debug log

        // Check if OTP matches
        if (storedOtp !== cleanedEnteredOtp) {
            showNotification("Invalid OTP code. Please check and try again", "error");
            return;
        }

        // Check if OTP is expired (5 minutes)
        const otpTime = new Date(otpData.createdAt).getTime();
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - otpTime;
        console.log("Time difference (ms):", timeDiff); // Debug log

        if (timeDiff > 5 * 60 * 1000) {
            showNotification("OTP has expired. Please login again", "error");
            await Database.remove(otpRef);
            return;
        }

        // Clear the used OTP
        await Database.remove(otpRef);

        // Set post-OTP verification flag
        sessionStorage.setItem("postOTPVerification", "true");

        // Show success message
        showNotification("Login successful! Redirecting...", "success");

        // Redirect based on email
        setTimeout(() => {
            if (userEmail === ADMIN_EMAIL) {
                window.location.href = "admin_dashboard.html";
            } else {
                window.location.href = "user_dashboard.html";
            }
        }, 2000);

    } catch (error) {
        console.error("OTP verification error:", error);
        showNotification("Verification failed. Please try again", "error");
    }
});

// Function to get user data from Firestore
async function getUserData(userId) {
    try {
        const docRef = Firestore.doc(firestore, "users", userId);
        const docSnap = await Firestore.getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting user data:", error);
        throw error;
    }
}

// Update the forgot password function
document.getElementById("resetPasswordSubmit").addEventListener("click", async function(event) {
    event.preventDefault();
    
    const email = document.getElementById("resetEmail").value.trim();
    
    // Validate email
    if (!email) {
        showNotification("Please enter your email address", "error");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification("Please enter a valid email address", "error");
        document.getElementById("resetEmail").classList.add('input-error');
        return;
    }

    try {
        // Check in Firestore first
        const usersCollection = Firestore.collection(firestore, "users");
        const q = Firestore.query(usersCollection, Firestore.where("email", "==", email));
        const querySnapshot = await Firestore.getDocs(q);

        if (querySnapshot.empty) {
            showNotification("No account found with this email", "error");
            document.getElementById("resetEmail").classList.add('input-error');
            return;
        }

        // If we found the email in Firestore, send the reset email
        await Auth.sendPasswordResetEmail(auth, email);
        
        // Show success message
        showNotification("Password reset link sent to your email", "success");
        
        // Clear the input
        document.getElementById("resetEmail").value = '';
        document.getElementById("resetEmail").classList.remove('input-error');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
            forgotPasswordContainer.classList.add("hidden");
            loginContainer.classList.remove("hidden");
        }, 3000);

    } catch (error) {
        console.error("Password reset error:", error);
        
        if (error.code === 'permission-denied') {
            // If Firestore permission denied, try direct Auth method
            try {
                await Auth.sendPasswordResetEmail(auth, email);
                showNotification("Password reset link sent to your email", "success");
                
                // Clear the input and redirect
                document.getElementById("resetEmail").value = '';
                document.getElementById("resetEmail").classList.remove('input-error');
                
                setTimeout(() => {
                    forgotPasswordContainer.classList.add("hidden");
                    loginContainer.classList.remove("hidden");
                }, 3000);
                return;
            } catch (authError) {
                console.error("Auth error:", authError);
            }
        }
        
        // Handle other error cases
        switch (error.code) {
            case 'auth/invalid-email':
                showNotification("Invalid email address", "error");
                break;
            case 'auth/user-not-found':
                showNotification("No account found with this email", "error");
                break;
            case 'auth/too-many-requests':
                showNotification("Too many attempts. Please try again later", "warning");
                break;
            case 'auth/network-request-failed':
                showNotification("Network error. Please check your connection", "error");
                break;
            default:
                // Try direct auth method as fallback
                try {
                    await Auth.sendPasswordResetEmail(auth, email);
                    showNotification("Password reset link sent to your email", "success");
                    
                    // Clear the input and redirect
                    document.getElementById("resetEmail").value = '';
                    document.getElementById("resetEmail").classList.remove('input-error');
                    
                    setTimeout(() => {
                        forgotPasswordContainer.classList.add("hidden");
                        loginContainer.classList.remove("hidden");
                    }, 3000);
                } catch (finalError) {
                    showNotification("Failed to send reset link. Please try again", "error");
                }
        }
    }
});

