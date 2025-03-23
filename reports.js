import { 
    auth, 
    db,
    showNotification 
} from './shared.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Function to get date range based on period
function getDateRange(period) {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'week':
            start.setDate(now.getDate() - 7);
            break;
        case 'month':
            start.setMonth(now.getMonth() - 1);
            break;
        case 'year':
            start.setFullYear(now.getFullYear() - 1);
            break;
        case 'custom':
            // Handle custom date range from form inputs
            const dateFrom = document.getElementById('dateFrom').value;
            const dateTo = document.getElementById('dateTo').value;
            if (dateFrom && dateTo) {
                return {
                    start: new Date(dateFrom),
                    end: new Date(dateTo)
                };
            }
            break;
    }
    
    return { start, end: now };
}

// Function to format currency
function formatCurrency(amount) {
    return `MWK ${amount.toLocaleString()}`;
}

// Function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Function to get orders for report
async function getOrdersForReport(userId, period) {
    try {
        const { start, end } = getDateRange(period);
        const ordersRef = collection(db, "orders");
        
        try {
            // Try the optimal query first (requires index)
            const q = query(
                ordersRef,
                where("userId", "==", userId),
                where("createdAt", ">=", Timestamp.fromDate(start)),
                where("createdAt", "<=", Timestamp.fromDate(end)),
                orderBy("createdAt", "desc")
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
                // Fallback: Get all user's orders and filter in memory
                console.log("Index not found, falling back to client-side filtering");
                const fallbackQuery = query(ordersRef, where("userId", "==", userId));
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                // Convert to array and filter in memory
                const orders = [];
                fallbackSnapshot.forEach(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toDate() || new Date(data.createdAt);
                    
                    if (createdAt >= start && createdAt <= end) {
                        orders.push({
                            id: doc.id,
                            ...data
                        });
                    }
                });
                
                // Sort by createdAt in descending order
                return orders.sort((a, b) => {
                    const dateA = a.createdAt?.toDate() || new Date(a.createdAt);
                    const dateB = b.createdAt?.toDate() || new Date(b.createdAt);
                    return dateB - dateA;
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
        throw error;
    }
}

// Function to generate PDF report
async function generatePDFReport(orders, reportType, reportTitle) {
    // Create report content based on type
    let content = `
        <div class="report-container">
            <div class="report-header">
                <img src="assets/img/images.png" alt="NOCMA Logo" style="width: 100px;">
                <h1>${reportTitle || 'NOCMA Report'}</h1>
                <p>Generated on: ${formatDate(new Date())}</p>
            </div>
    `;

    switch (reportType) {
        case 'summary':
            content += generateSummaryReport(orders);
            break;
        case 'detailed':
            content += generateDetailedReport(orders);
            break;
        case 'financial':
            content += generateFinancialReport(orders);
            break;
    }

    content += `
        <div class="report-footer">
            <p>This is an automatically generated report by NOCMA Fuel Management System</p>
        </div>
    </div>`;

    // Add styles for PDF
    const style = `
        <style>
            .report-container { font-family: Arial, sans-serif; padding: 20px; }
            .report-header { text-align: center; margin-bottom: 30px; }
            .report-header h1 { color: #2563eb; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            th { background-color: #f8fafc; }
            .summary-card { background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 8px; }
            .report-footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; }
        </style>
    `;

    // Configure PDF options
    const opt = {
        margin: 1,
        filename: `NOCMA-${reportType}-Report-${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Create temporary container
    const container = document.createElement('div');
    container.innerHTML = style + content;
    document.body.appendChild(container);

    try {
        // Generate PDF
        await html2pdf().set(opt).from(container).save();
        document.body.removeChild(container);
        return true;
    } catch (error) {
        document.body.removeChild(container);
        throw error;
    }
}

// Function to generate Excel report
function generateExcelReport(orders, reportType) {
    let data = [];
    const workbook = XLSX.utils.book_new();
    
    switch (reportType) {
        case 'summary':
            data = generateSummaryExcelData(orders);
            break;
        case 'detailed':
            data = generateDetailedExcelData(orders);
            break;
        case 'financial':
            data = generateFinancialExcelData(orders);
            break;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType.charAt(0).toUpperCase() + reportType.slice(1));
    
    // Generate Excel file
    XLSX.writeFile(workbook, `NOCMA-${reportType}-Report-${new Date().getTime()}.xlsx`);
}

// Function to generate CSV report
function generateCSVReport(orders, reportType) {
    let data = [];
    
    switch (reportType) {
        case 'summary':
            data = generateSummaryExcelData(orders);
            break;
        case 'detailed':
            data = generateDetailedExcelData(orders);
            break;
        case 'financial':
            data = generateFinancialExcelData(orders);
            break;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    // Create and download CSV file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `NOCMA-${reportType}-Report-${new Date().getTime()}.csv`;
    link.click();
}

// Helper function to generate summary report content
function generateSummaryReport(orders) {
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;

    return `
        <div class="summary-section">
            <div class="summary-card">
                <h3>Order Statistics</h3>
                <p>Total Orders: ${totalOrders}</p>
                <p>Completed Orders: ${completedOrders}</p>
                <p>Pending Orders: ${pendingOrders}</p>
                <p>Total Revenue: ${formatCurrency(totalAmount)}</p>
            </div>
            
            <div class="summary-table">
                <h3>Order Summary</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Count</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Completed</td>
                            <td>${completedOrders}</td>
                            <td>${((completedOrders/totalOrders) * 100).toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Pending</td>
                            <td>${pendingOrders}</td>
                            <td>${((pendingOrders/totalOrders) * 100).toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Helper function to generate detailed report content
function generateDetailedReport(orders) {
    return `
        <div class="detailed-section">
            <table>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Fuel Type</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => {
                        let orderDate;
                        if (order.createdAt?.toDate) {
                            orderDate = order.createdAt.toDate();
                        } else if (order.createdAt instanceof Date) {
                            orderDate = order.createdAt;
                        } else if (typeof order.createdAt === 'number') {
                            orderDate = new Date(order.createdAt);
                        } else {
                            orderDate = new Date();
                        }

                        const fuels = Array.isArray(order.fuels) ? order.fuels : [];
                        const fuelTypes = fuels.map(f => f.type || 'Unknown').join(', ') || 'N/A';
                        const totalQuantity = fuels.reduce((sum, f) => sum + (Number(f.quantity) || 0), 0);

                        return `
                            <tr>
                                <td>${order.id || 'N/A'}</td>
                                <td>${formatDate(orderDate)}</td>
                                <td>${fuelTypes}</td>
                                <td>${totalQuantity} L</td>
                                <td>${formatCurrency(order.totalPrice || 0)}</td>
                                <td>${order.status || 'N/A'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper function to generate financial report content
function generateFinancialReport(orders) {
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const serviceFees = orders.reduce((sum, order) => sum + ((order.totalPrice || 0) * 0.02), 0);

    return `
        <div class="financial-section">
            <div class="summary-card">
                <h3>Financial Summary</h3>
                <p>Total Revenue: ${formatCurrency(totalRevenue)}</p>
                <p>Service Fees: ${formatCurrency(serviceFees)}</p>
                <p>Net Revenue: ${formatCurrency(totalRevenue - serviceFees)}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Service Fee</th>
                        <th>Total</th>
                        <th>Payment Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => {
                        const serviceFee = (order.totalPrice || 0) * 0.02;
                        let orderDate;
                        if (order.createdAt?.toDate) {
                            orderDate = order.createdAt.toDate();
                        } else if (order.createdAt instanceof Date) {
                            orderDate = order.createdAt;
                        } else if (typeof order.createdAt === 'number') {
                            orderDate = new Date(order.createdAt);
                        } else {
                            orderDate = new Date();
                        }
                        return `
                            <tr>
                                <td>${order.id || 'N/A'}</td>
                                <td>${formatDate(orderDate)}</td>
                                <td>${formatCurrency(order.totalPrice || 0)}</td>
                                <td>${formatCurrency(serviceFee)}</td>
                                <td>${formatCurrency((order.totalPrice || 0) + serviceFee)}</td>
                                <td>${order.status || 'N/A'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper functions for Excel/CSV data generation
function generateSummaryExcelData(orders) {
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const completedOrders = orders.filter(order => order.status === 'completed').length;
    const pendingOrders = orders.filter(order => order.status === 'pending').length;

    return [
        {
            'Metric': 'Total Orders',
            'Value': totalOrders
        },
        {
            'Metric': 'Completed Orders',
            'Value': completedOrders
        },
        {
            'Metric': 'Pending Orders',
            'Value': pendingOrders
        },
        {
            'Metric': 'Total Revenue',
            'Value': formatCurrency(totalAmount)
        }
    ];
}

function generateDetailedExcelData(orders) {
    return orders.map(order => {
        // Handle createdAt that might be a Timestamp, Date object, or timestamp number
        let orderDate;
        if (order.createdAt?.toDate) {
            // Firebase Timestamp
            orderDate = order.createdAt.toDate();
        } else if (order.createdAt instanceof Date) {
            // JavaScript Date object
            orderDate = order.createdAt;
        } else if (typeof order.createdAt === 'number') {
            // Unix timestamp
            orderDate = new Date(order.createdAt);
        } else {
            // Fallback to current date if no valid date found
            orderDate = new Date();
        }

        // Handle fuels array that might be undefined or malformed
        const fuels = Array.isArray(order.fuels) ? order.fuels : [];
        const fuelTypes = fuels.map(f => f.type || 'Unknown').join(', ') || 'N/A';
        const totalQuantity = fuels.reduce((sum, f) => sum + (Number(f.quantity) || 0), 0);

        return {
            'Order ID': order.id || 'N/A',
            'Date': formatDate(orderDate),
            'Fuel Types': fuelTypes,
            'Total Quantity (L)': totalQuantity,
            'Amount': formatCurrency(order.totalPrice || 0),
            'Status': order.status || 'N/A'
        };
    });
}

function generateFinancialExcelData(orders) {
    return orders.map(order => {
        const serviceFee = (order.totalPrice || 0) * 0.02;
        return {
            'Order ID': order.id,
            'Date': formatDate(order.createdAt.toDate()),
            'Amount': formatCurrency(order.totalPrice),
            'Service Fee': formatCurrency(serviceFee),
            'Total': formatCurrency(order.totalPrice + serviceFee),
            'Status': order.status
        };
    });
}

// Main report generation function
export async function generateReport(reportType, reportFormat, reportPeriod, reportTitle, includeCharts, includeTables) {
    try {
        showNotification("Generating report...", "info");
        
        const user = auth.currentUser;
        if (!user) {
            showNotification("Please log in to generate reports", "error");
            return;
        }

        // Get orders for the report
        const orders = await getOrdersForReport(user.uid, reportPeriod);
        
        if (!orders || orders.length === 0) {
            showNotification("No orders found for the selected period", "warning");
            return;
        }

        // Generate report based on format
        try {
            switch (reportFormat.toLowerCase()) {
                case 'pdf':
                    await generatePDFReport(orders, reportType, reportTitle);
                    break;
                case 'excel':
                    generateExcelReport(orders, reportType);
                    break;
                case 'csv':
                    generateCSVReport(orders, reportType);
                    break;
                default:
                    throw new Error(`Unsupported report format: ${reportFormat}`);
            }
            
            showNotification("Report generated successfully!", "success");
        } catch (error) {
            console.error("Error generating report:", error);
            showNotification(`Failed to generate ${reportFormat.toUpperCase()} report. Please try again.`, "error");
            throw error;
        }
    } catch (error) {
        console.error("Error in report generation:", error);
        if (error.message.includes('requires an index')) {
            showNotification("System is optimizing the report generation. Please try again in a few moments.", "warning");
        } else {
            showNotification("Failed to generate report. Please try again later.", "error");
        }
        throw error;
    }
} 