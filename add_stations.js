import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBX4Uy9QkFnQnwNHXO_Yp5h5yOXHvQDLaM",
    authDomain: "national-oil-company-malawi.firebaseapp.com",
    projectId: "national-oil-company-malawi",
    storageBucket: "national-oil-company-malawi.appspot.com",
    messagingSenderId: "965033674381",
    appId: "1:965033674381:web:c9c9f10e0e4e8c7e2c5443"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample filling stations data
const stations = [
    {
        name: "Puma Energy Lilongwe City Center",
        company: "Puma Energy",
        address: "Paul Kagame Road, City Center",
        district: "Lilongwe",
        region: "Central",
        status: "active",
        coordinates: {
            latitude: -13.9626,
            longitude: 33.7741
        }
    },
    {
        name: "Total Energies Blantyre Main",
        company: "Total Energies",
        address: "Victoria Avenue, Blantyre CBD",
        district: "Blantyre",
        region: "Southern",
        status: "active",
        coordinates: {
            latitude: -15.7861,
            longitude: 35.0058
        }
    },
    {
        name: "Mount Soche Filling Station",
        company: "Mount Soche",
        address: "Chipembere Highway",
        district: "Blantyre",
        region: "Southern",
        status: "active",
        coordinates: {
            latitude: -15.7867,
            longitude: 35.0072
        }
    },
    {
        name: "Puma Energy Mzuzu",
        company: "Puma Energy",
        address: "M1 Highway, Mzuzu",
        district: "Mzuzu",
        region: "Northern",
        status: "active",
        coordinates: {
            latitude: -11.4657,
            longitude: 34.0196
        }
    },
    {
        name: "Total Energies Zomba",
        company: "Total Energies",
        address: "M3 Road, Zomba",
        district: "Zomba",
        region: "Southern",
        status: "active",
        coordinates: {
            latitude: -15.3833,
            longitude: 35.3333
        }
    }
];

// Function to add stations to Firestore
async function addStations() {
    try {
        for (const station of stations) {
            await addDoc(collection(db, "filling_stations"), {
                ...station,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`Added station: ${station.name}`);
        }
        console.log("All stations added successfully!");
    } catch (error) {
        console.error("Error adding stations:", error);
    }
}

// Run the function
addStations(); 