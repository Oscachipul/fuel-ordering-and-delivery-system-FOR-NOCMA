// Import shared Firebase instances and utilities
import { 
    auth, 
    db,
    initializeHeader,
    defaultAvatar,
    showNotification
} from './shared.js';

// Import Firebase modules
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc,
    getDoc,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { generateReport } from './reports.js';

// Enable offline persistence
enableIndexedDbPersistence(db, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
}).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
        console.warn('The current browser does not support offline persistence');
    }
});

// Network status tracking
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Back online! Refreshing data...', 'success');
    refreshData();
});
window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('You are offline. Some features may be limited.', 'warning');
});

// Refresh data when coming back online
async function refreshData() {
    const user = auth.currentUser;
    if (user) {
        try {
            await updateSummaryCards(user.uid);
            await loadOrderHistory(user.uid);
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }
}

// Helper function to update DOM elements
function updateDOMElements(userData) {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userInitials = document.getElementById('headerInitials');
    const headerProfilePic = document.getElementById('headerProfilePic');

    if (userName && userEmail) {
        userName.textContent = userData.companyName || 'User';
        userEmail.textContent = userData.email || '';
    }

    if (headerProfilePic && userInitials) {
        // Set initials
        const initials = (userData.companyName || 'U')
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
        
        userInitials.textContent = initials;

        // Set default avatar first
        headerProfilePic.src = defaultAvatar;
        headerProfilePic.style.display = 'block';
        userInitials.style.display = 'none';
        
        // Then try to load the user's profile picture if it exists
        if (userData.photoURL) {
            headerProfilePic.src = userData.photoURL;
            headerProfilePic.style.display = 'block';
            userInitials.style.display = 'none';

            // Add error handler for the profile picture
            headerProfilePic.onerror = () => {
                headerProfilePic.style.display = 'none';
                userInitials.style.display = 'block';
                headerProfilePic.src = defaultAvatar;
            };
        } else {
            headerProfilePic.style.display = 'none';
            userInitials.style.display = 'block';
        }
    }
}

// Chart initialization and update functions
let fuelTypeChart;
let quantityTrendChart;

function initializeCharts() {
    // Initialize Fuel Type Distribution Chart
    const fuelTypeCtx = document.getElementById('fuelTypeChart').getContext('2d');
    fuelTypeChart = new Chart(fuelTypeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Petrol', 'Diesel', 'Paraffin'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Initialize Quantity Trends Chart
    const quantityTrendCtx = document.getElementById('quantityTrendChart').getContext('2d');
    quantityTrendChart = new Chart(quantityTrendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Total Quantity (L)',
                data: [],
                borderColor: '#3b82f6',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `${value}L`
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Update summary cards with better error handling and offline support
async function updateSummaryCards(userId) {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const ordersRef = collection(db, "orders");
        
        try {
            // Try with indexes first
            const [dailySnapshot, weeklySnapshot, monthlySnapshot, yearlySnapshot] = await Promise.all([
                getDocs(query(ordersRef, where("userId", "==", userId), where("orderDate", ">=", startOfDay))),
                getDocs(query(ordersRef, where("userId", "==", userId), where("orderDate", ">=", startOfWeek))),
                getDocs(query(ordersRef, where("userId", "==", userId), where("orderDate", ">=", startOfMonth))),
                getDocs(query(ordersRef, where("userId", "==", userId), where("orderDate", ">=", startOfYear)))
            ]);

            updateSummaryCardValues({
                daily: dailySnapshot.size,
                weekly: weeklySnapshot.size,
                monthly: monthlySnapshot.size,
                yearly: yearlySnapshot.size
            });

        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                // Fall back to getting all orders and filtering in memory
                const allOrdersQuery = query(ordersRef, where("userId", "==", userId));
                const allOrdersSnapshot = await getDocs(allOrdersQuery);
                
                const orders = [];
                allOrdersSnapshot.forEach(doc => {
                    const data = doc.data();
                    const orderDate = data.orderDate?.toDate?.() || new Date(data.orderDate);
                    orders.push({
                        ...data,
                        orderDate
                    });
                });

                // Filter in memory
                const stats = {
                    daily: orders.filter(order => order.orderDate >= startOfDay).length,
                    weekly: orders.filter(order => order.orderDate >= startOfWeek).length,
                    monthly: orders.filter(order => order.orderDate >= startOfMonth).length,
                    yearly: orders.filter(order => order.orderDate >= startOfYear).length
                };

                updateSummaryCardValues(stats);

                if (isOnline) {
                    showNotification("Please create the required indexes for better performance. Check the console for details.", "warning");
                    console.log("Create the required indexes here:", error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0]);
                }
            } else if (error.code === 'unavailable' || error.message.includes('offline')) {
                // Handle offline scenario
                showNotification("Working in offline mode. Some data may not be up to date.", "info");
                // Try to use cached data
                const allOrdersQuery = query(ordersRef, where("userId", "==", userId));
                const allOrdersSnapshot = await getDocs(allOrdersQuery);
                
                const orders = [];
                allOrdersSnapshot.forEach(doc => {
                    const data = doc.data();
                    const orderDate = data.orderDate?.toDate?.() || new Date(data.orderDate);
                    orders.push({
                        ...data,
                        orderDate
                    });
                });

                const stats = {
                    daily: orders.filter(order => order.orderDate >= startOfDay).length,
                    weekly: orders.filter(order => order.orderDate >= startOfWeek).length,
                    monthly: orders.filter(order => order.orderDate >= startOfMonth).length,
                    yearly: orders.filter(order => order.orderDate >= startOfYear).length
                };

                updateSummaryCardValues(stats);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Error updating summary cards:", error);
        showNotification("Unable to update summary statistics. Please check your connection.", "error");
        
        // Set default values
        updateSummaryCardValues({
            daily: 0,
            weekly: 0,
            monthly: 0,
            yearly: 0
        });
    }
}

function updateSummaryCardValues(stats) {
    document.getElementById('dailyOrders').textContent = stats.daily;
    document.getElementById('weeklyOrders').textContent = stats.weekly;
    document.getElementById('monthlyOrders').textContent = stats.monthly;
    document.getElementById('yearlyOrders').textContent = stats.yearly;
}

// Update charts with order data
function updateCharts(orders) {
    // Update Fuel Type Distribution Chart
    const fuelTypeCounts = {
        'Petrol': 0,
        'Diesel': 0,
        'Paraffin': 0
    };

    orders.forEach(order => {
        if (order.fuels && Array.isArray(order.fuels)) {
            order.fuels.forEach(fuel => {
                if (fuelTypeCounts.hasOwnProperty(fuel.type)) {
                    fuelTypeCounts[fuel.type] += fuel.quantity || 0;
                }
            });
        }
    });

    fuelTypeChart.data.datasets[0].data = Object.values(fuelTypeCounts);
    fuelTypeChart.update();

    // Update Quantity Trends Chart
    const quantityTrends = orders
        .sort((a, b) => {
            const dateA = a.orderDate?.toDate?.() || new Date(a.orderDate);
            const dateB = b.orderDate?.toDate?.() || new Date(b.orderDate);
            return dateA - dateB;
        })
        .map(order => {
            let totalQuantity = 0;
            if (order.fuels && Array.isArray(order.fuels)) {
                order.fuels.forEach(fuel => {
                    totalQuantity += fuel.quantity || 0;
                });
            }
            const date = order.orderDate?.toDate?.() || new Date(order.orderDate);
            return {
                date: date.toLocaleDateString(),
                quantity: totalQuantity
            };
        });

    quantityTrendChart.data.labels = quantityTrends.map(trend => trend.date);
    quantityTrendChart.data.datasets[0].data = quantityTrends.map(trend => trend.quantity);
    quantityTrendChart.update();
}

// Handle filters
function initializeFilters() {
    const filterForm = document.getElementById('filterForm');
    const fuelTypeSelect = document.getElementById('fuelType');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');

    filterForm.addEventListener('change', async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const filters = {
            fuelType: fuelTypeSelect.value,
            dateFrom: dateFromInput.value ? new Date(dateFromInput.value) : null,
            dateTo: dateToInput.value ? new Date(dateToInput.value) : null
        };

        await loadOrderHistory(userId, filters);
    });
}

// Handle report generation
function initializeReportGeneration() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportModal = document.getElementById('reportModal');
    const reportForm = document.getElementById('reportForm');
    const closeModal = document.querySelector('.close-modal');

    generateReportBtn.addEventListener('click', () => {
        reportModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', () => {
        reportModal.style.display = 'none';
    });

    // Close modal if clicking outside
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            reportModal.style.display = 'none';
        }
    });

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const reportType = document.getElementById('reportType').value;
        const reportFormat = document.getElementById('reportFormat').value;
        const reportPeriod = document.getElementById('reportPeriod').value;
        const reportTitle = document.getElementById('reportTitle').value;
        const includeCharts = document.getElementById('includeCharts').checked;
        const includeTables = document.getElementById('includeTables').checked;

        // Hide the modal
        reportModal.style.display = 'none';
        
        try {
            await generateReport(
                reportType,
                reportFormat,
                reportPeriod,
                reportTitle,
                includeCharts,
                includeTables
            );
        } catch (error) {
            console.error("Error generating report:", error);
            showNotification("Failed to generate report", "error");
        }
    });
}

