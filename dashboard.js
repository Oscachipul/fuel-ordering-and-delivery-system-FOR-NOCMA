import { auth, db, loadUserHeader, initializeHeader } from './shared.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Initialize the header with user profile
initializeHeader();

// Your existing dashboard-specific code here
// ... existing code ... 