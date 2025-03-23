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
    serverTimestamp,
    orderBy,
    limit,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Initialize Firebase Storage
const storage = getStorage();

// Create toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the header
    initializeHeader();
    
    // Add toast container to body
    document.body.appendChild(toastContainer);

    // Add auth state change listener
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to login page");
            showNotification("Please login to access the dashboard", "warning");
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

            // Safely update DOM elements
            const updateDOMElements = () => {
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
            };

            // Try to update DOM elements
            updateDOMElements();

            // Handle first login
            const isPostOTP = sessionStorage.getItem("postOTPVerification");
            if (isPostOTP) {
                showNotification(`Welcome to your dashboard, ${userData.companyName}!`, "success");
                sessionStorage.removeItem("postOTPVerification");
                await loadUserOrders(user.uid);
            } else {
                showNotification(`Welcome back, ${userData.companyName}!`, "success");
                await loadUserOrders(user.uid);
            }

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

    // Add navigation handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(nav => {
                nav.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    // Initialize the delivery status card with empty counts
    updateDeliveryStatusCounts({
        pending_approval: 0,
        approved: 0,
        in_transit: 0,
        delivered: 0,
        rejected: 0
    });
});

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

// Load user's orders
async function loadUserOrders(userId) {
    try {
        console.log("Attempting to load orders for user:", userId);

        // Reference to orders collection
        const ordersRef = collection(db, "orders");
        
        // Create query with just userId
        const q = query(ordersRef, where("userId", "==", userId));
        
        // Execute query
        const querySnapshot = await getDocs(q);
        console.log("Query executed, found", querySnapshot.size, "total orders");

        // Update dashboard cards
        let totalOrders = 0;
        let completedDeliveries = 0;
        let pendingOrders = 0;

        // Track delivery status counts
        let deliveryStatusCounts = {
            pending_approval: 0,
            approved: 0,
            in_transit: 0,
            delivered: 0,
            rejected: 0
        };
        
        // Clear existing table
        const tableBody = document.getElementById('recentActivityTable');
        tableBody.innerHTML = '';
        
        // Get the start and end of the current day
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Process orders and filter for today's orders in memory
        const orders = [];
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            
            // Check if the order is from today
            if (orderDate >= startOfDay && orderDate <= endOfDay) {
                orders.push({ id: doc.id, ...order });
                
                if (order.status === 'completed') completedDeliveries++;
                else if (order.status === 'pending') pendingOrders++;

                // Count delivery statuses
                const deliveryStatus = order.deliveryStatus || 'pending_approval';
                deliveryStatusCounts[deliveryStatus]++;
            }
        });

        totalOrders = orders.length;

        // Handle empty results
        if (orders.length === 0) {
            console.log("No orders found for today");
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders for today</td></tr>';
            updateDashboardCards(0, 0, 0);
            updateDeliveryStatusCounts(deliveryStatusCounts);
            return;
        }

        console.log(`Found ${totalOrders} orders today (${completedDeliveries} completed, ${pendingOrders} pending)`);
        console.log('Delivery status counts:', deliveryStatusCounts);

        // Sort orders by date (most recent first)
        orders.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.seconds : 0;
            const dateB = b.createdAt ? b.createdAt.seconds : 0;
            return dateB - dateA;
        });

        // Update table
        orders.forEach(order => {
            const row = document.createElement('tr');
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            
            // Format fuel types and quantities
            let fuelInfo = 'N/A';
            if (order.fuels && order.fuels.length > 0) {
                fuelInfo = order.fuels.map(fuel => 
                    `${fuel.type} (${fuel.quantity}L)`
                ).join(', ');
            }
            
            // Get the total amount including service fee if available
            const totalAmount = order.payment?.totalAmount || order.totalPrice || 0;

            // Get delivery status with appropriate styling
            const deliveryStatus = getDeliveryStatusBadge(order.deliveryStatus);
            
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${formatDate(orderDate)}</td>
                <td>${fuelInfo}</td>
                <td>MWK ${totalAmount.toLocaleString()}</td>
                <td><span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span></td>
                <td>${deliveryStatus}</td>
                <td>
                    ${order.status === 'pending' ? `
                        <button class="action-btn complete-payment-btn" onclick="showPaymentModal({orderId: '${order.id}', totalAmount: ${totalAmount}})">
                            <i class="fas fa-credit-card"></i>
                            Complete Payment
                        </button>
                    ` : ''}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update dashboard cards with today's statistics
        updateDashboardCards(totalOrders, completedDeliveries, pendingOrders);
        updateDeliveryStatusCounts(deliveryStatusCounts);
        
    } catch (error) {
        console.error("Error loading orders:", error);
        handleOrderLoadError();
    }
}

