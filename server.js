const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS (optional, for debugging or frontend calls)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 🌐 Base test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ✅ Payment success webhook (CloudPayments sends POST request here)
app.post('/api/payment/success', (req, res) => {
  console.log('✅ Payment Success Webhook Received:');
  console.log(JSON.stringify(req.body, null, 2));

  // TODO: Validate payment, update database, etc.

  res.status(200).json({ code: 0, message: 'Received successfully' });
});

// ❌ (Optional) Fail handler (if you configure CloudPayments to call it)
app.post('/api/payment/fail', (req, res) => {
  console.log('❌ Payment Failed Webhook:');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ code: 0, message: 'Failure logged' });
});

// Start backend
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});