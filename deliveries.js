import { 
    app,
    auth, 
    db, 
    storage,
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
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Add pagination state
let currentPage = 1;
const ordersPerPage = 5;
let allOrders = [];

// Create toast container for notifications
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

// Load user's deliveries (using orders collection)
async function loadUserDeliveries(userId) {
    try {
        const deliveriesTable = document.getElementById('deliveriesTableBody');
        if (!deliveriesTable) {
            console.error('Deliveries table body not found');
            return;
        }

        // Show loading state
        deliveriesTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading-spinner"></div>
                    Loading deliveries...
                </td>
            </tr>
        `;

        // Use a simple query without composite index requirements
        const ordersRef = collection(db, "orders");
        const basicQuery = query(
            ordersRef,
            where("userId", "==", userId)
        );

        const unsubscribe = onSnapshot(basicQuery, 
            (snapshot) => {
                // Process the documents manually
                const docs = snapshot.docs;
                allOrders = docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => {
                        const dateA = a.createdAt?.seconds || 0;
                        const dateB = b.createdAt?.seconds || 0;
                        return dateB - dateA; // Sort newest first
                    });

                // Update the table with pagination
                updateDeliveriesTable();
                
                // Update statistics
                updateDeliveryStats(allOrders);
            },
            (error) => {
                console.error("Error in orders snapshot:", error);
                showNotification("Failed to load deliveries", "error");
                deliveriesTable.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-red-500">
                            <i class="fas fa-exclamation-circle"></i>
                            Error loading deliveries. Please try again later.
                        </td>
                    </tr>
                `;
            }
        );

        // Store unsubscribe function for cleanup
        window.addEventListener('beforeunload', () => unsubscribe());

    } catch (error) {
        console.error("Error in loadUserDeliveries:", error);
        showNotification("Failed to load deliveries", "error");
    }
}

