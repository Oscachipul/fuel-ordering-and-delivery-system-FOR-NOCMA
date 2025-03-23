import { 
    auth, 
    db, 
    initializeHeader,
    defaultAvatar 
} from './shared.js';
import { 
    collection, 
    query,
    where,
    getDocs,
    doc, 
    getDoc,
    addDoc,
    writeBatch,
    serverTimestamp,
    orderBy,
    limit,
    onSnapshot,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Initialize Firebase Storage
const storage = getStorage();

// Initialize header
initializeHeader();

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

// Make map variables global
let map;
let markers = [];
let userLocation = null;

// Add static filling station data
const staticFillingStations = [
    {
        id: 'total-limbe',
        name: 'TotalEnergies Limbe',
        coordinates: {
            latitude: -15.8147,
            longitude: 35.0549
        },
        address: 'Livingstone Avenue, Limbe, Blantyre',
        rating: 4.5,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Total'
    },
    {
        id: 'puma-blantyre-central',
        name: 'Puma Energy Blantyre Central',
            coordinates: {
            latitude: -15.7861,
            longitude: 35.0058
        },
        address: 'Victoria Avenue, Blantyre CBD',
        rating: 4.3,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Puma'
    },
    {
        id: 'mount-meru-chilomoni',
        name: 'Mount Meru Chilomoni',
            coordinates: {
            latitude: -15.7789,
            longitude: 34.9872
        },
        address: 'Chilomoni Ring Road, Blantyre',
        rating: 4.2,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Mount'
    },
    {
        id: 'total-chirimba',
        name: 'TotalEnergies Chirimba',
            coordinates: {
            latitude: -15.7933,
            longitude: 34.9789
        },
        address: 'Chirimba Industrial Area, Blantyre',
        rating: 4.4,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Total'
    },
    {
        id: 'puma-ndirande',
        name: 'Puma Energy Ndirande',
            coordinates: {
            latitude: -15.7847,
            longitude: 35.0276
        },
        address: 'Ndirande Ring Road, Blantyre',
        rating: 4.1,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Puma'
    },
    {
        id: 'petroda-bangwe',
        name: 'Petroda Bangwe',
            coordinates: {
            latitude: -15.8028,
            longitude: 35.0432
        },
        address: 'Bangwe Township, Blantyre',
        rating: 4.0,
        status: 'active',
        district: 'Blantyre',
        region: 'Southern',
        company: 'Petroda'
    },
    {
        id: 'total-zomba',
        name: 'TotalEnergies Zomba',
        coordinates: {
            latitude: -15.3833,
            longitude: 35.3333
        },
        address: 'M3 Highway, Zomba',
        rating: 4.3,
        status: 'active',
        district: 'Zomba',
        region: 'Southern',
        company: 'Total'
    },
    {
        id: 'puma-thyolo',
        name: 'Puma Energy Thyolo',
        coordinates: {
            latitude: -16.0670,
            longitude: 35.1405
        },
        address: 'Thyolo Road, Thyolo',
        rating: 4.0,
        status: 'active',
        district: 'Thyolo',
        region: 'Southern',
        company: 'Puma'
    },
    {
        id: 'mount-meru-luchenza',
        name: 'Mount Meru Luchenza',
        coordinates: {
            latitude: -16.0079,
            longitude: 35.2095
        },
        address: 'Luchenza Trading Centre',
        rating: 4.1,
        status: 'active',
        district: 'Thyolo',
        region: 'Southern',
        company: 'Mount'
    },
    {
        id: 'total-mulanje',
        name: 'TotalEnergies Mulanje',
        coordinates: {
            latitude: -16.0319,
            longitude: 35.5000
        },
        address: 'Mulanje Trading Centre',
        rating: 4.2,
        status: 'active',
        district: 'Mulanje',
        region: 'Southern',
        company: 'Total'
    },
    {
        id: 'puma-chikwawa',
        name: 'Puma Energy Chikwawa',
        coordinates: {
            latitude: -16.0345,
            longitude: 34.7844
        },
        address: 'Chikwawa Trading Centre',
        rating: 4.0,
        status: 'active',
        district: 'Chikwawa',
        region: 'Southern',
        company: 'Puma'
    },
    {
        id: 'total-mangochi',
        name: 'TotalEnergies Mangochi',
        coordinates: {
            latitude: -14.4782,
            longitude: 35.2500
        },
        address: 'Mangochi Town',
        rating: 4.4,
        status: 'active',
        district: 'Mangochi',
        region: 'Southern',
        company: 'Total'
    }
];

// Update the initMap function
window.initMap = async function() {
    try {
        // Create the map using the configuration
        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: -13.9626, lng: 33.7741 }, // Center on Lilongwe
            zoom: 12,
            mapId: GOOGLE_MAPS_CONFIG.mapId,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                mapTypeIds: ["roadmap", "satellite"]
            },
            streetViewControl: true,
            fullscreenControl: true
        });

        // Load stations directly
        await loadFillingStations();

    } catch (error) {
        console.error("Error initializing map:", error);
        showNotification("Error loading map. Please refresh the page.", "error");
    }
};