// Helper function to generate delivery status badge HTML
function getDeliveryStatusBadge(status) {
    const statusMap = {
        'pending_approval': {
            label: 'Pending Approval',
            class: 'pending'
        },
        'approved': {
            label: 'Approved',
            class: 'approved'
        },
        'in_transit': {
            label: 'In Transit',
            class: 'in-transit'
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
        class: 'pending'
    };

    const statusInfo = statusMap[status] || defaultStatus;
    
    return `<span class="delivery-status-badge ${statusInfo.class}">
                ${statusInfo.label}
            </span>`;
}

// Helper function to update dashboard cards
function updateDashboardCards(total, completed, pending) {
    document.querySelector('.card:nth-child(1) .card-value').textContent = total;
    document.querySelector('.card:nth-child(2) .card-value').textContent = completed;
    document.querySelector('.card:nth-child(3) .card-value').textContent = pending;
}

// Helper function to update delivery status counts in the dashboard
function updateDeliveryStatusCounts(counts) {
    try {
        // Wait for DOM elements to be ready
        const elements = {
            currentStatusIcon: document.getElementById('currentStatusIcon'),
            currentStatusText: document.getElementById('currentStatusText'),
            currentStatusCount: document.getElementById('currentStatusCount'),
            stepPending: document.getElementById('stepPending'),
            stepApproved: document.getElementById('stepApproved'),
            stepTransit: document.getElementById('stepTransit'),
            stepDelivered: document.getElementById('stepDelivered'),
            labelPending: document.getElementById('labelPending'),
            labelApproved: document.getElementById('labelApproved'),
            labelTransit: document.getElementById('labelTransit'),
            labelDelivered: document.getElementById('labelDelivered')
        };

        // Check if any required element is missing
        const missingElements = Object.entries(elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn('Missing elements:', missingElements);
            return; // Exit early if any elements are missing
        }

        // Find the most active status
        const statusPriority = ['in_transit', 'pending_approval', 'approved', 'delivered', 'rejected'];
        let activeStatus = statusPriority.find(status => counts[status] > 0) || 'pending_approval';
        
        // Update the current status display
        const statusInfo = {
            pending_approval: {
                icon: 'clock',
                text: 'Pending Approval',
                description: `${counts.pending_approval || 0} orders awaiting approval`,
                color: '#92400e'
            },
            approved: {
                icon: 'check-circle',
                text: 'Approved',
                description: `${counts.approved || 0} orders approved`,
                color: '#166534'
            },
            in_transit: {
                icon: 'truck',
                text: 'In Transit',
                description: `${counts.in_transit || 0} orders being delivered`,
                color: '#1e40af'
            },
            delivered: {
                icon: 'box-check',
                text: 'Delivered',
                description: `${counts.delivered || 0} orders completed`,
                color: '#065f46'
            },
            rejected: {
                icon: 'times-circle',
                text: 'Rejected',
                description: `${counts.rejected || 0} orders rejected`,
                color: '#991b1b'
            }
        };

        // Update status indicator
        const currentInfo = statusInfo[activeStatus];
        elements.currentStatusIcon.className = `fas fa-${currentInfo.icon}`;
        elements.currentStatusText.textContent = currentInfo.text;
        elements.currentStatusCount.textContent = currentInfo.description;

        // Update progress steps
        const steps = ['pending', 'approved', 'transit', 'delivered'];
        const statusOrder = ['pending_approval', 'approved', 'in_transit', 'delivered'];
        const currentIndex = statusOrder.indexOf(activeStatus);

        steps.forEach((step, index) => {
            const stepElement = elements[`step${step.charAt(0).toUpperCase() + step.slice(1)}`];
            const labelElement = elements[`label${step.charAt(0).toUpperCase() + step.slice(1)}`];

            if (index < currentIndex) {
                stepElement.className = 'progress-step completed';
                labelElement.className = 'progress-label completed';
            } else if (index === currentIndex) {
                stepElement.className = 'progress-step active';
                labelElement.className = 'progress-label active';
            } else {
                stepElement.className = 'progress-step';
                labelElement.className = 'progress-label';
            }
        });

        // Update progress line
        const progressSteps = document.querySelector('.progress-steps');
        if (progressSteps) {
            progressSteps.setAttribute('data-progress', currentIndex);
        }

    } catch (error) {
        console.warn('Error updating delivery status counts:', error);
        // Set a default state for the delivery status card
        try {
            const statusIcon = document.getElementById('currentStatusIcon');
            const statusText = document.getElementById('currentStatusText');
            const statusCount = document.getElementById('currentStatusCount');
            
            if (statusIcon) statusIcon.className = 'fas fa-exclamation-circle';
            if (statusText) statusText.textContent = 'Status Unavailable';
            if (statusCount) statusCount.textContent = 'Unable to load status information';
        } catch (e) {
            console.error('Failed to set default state:', e);
        }
    }
}

// Update the handleOrderLoadError function
function handleOrderLoadError() {
    try {
        showNotification("Failed to load orders. Please try again later.", "error");
        
        const tableBody = document.getElementById('recentActivityTable');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error loading orders</td></tr>';
        }
        
        updateDashboardCards('-', '-', '-');
        
        // Update status indicator for error state
        const elements = {
            currentStatusIcon: document.getElementById('currentStatusIcon'),
            currentStatusText: document.getElementById('currentStatusText'),
            currentStatusCount: document.getElementById('currentStatusCount')
        };

        if (elements.currentStatusIcon) elements.currentStatusIcon.className = 'fas fa-exclamation-circle';
        if (elements.currentStatusText) elements.currentStatusText.textContent = 'Error Loading Status';
        if (elements.currentStatusCount) elements.currentStatusCount.textContent = 'Please try again later';

        // Reset progress steps
        ['Pending', 'Approved', 'Transit', 'Delivered'].forEach(step => {
            const stepElement = document.getElementById(`step${step}`);
            const labelElement = document.getElementById(`label${step}`);
            if (stepElement) stepElement.className = 'progress-step';
            if (labelElement) labelElement.className = 'progress-label';
        });
    } catch (error) {
        console.error('Error in handleOrderLoadError:', error);
    }
}