// Add pagination state
let currentPage = 1;
const ordersPerPage = 10;
let totalFilteredOrders = 0;
let allOrders = [];

// Update the loadOrderHistory function to handle pagination
async function loadOrderHistory(userId, filters = {}, page = 1) {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;

    // Show loading state
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="loading-spinner"></div>
                <p class="mt-3">Loading order history...</p>
            </td>
        </tr>
    `;

    try {
        const ordersRef = collection(db, "orders");
        let orders = [];

        try {
            // Try with indexes first
            let queryConstraints = [where("userId", "==", userId)];

            // Add filter constraints
            if (filters.fuelType) {
                queryConstraints.push(where("fuels.type", "array-contains", filters.fuelType));
            }
            if (filters.dateFrom) {
                queryConstraints.push(where("orderDate", ">=", filters.dateFrom));
            }
            if (filters.dateTo) {
                queryConstraints.push(where("orderDate", "<=", filters.dateTo));
            }

            const q = query(ordersRef, ...queryConstraints, orderBy("orderDate", "desc"));
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((doc) => {
                orders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                // Handle missing index
                const fallbackQuery = query(ordersRef, where("userId", "==", userId));
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                fallbackSnapshot.forEach((doc) => {
                    orders.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Apply filters in memory
                orders = filterOrdersInMemory(orders, filters);

            } else if (error.code === 'unavailable' || error.message.includes('offline')) {
                // Handle offline scenario
                showNotification("Working in offline mode. Using cached data.", "info");
                const fallbackQuery = query(ordersRef, where("userId", "==", userId));
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                fallbackSnapshot.forEach((doc) => {
                    orders.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Apply filters in memory
                orders = filterOrdersInMemory(orders, filters);
            } else {
                throw error;
            }
        }

        // Store all orders for pagination
        allOrders = orders;
        totalFilteredOrders = orders.length;

        // Update pagination info
        const totalPages = Math.ceil(totalFilteredOrders / ordersPerPage);
        currentPage = Math.min(page, totalPages);
        
        // Get orders for current page
        const startIndex = (currentPage - 1) * ordersPerPage;
        const endIndex = startIndex + ordersPerPage;
        const paginatedOrders = orders.slice(startIndex, endIndex);

        // Update table and charts
        updateOrdersTable(paginatedOrders);
        updateCharts(orders);
        updatePaginationControls();

    } catch (error) {
        console.error("Error loading order history:", error);
        
        if (!isOnline) {
            showNotification("You are offline. Please check your internet connection.", "warning");
        } else {
            showNotification("Failed to load order history. Please try again later.", "error");
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>${isOnline ? 'Failed to load order history. Please try again later.' : 'You are currently offline. Please check your internet connection.'}</p>
                        ${isOnline ? '<button onclick="retryLoadOrders()" class="btn btn-primary mt-3">Retry</button>' : ''}
                    </div>
                </td>
            </tr>
        `;
    }
}

