import { 
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
    onSnapshot,
    orderBy,
    Timestamp,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Add pagination state
let currentPage = 1;
const invoicesPerPage = 4;
let allInvoices = [];

// Add search and filter functionality
let searchQuery = '';
let statusFilter = '';

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

    // If the message contains HTML, update the message span
    if (message.includes('<a')) {
        const messageSpan = toast.querySelector('.toast-message');
        messageSpan.innerHTML = message;
    }

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toastContainer.removeChild(toast), 300);
    }, 5000);
}

// Load user's invoices from orders
async function loadUserInvoices(userId) {
    try {
        console.log("Loading orders for user:", userId);

        // Reference to orders collection
        const ordersRef = collection(db, "orders");
        
        // First try with the ordered query
        const orderedQuery = query(
            ordersRef, 
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );

        try {
            // Set up real-time listener
            const unsubscribe = onSnapshot(orderedQuery, 
                (snapshot) => {
                    console.log("Received orders snapshot:", snapshot.size, "documents");
                    processOrdersSnapshot(snapshot);
                },
                (error) => {
                    console.error("Error in orders snapshot:", error);
                    
                    // Handle index error
                    if (error.code === 'failed-precondition') {
                        const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/)?.[0];
                        
                        if (indexUrl) {
                            // Show notification with link to create index
                            showNotification(
                                `This query requires an index. Click <a href="${indexUrl}" target="_blank">here</a> to create it. Using simple query for now.`,
                                "warning"
                            );
                            
                            // Use simple query without ordering as fallback
                            const fallbackQuery = query(
                                ordersRef,
                                where("userId", "==", userId)
                            );
                            
                            // Set up fallback listener
                            onSnapshot(fallbackQuery, 
                                (fallbackSnapshot) => {
                                    console.log("Using fallback query without ordering");
                                    // Process snapshot and sort manually
                                    processOrdersSnapshot(fallbackSnapshot, true);
                                },
                                (fallbackError) => {
                                    console.error("Fallback query error:", fallbackError);
                                    showNotification("Failed to load orders", "error");
                                }
                            );
                        }
                    } else {
                        showNotification("Failed to load orders", "error");
                    }
                }
            );

            // Store unsubscribe function for cleanup
            window.invoiceUnsubscribe = unsubscribe;

        } catch (error) {
            console.error("Error setting up query:", error);
            showNotification("Failed to load orders", "error");
        }

    } catch (error) {
        console.error("Error in loadUserInvoices:", error);
        showNotification("Failed to initialize orders loading", "error");
    }
}

// Helper function to process orders snapshot
function processOrdersSnapshot(snapshot, needsManualSort = false) {
    try {
        // Map documents to our format
        allInvoices = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                orderNumber: data.orderNumber || doc.id,
                createdAt: getValidDate(data.createdAt || data.timestamp),
                productName: data.fuels?.[0]?.type || 'N/A',
                quantity: data.fuels?.[0]?.quantity || 0,
                totalAmount: calculateTotalAmount(data.fuels || []),
                status: data.status || 'pending',
                orderDetails: data
            };
        });

        // Sort manually if needed (when using fallback query)
        if (needsManualSort) {
            allInvoices.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateB - dateA; // Sort in descending order
            });
        }

        // Update UI
        updateInvoicesTable();
        updateInvoiceStats(allInvoices);

    } catch (error) {
        console.error("Error processing orders:", error);
        showNotification("Error processing order data", "error");
    }
}

// Calculate total amount from fuels
function calculateTotalAmount(fuels) {
    return fuels.reduce((total, fuel) => {
        const price = fuel.price || 0;
        const quantity = fuel.quantity || 0;
        return total + (price * quantity);
    }, 0);
}

