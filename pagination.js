// Pagination configuration
const ITEMS_PER_PAGE = 4;
let currentPage = 1;
let totalOrders = 0;
let allOrders = [];
let filteredOrders = [];

// Initialize pagination
function initializePagination(orders) {
    try {
        console.log('Initializing pagination with orders:', orders);
        if (!Array.isArray(orders) || orders.length === 0) {
            console.log('No orders to initialize');
            return;
        }
        
        allOrders = orders;
        filteredOrders = [...orders];
        totalOrders = filteredOrders.length;
        
        // Initialize filters
        initializeFilters();
        
        updatePaginationInfo();
        displayCurrentPage();
    } catch (error) {
        console.error('Error initializing pagination:', error);
    }
}

// Initialize filters
function initializeFilters() {
    try {
        const fuelTypeSelect = document.getElementById('fuelType');
        const dateFromInput = document.getElementById('dateFrom');
        const dateToInput = document.getElementById('dateTo');

        if (!fuelTypeSelect || !dateFromInput || !dateToInput) {
            console.error('Filter elements not found in DOM');
            return;
        }

        // Remove existing event listeners if any
        fuelTypeSelect.removeEventListener('change', filterOrders);
        dateFromInput.removeEventListener('change', filterOrders);
        dateToInput.removeEventListener('change', filterOrders);

        // Add new event listeners
        fuelTypeSelect.addEventListener('change', filterOrders);
        dateFromInput.addEventListener('change', filterOrders);
        dateToInput.addEventListener('change', filterOrders);

        console.log('Filters initialized successfully');
    } catch (error) {
        console.error('Error initializing filters:', error);
    }
}

// Update summary cards
function updateSummaryCards() {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        let dailyOrders = 0;
        let weeklyOrders = 0;
        let monthlyOrders = 0;
        let yearlyOrders = 0;

        filteredOrders.forEach(order => {
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            
            if (orderDate >= startOfDay) dailyOrders++;
            if (orderDate >= startOfWeek) weeklyOrders++;
            if (orderDate >= startOfMonth) monthlyOrders++;
            if (orderDate >= startOfYear) yearlyOrders++;
        });

        // Update the summary cards
        document.getElementById('dailyOrders').textContent = dailyOrders;
        document.getElementById('weeklyOrders').textContent = weeklyOrders;
        document.getElementById('monthlyOrders').textContent = monthlyOrders;
        document.getElementById('yearlyOrders').textContent = yearlyOrders;

        console.log('Orders Summary:', { dailyOrders, weeklyOrders, monthlyOrders, yearlyOrders });
    } catch (error) {
        console.error('Error updating summary cards:', error);
    }
}