// Date formatting
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Dashboard-specific functionality
async function loadDashboardData() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Update dashboard with user data
            // Add your dashboard-specific code here
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// Load dashboard data when auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadDashboardData();
    } else {
        window.location.href = 'index.html';
    }
});

// Function to load recent activity
async function loadRecentActivity() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log("No user logged in");
            return;
        }

        // Show loading state
        const recentActivityTable = document.getElementById('recentActivityTable');
        recentActivityTable.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center;">
                    <div style="display: flex; justify-content: center; align-items: center; padding: 20px;">
                        <div class="loading-spinner"></div>
                    </div>
                </td>
            </tr>
        `;

        const ordersRef = collection(db, "orders");
        try {
            const q = query(
                ordersRef,
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(5)
            );

            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                recentActivityTable.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center;">No recent activity</td>
                    </tr>
                `;
                return;
            }

            recentActivityTable.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const order = doc.data();
                const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
                
                // Format fuel types and quantities
                const fuelInfo = order.fuels?.map(fuel => 
                    `${fuel.type} (${fuel.quantity}L)`
                ).join(', ') || 'N/A';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${doc.id}</td>
                    <td>${formatDate(orderDate)}</td>
                    <td>${fuelInfo}</td>
                    <td>MWK ${order.totalPrice?.toLocaleString() || '0'}</td>
                    <td><span class="status-badge ${order.status}">${order.status}</span></td>
                    <td>
                        ${order.status === 'pending' ? `
                            <button class="action-btn complete-payment-btn" onclick="showPaymentModal({orderId: '${doc.id}', totalAmount: ${order.totalPrice}})">
                                <i class="fas fa-credit-card"></i>
                                Complete Payment
                            </button>
                        ` : '-'}
                    </td>
                `;
                recentActivityTable.appendChild(row);
            });

        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                // Show user-friendly error message with link to create index
                recentActivityTable.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px;">
                            <div style="color: #e11d48; margin-bottom: 10px;">
                                <i class="fas fa-exclamation-circle"></i>
                                The system needs to create an index for better performance.
                            </div>
                            <div style="margin-bottom: 10px;">
                                Please click the link below to create the required index:
                            </div>
                            <a href="${error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)[0]}"
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
            } else {
                // Show generic error message for other errors
                recentActivityTable.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #e11d48;">
                            <i class="fas fa-exclamation-circle"></i>
                            Error loading recent activity. Please try again later.
                        </td>
                    </tr>
                `;
            }
            throw error; // Re-throw the error for logging purposes
        }

    } catch (error) {
        console.error("Error loading recent activity:", error);
        showNotification("Error loading recent activity. Please try again later.", "error");
    }
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

