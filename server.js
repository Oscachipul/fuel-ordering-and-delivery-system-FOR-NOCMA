require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', '*'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Serve static files
app.use(express.static(__dirname));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!' 
    });
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'nocma29@gmail.com',
        pass: 'mlum olon ffhs nljb'
    }
});

// Test email connection
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Email server error:", error);
    } else {
        console.log("✅ Email server is ready");
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Send OTP API
app.post("/send-otp", async (req, res) => {
    const { email, otp } = req.body;

    // Quick validation first
    if (!email || !otp) {
        return res.status(400).json({ 
            success: false,
            message: "Email and OTP are required" 
        });
    }

    // Basic email validation
    if (!email.includes('@')) {
        return res.status(400).json({
            success: false,
            message: "Invalid email format"
        });
    }

    // Send immediate response
    res.status(200).json({ 
        success: true, 
        message: "OTP sending initiated" 
    });

    // Then send email asynchronously
    try {
        const mailOptions = {
            from: '"NOCMA Support" <nocma29@gmail.com>',
            to: email,
            subject: "Your NOCMA Login OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50; text-align: center;">NOCMA Login Verification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <h3 style="margin: 0 0 10px 0;">Your OTP Code:</h3>
                        <h1 style="color: #2c3e50; font-size: 36px; margin: 0;">${otp}</h1>
                    </div>
                    <p style="color: #666;">This code will expire in 5 minutes.</p>
                    <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        © ${new Date().getFullYear()} National Oil Company of Malawi Ltd
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent to ${email}`);
    } catch (error) {
        console.error("❌ Email error:", error);
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve user dashboard
app.get('/user_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'user_dashboard.html'));
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
    });
});

// Start Server
const PORT = 5500; // Explicitly set to 5500

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Static files being served from: ${__dirname}`);
    console.log(`🌐 Server URLs:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://127.0.0.1:${PORT}`);
});