// Update deliveries table with pagination
function updateDeliveriesTable() {
    const deliveriesTable = document.getElementById('deliveriesTableBody');
    if (!deliveriesTable) return;

    if (allOrders.length === 0) {
        deliveriesTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <i class="fas fa-box"></i>
                    No deliveries found
                </td>
            </tr>
        `;
        updatePaginationControls();
        return;
    }

    // Calculate pagination values
    const totalPages = Math.ceil(allOrders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = Math.min(startIndex + ordersPerPage, allOrders.length);
    const currentOrders = allOrders.slice(startIndex, endIndex);

    // Clear table
    deliveriesTable.innerHTML = '';

    // Display current page orders
    currentOrders.forEach(order => {
        const row = document.createElement('tr');
        
        // Format date
        const orderDate = order.createdAt ? 
            new Date(order.createdAt.seconds * 1000) : 
            new Date();

        // Format fuel info
        const fuelInfo = order.fuels ? 
            order.fuels.map(fuel => `${fuel.type}: ${fuel.quantity}L`).join('<br>') : 
            'N/A';

        // Get total amount
        const totalAmount = order.payment?.totalAmount || order.totalPrice || 0;

        // Get delivery status with appropriate styling
        const deliveryStatus = getDeliveryStatusBadge(order.deliveryStatus || 'pending_approval');

        row.innerHTML = `
            <td>${order.id}</td>
            <td>${formatDate(orderDate)}</td>
            <td>${fuelInfo}</td>
            <td>MWK ${totalAmount.toLocaleString()}</td>
            <td><span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></td>
            <td>${deliveryStatus}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewDeliveryDetails('${order.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
            </td>
        `;

        deliveriesTable.appendChild(row);
    });

    // Update pagination controls
    updatePaginationControls();
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(allOrders.length / ordersPerPage);
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');

    // Update page numbers
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;

    // Update button states
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    // Add click handlers if not already added
    if (!prevPageBtn.hasClickHandler) {
        prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
        prevPageBtn.hasClickHandler = true;
    }
    if (!nextPageBtn.hasClickHandler) {
        nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
        nextPageBtn.hasClickHandler = true;
    }
}

// Change page function
function changePage(newPage) {
    const totalPages = Math.ceil(allOrders.length / ordersPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updateDeliveriesTable();
    }
}

// Helper function to generate delivery status badge HTML
function getDeliveryStatusBadge(status) {
    const statusMap = {
        'pending_approval': {
            label: 'Pending Approval',
            class: 'pending_approval'
        },
        'approved': {
            label: 'Approved',
            class: 'approved'
        },
        'in_transit': {
            label: 'In Transit',
            class: 'in_transit'
        },
        'delivered': {
            label: 'Delivered',
            class: 'delivered'
        },
        'rejected': {
            label: 'Rejected',
            class: 'rejected'
        }
    };

    const defaultStatus = {
        label: 'Pending Approval',
        class: 'pending_approval'
    };

    const statusInfo = statusMap[status] || defaultStatus;
    
    return `<span class="delivery-status-badge ${statusInfo.class}">
                ${statusInfo.label}
            </span>`;
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusClasses = {
        'pending': 'pending',
        'processing': 'processing',
        'in_transit': 'processing',
        'delivered': 'completed',
        'cancelled': 'cancelled',
        'delayed': 'warning'
    };

    const statusText = {
        'pending': 'Pending',
        'processing': 'Processing',
        'in_transit': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled',
        'delayed': 'Delayed'
    };

    const statusClass = statusClasses[status] || 'pending';
    const text = statusText[status] || 'Pending';

    return `<span class="status-badge ${statusClass}">${text}</span>`;
}

// Update delivery statistics
function updateDeliveryStats(orders) {
    try {
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const inTransitOrders = orders.filter(o => o.status === 'in_transit').length;
        const completedOrders = orders.filter(o => o.status === 'delivered').length;

        // Update statistics cards
        document.getElementById('totalDeliveries').textContent = totalOrders;
        document.getElementById('pendingDeliveries').textContent = pendingOrders;
        document.getElementById('inTransitDeliveries').textContent = inTransitOrders;
        document.getElementById('completedDeliveries').textContent = completedOrders;

    } catch (error) {
        console.error('Error updating delivery stats:', error);
    }
}

// Track delivery location
async function trackDelivery(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            showNotification("Order not found", "error");
            return;
        }

        const order = orderDoc.data();
        
        // Show tracking modal
        showTrackingModal(order);
    } catch (error) {
        console.error("Error tracking order:", error);
        showNotification("Failed to track order", "error");
    }
}

// Show tracking modal
function showTrackingModal(order) {
    const modal = document.getElementById('trackingModal');
    if (!modal) return;

    // Get station name
    let stationName = 'N/A';
    if (order.stationId) {
        getDoc(doc(db, "stations", order.stationId))
            .then(stationDoc => {
                if (stationDoc.exists()) {
                    stationName = stationDoc.data().name;
                    updateModalContent(order, stationName);
                }
            })
            .catch(error => {
                console.error("Error fetching station:", error);
                updateModalContent(order, stationName);
            });
    } else {
        updateModalContent(order, stationName);
    }
}

// Update modal content with station name
function updateModalContent(order, stationName) {
    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    // Format order details
    const orderDetails = order.fuels ? 
        order.fuels.map(item => `${item.type} - ${item.quantity}L`).join(', ') : 
        'N/A';

    modalContent.innerHTML = `
        <div class="modal-header">
            <h3>Track Order #${order.id}</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
            <div class="tracking-info">
                <div class="tracking-status">
                    <h4>Current Status</h4>
                    <p>${getStatusBadge(order.status)}</p>
                </div>
                <div class="delivery-details">
                    <h4>Order Details</h4>
                    <p><strong>Order ID:</strong> ${order.id}</p>
                    <p><strong>Station:</strong> ${stationName}</p>
                    <p><strong>Order Items:</strong> ${orderDetails}</p>
                    <p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>
                    <p><strong>Driver:</strong> ${order.driverName || 'Not assigned'}</p>
                    <p><strong>Estimated Time:</strong> ${formatDate(order.estimatedDeliveryTime)}</p>
                </div>
                <div class="tracking-map" id="trackingMap">
                    <!-- Map will be initialized here -->
                </div>
                <div class="tracking-timeline">
                    <h4>Order Timeline</h4>
                    <div class="timeline">
                        ${generateTimeline(order)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Show modal
    document.getElementById('trackingModal').style.display = 'flex';

    // Initialize map
    initializeTrackingMap(order);

    // Add close button event listener
    const closeBtn = modalContent.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        document.getElementById('trackingModal').style.display = 'none';
    });

    // Close modal when clicking outside
    document.getElementById('trackingModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('trackingModal')) {
            document.getElementById('trackingModal').style.display = 'none';
        }
    });
}

