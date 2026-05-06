const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "brealls_secret_key";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Make sure database folder exists
const databaseFolder = path.join(__dirname, "database");
if (!fs.existsSync(databaseFolder)) {
  fs.mkdirSync(databaseFolder);
}

const dbPath = path.join(databaseFolder, "brealls.db");
const db = new sqlite3.Database(dbPath);

// DATABASE TABLES
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accommodations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      price REAL NOT NULL,
      status TEXT DEFAULT 'Available'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      accommodation_id INTEGER,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      guests INTEGER NOT NULL,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(accommodation_id) REFERENCES accommodations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT DEFAULT 'Unpaid',
      reference_no TEXT,
      paid_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(booking_id) REFERENCES bookings(id)
    )
  `);
});

// DEFAULT USERS AND SAMPLE ACCOMMODATIONS
setTimeout(() => {
  const adminPass = bcrypt.hashSync("admin123", 10);
  const staffPass = bcrypt.hashSync("staff123", 10);

  db.run(
    `INSERT OR IGNORE INTO users (id, full_name, email, password, role)
     VALUES (1, 'System Administrator', 'admin@brealls.com', ?, 'Administrator')`,
    [adminPass]
  );

  db.run(
    `INSERT OR IGNORE INTO users (id, full_name, email, password, role)
     VALUES (2, 'Front Desk Staff', 'staff@brealls.com', ?, 'Staff')`,
    [staffPass]
  );

  db.run(`
    INSERT OR IGNORE INTO accommodations 
    (id, name, type, capacity, price, status)
    VALUES 
    (1, 'Lodge Room 1', 'Lodge', 2, 1500, 'Available'),
    (2, 'Family Cottage 1', 'Cottage', 6, 3000, 'Available'),
    (3, 'Beach Cottage 2', 'Cottage', 4, 2500, 'Available')
  `);
}, 1000);

// AUTHENTICATION MIDDLEWARE
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).json({ message: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized access" });
    }

    req.user = decoded;
    next();
  });
}

// REGISTER CUSTOMER
app.post("/api/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Please complete all fields" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (full_name, email, password, role)
     VALUES (?, ?, ?, 'Customer')`,
    [full_name, email, hashedPassword],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Email already exists" });
      }

      res.json({ message: "Registration successful. You may now login." });
    }
  );
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
      SECRET_KEY,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    });
  });
});

// VIEW ACCOMMODATIONS
app.get("/api/accommodations", (req, res) => {
  db.all(`SELECT * FROM accommodations ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Failed to load accommodations" });
    }

    res.json(rows);
  });
});

// ADD ACCOMMODATION
app.post("/api/accommodations", verifyToken, (req, res) => {
  const { name, type, capacity, price } = req.body;

  if (!name || !type || !capacity || !price) {
    return res.status(400).json({ message: "Please complete all fields" });
  }

  db.run(
    `INSERT INTO accommodations (name, type, capacity, price, status)
     VALUES (?, ?, ?, ?, 'Available')`,
    [name, type, capacity, price],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Failed to add accommodation" });
      }

      res.json({ message: "Accommodation added successfully" });
    }
  );
});

// CREATE BOOKING
app.post("/api/bookings", verifyToken, (req, res) => {
  const { accommodation_id, check_in, check_out, guests } = req.body;

  if (!accommodation_id || !check_in || !check_out || !guests) {
    return res.status(400).json({ message: "Please complete all booking details" });
  }

  db.get(
    `
    SELECT * FROM bookings
    WHERE accommodation_id = ?
    AND status NOT IN ('Cancelled', 'Checked-out')
    AND check_in < ?
    AND check_out > ?
    `,
    [accommodation_id, check_out, check_in],
    (err, existingBooking) => {
      if (existingBooking) {
        return res.status(400).json({
          message: "Double booking detected. Please choose another date.",
        });
      }

      db.run(
        `
        INSERT INTO bookings 
        (user_id, accommodation_id, check_in, check_out, guests, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
        `,
        [req.user.id, accommodation_id, check_in, check_out, guests],
        function (err) {
          if (err) {
            return res.status(400).json({ message: "Booking failed" });
          }

          res.json({ message: "Booking request submitted successfully" });
        }
      );
    }
  );
});

// VIEW BOOKINGS
app.get("/api/bookings", verifyToken, (req, res) => {
  let query;
  let params = [];

  if (req.user.role === "Customer") {
    query = `
      SELECT bookings.*, accommodations.name AS accommodation_name
      FROM bookings
      JOIN accommodations ON bookings.accommodation_id = accommodations.id
      WHERE bookings.user_id = ?
      ORDER BY bookings.created_at DESC
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT bookings.*, users.full_name, accommodations.name AS accommodation_name
      FROM bookings
      JOIN users ON bookings.user_id = users.id
      JOIN accommodations ON bookings.accommodation_id = accommodations.id
      ORDER BY bookings.created_at DESC
    `;
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Failed to load bookings" });
    }

    res.json(rows);
  });
});

// UPDATE BOOKING STATUS
app.put("/api/bookings/:id/status", verifyToken, (req, res) => {
  const { status } = req.body;
  const bookingId = req.params.id;

  db.run(
    `UPDATE bookings SET status = ? WHERE id = ?`,
    [status, bookingId],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Failed to update booking status" });
      }

      res.json({ message: "Booking status updated successfully" });
    }
  );
});

// RECORD PAYMENT
app.post("/api/payments", verifyToken, (req, res) => {
  const { booking_id, amount, payment_method, payment_status, reference_no } = req.body;

  if (!booking_id || !amount || !payment_method) {
    return res.status(400).json({ message: "Please complete payment details" });
  }

  db.run(
    `
    INSERT INTO payments 
    (booking_id, amount, payment_method, payment_status, reference_no)
    VALUES (?, ?, ?, ?, ?)
    `,
    [booking_id, amount, payment_method, payment_status, reference_no],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Payment recording failed" });
      }

      res.json({ message: "Payment recorded successfully" });
    }
  );
});

// REPORTS
app.get("/api/reports", verifyToken, (req, res) => {
  const report = {};

  db.get(`SELECT COUNT(*) AS total_bookings FROM bookings`, [], (err, bookings) => {
    report.total_bookings = bookings?.total_bookings || 0;

    db.get(
      `SELECT COUNT(*) AS confirmed_bookings FROM bookings WHERE status = 'Confirmed'`,
      [],
      (err, confirmed) => {
        report.confirmed_bookings = confirmed?.confirmed_bookings || 0;

        db.get(
          `SELECT SUM(amount) AS total_sales FROM payments WHERE payment_status = 'Paid'`,
          [],
          (err, sales) => {
            report.total_sales = sales?.total_sales || 0;
            res.json(report);
          }
        );
      }
    );
  });
});

// DEFAULT ROUTE
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Brealls Booking System running on port ${PORT}`);
});