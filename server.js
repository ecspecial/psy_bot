const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require("crypto");
const axios = require("axios");
require('dotenv').config();


const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'db.sqlite');

// Create DB if not exists and open it
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('❌ Failed to open DB:', err.message);
  console.log('✅ Connected to SQLite database.');
});

function generateInvoiceId() {
  return crypto.randomBytes(12).toString("hex"); // 24-character hex string
}

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    subscription_id TEXT,
    is_active BOOLEAN DEFAULT 0,
    ftd BOOLEAN DEFAULT 1,
    subscription_end_date DATETIME
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

app.post("/api/payment/stars-success", (req, res) => {
  const { account_id, amount, tx_id, payload } = req.body;

  if (!account_id || !tx_id) {               // minimal sanity check
    return res.status(400).json({ error: "Missing account_id or tx_id" });
  }

  // ①  Save payment — ignore if it is already there (idempotent)
  db.run(
    `INSERT OR IGNORE INTO payments
       (transaction_id, account_id, invoice_id, subscription_id,
        amount, currency, status, operation_type, token, is_test, date_time)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, '', 0, datetime('now'))`,
    [
      tx_id,                               // transaction_id   (primary key)
      account_id,
      payload || null,                     // invoice_id   (optional: original pay-load)
      tx_id,                               // subscription_id (same as tx_id)
      parseFloat(amount),
      'XTR',                               // currency
      'complete',                          // status
      'tg_stars'                           // operation_type
    ],
    (err) => {
      if (err) {
        console.error("❌ Stars payment insert error:", err.message);
        return res.status(500).json({ error: "DB insert error" });
      }

      // ②  Activate / extend the subscription
      db.run(
        `UPDATE users SET
             is_active            = 1,
             ftd                  = 0,
             subscription_id      = NULL,
             subscription_end_date= COALESCE(
                                       CASE
                                         WHEN subscription_end_date IS NULL
                                           THEN datetime('now', '+7 days')
                                         WHEN datetime(subscription_end_date) < datetime('now')
                                           THEN datetime('now', '+7 days')
                                         ELSE datetime(subscription_end_date, '+7 days')
                                       END,
                                       datetime('now', '+7 days')
                                     ),
             updated_at           = CURRENT_TIMESTAMP
           WHERE account_id = ?`,
        [ account_id ],
        (err2) => {
          if (err2) {
            console.error("❌ Stars user-update error:", err2.message);
            return res.status(500).json({ error: "DB update error" });
          }
          return res.json({ success: true });
        });
    });
});

app.post("/api/subscription/check", async (req, res) => {
  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: "Missing account_id" });
  }

  db.get(`SELECT subscription_id, is_active, subscription_end_date FROM users WHERE account_id = ?`, [account_id], async (err, row) => {
    if (err) {
      console.error("❌ DB error on subscription check:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (!row || !row.subscription_end_date) {
      return res.status(200).json({ allowed: false });
    }

    const { subscription_id, is_active, subscription_end_date } = row;
    const now = new Date();
    const endDate = new Date(subscription_end_date);

    // ✅ Case 1: NON-RECURRING: is_active = 1 and endDate in future
    if (!subscription_id && is_active === 1 && now < endDate) {
      return res.status(200).json({ allowed: true });
    }

    // ✅ Case 2: RECURRING and still valid
    if (subscription_id && is_active === 1 && now < endDate) {
      return res.status(200).json({ allowed: true });
    }

    // ❌ If recurrent but expired — check CloudPayments status
    if (subscription_id && now >= endDate) {
      try {
        const cloudResponse = await axios.post(
          "https://api.cloudpayments.ru/subscriptions/find",
          { accountId: account_id },
          {
            auth: {
              username: process.env.CLOUD_PUBLIC_ID,
              password: process.env.CLOUD_API_SECRET
            }
          }
        );

        if (!cloudResponse.data?.Success) {
          console.error("❌ CloudPayments status check failed:", cloudResponse.data?.Message);
          return res.status(200).json({ allowed: false });
        }

        const subs = cloudResponse.data.Model || [];
        const matching = subs.find(s => s.Id === subscription_id);

        if (matching && matching.StatusCode === 0) {
          // ✅ Subscription still active — extend local end date
          db.run(
            `UPDATE users SET subscription_end_date = datetime(subscription_end_date, '+7 days'), is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?`,
            [account_id],
            (err) => {
              if (err) console.error("❌ DB update after remote check failed:", err.message);
            }
          );
          return res.status(200).json({ allowed: true });
        } else {
          // ❌ Not active anymore — disable locally
          db.run(
            `UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?`,
            [account_id],
            (err) => {
              if (err) console.error("❌ DB disable user error:", err.message);
            }
          );
          return res.status(200).json({ allowed: false });
        }

      } catch (err) {
        console.error("❌ CloudPayments API error:", err?.response?.data || err.message);
        return res.status(500).json({ allowed: false, error: "CloudPayments API error" });
      }
    }

    // ❌ Fallback
    return res.status(200).json({ allowed: false });
  });
});

