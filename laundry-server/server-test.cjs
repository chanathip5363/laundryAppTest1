const express = require("express");
const sqlite3 = require("sqlite3");

const app = express();

const db = new sqlite3.Database(
  "./database.db",
  sqlite3.OPEN_READONLY
);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "Smart Laundry Cloud Test",
    mqtt: "DISABLED"
  });
});

app.get("/machines", (req, res) => {
  db.all(
    "SELECT machine, state, status FROM machines ORDER BY machine",
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }
      res.json(rows);
    }
  );
});

app.listen(3000, "127.0.0.1", () => {
  console.log("Cloud Test Server running on localhost:3000");
  console.log("MQTT DISABLED");
});
