const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error('❌ Failed to open DB:', err.message);
  console.log('📂 Opened database:', DB_PATH);
});

// Fetch users
db.all(`SELECT * FROM users`, (err, users) => {
  if (err) return console.error('❌ Error fetching users:', err.message);
  console.log('\n📋 USERS:');
  users.forEach(user => console.log(user));
});

// Fetch payments
db.all(`SELECT * FROM payments`, (err, payments) => {
  if (err) return console.error('❌ Error fetching payments:', err.message);
  console.log('\n💳 PAYMENTS:');
  payments.forEach(payment => console.log(payment));
});