// Initialize payment functionality when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize payment tabs
    initializePaymentTabs();
    
    // Create payment options
    createPaymentOptions('mobile');
    createPaymentOptions('bank');
    
    // Load payment method images
    loadPaymentMethodImages();
});

// Make sure showPaymentModal is available globally
window.showPaymentModal = function(orderDetails) {
    const modal = document.getElementById('paymentModal');
    const modalContent = modal.querySelector('.payment-modal');
    
    // Store orderId in the modal's dataset
    modal.dataset.orderId = orderDetails.orderId;
    
    // Reset modal state
    document.querySelectorAll('.payment-option').forEach(opt => 
        opt.classList.remove('selected'));
    document.querySelector('.payment-input-container').classList.add('hidden');
    document.getElementById('processPayment').disabled = true;

    // Update payment amounts
    const totalAmount = parseFloat(orderDetails.totalAmount);
    document.getElementById('modalTotalAmount').textContent = `MWK ${totalAmount.toLocaleString()}`;
    const serviceFee = totalAmount * 0.02;
    document.getElementById('modalServiceFee').textContent = `MWK ${serviceFee.toLocaleString()}`;
    const finalAmount = totalAmount + serviceFee;
    document.getElementById('modalFinalAmount').textContent = `MWK ${finalAmount.toLocaleString()}`;
    document.getElementById('buttonAmount').textContent = `MWK ${finalAmount.toLocaleString()}`;

    // Show modal with fade-in effect
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
        modalContent.style.transform = 'translateY(0)';
        modalContent.style.opacity = '1';
    }, 10);

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
        });
    });
}

