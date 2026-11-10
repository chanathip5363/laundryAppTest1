const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("node:crypto");

const app = express();
app.use(express.json());

const db = new sqlite3.Database(
  "./database-reservation-test.db"
);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "Reservation Test",
    mqtt: "DISABLED"
  });
});

app.get("/machines", (req, res) => {
  db.all("SELECT * FROM machines", (err, rows) => {
    if (err) return res.sendStatus(500);
    res.json(rows);
  });
});

app.post("/request-qr", (req, res) => {
  const { machine } = req.body || {};

  if (typeof machine !== "string" || !machine) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุเครื่อง"
    });
  }

  const now = Date.now();
  const reservedUntil = now + 120000;
  const reserveToken = crypto.randomUUID();

  db.run(`
    UPDATE machines
    SET state = 'RESERVED',
        reserved_until = ?,
        reserve_token = ?
    WHERE machine = ?
      AND status = 'ONLINE'
      AND (
        state = 'IDLE'
        OR (
          state = 'RESERVED'
          AND reserved_until IS NOT NULL
          AND reserved_until <= ?
        )
      )
  `, [reservedUntil, reserveToken, machine, now], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Database error"
      });
    }

    if (this.changes !== 1) {
      return res.json({
        success: false,
        message: "เครื่องไม่ว่างหรือออฟไลน์"
      });
    }

    res.json({
      success: true,
      message: "จองเครื่องสำเร็จ",
      qr: "TEMP_QR",
      reserveToken,
      reservedUntil
    });
  });
});

app.listen(3001, "127.0.0.1", () => {
  console.log("Reservation Test Server running on localhost:3001");
  console.log("MQTT DISABLED");
});
