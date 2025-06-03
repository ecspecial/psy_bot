const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.sqlite');

// Create DB if not exists and open it
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('❌ Failed to open DB:', err.message);
  console.log('✅ Connected to SQLite database.');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_id TEXT,
    is_active BOOLEAN DEFAULT 1,
    ftd BOOLEAN DEFAULT 1
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL,
    invoice_id TEXT,
    subscription_id TEXT,
    amount DECIMAL(10, 2),
    currency TEXT,
    status TEXT,
    operation_type TEXT,
    token TEXT,
    is_test BOOLEAN,
    date_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
});

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Webhook: payment success
app.post('/api/payment/success', (req, res) => {
  const data = req.body;
  console.log('✅ Payment Success Webhook Received:\n', JSON.stringify(data, null, 2));

  const {
    TransactionId,
    Amount,
    Currency,
    OperationType,
    InvoiceId,
    AccountId,
    SubscriptionId,
    Token,
    Status,
    TestMode,
    DateTime
  } = data;

  // 1. Insert user if not exists
  db.run(
    `INSERT OR IGNORE INTO users (account_id) VALUES (?)`,
    [AccountId],
    function (err) {
      if (err) return console.error('❌ User insert error:', err.message);

      // 2. Insert payment
      db.run(
        `INSERT OR IGNORE INTO payments (
          transaction_id, account_id, invoice_id, subscription_id,
          amount, currency, status, operation_type, token,
          is_test, date_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          TransactionId,
          AccountId,
          InvoiceId,
          SubscriptionId,
          parseFloat(Amount),
          Currency,
          Status,
          OperationType,
          Token,
          TestMode === "1",
          DateTime
        ],
        function (err) {
          if (err) return console.error('❌ Payment insert error:', err.message);

          // 3. Update user info
          db.run(
            `UPDATE users SET
              subscription_id = ?,
              updated_at = CURRENT_TIMESTAMP,
              is_active = 1,
              ftd = 0
             WHERE account_id = ?`,
            [SubscriptionId, AccountId],
            function (err) {
              if (err) console.error('❌ User update error:', err.message);
            }
          );
        }
      );
    }
  );

  res.status(200).json({ code: 0, message: 'Received successfully' });
});

// Webhook: payment fail
app.post('/api/payment/fail', (req, res) => {
  console.log('❌ Payment Failed Webhook:\n', JSON.stringify(req.body, null, 2));
  res.status(200).json({ code: 0, message: 'Failure logged' });
});

// Start backend
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});