// Helper function to create marker content
function createMarkerContent(title, type = 'station') {
    const container = document.createElement('div');
    container.className = 'custom-marker';
    
    const iconElement = document.createElement('div');
    iconElement.className = `marker-icon ${type}`;
    
    if (type === 'user') {
        iconElement.innerHTML = '<i class="fas fa-user-circle"></i>';
        iconElement.style.backgroundColor = '#2563eb';
    } else {
        iconElement.innerHTML = '<i class="fas fa-gas-pump"></i>';
        iconElement.style.backgroundColor = '#ef4444';
    }
    
    const labelElement = document.createElement('div');
    labelElement.className = 'marker-label';
    labelElement.textContent = title;
    
    container.appendChild(iconElement);
    container.appendChild(labelElement);
    
    return container;
}

// Update the updateMapMarkers function to use AdvancedMarkerElement
async function updateMapMarkers(stations) {
    try {
        // Clear existing markers
        markers.forEach(marker => marker.map = null);
        markers = [];

        // Import the marker library
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        // Create new markers
        for (const station of stations) {
            const marker = new AdvancedMarkerElement({
                map,
                position: {
                    lat: station.location.latitude,
                    lng: station.location.longitude
                },
                title: station.name,
                content: createMarkerContent(station.name)
            });

            // Add click listener
            marker.addEventListener('gmp-click', () => selectStation(station));
            markers.push(marker);
        }
    } catch (error) {
        console.error("Error updating map markers:", error);
        showNotification("Error displaying station markers", "error");
    }
}

// Add styles for markers
const markerStyles = document.createElement('style');
markerStyles.textContent = `
    .custom-marker {
    display: flex;
        flex-direction: column;
    align-items: center;
    cursor: pointer;
    }
    
    .marker-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        background-color: #ef4444;
        transition: transform 0.2s;
    }
    
    .marker-icon:hover {
        transform: scale(1.1);
    }
    
    .marker-icon.user {
        background-color: #2563eb;
    }
    
    .marker-icon i {
        font-size: 16px;
    }
    
    .marker-label {
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        margin-top: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        max-width: 150px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .map-marker-info {
        padding: 12px;
        max-width: 250px;
    }

    .map-marker-info h3 {
        margin: 0 0 8px 0;
        color: #1e293b;
        font-size: 16px;
    }

    .map-marker-info p {
        margin: 0 0 8px 0;
        color: #64748b;
        font-size: 14px;
    }

    .select-station-btn {
        background-color: #2563eb;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
    cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        width: 100%;
        margin-top: 8px;
        font-weight: 500;
    }

    .select-station-btn:hover {
        background-color: #1e40af;
        transform: translateY(-1px);
    }

    .select-station-btn:active {
        transform: translateY(0);
    }
`;
document.head.appendChild(markerStyles);

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

