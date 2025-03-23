// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
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

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore with enhanced cache settings
export const db = initializeFirestore(app, {
    cache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
    })
});

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
        // The current browser doesn't support persistence
        console.warn('The current browser doesn\'t support persistence.');
    }
});

export default app; 