// Update invoices table with pagination
function updateInvoicesTable() {
    const tableContainer = document.querySelector('.table-container');
    const currentPageStart = document.getElementById('currentPageStart');
    const currentPageEnd = document.getElementById('currentPageEnd');
    const totalOrders = document.getElementById('totalOrders');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    // Filter orders based on search query and status
    let filteredOrders = allInvoices.filter(order => {
        const orderNumber = order.orderNumber?.toLowerCase() || '';
        const productName = order.productName?.toLowerCase() || '';
        const matchesSearch = 
            orderNumber.includes(searchQuery) ||
            productName.includes(searchQuery);
        const matchesStatus = !statusFilter || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Sort orders by date in descending order (latest first)
    filteredOrders.sort((a, b) => {
        const dateA = a.createdAt?.seconds || a.createdAt;
        const dateB = b.createdAt?.seconds || b.createdAt;
        return dateB - dateA;
    });

    // Calculate pagination
    const startIndex = (currentPage - 1) * invoicesPerPage;
    const endIndex = startIndex + invoicesPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    // Update pagination info
    currentPageStart.textContent = filteredOrders.length > 0 ? startIndex + 1 : 0;
    currentPageEnd.textContent = Math.min(endIndex, filteredOrders.length);
    totalOrders.textContent = filteredOrders.length;

    // Update pagination buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = endIndex >= filteredOrders.length;

    // Clear existing content and create orders grid
    tableContainer.innerHTML = `
        <div class="table-header">
            <h2>Recent Orders</h2>
            <div class="table-actions">
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Search orders..." id="searchOrders">
                </div>
                <div class="filter-box">
                    <select id="filterStatus">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="orders-grid">
            ${paginatedOrders.length > 0 ? paginatedOrders.map(order => {
                const products = order.orderDetails?.fuels || [];
                const productsList = products.map(fuel => 
                    `${fuel.type || 'N/A'} (${formatNumber(fuel.quantity || 0)}L)`
                ).join(', ');

                const status = order.status?.toLowerCase() || 'pending';

                return `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="order-id">
                                <i class="fas fa-hashtag"></i>
                                ${order.orderNumber || 'N/A'}
                            </div>
                            <div class="order-date">
                                <i class="fas fa-calendar"></i>
                                ${formatDate(order.createdAt)}
                            </div>
                        </div>
                        <div class="order-details">
                            <div class="order-product">
                                <i class="fas fa-gas-pump"></i>
                                ${productsList || 'N/A'}
                            </div>
                            <div class="order-quantity">
                                <i class="fas fa-tachometer-alt"></i>
                                Total Quantity: ${formatNumber(products.reduce((sum, fuel) => sum + (fuel.quantity || 0), 0))}L
                            </div>
                            <div class="order-amount">
                                <i class="fas fa-money-bill-wave"></i>
                                MK ${formatNumber(order.totalAmount || 0)}
                            </div>
                        </div>
                        <div class="order-footer">
                            <div class="status-badge ${status}">
                                ${order.status || 'Pending'}
                            </div>
                            <div class="order-actions">
                                <button class="action-btn view-btn" onclick="viewInvoice('${order.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="action-btn invoice-btn" onclick="generateInvoice('${order.id}')">
                                    <i class="fas fa-file-invoice"></i> Invoice
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : `
                <div class="no-orders">
                    <i class="fas fa-file-invoice"></i>
                    <p>No orders found</p>
                </div>
            `}
        </div>
        <div class="pagination-controls">
            <div class="pagination-info">
                Showing <span id="currentPageStart">${currentPageStart.textContent}</span> to <span id="currentPageEnd">${currentPageEnd.textContent}</span> of <span id="totalOrders">${totalOrders.textContent}</span> orders
            </div>
            <div class="pagination-buttons">
                <button id="prevPage" class="btn btn-secondary" ${prevPageBtn.disabled ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <button id="nextPage" class="btn btn-primary" ${nextPageBtn.disabled ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;

    // Reattach event listeners for search and filter
    const searchInput = document.getElementById('searchOrders');
    const filterSelect = document.getElementById('filterStatus');
    
    searchInput.value = searchQuery;
    filterSelect.value = statusFilter;
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1;
        updateInvoicesTable();
    });

    filterSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        currentPage = 1;
        updateInvoicesTable();
    });

    // Reattach pagination button event listeners
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateInvoicesTable();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / invoicesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateInvoicesTable();
        }
    });
}