async function loadFillingStations() {
    try {
            const stationCards = document.getElementById('stationCards');
        
        // Use static data directly
        const stations = staticFillingStations.map(station => ({
            id: station.id,
            name: station.name,
            coordinates: station.coordinates,
            address: station.address,
            rating: station.rating,
            status: station.status,
            district: station.district,
            region: station.region,
            company: station.company
        }));

            if (stations.length === 0) {
                stationCards.innerHTML = `
                    <div class="no-stations">
                        <i class="fas fa-gas-pump"></i>
                        <p>No filling stations available at the moment</p>
                    </div>
                `;
                return;
            }

            // Update total stations count
            const totalStationsMessage = document.createElement('div');
            totalStationsMessage.className = 'total-stations-message';
            totalStationsMessage.innerHTML = `
                <i class="fas fa-info-circle"></i>
                Found ${stations.length} filling stations available
            `;
            stationCards.innerHTML = '';
            stationCards.appendChild(totalStationsMessage);

            try {
                // Import the marker library
                const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

                // Clear existing markers
                markers.forEach(marker => marker.map = null);
                markers = [];

                // Create markers for each station
                stations.forEach(station => {
                    // Create station card
                    const card = createStationCard(station);
                    stationCards.appendChild(card);

                    // Create marker with custom icon
                    const markerContent = document.createElement('div');
                    markerContent.className = 'custom-marker';
                    markerContent.innerHTML = `
                        <div class="marker-icon station ${station.company.toLowerCase()}">
                            <i class="fas fa-gas-pump"></i>
                        </div>
                        <div class="marker-label">${station.name}</div>
                    `;

                    const marker = new AdvancedMarkerElement({
                        map,
                        position: {
                            lat: station.coordinates.latitude,
                            lng: station.coordinates.longitude
                        },
                        title: station.name,
                        content: markerContent
                    });

                    // Create info window with more details
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="map-marker-info">
                                <h3>${station.name}</h3>
                                <p><i class="fas fa-map-marker-alt"></i> ${station.address}</p>
                                ${station.rating ? `
                                    <p><i class="fas fa-star"></i> Rating: ${station.rating.toFixed(1)} / 5.0</p>
                                ` : ''}
                                <p><i class="fas fa-map"></i> ${station.district}, ${station.region}</p>
                            <button class="select-station-btn" data-station-id="${station.id}">Select This Station</button>
                            </div>
                        `
                    });

                // Add click listener to marker using gmp-click
                marker.addEventListener('gmp-click', () => {
                        // Close all other info windows
                        markers.forEach(m => m.infoWindow?.close());
                        infoWindow.open(map, marker);
                    
                    // Add click listener to the select button after info window is opened
                    setTimeout(() => {
                        const selectBtn = document.querySelector('.select-station-btn');
                        if (selectBtn) {
                            selectBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                const stationId = selectBtn.dataset.stationId;
                                window.selectStation(stationId);
                            });
                        }
                    }, 100);
                    });

                    marker.infoWindow = infoWindow;
                    markers.push(marker);
                });

                // Fit map bounds to show all markers
                if (markers.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    markers.forEach(marker => {
                        bounds.extend(marker.position);
                    });
                    map.fitBounds(bounds);
                }

            } catch (markerError) {
                console.error("Error creating markers:", markerError);
                // Fallback to basic markers
                stations.forEach(station => {
                    const card = createStationCard(station);
                    stationCards.appendChild(card);

                    const marker = new google.maps.Marker({
                        position: {
                            lat: station.coordinates.latitude,
                            lng: station.coordinates.longitude
                        },
                        map: map,
                        title: station.name,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/gas.png'
                        }
                    });

                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="map-marker-info">
                                <h3>${station.name}</h3>
                                <p><i class="fas fa-map-marker-alt"></i> ${station.address}</p>
                                ${station.rating ? `
                                    <p><i class="fas fa-star"></i> Rating: ${station.rating.toFixed(1)} / 5.0</p>
                                ` : ''}
                                <p><i class="fas fa-map"></i> ${station.district}, ${station.region}</p>
                            <button class="select-station-btn" data-station-id="${station.id}">Select This Station</button>
                            </div>
                        `
                    });

                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                        selectStation(station.id);
                    });

                    markers.push(marker);
                });
            }

            // Initialize search functionality
            initializeStationSearch(stations);

    } catch (error) {
            console.error("Error loading stations:", error);
            showNotification("Failed to load filling stations", "error");
    }
}

function createStationCard(station) {
    const card = document.createElement('div');
    card.className = 'station-card';
    card.dataset.stationId = station.id;

    const companyClass = station.name.toLowerCase().replace(/\s+/g, '-');
    
    card.innerHTML = `
        <div class="station-icon ${companyClass}">
            ${station.photoUrl ? 
                `<img src="${station.photoUrl}" alt="${station.name}">` :
                '<i class="fas fa-gas-pump"></i>'
            }
        </div>
        <div class="station-name">${station.name}</div>
        <div class="station-address">${station.address}</div>
        <div class="station-details">
            <div class="station-area">
                <i class="fas fa-map-marker-alt"></i>
                ${station.district}, ${station.region}
            </div>
            ${station.rating ? `
                <div class="station-rating">
                    <i class="fas fa-star"></i>
                    ${station.rating.toFixed(1)} / 5.0
                </div>
            ` : ''}
            ${station.distance ? `
                <div class="station-distance">
                    <i class="fas fa-route"></i>
                    ${station.distance.toFixed(1)} km away
                </div>
            ` : ''}
        </div>
    `;

    // Add click handler for station selection
    card.addEventListener('click', () => {
        // Remove selection from other cards
        document.querySelectorAll('.station-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Add selection to clicked card
        card.classList.add('selected');
        
        // Update order summary
        updateOrderSummary({
            location: station.name,
            address: station.address,
            stationId: station.id
        });

        // Center map on selected station
        map.setCenter({
            lat: station.coordinates.latitude,
            lng: station.coordinates.longitude
        });
        map.setZoom(15);
    });

    return card;
}

function initializeStationSearch(stations) {
    const searchInput = document.getElementById('stationSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const stationCards = document.querySelectorAll('.station-card');

        stationCards.forEach(card => {
            const stationData = stations.find(s => s.id === card.dataset.stationId);
            if (!stationData) return;

            const searchString = `
                ${stationData.name}
                ${stationData.address}
                ${stationData.district}
                ${stationData.region}
                ${stationData.company}
            `.toLowerCase();

            card.style.display = searchString.includes(searchTerm) ? '' : 'none';
    });
});
}

function updateOrderSummary({ location, address, stationId }) {
    const summaryLocation = document.getElementById('summaryLocation');
    if (summaryLocation) {
        summaryLocation.textContent = `${location} (${address})`;
    }

    // Store selected station ID for order submission
    document.getElementById('orderForm').dataset.selectedStation = stationId;
}

// Initialize fuel selection and quantity input handling
document.addEventListener('DOMContentLoaded', () => {
    initializeFuelSelection();
});