function filterOrdersInMemory(orders, filters) {
    return orders.filter(order => {
        let matchesFilters = true;
        
        if (filters.fuelType) {
            matchesFilters = order.fuels?.some(fuel => fuel.type === filters.fuelType);
        }
        
        if (matchesFilters && filters.dateFrom) {
            const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
            matchesFilters = orderDate >= filters.dateFrom;
        }
        
        if (matchesFilters && filters.dateTo) {
            const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
            matchesFilters = orderDate <= filters.dateTo;
        }
        
        return matchesFilters;
    }).sort((a, b) => {
        const dateA = a.orderDate?.toDate?.() || new Date(a.orderDate);
        const dateB = b.orderDate?.toDate?.() || new Date(b.orderDate);
        return dateB - dateA;
    });
}

// Make retryLoadOrders globally accessible
window.retryLoadOrders = async function() {
    const user = auth.currentUser;
    if (user) {
        await loadOrderHistory(user.uid);
    }
};

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(totalFilteredOrders / ordersPerPage);
    const startIndex = ((currentPage - 1) * ordersPerPage) + 1;
    const endIndex = Math.min(currentPage * ordersPerPage, totalFilteredOrders);

    // Update pagination info
    document.getElementById('currentPageStart').textContent = totalFilteredOrders === 0 ? 0 : startIndex;
    document.getElementById('currentPageEnd').textContent = endIndex;
    document.getElementById('totalOrders').textContent = totalFilteredOrders;

    // Update button states
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');

    if (prevButton && nextButton) {
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage >= totalPages;
    }
}