// Change page function
window.changePage = function(page) {
    currentPage = page;
    updateInvoicesTable();
};

// Get status badge HTML
function getStatusBadge(status) {
    const statusClasses = {
        'pending': 'pending',
        'processing': 'processing',
        'completed': 'completed',
        'cancelled': 'cancelled'
    };

    const statusText = {
        'pending': 'Pending',
        'processing': 'Processing',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };

    const statusClass = statusClasses[status] || 'pending';
    const text = statusText[status] || 'Pending';

    return `<span class="status-badge ${statusClass}">${text}</span>`;
}

// Update invoice statistics
function updateInvoiceStats(invoices) {
    try {
        // Get dates for different periods
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        
        // Calculate statistics
        const currentMonthInvoices = invoices.filter(invoice => {
            const invoiceDate = new Date(invoice.createdAt?.seconds ? invoice.createdAt.seconds * 1000 : invoice.createdAt);
            return invoiceDate >= lastMonth;
        });

        const lastMonthInvoices = invoices.filter(invoice => {
            const invoiceDate = new Date(invoice.createdAt?.seconds ? invoice.createdAt.seconds * 1000 : invoice.createdAt);
            return invoiceDate >= thirtyDaysAgo && invoiceDate < lastMonth;
        });

        // Calculate totals
        const currentMonthTotal = currentMonthInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
        const lastMonthTotal = lastMonthInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
        
        // Calculate pending payments
        const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending');
        const pendingAmount = pendingInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
        
        // Calculate overdue invoices (more than 30 days old and pending)
        const overdueInvoices = pendingInvoices.filter(invoice => {
            const invoiceDate = new Date(invoice.createdAt?.seconds ? invoice.createdAt.seconds * 1000 : invoice.createdAt);
            return (now - invoiceDate) > (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
        });
        const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

        // Calculate trends
        const calculateTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const invoiceTrend = calculateTrend(currentMonthInvoices.length, lastMonthInvoices.length);
        const revenueTrend = calculateTrend(currentMonthTotal, lastMonthTotal);

        // Update Total Invoices card
        const totalInvoicesElement = document.getElementById('totalInvoices');
        if (totalInvoicesElement) {
            totalInvoicesElement.innerHTML = `
                <span class="count">${currentMonthInvoices.length}</span>
                <span class="trend ${invoiceTrend >= 0 ? 'positive' : 'negative'}">
                    <i class="fas fa-arrow-${invoiceTrend >= 0 ? 'up' : 'down'}"></i>
                    ${Math.abs(invoiceTrend).toFixed(1)}%
                </span>
            `;
        }

        // Update Pending Payments card
        const pendingPaymentsElement = document.getElementById('pendingPayments');
        if (pendingPaymentsElement) {
            pendingPaymentsElement.innerHTML = `
                <span class="count">${pendingInvoices.length}</span>
                <span class="trend ${pendingInvoices.length === 0 ? '' : 'negative'}">
                    <i class="fas fa-${pendingInvoices.length === 0 ? 'check' : 'exclamation-circle'}"></i>
                    ${pendingInvoices.length === 0 ? 'All clear' : 'Needs attention'}
                </span>
            `;
        }

        // Update Total Amount card
        const totalAmountElement = document.getElementById('totalAmount');
        if (totalAmountElement) {
            totalAmountElement.innerHTML = `
                <span class="count">MK ${formatNumber(currentMonthTotal)}</span>
                <span class="trend ${revenueTrend >= 0 ? 'positive' : 'negative'}">
                    <i class="fas fa-arrow-${revenueTrend >= 0 ? 'up' : 'down'}"></i>
                    ${Math.abs(revenueTrend).toFixed(1)}%
                </span>
            `;
        }

        // Update Overdue Amount card
        const overdueAmountElement = document.getElementById('overdueAmount');
        if (overdueAmountElement) {
            overdueAmountElement.innerHTML = `
                <span class="count">MK ${formatNumber(overdueAmount)}</span>
                <span class="trend ${overdueInvoices.length === 0 ? 'positive' : 'negative'}">
                    <i class="fas fa-${overdueInvoices.length === 0 ? 'check' : 'exclamation-circle'}"></i>
                    ${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'}
                </span>
            `;
        }

    } catch (error) {
        console.error('Error updating invoice stats:', error);
        showNotification('Error updating statistics', 'error');
    }
}

// Format number with commas
function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Helper function to get valid date
function getValidDate(timestamp) {
    if (!timestamp) return new Date();
    
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    
    if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000);
    }
    
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date() : date;
}

