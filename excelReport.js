// Excel Report Generation Functions

// Helper function to format currency
function formatCurrency(amount) {
    return `MWK ${amount.toLocaleString()}`;
}

// Helper function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Generate Excel report with proper formatting
function generateExcelReport(orders, type) {
    let report = [];
    
    // Add UTF-8 BOM for proper Excel encoding
    report.push("\uFEFF");
    
    // Add report header
    report.push("NOCMA " + type.toUpperCase() + " REPORT");
    report.push("Generated on: " + new Date().toLocaleString());
    report.push(""); // Empty line for spacing
    
    // Add Excel formatting instructions
    report.push("EXCEL_FORMATTING");
    report.push("Sheet Name," + type);
    report.push("Title Cell,A1");
    report.push("Title Font Size,18");
    report.push("Title Font,Bold");
    report.push("Title Color,#1e40af");
    report.push("Header Background,#f8fafc");
    report.push("Header Font,Bold");
    report.push("Header Color,#1e293b");
    report.push("Data Font Size,11");
    report.push("Data Color,#334155");
    report.push(""); // Empty line for spacing

    // Add data based on report type
    switch(type) {
        case 'summary':
            report.push(...generateSummaryData(orders));
            break;
        case 'detailed':
            report.push(...generateDetailedData(orders));
            break;
        case 'financial':
            report.push(...generateFinancialData(orders));
            break;
        case 'delivery':
            report.push(...generateDeliveryData(orders));
            break;
    }

    return report.join('\n');
}

// Generate summary report data
function generateSummaryData(orders) {
    let data = [];
    
    // Executive Summary
    data.push("EXECUTIVE SUMMARY");
    data.push("Metric,Value,Format,Color");
    data.push("Period," + formatDate(orders[0]?.timestamp || new Date()) + " to " + formatDate(orders[orders.length - 1]?.timestamp || new Date()) + ",Date,#1e293b");
    data.push("Total Orders," + orders.length + ",Number,#3b82f6");
    data.push("Total Volume (L)," + orders.reduce((sum, order) => sum + order.totalQuantity, 0) + ",Number,#10b981");
    data.push("Total Revenue (MWK)," + orders.reduce((sum, order) => sum + order.totalPrice, 0) + ",Currency,#f59e0b");
    data.push("Average Order Value (MWK)," + (orders.reduce((sum, order) => sum + order.totalPrice, 0) / orders.length).toFixed(2) + ",Currency,#8b5cf6");
    data.push("Service Fee Revenue (MWK)," + orders.reduce((sum, order) => sum + order.payment.serviceFee, 0) + ",Currency,#ef4444");
    data.push("");

    // Performance Metrics
    data.push("PERFORMANCE METRICS");
    data.push("Metric,Value,Target,Performance,Format,Color");
    const totalOrders = orders.length;
    const completedOrders = orders.filter(order => order.status === 'Completed').length;
    const completionRate = ((completedOrders / totalOrders) * 100).toFixed(2);
    data.push(`Order Completion Rate,${completionRate}%,95%,${completionRate >= 95 ? 'Above Target' : 'Below Target'},Percentage,#10b981`);
    
    const avgDeliveryTime = orders.reduce((sum, order) => {
        const deliveryTime = new Date(order.deliveryDate) - new Date(order.timestamp);
        return sum + deliveryTime;
    }, 0) / orders.length;
    const avgDeliveryDays = (avgDeliveryTime / (1000 * 60 * 60 * 24)).toFixed(1);
    data.push(`Average Delivery Time,${avgDeliveryDays} days,2 days,${avgDeliveryDays <= 2 ? 'On Target' : 'Above Target'},Number,#3b82f6`);
    data.push("");

    // Add conditional formatting
    data.push("CONDITIONAL_FORMATTING");
    data.push("Range,Type,Color,Value");
    data.push("B2:B6,Color Scale,#10b981,#f59e0b");
    data.push("C2:C6,Data Bars,#3b82f6");
    data.push("D2:D6,Icon Set,3 Arrows");
    data.push("B8:B10,Color Scale,#10b981,#f59e0b");
    data.push("C8:C10,Data Bars,#3b82f6");
    data.push("D8:D10,Icon Set,3 Arrows");

    return data;
}