// Generate order timeline
function generateTimeline(order) {
    const timeline = [];
    const events = [
        { status: 'pending', text: 'Order placed' },
        { status: 'processing', text: 'Order processing' },
        { status: 'in_transit', text: 'Delivery in progress' },
        { status: 'delivered', text: 'Delivery completed' }
    ];

    events.forEach(event => {
        const isCompleted = order.status === event.status || 
            (event.status === 'pending' && order.status !== 'cancelled') ||
            (event.status === 'processing' && ['in_transit', 'delivered'].includes(order.status)) ||
            (event.status === 'in_transit' && order.status === 'delivered');

        timeline.push(`
            <div class="timeline-item ${isCompleted ? 'completed' : ''}">
                <div class="timeline-icon">
                    <i class="fas fa-${getTimelineIcon(event.status)}"></i>
                </div>
                <div class="timeline-content">
                    <h5>${event.text}</h5>
                    <p>${getTimelineDate(order, event.status)}</p>
                </div>
            </div>
        `);
    });

    return timeline.join('');
}

// Format date function
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Get timeline icon based on status
function getTimelineIcon(status) {
    const icons = {
        'pending': 'clock',
        'processing': 'cog',
        'in_transit': 'truck',
        'delivered': 'check-circle'
    };
    return icons[status] || 'circle';
}

// Get timeline date based on status
function getTimelineDate(order, status) {
    if (!order) return 'N/A';
    
    const dateFields = {
        'pending': order.createdAt || order.timestamp,
        'processing': order.processingDate,
        'in_transit': order.inTransitDate,
        'delivered': order.deliveredDate
    };

    const date = dateFields[status];
    return date ? formatDate(date) : 'Pending';
}

