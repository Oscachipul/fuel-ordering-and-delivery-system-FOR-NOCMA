// Firebase imports
import { 
    auth, 
    db, 
    initializeHeader,
    enableIndexedDbPersistence
} from './shared.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc, 
    getDoc,
    addDoc,
    serverTimestamp,
    orderBy,
    limit,
    onSnapshot,
    enableNetwork,
    disableNetwork
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize header
initializeHeader();

// Enable offline persistence
enableIndexedDbPersistence(db)
    .then(() => {
        console.log("Offline persistence enabled");
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
        } else if (err.code === 'unimplemented') {
            console.warn("The current browser doesn't support offline persistence");
        }
    });

// UI Elements
const stationsList = document.getElementById('stations-list');
const orderForm = document.getElementById('order-form');
const searchInput = document.getElementById('station-search');

// Create toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

// Network status monitoring
let isOnline = navigator.onLine;
const networkStatusDiv = document.createElement('div');
networkStatusDiv.className = 'network-status';
networkStatusDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: bold;
    z-index: 9999;
    display: none;
`;
document.body.appendChild(networkStatusDiv);

function updateNetworkStatus(online) {
    isOnline = online;
    networkStatusDiv.style.display = 'block';
    if (online) {
        networkStatusDiv.style.backgroundColor = '#4CAF50';
        networkStatusDiv.style.color = 'white';
        networkStatusDiv.textContent = 'Online';
        enableNetwork(db).then(() => {
            loadFillingStations();
        });
        setTimeout(() => {
            networkStatusDiv.style.display = 'none';
        }, 3000);
    } else {
        networkStatusDiv.style.backgroundColor = '#f44336';
        networkStatusDiv.style.color = 'white';
        networkStatusDiv.textContent = 'Offline';
        disableNetwork(db);
        showNotification('Working offline. Changes will sync when you're back online.', 'warning');
    }
}

// Monitor network status
window.addEventListener('online', () => updateNetworkStatus(true));
window.addEventListener('offline', () => updateNetworkStatus(false));
updateNetworkStatus(navigator.onLine);

// Notification system
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

// Map and location handling
let map;
let markers = [];
let userLocation = null;
let selectedStation = null;

window.initMap = async function() {
    try {
        const malawiCenter = { lat: -13.2543, lng: 34.3015 };
        
        map = new google.maps.Map(document.getElementById('map'), {
            center: malawiCenter,
            zoom: 7,
            styles: [
                {
                    featureType: "poi.business",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Get user location
        try {
            const position = await getCurrentPosition();
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            new google.maps.Marker({
                position: userLocation,
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                },
                title: 'Your Location'
            });

            map.setCenter(userLocation);
            map.setZoom(10);
        } catch (error) {
            console.log('User location not available:', error);
        }

        await loadFillingStations();
    } catch (error) {
        console.error("Error initializing map:", error);
        showNotification("Error loading map. Please refresh the page.", "error");
    }
};

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

// Station handling
async function loadFillingStations() {
    try {
        if (!stationsList) {
            console.error('Stations list element not found');
            return;
        }

        stationsList.innerHTML = '<div class="loading">Loading stations...</div>';

        const stationsQuery = query(
            collection(db, 'filling_stations'),
            where('active', '==', true),
            orderBy('name'),
            limit(50)
        );

        const unsubscribe = onSnapshot(stationsQuery, 
            (snapshot) => {
                const stations = [];
                snapshot.forEach((doc) => {
                    stations.push({ id: doc.id, ...doc.data() });
                });

                if (userLocation) {
                    stations.forEach(station => {
                        station.distance = calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            station.location.latitude,
                            station.location.longitude
                        );
                    });
                    stations.sort((a, b) => a.distance - b.distance);
                }

                updateStationsList(stations);
                updateMapMarkers(stations);
            },
            (error) => {
                console.error("Error loading stations:", error);
                showNotification("Error loading stations. Please try again later.", "error");
                stationsList.innerHTML = '<div class="error">Failed to load stations. Please refresh the page.</div>';
            }
        );

        // Cleanup previous listener
        if (window.stationsUnsubscribe) {
            window.stationsUnsubscribe();
        }
        window.stationsUnsubscribe = unsubscribe;

    } catch (error) {
        console.error("Error in loadFillingStations:", error);
        showNotification("Error loading stations. Please try again later.", "error");
        stationsList.innerHTML = '<div class="error">Failed to load stations. Please refresh the page.</div>';
    }
}

function updateStationsList(stations) {
    if (!stationsList) return;

    stationsList.innerHTML = '';
    
    if (stations.length === 0) {
        stationsList.innerHTML = '<div class="no-results">No stations found</div>';
        return;
    }

    stations.forEach(station => {
        const card = createStationCard(station);
        stationsList.appendChild(card);
    });
}

function createStationCard(station) {
    const card = document.createElement('div');
    card.className = 'station-card';
    card.dataset.stationId = station.id;

    const distanceText = station.distance 
        ? `${(station.distance).toFixed(1)} km away`
        : 'Distance unknown';

    card.innerHTML = `
        <div class="station-image">
            <img src="${station.photoUrl || 'default-station.jpg'}" alt="${station.name}" 
                onerror="this.src='default-station.jpg'">
        </div>
        <div class="station-info">
            <h3>${station.name}</h3>
            <p>${station.address}</p>
            <p>${station.district}, ${station.region}</p>
            <div class="station-details">
                <span class="rating">⭐ ${station.rating || 'N/A'}</span>
                <span class="distance">${distanceText}</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => selectStation(station));

    return card;
}

function updateMapMarkers(stations) {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    stations.forEach(station => {
        const marker = new google.maps.Marker({
            position: {
                lat: station.location.latitude,
                lng: station.location.longitude
            },
            map: map,
            title: station.name,
            animation: google.maps.Animation.DROP
        });

        marker.addListener('click', () => selectStation(station));
        markers.push(marker);
    });
}

function selectStation(station) {
    selectedStation = station;

    // Update UI to show selected station
    document.querySelectorAll('.station-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.stationId === station.id) {
            card.classList.add('selected');
        }
    });

    // Center map on selected station
    map.setCenter({
        lat: station.location.latitude,
        lng: station.location.longitude
    });
    map.setZoom(15);

    // Update order form
    updateOrderSummary();
}

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI/180);
}

// Search functionality
if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
}

function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.station-card');
    
    cards.forEach(card => {
        const stationInfo = card.textContent.toLowerCase();
        if (stationInfo.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the page
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadFillingStations();
    } else {
        window.location.href = 'index.html';
    }
}); 