// Update charts
function updateCharts() {
    try {
        // Fuel Type Distribution Chart
        const fuelTypeChart = document.getElementById('fuelTypeChart');
        if (fuelTypeChart) {
            const ctx = fuelTypeChart.getContext('2d');
            
            // Destroy existing chart if it exists
            if (window.fuelTypeChartInstance) {
                window.fuelTypeChartInstance.destroy();
            }

            const fuelTypeData = {};
            filteredOrders.forEach(order => {
                if (order.fuels && order.fuels.length > 0) {
                    order.fuels.forEach(fuel => {
                        fuelTypeData[fuel.type] = (fuelTypeData[fuel.type] || 0) + fuel.quantity;
                    });
                }
            });

            // Create new chart
            window.fuelTypeChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(fuelTypeData),
                    datasets: [{
                        data: Object.values(fuelTypeData),
                        backgroundColor: [
                            '#3b82f6',
                            '#10b981',
                            '#f59e0b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }

        // Quantity Trends Chart
        const quantityTrendChart = document.getElementById('quantityTrendChart');
        if (quantityTrendChart) {
            const ctx = quantityTrendChart.getContext('2d');
            
            // Destroy existing chart if it exists
            if (window.quantityTrendChartInstance) {
                window.quantityTrendChartInstance.destroy();
            }

            const quantityTrendData = {};
            filteredOrders.forEach(order => {
                if (order.fuels && order.fuels.length > 0) {
                    const date = order.createdAt ? 
                        new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 
                        new Date().toLocaleDateString();
                    order.fuels.forEach(fuel => {
                        if (!quantityTrendData[date]) {
                            quantityTrendData[date] = {};
                        }
                        quantityTrendData[date][fuel.type] = (quantityTrendData[date][fuel.type] || 0) + fuel.quantity;
                    });
                }
            });

            const dates = Object.keys(quantityTrendData).sort();
            const fuelTypes = [...new Set(filteredOrders.flatMap(order => 
                order.fuels ? order.fuels.map(fuel => fuel.type) : []
            ))];

            // Create new chart
            window.quantityTrendChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: fuelTypes.map((type, index) => ({
                        label: type,
                        data: dates.map(date => quantityTrendData[date][type] || 0),
                        borderColor: ['#3b82f6', '#10b981', '#f59e0b'][index],
                        tension: 0.1
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// Filter orders based on criteria
function filterOrders() {
    try {
        console.log('Filtering orders...');
        const fuelType = document.getElementById('fuelType')?.value;
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;

        console.log('Filter criteria:', { fuelType, dateFrom, dateTo });
        console.log('All orders before filtering:', allOrders);

        if (!Array.isArray(allOrders) || allOrders.length === 0) {
            console.log('No orders to filter');
            return;
        }

        filteredOrders = allOrders.filter(order => {
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            const orderDateStr = orderDate.toISOString().split('T')[0];
            
            // Check fuel type filter
            let fuelTypeMatch = true;
            if (fuelType) {
                // Check if the order has multiple fuels
                if (order.fuels && order.fuels.length > 0) {
                    fuelTypeMatch = order.fuels.some(fuel => 
                        fuel.type.toLowerCase() === fuelType.toLowerCase()
                    );
                }
                // Check if the order has a single fuel type
                else if (order.fuelType) {
                    fuelTypeMatch = order.fuelType.toLowerCase() === fuelType.toLowerCase();
                }
                // Check if the order has a product field
                else if (order.product) {
                    fuelTypeMatch = order.product.toLowerCase().includes(fuelType.toLowerCase());
                }
                else {
                    fuelTypeMatch = false;
                }
            }
            
            // Check date range filter
            const dateMatch = (!dateFrom || orderDateStr >= dateFrom) && 
                            (!dateTo || orderDateStr <= dateTo);
            
            console.log('Order:', order.id, {
                fuelTypeMatch,
                dateMatch,
                orderDate: orderDateStr,
                fuelType: order.fuelType,
                fuels: order.fuels,
                product: order.product
            });
            
            return fuelTypeMatch && dateMatch;
        });

        console.log('Filtered orders:', filteredOrders);

        // Reset to first page when filters change
        currentPage = 1;
        totalOrders = filteredOrders.length;
        updatePaginationInfo();
        displayCurrentPage();
        updateSummaryCards();
        updateCharts();
    } catch (error) {
        console.error('Error filtering orders:', error);
    }
}

// Update pagination information
function updatePaginationInfo() {
    try {
        const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(start + ITEMS_PER_PAGE - 1, totalOrders);
        
        const startElement = document.getElementById('currentPageStart');
        const endElement = document.getElementById('currentPageEnd');
        const totalElement = document.getElementById('totalOrders');
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');

        if (!startElement || !endElement || !totalElement || !prevButton || !nextButton) {
            console.error('Pagination elements not found in DOM');
            return;
        }

        startElement.textContent = start;
        endElement.textContent = end;
        totalElement.textContent = totalOrders;
        
        // Update button states
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = end >= totalOrders;
    } catch (error) {
        console.error('Error updating pagination info:', error);
    }
}

// Display current page orders
function displayCurrentPage() {
    try {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageOrders = filteredOrders.slice(startIndex, endIndex);
        
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) {
            console.error('Orders table body not found in DOM');
            return;
        }

        tbody.innerHTML = '';
        
        if (pageOrders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center;">No orders found</td>
                </tr>
            `;
            return;
        }
        
        pageOrders.forEach(order => {
            const row = document.createElement('tr');
            const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
            
            // Format fuel types and quantities
            let fuelInfo = 'N/A';
            if (order.fuels && order.fuels.length > 0) {
                fuelInfo = order.fuels.map(fuel => 
                    `${fuel.type} (${fuel.quantity}L)`
                ).join(', ');
            } else if (order.fuelType) {
                fuelInfo = order.fuelType;
            } else if (order.product) {
                fuelInfo = order.product;
            }
            
            // Get the total amount including service fee if available
            const totalAmount = order.payment?.totalAmount || order.totalPrice || 0;
            
            row.innerHTML = `
                <td style="padding: 1.5rem 1rem;">${order.id}</td>
                <td style="padding: 1.5rem 1rem;">${formatDate(orderDate)}</td>
                <td style="padding: 1.5rem 1rem;">${fuelInfo}</td>
                <td style="padding: 1.5rem 1rem;">MWK ${totalAmount.toLocaleString()}</td>
                <td style="padding: 1.5rem 1rem;">
                    <span class="status-badge ${order.status || 'pending'}">${order.status || 'pending'}</span>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        updatePaginationInfo();
    } catch (error) {
        console.error('Error displaying current page:', error);
    }
}

// Format date helper function
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format currency helper function
function formatCurrency(amount) {
    if (!amount) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Event listeners for pagination buttons
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updatePaginationInfo();
        displayCurrentPage();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const maxPage = Math.ceil(totalOrders / ITEMS_PER_PAGE);
    if (currentPage < maxPage) {
        currentPage++;
        updatePaginationInfo();
        displayCurrentPage();
    }
});

// Export the initialization function
export { initializePagination }; 