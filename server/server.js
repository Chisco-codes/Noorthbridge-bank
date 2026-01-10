const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(express.json());

// Very permissive CORS (safe for Render live deployment)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Nodemailer transporter (back to your original Gmail setup for tonight)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// MongoDB Connection with retry (FIXED: Removed deprecated options for Mongoose v8+)
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
};
connectDB();

// User Schema
const userSchema = new mongoose.Schema({
  role: { type: String, default: 'user' },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountNumber: { type: String, unique: true },
  accountType: { type: String, default: 'Chequing' },
  balance: { type: Number, default: 0 },
  profileImage: String,
  authCode: String,
  authCodeExpires: Date,
  lastTransferIP: String,
  transactions: [{
    type: { type: String },
    amount: Number,
    date: { type: Date, default: Date.now },
    description: String
  }]
});

const User = mongoose.model('User', userSchema);

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

// ======================== ROUTES ========================

// Admin: List all users
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin: Add funds to any user
app.post('/api/admin/add-funds', auth, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (admin.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });

    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ msg: 'userId and amount required' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ msg: 'User not found' });

    targetUser.balance += parseFloat(amount);
    targetUser.transactions.push({
      type: 'Admin Credit',
      amount: parseFloat(amount),
      description: `Admin added $${amount}`
    });
    await targetUser.save();

    res.json({ msg: `Added $${amount} to ${targetUser.name}'s account` });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Transfer money (with description)