// Update the formatDate function
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = getValidDate(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// View invoice function
window.viewInvoice = async function(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            showNotification("Order not found", "error");
            return;
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };

        // Fetch user profile data
        const userId = order.userId;
        if (userId) {
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                order.userProfile = userDoc.data();
            }
        }
        
        // Create invoice content
        const invoiceContent = generateInvoiceContent(order);
        
        // Show invoice in a modal
        showInvoiceModal(invoiceContent);
    } catch (error) {
        console.error("Error viewing invoice:", error);
        showNotification("Failed to view invoice", "error");
    }
};

// Generate invoice content
function generateInvoiceContent(order) {
    if (!order) {
        console.error("Invalid order data:", order);
        return '<div class="error-message">Invalid order data</div>';
    }

    // Get the correct date
    let orderDate;
    if (order.createdAt?.seconds) {
        orderDate = new Date(order.createdAt.seconds * 1000);
    } else if (order.createdAt) {
        orderDate = new Date(order.createdAt);
    } else if (order.timestamp) {
        orderDate = new Date(order.timestamp);
    } else if (order.orderDate?.seconds) {
        orderDate = new Date(order.orderDate.seconds * 1000);
    } else {
        orderDate = new Date();
    }

    // Get the correct ID
    const orderId = order.id || order.orderNumber || 'N/A';
    const invoiceNumber = `INV-${orderId.slice(-6).toUpperCase()}`;
    
    // Calculate totals
    const fuels = order.fuels || [];
    const subtotal = order.totalPrice || fuels.reduce((total, fuel) => total + (fuel.quantity || 0) * (fuel.price || 0), 0);
    const serviceFee = order.serviceFee || subtotal * 0.02; // 2% service fee if not specified
    const totalAmount = order.totalAmount || (subtotal + serviceFee);

    // Get user profile data and delivery information
    const userProfile = order.userProfile || {};
    const deliveryInfo = order.deliveryInfo || {};
    const location = order.location || {};
    const station = order.station || {};
    
    return `
        <div class="invoice-content">
            <div class="invoice-header">
                <div class="invoice-logo">
                    <img src="assets/img/images.png" alt="NOCMA Logo" class="nocma-logo">
                    <div class="company-info">
                        <h2>National Oil Company of Malawi</h2>
                        <p>P.O. Box 1344, Lilongwe, Malawi</p>
                        <p>Phone: +265 1 789 000</p>
                        <p>Email: info@nocma.mw</p>
                    </div>
                </div>
                <div class="invoice-details">
                    <h3>INVOICE</h3>
                    <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                    <p><strong>Date:</strong> ${formatDate(orderDate)}</p>
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${order.status?.toLowerCase() || 'pending'}">${order.status || 'Pending'}</span></p>
                </div>
            </div>
            
            <div class="invoice-body">
                <div class="company-details">
                    <h3>Client Details</h3>
                    <div class="client-info-grid">
                        <div class="client-info-section">
                            <h4>Company Information</h4>
                            <p><strong>Company Name:</strong> ${userProfile.companyName || 'N/A'}</p>
                            <p><strong>Contact Person:</strong> ${userProfile.contactPerson || userProfile.displayName || 'N/A'}</p>
                            <p><strong>Email:</strong> ${userProfile.email || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${userProfile.phone || userProfile.phoneNumber || 'N/A'}</p>
                            <p><strong>Address:</strong> ${userProfile.address || 'N/A'}</p>
                            <p><strong>Business Registration:</strong> ${userProfile.businessRegistration || 'N/A'}</p>
                            <p><strong>Tax ID:</strong> ${userProfile.taxId || 'N/A'}</p>
                            <p><strong>License Number:</strong> ${userProfile.licenseNumber || 'N/A'}</p>
                        </div>
                        <div class="client-info-section">
                            <h4>Delivery Information</h4>
                            <p><strong>Station ID:</strong> ${order.stationId || station.id || 'N/A'}</p>
                            <p><strong>Station Name:</strong> ${order.stationName || station.name || 'N/A'}</p>
                            <p><strong>Location:</strong> ${location.address || order.deliveryAddress || 'N/A'}</p>
                            <p><strong>Region:</strong> ${location.region || order.region || station.region || 'N/A'}</p>
                            <p><strong>District:</strong> ${location.district || order.district || 'N/A'}</p>
                            <p><strong>Contact Person:</strong> ${deliveryInfo.contactPerson || order.contactPerson || 'N/A'}</p>
                            <p><strong>Contact Phone:</strong> ${deliveryInfo.contactPhone || order.contactPhone || 'N/A'}</p>
                            <p><strong>Delivery Instructions:</strong> ${deliveryInfo.instructions || order.deliveryInstructions || 'N/A'}</p>
                            <p><strong>Preferred Delivery Date:</strong> ${order.preferredDeliveryDate ? formatDate(order.preferredDeliveryDate) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="order-items">
                    <h3>Order Items</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Fuel Type</th>
                                <th>Quantity (L)</th>
                                <th class="text-right">Price (MK/L)</th>
                                <th class="text-right">Total (MK)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fuels.map(fuel => {
                                const quantity = fuel.quantity || 0;
                                const price = fuel.price || 0;
                                const total = quantity * price;
                                return `
                                    <tr>
                                        <td>${fuel.type || 'N/A'}</td>
                                        <td>${formatNumber(quantity)}</td>
                                        <td class="text-right">${formatNumber(price)}</td>
                                        <td class="text-right">${formatNumber(total)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" class="text-right"><strong>Subtotal:</strong></td>
                                <td class="text-right"><strong>MK ${formatNumber(subtotal)}</strong></td>
                            </tr>
                            <tr>
                                <td colspan="3" class="text-right"><strong>Service Fee (2%):</strong></td>
                                <td class="text-right"><strong>MK ${formatNumber(serviceFee)}</strong></td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="3" class="text-right"><strong>Total Amount:</strong></td>
                                <td class="text-right"><strong>MK ${formatNumber(totalAmount)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${order.additionalNotes ? `
                    <div class="additional-notes">
                        <h3>Additional Notes</h3>
                        <p>${order.additionalNotes}</p>
                    </div>
                ` : ''}

                <div class="invoice-footer">
                    <div class="terms">
                        <h3>Terms & Conditions</h3>
                        <p>1. Payment is due within 30 days from the invoice date.</p>
                        <p>2. All prices are in Malawi Kwacha (MK).</p>
                        <p>3. This invoice is subject to NOCMA's standard terms and conditions.</p>
                    </div>
                    <div class="signature">
                        <p>For NOCMA</p>
                        <div class="signature-line"></div>
                        <p>Authorized Signature</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Show invoice modal
function showInvoiceModal(content) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('invoiceModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'invoiceModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Invoice Details</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="action-btn download-btn" onclick="downloadInvoiceAsPDF()">
                        <i class="fas fa-download"></i> Download PDF
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update modal content
    modal.querySelector('.modal-body').innerHTML = content;

    // Show modal
    modal.style.display = 'flex';

    // Add close button event listener
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Download invoice as PDF
window.downloadInvoiceAsPDF = function() {
    try {
        const modalContent = document.querySelector('.modal-body');
        if (!modalContent) {
            showNotification("Invoice content not found", "error");
            return;
        }

        // Show loading notification
        showNotification("Preparing invoice for download...", "info");

        // Create a clone of the content for PDF generation
        const content = modalContent.cloneNode(true);

        // Add custom styles for PDF
        const style = document.createElement('style');
        style.textContent = `
            .invoice-content {
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
                font-size: 14px;
            }
            .nocma-logo {
                width: 100px;
                height: 100px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-size: 14px;
            }
            th, td {
                padding: 12px;
                border: 1px solid #ddd;
                text-align: left;
            }
            th {
                background-color: #f8f9fa;
                font-weight: bold;
                color: #1e293b;
            }
            .text-right {
                text-align: right;
            }
            tfoot tr {
                background-color: #f8f9fa;
            }
            tfoot tr.total-row {
                background-color: #e2e8f0;
                font-size: 16px;
            }
            tfoot tr.total-row td {
                color: #1e293b;
            }
            .signature-line {
                margin: 20px 0;
                border-top: 1px solid #000;
            }
            .company-details {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .invoice-header {
                margin-bottom: 30px;
            }
            .invoice-details {
                text-align: right;
            }
            .invoice-details h3 {
                color: #2563eb;
                font-size: 24px;
                margin-bottom: 10px;
            }
            .terms {
                margin-top: 30px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            .terms h3 {
                color: #1e293b;
                margin-bottom: 10px;
            }
            .terms p {
                margin: 5px 0;
                font-size: 12px;
            }
        `;
        content.appendChild(style);
        
        // Configure PDF options
        const opt = {
            margin: [0.5, 0.5],
            filename: `NOCMA-Invoice-${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: { 
                unit: 'in', 
                format: 'a4', 
                orientation: 'portrait'
            }
        };

        // Generate PDF
        html2pdf()
            .set(opt)
            .from(content)
            .save()
            .then(() => {
                showNotification("Invoice downloaded successfully", "success");
            })
            .catch(error => {
                console.error("Error generating PDF:", error);
                showNotification("Failed to generate PDF", "error");
            });

    } catch (error) {
        console.error("Error in download function:", error);
        showNotification("Failed to download invoice", "error");
    }
};

// Download invoice function
window.downloadInvoice = async function(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            showNotification("Order not found", "error");
            return;
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };
        
        // Generate invoice content
        const invoiceContent = generateInvoiceContent(order);
        
        // Create a temporary container for the invoice
        const tempContainer = document.createElement('div');
        tempContainer.className = 'modal-body';
        tempContainer.innerHTML = invoiceContent;
        document.body.appendChild(tempContainer);
        
        // Download the PDF
        await downloadInvoiceAsPDF();
        
        // Remove the temporary container
        document.body.removeChild(tempContainer);
        
    } catch (error) {
        console.error("Error downloading invoice:", error);
        showNotification("Failed to download invoice", "error");
    }
};

// Generate invoice function
window.generateInvoice = async function(orderId) {
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);

        if (!orderDoc.exists()) {
            showNotification("Order not found", "error");
            return;
        }

        const order = {
            id: orderDoc.id,
            ...orderDoc.data()
        };
        
        // Create invoice content
        const invoiceContent = generateInvoiceContent(order);
        
        // Show invoice in a modal
        showInvoiceModal(invoiceContent);
    } catch (error) {
        console.error("Error generating invoice:", error);
        showNotification("Failed to generate invoice", "error");
    }
};

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the header
    initializeHeader();
    
    // Add auth state change listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            showNotification("Please login to access the invoices page", "warning");
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

            // Load user's invoices
            await loadUserInvoices(user.uid);

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

    // Add search and filter functionality
    document.getElementById('searchOrders')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1; // Reset to first page when searching
        updateInvoicesTable();
    });

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        currentPage = 1; // Reset to first page when filtering
        updateInvoicesTable();
    });

    // Add pagination button event listeners
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateInvoicesTable();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(allInvoices.length / invoicesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateInvoicesTable();
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

// Load invoices
async function loadInvoices(userId) {
    try {
        const invoicesTableBody = document.getElementById('invoicesTableBody');
        if (!invoicesTableBody) {
            console.error('Invoices table body not found');
            return;
        }

        // Show loading state
        invoicesTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading-spinner"></div>
                    Loading invoices...
                </td>
            </tr>
        `;

        // Query completed orders with payments
        const ordersRef = collection(db, "orders");
        
        try {
            // First try with the ordered query
            const orderedQuery = query(
                ordersRef,
                where("userId", "==", userId),
                where("status", "==", "completed"),
                orderBy("createdAt", "desc"),
                limit(10)
            );

            const querySnapshot = await getDocs(orderedQuery);
            processInvoices(querySnapshot, invoicesTableBody);

        } catch (error) {
            if (error.code === 'failed-precondition' && error.message.includes('requires an index')) {
                const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
                
                // Show index creation message
                showNotification(
                    `This feature requires a database index. Please <a href="${indexUrl}" target="_blank">click here</a> to create it. Using basic view for now.`,
                    "warning"
                );

                // Use a simpler query as fallback
                const fallbackQuery = query(
                    ordersRef,
                    where("userId", "==", userId),
                    where("status", "==", "completed")
                );

                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                // Sort manually since we can't use orderBy
                const sortedDocs = Array.from(fallbackSnapshot.docs).sort((a, b) => {
                    const dateA = a.data().createdAt?.seconds || 0;
                    const dateB = b.data().createdAt?.seconds || 0;
                    return dateB - dateA;
                }).slice(0, 10); // Apply limit manually

                processInvoices({ 
                    docs: sortedDocs,
                    empty: sortedDocs.length === 0,
                    size: sortedDocs.length
                }, invoicesTableBody);
            } else {
                throw error; // Re-throw non-index related errors
            }
        }
    } catch (error) {
        console.error("Error loading invoices:", error);
        showNotification("Failed to load invoices", "error");
        
        if (invoicesTableBody) {
            invoicesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-red-500">
                        <i class="fas fa-exclamation-circle"></i>
                        Error loading invoices. Please try again later.
                    </td>
                </tr>
            `;
        }
    }
}

function processInvoices(querySnapshot, tableBody) {
    if (querySnapshot.empty) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <i class="fas fa-file-invoice"></i>
                    <p>No invoices found</p>
                </td>
            </tr>
        `;
        return;
    }

    // Clear table
    tableBody.innerHTML = '';

    // Process each invoice
    querySnapshot.docs.forEach((doc) => {
        const invoice = doc.data();
        const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt.seconds * 1000) : new Date();
        
        // Format fuel types and quantities
        let fuelInfo = invoice.fuels?.map(fuel => 
            `${fuel.type} (${fuel.quantity}L)`
        ).join(', ') || 'N/A';

        // Get the total amount including service fee if available
        const totalAmount = invoice.payment?.totalAmount || invoice.totalPrice || 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${doc.id}</td>
            <td>${formatDate(invoiceDate)}</td>
            <td>${fuelInfo}</td>
            <td>MWK ${totalAmount.toLocaleString()}</td>
            <td>
                <span class="status-badge ${invoice.payment?.status || 'pending'}">
                    ${invoice.payment?.status || 'pending'}
                </span>
            </td>
            <td>
                <button class="action-btn view-btn" onclick="viewInvoice('${doc.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn download-btn" onclick="downloadInvoice('${doc.id}')">
                    <i class="fas fa-download"></i> Download
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Close modal helper
window.closeModal = (element) => {
    const modal = element.closest('.modal');
    if (modal) modal.remove();
}; 