function initializeFuelSelection() {
    const fuelCards = document.querySelectorAll('.fuel-card');
    const prices = {
        'Petrol': 1500,
        'Diesel': 1400,
        'Paraffin': 1200
    };
    
    fuelCards.forEach(card => {
        const quantityInput = card.querySelector('.quantity-input');
        const input = quantityInput.querySelector('input');
        
        // Add click handler for the card
        card.addEventListener('click', (e) => {
            // Don't toggle selection if clicking the input
            if (e.target.tagName === 'INPUT') {
                return;
            }
            
            // Toggle selection
            card.classList.toggle('selected');
            quantityInput.classList.toggle('visible');
            
            // Clear input if deselecting
            if (!card.classList.contains('selected')) {
                input.value = '';
            }
            
            updateFuelSummary();
        });

        // Add input event listener for quantity changes
        input.addEventListener('input', () => {
            // Ensure the card is selected when entering quantity
            if (!card.classList.contains('selected') && input.value) {
                card.classList.add('selected');
                quantityInput.classList.add('visible');
            }
            // Remove selection if quantity is cleared
            else if (card.classList.contains('selected') && !input.value) {
                card.classList.remove('selected');
                quantityInput.classList.remove('visible');
            }
            updateFuelSummary();
        });
    });
}

function updateFuelSummary() {
    const selectedFuels = [];
    let totalPrice = 0;
    const prices = {
        'Petrol': 1500,
        'Diesel': 1400,
        'Paraffin': 1200
    };

    document.querySelectorAll('.fuel-card').forEach(card => {
        const fuelType = card.dataset.fuel;
        const quantityInput = card.querySelector('input[type="number"]');
        const quantity = parseInt(quantityInput?.value) || 0;

        if (card.classList.contains('selected') && quantity > 0) {
            selectedFuels.push(`${fuelType} (${quantity}L)`);
            totalPrice += quantity * prices[fuelType];
        }
    });

    // Update summary elements
    const summaryFuelType = document.getElementById('summaryFuelType');
    const summaryQuantity = document.getElementById('summaryQuantity');
    const summaryPrice = document.getElementById('summaryPrice');

    if (selectedFuels.length > 0) {
        summaryFuelType.textContent = selectedFuels.join(', ');
        // Convert NodeList to Array before using reduce
        const totalQuantity = Array.from(document.querySelectorAll('.fuel-card.selected input[type="number"]'))
            .reduce((sum, input) => sum + (parseInt(input.value) || 0), 0);
        summaryQuantity.textContent = `${totalQuantity} L`;
        summaryPrice.textContent = `MWK ${totalPrice.toLocaleString()}`;
    } else {
        summaryFuelType.textContent = '-';
        summaryQuantity.textContent = '-';
        summaryPrice.textContent = 'MWK 0.00';
    }
}

// Handle order form submission
document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedStation = e.target.dataset.selectedStation;
    if (!selectedStation) {
        showNotification("Please select a filling station", "warning");
        return;
    }

    const selectedFuels = [];
    document.querySelectorAll('.fuel-card.selected').forEach(card => {
        const fuelType = card.dataset.fuel;
        const quantity = parseInt(card.querySelector('input[type="number"]').value) || 0;
        if (quantity > 0) {
            selectedFuels.push({ type: fuelType, quantity });
        }
    });

    if (selectedFuels.length === 0) {
        showNotification("Please select at least one fuel type and quantity", "warning");
        return;
    }

    const deliveryDate = document.getElementById('deliveryDate').value;
    if (!deliveryDate) {
        showNotification("Please select a delivery date", "warning");
        return;
    }

    try {
    const orderData = {
            userId: auth.currentUser.uid,
            stationId: selectedStation,
        fuels: selectedFuels,
            deliveryDate: new Date(deliveryDate),
        additionalNotes: document.getElementById('additionalNotes').value,
        status: 'pending',
            deliveryStatus: 'pending_approval', // Add initial delivery status
        createdAt: serverTimestamp(),
            totalPrice: parseFloat(document.getElementById('summaryPrice').textContent.replace(/[^0-9.-]+/g, ""))
    };

        const orderRef = await addDoc(collection(db, "orders"), orderData);
        showNotification("Order placed successfully!", "success");

    // Show payment modal
        showPaymentModal({
            orderId: orderRef.id,
            totalAmount: orderData.totalPrice
        });

    } catch (error) {
        console.error("Error placing order:", error);
        showNotification("Failed to place order. Please try again.", "error");
    }
});

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Add auth state change listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            showNotification("Please login to access the orders page", "warning");
            window.location.href = 'index.html';
            return;
        }

        try {
            console.log("User authenticated, loading user data");
            
            // Get user data first
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (!userDoc.exists()) {
                console.log("No user document found");
                showNotification("User data not found", "error");
                await signOut(auth);
                window.location.href = 'index.html';
                return;
            }

            const userData = userDoc.data();
            console.log("User data loaded successfully");

            // Update DOM elements including profile picture
            updateDOMElements(userData);

            // Load orders and other data
            await loadOrders();
            await loadFillingStations();

        } catch (error) {
            console.error("Error in auth state change:", error);
            showNotification("Failed to load user data", "error");
        }
    });
});

