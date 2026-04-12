const express = require("express");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const sqlite3 = require("sqlite3").verbose();

const cors = require("cors")

const app = express();
app.use(cors());

const usedTx = new Set();
app.use(bodyParser.json());

// ===== MQTT =====
const client = mqtt.connect("mqtts://1f987687489a42f296be8b2579cd71f5.s1.eu.hivemq.cloud:8883",
    {
        username: "ESP32",
        password: "Laundry123"
    }
);

client.on("connect", () => {
    console.log("MQTT connected");

    client.subscribe("laundry/+/state");
    client.subscribe("laundry/+/status");    
});

// ===== DATABASE =====
const db = new sqlite3.Database("./database.db");

 db.run(`
  ALTER TABLE machines ADD COLUMN reserved_until INTEGER
`, (err) => {
  if (err) {
    console.log("column อาจมีอยู่แล้ว:", err.message);
  } else {
    console.log("เพิ่ม reserved_until สำเร็จ");
  }
});

db.run(`
CREATE TABLE IF NOT EXISTS transactions (
    txid TEXT PRIMARY KEY,
    machine TEXT,
    amount INTEGER,
    status TEXT
    )
`);

db.run(`
CREATE TABLE IF NOT EXISTS machines (
    machine TEXT PRIMARY KEY,
    state TEXT,
    reserve_until INTEGER    
)
`);

// ===== ฟังก์ชันเช็คเครื่อง =====
function isMachineRunning(machine, callback){

    // if(usedTx.has(txid)){
    //     console.log("Duplicate (memory) -> ignore");
    //     return res.sendStatus(200)
    //  }
   // usedTx.add(txid)

    db.get("SELECT state FROM machines WHERE machine=?", [machine], (err,row)=>{
        if(err || !row){
            return callback(false);
        }
        callback(row.state === "RUNNING");
    });
}

// ===== webhook จาก payment =====
app.post("/webhook", (req, res) => {
  const { txid, machine, amount, program, tempPulse, aromaPulse } = req.body;
  console.log("Payment received:", txid);
  console.log("🔥🔥🔥 WEBHOOK HIT:", req.body);


  if (usedTx.has(txid)) {
    console.log("Duplicate (memory) -> ignore");
    return res.sendStatus(200);
  }
  usedTx.add(txid);

  // 1. กัน tx ซ้ำ
  db.get("SELECT * FROM transactions WHERE txid=?", [txid], (err, row) => {
    if (err) {
      console.log("DB error", err);
      return res.sendStatus(200);
    }

    if (row) {
      console.log("Duplicate TXID -> ignore");
      return res.sendStatus(200);
    }

    // 2. เช็คเครื่องว่าง
    isMachineRunning(machine, (running) => {
      if (running) {
        console.log("Machine busy -> reject payment");

        db.run(
          "INSERT INTO transactions VALUES (?,?,?,?)",
          [txid, machine, amount, "REJECTED"]
        );
        return res.sendStatus(200);
      }

      // 3. บันทึก transaction
      db.run(
        "INSERT OR IGNORE INTO transactions VALUES (?,?,?,?)",
        [txid, machine, amount, "SUCCESS"],
        function (err) {
          if (err) {
            console.log("DB error:", err);
            return res.sendStatus(200);
          }

          if (this.changes === 0) {
            console.log("Duplicate TX (DB) -> Ignore");
            return res.sendStatus(200);
          }

          // 4. อัพเดทเครื่องเป็น RUNNING
          db.run(
            "INSERT OR REPLACE INTO machines VALUES (?,?)",
            [machine, "RUNNING"]
          );

          // 5. ส่งไป ESP
          const payload = JSON.stringify({
            txid: txid,
            program: program
          });

          client.publish(`laundry/${machine}/tempPulse`, String(tempPulse || 0));          
          client.publish(`laundry/${machine}/aromaPulse`, String(aromaPulse || 0));          
          client.publish(`laundry/${machine}/program`, program.toString());          
          console.log("Start machine:", machine);
          return res.sendStatus(200);
        }
      );
    });
  });
});

app.post("/request-qr", (req, res) => {
  const { machine } = req.body;
  const now = Date.now();

  db.get("SELECT * FROM machines WHERE machine = ?", [machine], (err, row) => {

    if (row && (row.state === "RUNNING" || row.state === "RESERVED")) {
      return res.json({ success: false, message: "เครื่องไม่ว่าง" });
    }

    // ปลด lock ถ้าหมดเวลาแล้ว
    if (row && row.state === "RESERVED" && row.reserved_until <= now) {
      db.run(`UPDATE machine SET state = 'IDLE', reserved_until = NULL WHERE machine = ?`, [machine]);
    }

    if (row && row.state === "RESERVED" && row.reserved_until > now) {
      return res.json({ success: false, message: "เครื่องไม่ว่าง" });
    }

    const reservedUntil = now + 20000; // 20 วินาที

if (row) {
  db.run(`
    UPDATE machines
    SET state = 'RESERVED', reserved_until = ?
    WHERE machine = ?
  `, [reservedUntil, machine]);
} else {
  db.run(`
    INSERT INTO machines (machine, state, reserved_until)
    VALUES (?, 'RESERVED', ?)
  `, [machine, reservedUntil]);
}

    return res.json({
      success: true,
      message: "จองเครื่องสำเร็จ",
      qr: "TEMP_QR"
    });

  });
});

// ===== รับ status จาก ESP =====
client.subscribe("laundry/+/state");

client.on("message", (topic, message)=>{

    const msg = message.toString().trim().toUpperCase();
    const machine = topic.split("/")[1];

    console.log("TOPIC:", topic);
    console.log("RAW MSG:", msg);        

    console.log("Status:", machine, msg);

    if(msg === "FINISH" || msg === "IDLE"){
        db.run(
          "UPDATE machines SET state=? WHERE machine=?",
          ["IDLE", machine]
        );
        console.log("Machine Set to IDLE:", machine)
    }
    
});

// ===== start server =====
app.listen(3000, ()=>{
    console.log("Server running on port 3000");
});

app.get("/machine-status/:machine", (req, res) => {
  const machine = req.params.machine;

  db.get(
    "SELECT state FROM machines WHERE machine = ?",
    [machine],
    (err, row) => {
      if (err) {
        console.log("DB error:", err);
        return res.json({ available: false });
      }

      // ถ้ายังไม่มีข้อมูล = ถือว่าว่าง
      if (!row) {
        return res.json({ available: true });
      }

      // ว่าง = IDLE เท่านั้น
      const available = row.state === "IDLE";
      res.json({ available });
    }
  );
});

app.get("/fix", (req, res) => {
  db.run("DELETE FROM machines WHERE machine IS NULL");
  res.send("fixed");
});

 app.get("/machines", (req, res) => {
  db.all("SELECT * FROM machines", [], (err, rows) => {
    res.json(rows);
  });
});

app.get("/fix-null-machine", (req, res) => {
  db.run("DELETE FROM machines WHERE machine IS NULL", function (err) {
    if (err) {
      console.log("ลบ NULL ไม่สำเร็จ:", err.message);
      return res.status(500).send("delete failed");
    }

    console.log("ลบ NULL สำเร็จ", this.changes, "row");
    res.send(`deleted ${this.changes} row`);
  });
});