// New payment 
app.post("/api/payment/init", (req, res) => {
  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: "Missing account_id" });
  }

  db.get(`SELECT is_active, ftd FROM users WHERE account_id = ?`, [account_id], (err, row) => {
    if (err) {
      console.error("❌ Failed to get user info:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    // ❌ User already has an active subscription
    if (row && row.is_active === 1) {
      return res.status(400).json({ error: "Subscription already active" });
    }

    const ftd = row ? !!row.ftd : true;
    const invoiceId = generateInvoiceId();

    db.run(
      `INSERT INTO payments (
         transaction_id, account_id, invoice_id, status
       ) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), account_id, invoiceId, "created"],
      function (err) {
        if (err) {
          console.error("❌ Failed to insert payment:", err.message);
          return res.status(500).json({ error: "Failed to create payment" });
        }

        const paymentUrl = `https://numerologyfromkate.com/pay.html?accountId=${account_id}&invoiceId=${invoiceId}&ftd=${ftd}`;
        res.json({ url: paymentUrl });
      }
    );
  });
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

      // 2. Update payment
      db.run(
        `UPDATE payments SET
            transaction_id = ?,
            subscription_id = ?,
            amount = ?,
            currency = ?,
            status = ?,
            operation_type = ?,
            token = ?,
            is_test = ?,
            date_time = ?,
            created_at = CURRENT_TIMESTAMP
        WHERE invoice_id = ?`,
        [
          TransactionId,
          SubscriptionId,
          parseFloat(Amount),
          Currency,
          Status,
          OperationType,
          Token,
          TestMode === "1",
          DateTime,
          InvoiceId
        ],
        function (err) {
          if (err) return console.error("❌ Payment update error:", err.message);
          console.log("✅ Payment record updated.");
        }
      );

      // 3. Update user subscription status and expiration
      db.run(
        `UPDATE users SET 
            is_active = 1,
            ftd = 0,
            subscription_id = ?,
            subscription_end_date = datetime(?, '+7 days'),
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?`,
        [SubscriptionId, DateTime, AccountId],
        function (err) {
            if (err) return console.error("❌ User update error:", err.message);
            console.log("✅ User subscription updated.");
        }
        );
    }
  );

  res.status(200).json({ code: 0, message: 'Received successfully' });
});

app.post('/api/subscription/cancel', async (req, res) => {
  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: "Missing account_id" });
  }

  db.get(
    `SELECT subscription_id FROM users WHERE account_id = ? AND is_active = 1`,
    [account_id],
    async (err, row) => {
      if (err) {
        console.error("❌ DB error on cancel:", err.message);
        return res.status(500).json({ error: "Database error" });
      }

      if (!row || row.subscription_id === undefined) {
        return res.status(400).json({ error: "No active subscription to cancel" });
        }

        if (!row.subscription_id) {
        return res.status(400).json({ error: "Subscription payment not recurrent" });
        }
      const subscription_id = row.subscription_id;
      

    //   console.log("Using credentials:", process.env.CLOUD_PUBLIC_ID, process.env.CLOUD_API_SECRET);

      try {
        const response = await axios.post(
        "https://api.cloudpayments.ru/subscriptions/cancel",
        { Id: subscription_id },
        {
            auth: {
            username: process.env.CLOUD_PUBLIC_ID,
            password: process.env.CLOUD_API_SECRET
            }
        }
        );
        if (!response.data?.Success) {
          return res.status(500).json({ error: response.data?.Message || "Cancellation failed" });
        }

        db.run(
          `UPDATE users SET 
             is_active = 0,
             subscription_id = NULL,
             updated_at = CURRENT_TIMESTAMP,
             subscription_end_date = NULL
           WHERE account_id = ?`,
          [account_id],
          (err) => {
            if (err) {
              console.error("❌ Failed to update user after cancel:", err.message);
              return res.status(500).json({ error: "Database update failed" });
            }

            res.status(200).json({ success: true });
          }
        );
      } catch (err) {
        console.error("❌ CloudPayments cancel error:", err?.response?.data || err.message);
        res.status(500).json({ error: "CloudPayments API error" });
      }
    }
  );
});


app.post("/api/payment/sbp", (req, res) => {
  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: "Missing account_id" });
  }

  const invoiceId = generateInvoiceId();
  const amount = 490.00;

  const payload = {
    PublicId: process.env.CLOUD_PUBLIC_ID,
    Amount: amount,
    Currency: "RUB",
    Description: "Оплата по СБП",
    AccountId: account_id,
    Scheme: "charge",
    InvoiceId: invoiceId,
    SuccessRedirectUrl: "https://numerologyfromkate.com/success",
    IsTest: true // ✅ set to false in production
  };

  // Save minimal payment record
  db.run(
    `INSERT INTO payments (
       transaction_id, account_id, invoice_id, status
     ) VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), account_id, invoiceId, "created"],
    function (err) {
      if (err) {
        console.error("❌ Failed to insert SBP payment:", err.message);
        return res.status(500).json({ error: "Failed to log SBP payment" });
      }

      // Make request to CloudPayments
      axios.post("https://api.cloudpayments.ru/payments/qr/sbp/link", payload)

      .then(response => {
        if (!response.data?.Success) {
          return res.status(500).json({ error: response.data?.Message || "SBP error" });
        }

        res.json({
          url: response.data.Model?.QrUrl,
          invoiceId,
          transactionId: response.data.Model?.TransactionId
        });
      })
      .catch(err => {
        console.error("❌ SBP link error:", err?.response?.data || err.message);
        res.status(500).json({ error: "SBP API error" });
      });
    }
  );
});

// Webhook: payment fail
app.post('/api/payment/fail', (req, res) => {
  console.log('❌ Payment Failed Webhook:\n', JSON.stringify(req.body, null, 2));
  res.status(200).json({ code: 0, message: 'Failure logged' });
});

app.post('/api/users/register', (req, res) => {
  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'Missing account_id' });
  }

  db.run(
    `INSERT OR IGNORE INTO users (account_id) VALUES (?)`,
    [account_id],
    function (err) {
      if (err) {
        console.error("❌ Failed to insert user:", err.message);
        return res.status(500).json({ error: 'Database insert error' });
      }

      res.status(200).json({ success: true, message: 'User registered' });
    }
  );
});

// Start backend
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});