function updateOrdersTable(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    tableBody.innerHTML = '';

    if (!orders || orders.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="5" class="empty-state">
                <i class="fas fa-inbox fa-2x"></i>
                <p>No orders found</p>
            </td>
        `;
        tableBody.appendChild(emptyRow);
        return;
    }

    // Sort orders by date (newest first)
    const sortedOrders = [...orders].sort((a, b) => {
        const dateA = a.orderDate?.toDate?.() || new Date(a.orderDate);
        const dateB = b.orderDate?.toDate?.() || new Date(b.orderDate);
        return dateB - dateA;
    });

    sortedOrders.forEach(order => {
        const row = document.createElement('tr');
        
        // Ensure order properties exist and have default values
        const orderId = order.orderId || order.id || 'N/A';
        const orderDate = order.orderDate || new Date();
        
        // Get payment status from order data
        let paymentStatus;
        if (order.payment && order.payment.status) {
            paymentStatus = order.payment.status.toLowerCase();
        } else if (order.status === 'completed') {
            paymentStatus = 'paid';
        } else if (order.status === 'cancelled') {
            paymentStatus = 'cancelled';
        } else {
            paymentStatus = 'pending';
        }
        
        const deliveryStatus = (order.deliveryStatus || 'pending').toLowerCase();
        const fuels = Array.isArray(order.fuels) ? order.fuels : [];
        
        // Format the fuel list
        const fuelListHtml = formatFuelList(fuels);

        row.innerHTML = `
            <td data-label="Order ID">
                <div class="font-semibold">#${orderId}</div>
                <div class="text-secondary">${formatDate(orderDate)}</div>
            </td>
            <td data-label="Product">
                <div class="fuel-list">
                    ${fuelListHtml}
                </div>
            </td>
            <td data-label="Payment Status">
                <span class="status-badge status-${paymentStatus}">
                    <i class="fas ${getPaymentStatusIcon(paymentStatus)}"></i>
                    ${capitalizeFirstLetter(paymentStatus)}
                </span>
            </td>
            <td data-label="Delivery Status">
                <span class="status-badge status-${deliveryStatus}">
                    <i class="fas ${getDeliveryStatusIcon(deliveryStatus)}"></i>
                    ${capitalizeFirstLetter(deliveryStatus)}
                </span>
            </td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="action-btn view-btn" onclick="viewOrderDetails('${orderId}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${deliveryStatus === 'pending' ? `
                        <button class="action-btn cancel-btn" onclick="cancelOrder('${orderId}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function formatFuelList(fuels) {
    if (!Array.isArray(fuels) || fuels.length === 0) {
        return `
            <div class="fuel-item">
                <i class="fas fa-info-circle" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>
                <span class="fuel-type">No fuel details available</span>
            </div>
        `;
    }

    let totalQuantity = 0;
    const fuelItems = fuels.map(fuel => {
        const quantity = parseFloat(fuel.quantity) || 0;
        totalQuantity += quantity;
        return `
            <div class="fuel-item">
                <i class="fas fa-gas-pump" style="color: var(--primary-color); margin-right: 0.5rem;"></i>
                <span class="fuel-type">${fuel.type || 'Unknown'}</span>
                <span class="fuel-quantity">${formatNumber(quantity)}L</span>
            </div>
        `;
    }).join('');

    return `
        ${fuelItems}
        <div class="total-quantity">
            <i class="fas fa-calculator" style="margin-right: 0.5rem;"></i>
            Total: ${formatNumber(totalQuantity)}L
        </div>
    `;
}

function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
}