// Function to show payment inputs
function showPaymentInputs(type, method) {
    const mobileInput = document.querySelector('.mobile-input');
    const bankInput = document.querySelector('.bank-input');
    const inputContainer = document.querySelector('.payment-input-container');

    inputContainer.classList.remove('hidden');
    mobileInput.classList.add('hidden');
    bankInput.classList.add('hidden');

    if (type === 'mobile') {
        mobileInput.classList.remove('hidden');
        const phoneInput = document.getElementById('phoneNumber');
        phoneInput.placeholder = method.includes('airtel') ? 
            'Enter Airtel Money number' : 'Enter TNM Mpamba number';
    } else {
        bankInput.classList.remove('hidden');
        const accountInput = document.getElementById('accountNumber');
        accountInput.placeholder = `Enter ${method.replace(/-/g, ' ')} account number`;
    }

    // Reset validation
    validatePaymentInputs();
}

// Function to initialize payment tabs
function initializePaymentTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            contents.forEach(content => content.classList.add('hidden'));
            const targetContent = document.getElementById(`${tab.dataset.tab}Payment`);
            targetContent.classList.remove('hidden');
            document.querySelector('.payment-input-container').classList.add('hidden');
            document.getElementById('processPayment').disabled = true;
        });
    });
}

// Function to update payment amounts
function updatePaymentAmounts(orderDetails) {
    const totalAmount = orderDetails.totalAmount;
    const serviceFee = totalAmount * 0.02;
    const finalAmount = totalAmount + serviceFee;

    animateAmount('modalTotalAmount', totalAmount);
    animateAmount('modalServiceFee', serviceFee);
    animateAmount('modalFinalAmount', finalAmount);
    animateAmount('buttonAmount', finalAmount);
}

// Function to animate amount changes
function animateAmount(elementId, targetAmount, duration = 1000) {
    const element = document.getElementById(elementId);
    const start = 0;
    const increment = targetAmount / (duration / 16);
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
document.getElementById('phoneNumber')?.addEventListener('input', validatePaymentInputs);
document.getElementById('accountNumber')?.addEventListener('input', validatePaymentInputs);

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

// Make functions globally available
window.showPaymentModal = showPaymentModal;
window.validatePaymentInputs = validatePaymentInputs;

// Add event listener to process payment button
document.getElementById('processPayment')?.addEventListener('click', processPayment);

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
        const orderId = document.getElementById('paymentModal').dataset.orderId;
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
        showInvoice({
            transactionId,
            paymentMethod: `${paymentMethod} (${paymentProvider})`,
            orderAmount,
            serviceFee,
            totalAmount
        });
        
    } catch (error) {
        console.error('Payment processing error:', error);
        loadingOverlay.style.display = 'none';
        showNotification('Payment processing failed. Please try again.', 'error');
    }
}

// Function to show the invoice
function showInvoice(paymentDetails) {
    const invoiceModal = document.getElementById('invoiceModal');
    
    document.getElementById('invoiceNumber').textContent = paymentDetails.transactionId;
    document.getElementById('invoiceDate').textContent = new Date().toLocaleDateString();
    document.getElementById('customerName').textContent = document.getElementById('userName').textContent;
    document.getElementById('customerEmail').textContent = document.getElementById('userEmail').textContent;
    document.getElementById('paymentMethod').textContent = paymentDetails.paymentMethod;
    document.getElementById('transactionId').textContent = paymentDetails.transactionId;
    
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
    
    modalContent.style.transform = 'translateY(20px)';
    modalContent.style.opacity = '0';
    invoiceModal.classList.remove('show');
    
    setTimeout(() => {
        invoiceModal.style.display = 'none';
        showNotification('Order completed successfully! Refreshing dashboard...', 'success');
        
        // Reload the recent activity
        setTimeout(() => {
            loadRecentActivity();
        }, 2000);
    }, 300);
}

// Function to download invoice
function downloadInvoice() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    loadingOverlay.style.display = 'flex';
    
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        showNotification('Invoice downloaded successfully!', 'success');
    }, 1500);
}

// Make functions globally available
window.closeInvoiceModal = closeInvoiceModal;
window.downloadInvoice = downloadInvoice;

// Make function globally available
window.loadRecentActivity = loadRecentActivity;