// Function to update DOM elements including profile picture
function updateDOMElements(userData) {
    const userNameElement = document.getElementById('userName');
    const userEmailElement = document.getElementById('userEmail');
    const userInitialsElement = document.getElementById('headerInitials');
    const headerProfilePic = document.getElementById('headerProfilePic');

    // Only proceed if we have both the profile pic and initials elements
    if (!headerProfilePic || !userInitialsElement) {
        console.warn('Profile picture or initials element not found', {
            headerProfilePic: !!headerProfilePic,
            userInitialsElement: !!userInitialsElement
        });
        return;
    }

    if (userNameElement) {
        userNameElement.textContent = userData.companyName || 'User';
    }
    if (userEmailElement) {
        userEmailElement.textContent = userData.email || '';
    }
    
    // Set initials
    const initials = (userData.companyName || 'U')
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
    
    userInitialsElement.textContent = initials;

    // Set default avatar first
    headerProfilePic.src = defaultAvatar;
    headerProfilePic.style.display = 'block';
    userInitialsElement.style.display = 'none';
    
    // Then try to load the user's profile picture if it exists
    if (userData.photoURL) {
        try {
            getDownloadURL(ref(storage, userData.photoURL))
                .then(url => {
                    headerProfilePic.src = url;
                    headerProfilePic.style.display = 'block';
                    userInitialsElement.style.display = 'none';
                })
                .catch(error => {
                    console.error("Error loading profile picture:", error);
                    headerProfilePic.style.display = 'none';
                    userInitialsElement.style.display = 'block';
                });
        } catch (error) {
            console.error("Error loading profile picture:", error);
            headerProfilePic.style.display = 'none';
            userInitialsElement.style.display = 'block';
        }
    } else {
        headerProfilePic.style.display = 'none';
        userInitialsElement.style.display = 'block';
    }

    // Add error handler for the profile picture
    headerProfilePic.onerror = () => {
        headerProfilePic.style.display = 'none';
        userInitialsElement.style.display = 'block';
    };
}