function formatDate(date) {
    try {
        const d = date?.toDate?.() || new Date(date);
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function getPaymentStatusIcon(status) {
    const icons = {
        'paid': 'fa-check-circle',
        'pending': 'fa-clock',
        'failed': 'fa-times-circle'
    };
    return icons[status] || 'fa-question-circle';
}

function getDeliveryStatusIcon(status) {
    const icons = {
        'delivered': 'fa-check-circle',
        'pending': 'fa-clock',
        'processing': 'fa-truck',
        'cancelled': 'fa-times-circle'
    };
    return icons[status] || 'fa-question-circle';
}

// Make order detail functions globally accessible
window.viewOrderDetails = viewOrderDetails;
window.cancelOrder = cancelOrder;

// View order details function
async function viewOrderDetails(orderId) {
    try {
        // Get the order details
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (!orderDoc.exists()) {
            showNotification("Order not found", "error");
            return;
        }

        const order = orderDoc.data();
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal" id="orderDetailsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="invoice-header">
                            <div class="company-info">
                                <h2>NOCMA</h2>
                                <p>National Oil Company of Malawi</p>
                                <p>Order Details</p>
                            </div>
                            <div class="invoice-title">
                                <h1>Order #${order.orderId || orderId}</h1>
                                <p>${order.orderDate?.toDate?.().toLocaleString() || new Date(order.orderDate).toLocaleString()}</p>
                            </div>
                        </div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="invoice-details">
                            <div class="billing-info">
                                <div class="section">
                                    <h3>Order Information</h3>
                                    <p><strong>Status:</strong> ${order.status}</p>
                                    <p><strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}</p>
                                    <p><strong>Total Amount:</strong> MWK ${order.totalAmount?.toLocaleString() || 0}</p>
                                </div>
                                <div class="section">
                                    <h3>Delivery Information</h3>
                                    <p><strong>Delivery Address:</strong> ${order.deliveryAddress || 'N/A'}</p>
                                    <p><strong>Delivery Date:</strong> ${order.deliveryDate || 'Not scheduled'}</p>
                                    <p><strong>Delivery Status:</strong> ${order.deliveryStatus || 'Pending'}</p>
                                </div>
                            </div>
                            <div class="items-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fuel Type</th>
                                            <th>Quantity (L)</th>
                                            <th>Price/L (MWK)</th>
                                            <th>Total (MWK)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(order.fuels || []).map(fuel => `
                                            <tr>
                                                <td>${fuel.type}</td>
                                                <td>${fuel.quantity?.toLocaleString()}</td>
                                                <td>${fuel.pricePerLiter?.toLocaleString()}</td>
                                                <td>${(fuel.quantity * fuel.pricePerLiter)?.toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                    <tfoot>
                                        <tr class="total">
                                            <td colspan="3"><strong>Total Amount</strong></td>
                                            <td><strong>MWK ${order.totalAmount?.toLocaleString()}</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            ${order.notes ? `
                                <div class="additional-notes">
                                    <h3>Additional Notes</h3>
                                    <p>${order.notes}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('orderDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get the new modal
        const modal = document.getElementById('orderDetailsModal');
        const closeBtn = modal.querySelector('.close-modal');

        // Show modal
        modal.style.display = 'flex';

        // Close modal when clicking close button
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            setTimeout(() => modal.remove(), 300);
        };

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
                setTimeout(() => modal.remove(), 300);
            }
        };

    } catch (error) {
        console.error("Error viewing order details:", error);
        showNotification("Failed to load order details", "error");
    }
}

// Add cancel order function
async function cancelOrder(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: auth.currentUser.uid
        });
        
        showNotification("Order cancelled successfully", "success");
        
        // Refresh the orders
        const userId = auth.currentUser?.uid;
        if (userId) {
            loadOrderHistory(userId, {}, currentPage);
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        showNotification("Failed to cancel order", "error");
    }
}

// Initialize pagination controls
function initializePaginationControls() {
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');

    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const userId = auth.currentUser?.uid;
                if (userId) {
                    loadOrderHistory(userId, {}, currentPage);
                }
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(totalFilteredOrders / ordersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                const userId = auth.currentUser?.uid;
                if (userId) {
                    loadOrderHistory(userId, {}, currentPage);
                }
            }
        });
    }
}

// Update the document ready event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the header
    initializeHeader();
    
    // Initialize charts
    initializeCharts();
    
    // Initialize filters
    initializeFilters();
    
    // Initialize report generation
    initializeReportGeneration();
    
    // Initialize pagination controls
    initializePaginationControls();
    
    // Add auth state change listener with better error handling
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            window.location.href = 'index.html';
            return;
        }

        try {
            console.log("User authenticated, loading user data");
            
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
            console.log("User data loaded successfully");

            // Update DOM elements
            updateDOMElements(userData);

            // Load data with offline support
            await Promise.all([
                updateSummaryCards(user.uid),
                loadOrderHistory(user.uid)
            ]);

        } catch (error) {
            console.error("Error in auth state change:", error);
            
            if (!isOnline) {
                showNotification("You are offline. Some features may be limited.", "warning");
            } else {
                showNotification("Failed to load user data. Please try again later.", "error");
            }
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