// Generate detailed report data
function generateDetailedData(orders) {
    let data = [];
    
    data.push("ORDER DETAILS");
    data.push("Order ID,Date,Fuel Type,Quantity (L),Price per L (MWK),Subtotal (MWK),Status,Delivery Location,Delivery Date,Processing Time (days),Chart Color,Format");

    orders.forEach(order => {
        order.fuels.forEach(fuel => {
            const processingTime = ((new Date(order.deliveryDate) - new Date(order.timestamp)) / (1000 * 60 * 60 * 24)).toFixed(1);
            const color = order.status === 'Completed' ? '#10b981' : 
                         order.status === 'Pending' ? '#f59e0b' : 
                         order.status === 'Processing' ? '#3b82f6' : '#ef4444';
            data.push(`${order.id},${formatDate(order.timestamp)},${fuel.type},${fuel.quantity},${fuel.price},${fuel.subtotal},${order.status},${order.deliveryLocation.name},${formatDate(order.deliveryDate)},${processingTime},${color},Number`);
        });
        data.push(""); // Empty line between orders
    });

    // Add conditional formatting for detailed report
    data.push("CONDITIONAL_FORMATTING");
    data.push("Range,Type,Color,Value");
    data.push("D2:D100,Color Scale,#10b981,#f59e0b"); // Quantity column
    data.push("E2:E100,Data Bars,#3b82f6"); // Price column
    data.push("F2:F100,Icon Set,3 Arrows"); // Subtotal column
    data.push("J2:J100,Color Scale,#10b981,#f59e0b"); // Processing Time column
    data.push("G2:G100,Color Scale,#10b981,#ef4444"); // Status column

    return data;
}

// Generate financial report data
function generateFinancialData(orders) {
    let data = [];
    
    data.push("FINANCIAL DETAILS");
    data.push("Order ID,Date,Total Amount (MWK),Service Fee (MWK),Final Amount (MWK),Payment Method,Payment Status,Transaction ID,Profit Margin %,Chart Color,Format");

    orders.forEach(order => {
        const profitMargin = ((order.payment.serviceFee / order.totalPrice) * 100).toFixed(2);
        const color = order.payment.status === 'Completed' ? '#10b981' : 
                     order.payment.status === 'Pending' ? '#f59e0b' : 
                     order.payment.status === 'Processing' ? '#3b82f6' : '#ef4444';
        data.push(`${order.id},${formatDate(order.timestamp)},${order.totalPrice},${order.payment.serviceFee},${order.payment.totalAmount},${order.payment.method},${order.payment.status},${order.payment.transactionId},${profitMargin},${color},Currency`);
    });

    // Add conditional formatting for financial report
    data.push("CONDITIONAL_FORMATTING");
    data.push("Range,Type,Color,Value");
    data.push("C2:C100,Color Scale,#10b981,#f59e0b"); // Total Amount column
    data.push("D2:D100,Data Bars,#3b82f6"); // Service Fee column
    data.push("E2:E100,Icon Set,3 Arrows"); // Final Amount column
    data.push("I2:I100,Color Scale,#10b981,#f59e0b"); // Profit Margin column
    data.push("F2:F100,Color Scale,#10b981,#ef4444"); // Payment Status column

    return data;
}

// Generate delivery report data
function generateDeliveryData(orders) {
    let data = [];
    
    data.push("DELIVERY DETAILS");
    data.push("Order ID,Order Date,Delivery Location,Delivery Date,Status,Processing Time (days),On Time,Contact Person,Contact Phone,Chart Color,Format");

    orders.forEach(order => {
        const processingTime = ((new Date(order.deliveryDate) - new Date(order.timestamp)) / (1000 * 60 * 60 * 24)).toFixed(1);
        const isOnTime = processingTime <= 2;
        const color = order.status === 'Completed' ? '#10b981' : 
                     order.status === 'Pending' ? '#f59e0b' : 
                     order.status === 'Processing' ? '#3b82f6' : '#ef4444';
        data.push(`${order.id},${formatDate(order.timestamp)},${order.deliveryLocation.name},${formatDate(order.deliveryDate)},${order.status},${processingTime},${isOnTime ? 'Yes' : 'No'},${order.deliveryLocation.contactPerson || 'N/A'},${order.deliveryLocation.contactPhone || 'N/A'},${color},Text`);
    });

    // Add conditional formatting for delivery report
    data.push("CONDITIONAL_FORMATTING");
    data.push("Range,Type,Color,Value");
    data.push("F2:F100,Color Scale,#10b981,#f59e0b"); // Processing Time column
    data.push("G2:G100,Icon Set,3 Arrows"); // On Time column
    data.push("E2:E100,Color Scale,#10b981,#ef4444"); // Status column
    data.push("B2:B100,Data Bars,#3b82f6"); // Order Date column

    return data;
}

// Export functions
export {
    generateExcelReport,
    formatCurrency,
    formatDate
}; 