app.post('/api/transaction/transfer', [auth, body('toAccount').notEmpty(), body('amount').isNumeric()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { toAccount, amount } = req.body;
  try {
    const sender = await User.findById(req.user.id);
    const receiver = await User.findOne({ accountNumber: toAccount });
    if (!receiver) return res.status(400).json({ msg: 'Recipient not found' });
    if (sender.balance < amount) return res.status(400).json({ msg: 'Insufficient funds' });
    const clientIP = req.ip || req.connection.remoteAddress;
    if (sender.lastTransferIP && sender.lastTransferIP !== clientIP) {
      const authCode = Math.floor(100000 + Math.random() * 900000).toString();
      sender.authCode = authCode;
      sender.authCodeExpires = Date.now() + 10 * 60 * 1000;
      await sender.save();
      try {
        await transporter.sendMail({
          from: `"Northbridge Insurance Bank" <${process.env.SMTP_FROM}>`,
          to: 'jeffreyrobert462917@gmail.com',  // ← FIXED: added quotes
          subject: 'Transfer Auth Code Required - Northbridge Insurance Bank',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Transfer Auth Code</title>
              <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
                .header { background: #0d47a1; padding: 50px 40px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 36px; font-weight: 300; letter-spacing: 1px; }
                .content { padding: 50px 40px; text-align: center; background: #1a1a1a; color: #e0e0e0; }
                .code-box { background: #2d2d2d; border-radius: 16px; padding: 40px; margin: 40px auto; max-width: 320px; font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #bbdefb; }
                .footer { background: #0d0d0d; padding: 30px; text-align: center; font-size: 13px; color: #888888; }
                @media (prefers-color-scheme: light) {
                  .content, .footer { background: #ffffff !important; color: #333333 !important; }
                  .code-box { background: #f0f0f0 !important; color: #0d47a1 !important; }
                  .footer { color: #666666 !important; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Northbridge Insurance Bank</h1>
                </div>
                <div class="content">
                  <h2 style="color: #bbdefb;">Transfer Auth Code Required</h2>
                  <p>We detected a transfer attempt from a new location.</p>
                  <p>Please use this code to confirm:</p>
                  <div class="code-box">${authCode}</div>
                  <p>This code expires in 10 minutes.</p>
                  <p>If this wasn't you, contact support immediately.</p>
                </div>
                <div class="footer">
                  <p>© 2026 Northbridge Insurance Bank. All rights reserved.</p>
                  <p>support@northbridgebank.com | 1-800-NORTHBRIDGE</p>
                </div>
              </div>
            </body>
            </html>
          `
        });
      } catch (emailErr) {
        console.log('Email send failed:', emailErr.message);
      }
      return res.status(400).json({ msg: 'New location detected. Auth code sent to your email. Contact support at support@northbridgebank.com.' });
    }
    sender.balance -= parseFloat(amount);
    receiver.balance += parseFloat(amount);
    sender.lastTransferIP = clientIP;
    sender.transactions.push({
      type: 'Transfer Out',
      amount: parseFloat(amount),
      description: `Transferred $${amount} to ${toAccount}`
    });
    receiver.transactions.push({
      type: 'Transfer In',
      amount: parseFloat(amount),
      description: `Received $${amount} from ${sender.accountNumber}`
    });
    await sender.save();
    await receiver.save();
    res.json({ msg: 'Transfer successful', balance: sender.balance });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Register User
app.post('/api/auth/register', [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const accountNumber = 'CA' + Math.random().toString().slice(2, 12);
    user = new User({ name, email, password: hashedPassword, accountNumber });
    await user.save();

    // Send Welcome Email - Modern & Polished Template
    try {
      await transporter.sendMail({
        from: `"Northbridge Insurance Bank" <${process.env.SMTP_FROM}>`,
        to: 'jeffreyrobert462917@gmail.com',  // ← FIXED: added quotes
        subject: 'Welcome to Northbridge Insurance Bank – Your Account is Ready',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Welcome to Northbridge Insurance Bank</title>
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 20px auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
              .header { background: #0d47a1; padding: 50px 40px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 36px; font-weight: 300; letter-spacing: 1px; }
              .content { padding: 50px 40px; text-align: center; background: #1a1a1a; color: #e0e0e0; }
              .greeting { font-size: 28px; margin-bottom: 20px; color: white; }
              .account-box { background: #2d2d2d; border-radius: 16px; padding: 35px; margin: 40px auto; max-width: 480px; }
              .account-box p { margin: 16px 0; font-size: 18px; }
              .btn { display: inline-block; background: #bbdefb; color: #0d47a1; padding: 18px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; margin: 30px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
              .security-note { font-size: 15px; color: #aaaaaa; margin-top: 50px; line-height: 1.6; }
              .footer { background: #0d0d0d; padding: 30px; text-align: center; font-size: 13px; color: #888888; }
              @media (prefers-color-scheme: light) {
                .content, .footer { background: #ffffff !important; color: #333333 !important; }
                .account-box { background: #f5f5f5 !important; }
                .security-note, .footer p { color: #666666 !important; }
                .greeting { color: #0d47a1 !important; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Northbridge Insurance Bank</h1>
              </div>
              <div class="content">
                <div class="greeting">Welcome, ${name}!</div>
                <p>Thank you for choosing <strong>Northbridge Insurance Bank</strong>.</p>
                <p>Your new chequing account has been successfully created and is ready to use.</p>

                <div class="account-box">
                  <p><strong>Account Holder:</strong> ${name}</p>
                  <p><strong>Account Number:</strong> ${accountNumber}</p>
                  <p><strong>Account Type:</strong> Chequing</p>
                  <p><strong>Current Balance:</strong> $0.00 CAD</p>
                </div>

                <p>Log in now to explore your secure online banking dashboard, set up transfers, and more.</p>
                <a href="http://localhost:5500/dashboard.html" class="btn">Log In to Online Banking</a>

                <p class="security-note">
                  For your security, never share your password or account details.<br>
                  If you didn't create this account, please contact us immediately.
                </p>
              </div>
              <div class="footer">
                <p>© 2026 Northbridge Insurance Bank. All rights reserved.</p>
                <p>456 Bridge Street, Toronto, ON M5V 2B3 | support@northbridgebank.com | 1-800-NORTHBRIDGE</p>
                <p>This is an automated message. Please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      console.log('Welcome email sent to:', email);
    } catch (emailErr) {
      console.log('Email send failed:', emailErr.message);
    }

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login (with temporary debug code display)
app.post('/api/auth/login', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  console.log('Login attempt:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    console.log('Finding user...');
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    console.log('Comparing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.authCode = authCode;
    user.authCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    try {
      await transporter.sendMail({
        from: `"Northbridge Insurance Bank" <${process.env.SMTP_FROM}>`,
        to: 'jeffreyrobert462917@gmail.com',  // ← FIXED: added quotes
        subject: 'Your Login Auth Code - Northbridge Insurance Bank',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Your Auth Code</title>
            <style>
              body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 20px auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
              .header { background: #0d47a1; padding: 50px 40px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 36px; font-weight: 300; letter-spacing: 1px; }
              .content { padding: 50px 40px; text-align: center; background: #1a1a1a; color: #e0e0e0; }
              .code-box { background: #2d2d2d; border-radius: 16px; padding: 40px; margin: 40px auto; max-width: 320px; font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #bbdefb; }
              .footer { background: #0d0d0d; padding: 30px; text-align: center; font-size: 13px; color: #888888; }
              @media (prefers-color-scheme: light) {
                .content, .footer { background: #ffffff !important; color: #333333 !important; }
                .code-box { background: #f0f0f0 !important; color: #0d47a1 !important; }
                .footer { color: #666666 !important; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Northbridge Insurance Bank</h1>
              </div>
              <div class="content">
                <h2 style="color: #bbdefb;">Your Auth Code</h2>
                <p>Please use this code to complete your login:</p>
                <div class="code-box">${authCode}</div>
                <p>This code expires in 10 minutes.</p>
                <p>If you didn't request this, contact support immediately.</p>
              </div>
              <div class="footer">
                <p>© 2026 Northbridge Insurance Bank. All rights reserved.</p>
                <p>support@northbridgebank.com | 1-800-NORTHBRIDGE</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
      console.log('Auth code sent to:', email);
    } catch (emailErr) {
      console.log('Email send failed:', emailErr.message);
    }

    // TEMPORARY DEBUG: Show the code directly on screen tonight
    res.json({ 
      msg: 'Auth code sent to your email (check spam/promotions too). For testing tonight, the code is: ' + authCode,
      debugCode: authCode  // temporary - remove tomorrow after domain setup
    });
  } catch (err) {
    console.log('Login error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Verify Auth Code
app.post('/api/auth/verify-code', [
  body('email').isEmail(),
  body('authCode').isLength({ min: 6, max: 6 })
], async (req, res) => {
  const { email, authCode } = req.body;
  try {
    const user = await User.findOne({ email, authCode, authCodeExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ msg: 'Invalid or expired code' });

    user.authCode = undefined;
    user.authCodeExpires = undefined;
    await user.save();

    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get User Profile
app.get('/api/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Deposit - ADMIN ONLY
app.post('/api/transaction/deposit', [auth, body('amount').isNumeric()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { amount, description, userId } = req.body;

  try {
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied: Admins only' });
    }

    const targetUserId = userId || req.user.id;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ msg: 'Target user not found' });

    targetUser.balance += parseFloat(amount);
    targetUser.transactions.push({
      type: 'Deposit (Admin)',
      amount: parseFloat(amount),
      description: description || `Admin deposited $${amount}`
    });
    await targetUser.save();

    res.json({ 
      msg: `Deposited $${amount} to ${targetUser.name}'s account`, 
      balance: targetUser.balance 
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Withdraw
app.post('/api/transaction/withdraw', [auth, body('amount').isNumeric()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { amount } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (user.balance < amount) return res.status(400).json({ msg: 'Insufficient funds' });

    user.balance -= parseFloat(amount);
    user.transactions.push({
      type: 'Withdrawal',
      amount: parseFloat(amount),
      description: `Withdrew $${amount}`
    });
    await user.save();
    res.json({ msg: 'Withdrawal successful', balance: user.balance });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Change Password
app.post('/api/user/change-password', [auth, body('oldPassword').exists(), body('newPassword').isLength({ min: 6 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ msg: 'Invalid input' });

  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Old password incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Profile Image Upload
const upload = multer({ dest: 'uploads/' });

app.post('/api/user/upload-image', [auth, upload.single('image')], async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.profileImage = req.file.path;
    await user.save();
    res.json({ msg: 'Image uploaded', image: req.file.path });
  } catch (err) {
    res.status(500).json({ msg: 'Upload failed' });
  }
});

app.use('/uploads', express.static('uploads'));

// Global error handler for uncaught errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: 'Server error - please try again' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));