// Initialize tracking map
function initializeTrackingMap(order) {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement) return;

    // For now, just show a placeholder
    mapElement.innerHTML = `
        <div class="map-placeholder">
            <i class="fas fa-map-marker-alt"></i>
            <p>Map will be implemented here</p>
        </div>
    `;
}

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the header
    initializeHeader();
    
    // Add auth state change listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            showNotification("Please login to access the deliveries page", "warning");
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

            // Load deliveries
            await loadUserDeliveries(user.uid);

        } catch (error) {
            console.error("Error in auth state change:", error);
            showNotification("Failed to load user data", "error");
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

// Add this helper function at the top level
function getStationDisplayName(stationId) {
    const stationMap = {
        'puma-thyolo': 'Puma Thyolo',
        'puma-limbe': 'Puma Limbe',
        'puma-blantyre': 'Puma Blantyre'
    };
    return stationMap[stationId] || stationId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A';
}

window.viewDeliveryDetails = async (deliveryId) => {
    try {
        console.log("Fetching order details for ID:", deliveryId);
        const orderDoc = await getDoc(doc(db, "orders", deliveryId));
        if (!orderDoc.exists()) {
            showNotification("Delivery not found", "error");
            return;
        }

        const delivery = orderDoc.data();
        console.log("Order data:", delivery);
        console.log("Station ID from order:", delivery.stationId);
        
        // Get station name and location using the helper function
        const stationName = delivery.stationId ? getStationDisplayName(delivery.stationId) : 'N/A';
        const stationLocation = delivery.deliveryAddress || delivery.address || 'Location not specified';
        
        // Fetch user details
        let userDetails = { companyName: 'N/A', phoneNumber: 'N/A', email: 'N/A' };
        try {
            const userDoc = await getDoc(doc(db, "users", delivery.userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userDetails = {
                    companyName: userData.companyName || 'N/A',
                    phoneNumber: userData.phoneNumber || 'N/A',
                    email: userData.email || 'N/A'
                };
            }
        } catch (error) {
            console.error("Error fetching user details:", error);
        }
        
        console.log("Final station info:", { stationName, stationLocation });
        console.log("User details:", userDetails);
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('deliveryDetailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'deliveryDetailsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Format fuel details
        const fuelDetails = delivery.fuels ? 
            delivery.fuels.map(fuel => `
                <div class="order-item">
                    <span class="fuel-type">${fuel.type}</span>
                    <span class="quantity">${fuel.quantity}L</span>
                </div>
            `).join('') : 
            `<div class="order-item">
                <span class="fuel-type">${delivery.fuelType || 'N/A'}</span>
                <span class="quantity">${delivery.quantity || 0}L</span>
            </div>`;

        // Format payment status
        const paymentStatus = delivery.payment?.status || delivery.status || 'pending';
        const paymentAmount = delivery.payment?.totalAmount || delivery.totalPrice || 0;

        // Format dates
        const orderDate = delivery.createdAt ? new Date(delivery.createdAt.seconds * 1000) : new Date();
        const deliveryDate = delivery.deliveryDate ? new Date(delivery.deliveryDate.seconds * 1000) : null;
        const estimatedDeliveryTime = delivery.estimatedDeliveryTime ? 
            new Date(delivery.estimatedDeliveryTime.seconds * 1000) : null;

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="header-content">
                        <h2>Order Details</h2>
                        <div class="subtitle">Order #${deliveryId}</div>
                    </div>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="order-details-grid">
                        <!-- Order Summary Section -->
                        <div class="details-section">
                            <h3><i class="fas fa-info-circle"></i> Order Summary</h3>
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Order Date</label>
                                    <span>${formatDate(orderDate)}</span>
                                </div>
                                <div class="info-item">
                                    <label>Payment Status</label>
                                    <span class="status-badge ${paymentStatus}">${paymentStatus}</span>
                                </div>
                                <div class="info-item">
                                    <label>Total Amount</label>
                                    <span class="amount">MWK ${paymentAmount.toLocaleString()}</span>
                                </div>
                                <div class="info-item">
                                    <label>Delivery Status</label>
                                    <span>${getDeliveryStatusBadge(delivery.deliveryStatus || 'pending_approval')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Fuel Details Section -->
                        <div class="details-section">
                            <h3><i class="fas fa-gas-pump"></i> Fuel Details</h3>
                            <div class="order-items">
                                ${fuelDetails}
                            </div>
                        </div>

                        <!-- Delivery Information -->
                        <div class="details-section">
                            <h3><i class="fas fa-truck"></i> Delivery Information</h3>
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Delivery Date</label>
                                    <span>${deliveryDate ? formatDate(deliveryDate) : 'Not set'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Estimated Delivery</label>
                                    <span>${estimatedDeliveryTime ? formatDate(estimatedDeliveryTime) : 'Pending'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Station Name</label>
                                    <span>${stationName}</span>
                                </div>
                                <div class="info-item">
                                    <label>Delivery Location</label>
                                    <span>${stationLocation}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Contact Information -->
                        <div class="details-section">
                            <h3><i class="fas fa-address-card"></i> Contact Information</h3>
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Company Name</label>
                                    <span>${userDetails.companyName}</span>
                                </div>
                                <div class="info-item">
                                    <label>Phone Number</label>
                                    <span>${userDetails.phoneNumber}</span>
                                </div>
                                <div class="info-item">
                                    <label>Email</label>
                                    <span>${userDetails.email}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Timeline Section -->
                        <div class="details-section full-width">
                            <h3><i class="fas fa-clock"></i> Order Timeline</h3>
                            <div class="timeline">
                                ${generateTimeline(delivery)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Show modal
        modal.style.display = 'flex';

        // Add close button functionality
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.onclick = () => modal.style.display = 'none';

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };

    } catch (error) {
        console.error("Error viewing delivery details:", error);
        showNotification("Failed to load delivery details", "error");
    }
};