// Load orders function
async function loadOrders() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log("No user logged in");
            return;
        }

        const ordersRef = collection(db, "orders");
        const ordersTableBody = document.getElementById('ordersTableBody');
        
        if (!ordersTableBody) {
            console.error("Orders table body element not found");
            return;
        }

        // Show loading state
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading-spinner"></div>
                    <p class="mt-3">Loading orders...</p>
                </td>
            </tr>
        `;

        try {
            // First try the optimal query with ordering
            const q = query(
                ordersRef,
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(50)
            );

        const querySnapshot = await getDocs(q);
            processOrdersResults(querySnapshot);
            
        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                // Extract index creation URL from error message
                const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
                
                // Show user-friendly message with index creation link
                ordersTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px;">
                            <div style="color: #e11d48; margin-bottom: 10px;">
                                <i class="fas fa-exclamation-circle"></i>
                                The system needs to create an index for better performance.
                            </div>
                            <div style="margin-bottom: 10px;">
                                Please click the link below to create the required index:
                            </div>
                            <a href="${indexUrl}"
                               target="_blank"
                               style="color: #2563eb; text-decoration: underline;">
                                Create Index
                            </a>
                            <div style="margin-top: 10px; color: #64748b; font-size: 0.875rem;">
                                After creating the index, please wait a few minutes and refresh the page.
                            </div>
                        </td>
                    </tr>
                `;

                // Fall back to simpler query without ordering
                const fallbackQuery = query(
                    ordersRef,
                    where("userId", "==", user.uid)
                );

                const fallbackSnapshot = await getDocs(fallbackQuery);
                const orders = [];
                fallbackSnapshot.forEach(doc => {
                    orders.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Sort orders manually by date
                orders.sort((a, b) => {
                    const dateA = a.createdAt?.seconds || 0;
                    const dateB = b.createdAt?.seconds || 0;
                    return dateB - dateA;
                });

                // Take only the first 50 orders
                processOrdersResults({ 
                    docs: orders.slice(0, 50).map(order => ({
                        id: order.id,
                        data: () => order
                    })),
                    empty: orders.length === 0
                });
            } else {
                throw error; // Re-throw if it's a different error
            }
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        showNotification(
            "There was an error loading your orders. Please refresh the page or try again later.", 
            "error"
        );
        
        // Show error state in table
        if (ordersTableBody) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load orders. Please try again later.</p>
                    </td>
                </tr>
            `;
        }
    }
}

// Helper function to process and display orders
function processOrdersResults(querySnapshot) {
    const ordersTableBody = document.getElementById('ordersTableBody');

        if (querySnapshot.empty) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>No orders found</p>
                    </td>
                </tr>
            `;
            return;
        }

    ordersTableBody.innerHTML = '';
    querySnapshot.docs.forEach((doc) => {
            const order = doc.data();
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            
            // Format fuel types and quantities
            let fuelInfo = order.fuels?.map(fuel => 
                    `${fuel.type} (${fuel.quantity}L)`
            ).join(', ') || 'N/A';

            // Get the total amount including service fee if available
            const totalAmount = order.payment?.totalAmount || order.totalPrice || 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doc.id}</td>
                <td>${formatDate(orderDate)}</td>
                <td>${fuelInfo}</td>
                <td>MWK ${totalAmount.toLocaleString()}</td>
                <td><span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></td>
                <td class="action-buttons">
                    <button class="btn btn-primary" onclick="viewOrderDetails('${doc.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-danger" onclick="cancelOrder('${doc.id}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                </td>
            `;
            
            ordersTableBody.appendChild(row);
        });
}

// Format date helper
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// View order details
window.viewOrderDetails = async (orderId) => {
    try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
            const orderData = orderDoc.data();
            // Implement your order details view logic here
            console.log("Order details:", orderData);
            showNotification("Order details loaded", "success");
        }
    } catch (error) {
        console.error("Error viewing order details:", error);
        showNotification("Failed to load order details", "error");
    }
};

// Cancel order
window.cancelOrder = async (orderId) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
        // Implement your order cancellation logic here
        showNotification("Order cancelled successfully", "success");
        await loadOrders(); // Reload orders after cancellation
    } catch (error) {
        console.error("Error cancelling order:", error);
        showNotification("Failed to cancel order", "error");
    }
};

// Search functionality
const searchInput = document.getElementById('searchOrders');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#ordersTableBody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Filter functionality
const statusFilter = document.getElementById('statusFilter');
if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
        const filterValue = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#ordersTableBody tr');
        
        rows.forEach(row => {
            const statusCell = row.querySelector('.status-badge');
            if (!statusCell) return;
            
            const status = statusCell.textContent.toLowerCase();
            row.style.display = filterValue === 'all' || status === filterValue ? '' : 'none';
        });
    });
}

// Payment method configurations
const paymentMethods = {
    mobile: [
        {
            name: 'Airtel Money',
            image: 'assets/img/airtel-money.png',
            description: 'Pay using Airtel Money'
        },
        {
            name: 'TNM Mpamba',
            image: 'assets/img/tnm-mpamba.png',
            description: 'Pay using TNM Mpamba'
        }
    ],
    bank: [
        {
            name: 'Standard Bank',
            image: 'assets/img/standard-bank.png',
            description: 'Pay using Standard Bank'
        },
        {
            name: 'National Bank',
            image: 'assets/img/national-bank.png',
            description: 'Pay using National Bank'
        },
        {
            name: 'FDH Bank',
            image: 'assets/img/fdh-bank.png',
            description: 'Pay using FDH Bank'
        }
    ]
};

// Function to load payment method images
function loadPaymentMethodImages() {
    const paymentOptions = document.querySelectorAll('.payment-option img');
    paymentOptions.forEach(img => {
        img.onload = () => img.classList.add('loaded');
        img.src = img.dataset.src;
    });
}

// Function to create payment options
function createPaymentOptions(type) {
    const container = document.getElementById(`${type}Payment`);
    const methods = paymentMethods[type];
    
    container.innerHTML = methods.map(method => `
        <div class="payment-option" data-method="${method.name.toLowerCase().replace(/\s+/g, '-')}">
            <div class="payment-option-content">
                <img data-src="${method.image}" alt="${method.name}" class="payment-logo" />
            <div class="payment-option-details">
                <div class="payment-option-name">${method.name}</div>
                <div class="payment-option-description">${method.description}</div>
                </div>
            </div>
            <div class="payment-check">
                <i class="fas fa-check-circle"></i>
            </div>
        </div>
    `).join('');

    // Add click handlers for payment options
    container.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selection from all options
            document.querySelectorAll('.payment-option').forEach(opt => 
                opt.classList.remove('selected'));
            // Add selection to clicked option
            option.classList.add('selected');
            // Show the appropriate input container
            showPaymentInputs(type, option.dataset.method);
            // Enable the process payment button
            document.getElementById('processPayment').disabled = false;
        });
    });
}

// Function to show payment inputs based on selected method
function showPaymentInputs(type, method) {
    const mobileInput = document.querySelector('.mobile-input');
    const bankInput = document.querySelector('.bank-input');
    const inputContainer = document.querySelector('.payment-input-container');

    inputContainer.classList.remove('hidden');
    mobileInput.classList.add('hidden');
    bankInput.classList.add('hidden');

    if (type === 'mobile') {
        mobileInput.classList.remove('hidden');
        // Add placeholder specific to the method
        const phoneInput = document.getElementById('phoneNumber');
        phoneInput.placeholder = method.includes('airtel') ? 
            'Enter Airtel Money number' : 'Enter TNM Mpamba number';
    } else {
        bankInput.classList.remove('hidden');
        // Add bank-specific placeholder
        const accountInput = document.getElementById('accountNumber');
        accountInput.placeholder = `Enter ${method.replace(/-/g, ' ')} account number`;
    }

    // Animate the container
    inputContainer.style.animation = 'slideDown 0.3s ease-out';
}

// Function to show payment modal
function showPaymentModal(orderDetails) {
    const modal = document.getElementById('paymentModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Store orderId in the form for later use
    document.querySelector('#orderForm').dataset.orderId = orderDetails.orderId;
    
    // Reset modal state
    document.querySelectorAll('.payment-option').forEach(opt => 
        opt.classList.remove('selected'));
    document.querySelector('.payment-input-container').classList.add('hidden');
    document.getElementById('processPayment').disabled = true;

    // Show modal with fade-in effect
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
        modalContent.style.transform = 'translateY(0)';
        modalContent.style.opacity = '1';
    }, 10);

    // Initialize payment tabs
    initializePaymentTabs();

    // Create payment options
    createPaymentOptions('mobile');
    createPaymentOptions('bank');

    // Load images after modal is shown
    setTimeout(loadPaymentMethodImages, 100);

    // Update payment amounts with animation
    updatePaymentAmounts(orderDetails);

    // Add close button handler
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => {
        modalContent.style.transform = 'translateY(20px)';
        modalContent.style.opacity = '0';
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    };

    // Close modal if clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeBtn.onclick();
        }
    };
}

// Function to initialize payment tabs
function initializePaymentTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            // Hide all content sections
            contents.forEach(content => content.classList.add('hidden'));
            // Show selected content
            const targetContent = document.getElementById(`${tab.dataset.tab}Payment`);
            targetContent.classList.remove('hidden');
            // Reset payment inputs
            document.querySelector('.payment-input-container').classList.add('hidden');
            document.getElementById('processPayment').disabled = true;
        });
    });
}

// Function to update payment amounts with animation
function updatePaymentAmounts(orderDetails) {
    const totalAmount = orderDetails.totalAmount;
    const serviceFee = totalAmount * 0.02;
    const finalAmount = totalAmount + serviceFee;

    // Animate the amounts
    animateAmount('modalTotalAmount', totalAmount);
    animateAmount('modalServiceFee', serviceFee);
    animateAmount('modalFinalAmount', finalAmount);
    animateAmount('buttonAmount', finalAmount);
}

// Function to animate amount changes
function animateAmount(elementId, targetAmount, duration = 1000) {
    const element = document.getElementById(elementId);
    const start = 0;
    const increment = targetAmount / (duration / 16); // 60 FPS
    let current = start;

    const animate = () => {
        current += increment;
        if (current >= targetAmount) {
            element.textContent = `MWK ${targetAmount.toLocaleString()}`;
            return;
        }
        element.textContent = `MWK ${Math.floor(current).toLocaleString()}`;
        requestAnimationFrame(animate);
    };

    animate();
}

// Add input validation
document.getElementById('phoneNumber')?.addEventListener('input', (e) => {
    const value = e.target.value.replace(/\D/g, '');
    e.target.value = value;
    validatePaymentInputs();
});

document.getElementById('accountNumber')?.addEventListener('input', (e) => {
    const value = e.target.value.replace(/\D/g, '');
    e.target.value = value;
    validatePaymentInputs();
});

function validatePaymentInputs() {
    const processBtn = document.getElementById('processPayment');
    const phoneInput = document.getElementById('phoneNumber');
    const accountInput = document.getElementById('accountNumber');
    const mobileInputContainer = document.querySelector('.mobile-input');
    const bankInputContainer = document.querySelector('.bank-input');

    if (!mobileInputContainer.classList.contains('hidden')) {
        // For mobile money: Enable button when phone number is exactly 10 digits
        processBtn.disabled = phoneInput.value.length !== 10;
    } else if (!bankInputContainer.classList.contains('hidden')) {
        // For bank account: Enable button when account number is at least 10 digits
        processBtn.disabled = accountInput.value.length < 10;
    }
}

// Define the selectStation function globally
window.selectStation = function(stationId) {
    console.log("Selecting station:", stationId); // Debug log
    
    // Find the station data from our static stations
    const station = staticFillingStations.find(s => s.id === stationId);
    if (!station) {
        console.error("Station not found:", stationId);
        return;
    }

    // Remove selection from all cards
    document.querySelectorAll('.station-card').forEach(card => {
                card.classList.remove('selected');
    });

    // Find and select the card
    const card = document.querySelector(`.station-card[data-station-id="${stationId}"]`);
    if (card) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

            // Center map on selected station
    if (map) {
        map.setCenter({
            lat: station.coordinates.latitude,
            lng: station.coordinates.longitude
        });
            map.setZoom(15);
    }

    // Update order summary with station details
            updateOrderSummary({
        location: station.name,
        address: station.address,
        stationId: station.id
    });

    // Show selection notification
    showNotification(`Selected ${station.name} as delivery location`, 'success');
};

// Function to process payment and show invoice
async function processPayment() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    loadingOverlay.style.display = 'flex';

    try {
        // Get payment details
        const paymentMethod = document.querySelector('.tab-button.active').textContent.trim();
        const selectedPaymentOption = document.querySelector('.payment-option.selected');
        const paymentProvider = selectedPaymentOption ? selectedPaymentOption.querySelector('.payment-option-name').textContent : '';
        
        // Generate a random transaction ID
        const transactionId = 'TXN' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        // Get order details
        const orderAmount = document.getElementById('modalTotalAmount').textContent;
        const serviceFee = document.getElementById('modalServiceFee').textContent;
        const totalAmount = document.getElementById('modalFinalAmount').textContent;
        
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update order status in Firestore
        const orderId = document.querySelector('#orderForm').dataset.orderId;
        if (orderId) {
            const orderRef = doc(db, "orders", orderId);
            await updateDoc(orderRef, {
                status: 'completed',
                payment: {
                    transactionId,
                    method: `${paymentMethod} (${paymentProvider})`,
                    amount: parseFloat(totalAmount.replace(/[^0-9.-]+/g, "")),
                    timestamp: serverTimestamp()
                }
            });
        }
        
        // Hide payment modal and loading overlay
        const paymentModal = document.getElementById('paymentModal');
        paymentModal.style.display = 'none';
        loadingOverlay.style.display = 'none';
        
        // Show success notification
        showNotification('Payment processed successfully!', 'success');
        
        // Show invoice with payment details
        const invoiceDetails = {
            transactionId,
            paymentMethod: `${paymentMethod} (${paymentProvider})`,
            orderAmount,
            serviceFee,
            totalAmount
        };
        
        // Show the invoice modal
        showInvoice(invoiceDetails);
        
    } catch (error) {
        console.error('Payment processing error:', error);
        loadingOverlay.style.display = 'none';
        showNotification('Payment processing failed. Please try again.', 'error');
    }
}

// Function to show the invoice
function showInvoice(paymentDetails) {
    // Get the invoice modal
    const invoiceModal = document.getElementById('invoiceModal');
    
    // Set invoice details
    document.getElementById('invoiceNumber').textContent = paymentDetails.transactionId;
    document.getElementById('invoiceDate').textContent = new Date().toLocaleDateString();
    document.getElementById('customerName').textContent = document.getElementById('userName').textContent;
    document.getElementById('customerEmail').textContent = document.getElementById('userEmail').textContent;
    document.getElementById('paymentMethod').textContent = paymentDetails.paymentMethod;
    document.getElementById('transactionId').textContent = paymentDetails.transactionId;
    
    // Set order items
    const orderItems = document.getElementById('orderItems');
    orderItems.innerHTML = ''; // Clear existing items
    
    // Add selected fuels to order items
    document.querySelectorAll('.fuel-card.selected').forEach(card => {
        const fuelName = card.querySelector('.fuel-name').textContent;
        const quantity = card.querySelector('input[type="number"]').value;
        const price = card.querySelector('.fuel-price').textContent.match(/\d+/)[0];
        const total = quantity * price;
        
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div>
                <strong>${fuelName}</strong>
                <div>${quantity} Liters × MWK ${price}/L</div>
            </div>
            <div>MWK ${total.toLocaleString()}</div>
        `;
        orderItems.appendChild(orderItem);
    });
    
    // Set payment summary
    document.getElementById('invoiceSubtotal').textContent = paymentDetails.orderAmount;
    document.getElementById('invoiceServiceFee').textContent = paymentDetails.serviceFee;
    document.getElementById('invoiceTotal').textContent = paymentDetails.totalAmount;
    
    // Show the invoice modal with animation
    invoiceModal.style.display = 'block';
    setTimeout(() => {
        invoiceModal.classList.add('show');
        invoiceModal.querySelector('.payment-modal').style.transform = 'translateY(0)';
        invoiceModal.querySelector('.payment-modal').style.opacity = '1';
    }, 10);
}

// Function to close invoice modal and redirect
function closeInvoiceModal() {
    const invoiceModal = document.getElementById('invoiceModal');
    const modalContent = invoiceModal.querySelector('.payment-modal');
    
    // Add fade-out animation
    modalContent.style.transform = 'translateY(20px)';
    modalContent.style.opacity = '0';
    invoiceModal.classList.remove('show');
    
    setTimeout(() => {
        invoiceModal.style.display = 'none';
        showNotification('Order completed successfully! Redirecting to dashboard...', 'success');
        
        // Redirect to dashboard after showing the notification
        setTimeout(() => {
            window.location.href = 'user_dashboard.html';
        }, 2000);
    }, 300);
}

// Function to download invoice as PDF
function downloadInvoice() {
    // Show loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    loadingOverlay.style.display = 'flex';
    
    // Simulate PDF generation and download
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        showNotification('Invoice downloaded successfully!', 'success');
    }, 1500);
}

// Make functions globally available
window.closeInvoiceModal = closeInvoiceModal;
window.downloadInvoice = downloadInvoice;

// Add event listener to process payment button
document.getElementById('processPayment').addEventListener('click', processPayment);