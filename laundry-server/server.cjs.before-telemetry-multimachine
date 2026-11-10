const express = require("express");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const sqlite3 = require("sqlite3").verbose();

const cors = require("cors")

const app = express();
app.use(cors());
app.use(express.json());

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
    client.subscribe("laundry/+/telemetry");
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
  ALTER TABLE machines ADD COLUMN status TEXT DEFAULT 'OFFLINE'
`, (err) => {
  if (err) {
    console.log("status column อาจมีอยู่แล้ว:", err.message);
  } else {
    console.log("เพิ่ม status column สำเร็จ");
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
        callback(row.state === "RUNNING" || row.state === "STARTING");
    });
}

function isMachineOnline(machine, callback) {
    db.get(
        "SELECT status FROM machines WHERE machine=?",
        [machine],
        (err, row) => {
            if (err || !row) {
                return callback(false);
            }

            callback(row.status === "ONLINE");
        }
    );
}

// ===== webhook จาก payment =====
app.post("/webhook", require("./payment-bridge.cjs").authorizeWebhook(db, client), (req, res) => {
  const {
  txid,
  machine,
  amount,
  type,
  program,
  tempPulse,
  aromaPulse,
  temperatureOption,
  wrinkleOption
} = req.body;
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

    // ตรวจว่าเครื่องถูกจองไว้ และ reservation ยังไม่หมดเวลา
    db.get(
      "SELECT state, reserved_until, shop_id FROM machines WHERE machine=?",
      [machine],
      (err, machineRow) => {

        if (err || !machineRow) {
          console.log("Unknown machine -> reject payment");
          return res.sendStatus(200);
        }

    // ไม่มี reservation ที่ถูกต้อง
    if (
      machineRow.state !== "RESERVED" ||
      !machineRow.reserved_until
    ) {
      console.log("Reservation invalid -> reject payment");
      return res.sendStatus(200);
    }

    // reservation หมดเวลา
    if (machineRow.reserved_until <= Date.now()) {
      console.log("Reservation expired -> reset machine to IDLE");

      db.run(
        "UPDATE machines SET state='IDLE', reserved_until=NULL WHERE machine=?",
        [machine]
      );

      return res.sendStatus(200);
    }  

// เช็คว่า ESP ของเครื่องยัง ONLINE
isMachineOnline(machine, (online) => {
  if (!online) {
    console.log("Machine OFFLINE -> reject payment");

    db.run(
      "INSERT INTO transactions (txid, machine, amount, status, shop_id) VALUES (?,?,?,?,?)",
      [txid, machine, amount, "REJECTED", machineRow.shop_id]
    );

    return res.sendStatus(200);
  }

    // 2. เช็คเครื่องว่าง
    isMachineRunning(machine, (running) => {
      if (running) {
        console.log("Machine busy -> reject payment");

        db.run(
          "INSERT INTO transactions (txid, machine, amount, status, shop_id) VALUES (?,?,?,?,?)",
          [txid, machine, amount, "REJECTED", machineRow.shop_id]
        );
        return res.sendStatus(200);
      }

      // 3. บันทึก transaction
      db.run(
        "INSERT OR IGNORE INTO transactions (txid, machine, amount, status, shop_id) VALUES (?,?,?,?,?)",
        [txid, machine, amount, "SUCCESS", machineRow.shop_id],
        function (err) {
          if (err) {
            console.log("DB error:", err);
            return res.sendStatus(200);
          }

          if (this.changes === 0) {
            console.log("Duplicate TX (DB) -> Ignore");
            return res.sendStatus(200);
          }


          // ===== USAGE START: บันทึกค่ามิเตอร์เมื่อชำระเงินสำเร็จ =====
          if (machine === "machine1") {
            db.get(
              `SELECT energy_kwh, water_liters, received_at
               FROM machine_telemetry
               WHERE machine = ?
               ORDER BY id DESC LIMIT 1`,
              [machine],
              (usageErr, meter) => {
                if (usageErr) {
                  console.error("[USAGE START] Telemetry DB error:", usageErr);
                  return;
                }

                const ageMs = meter
                  ? Date.now() - Date.parse(meter.received_at)
                  : Infinity;

                const fresh = Number.isFinite(ageMs) &&
                              ageMs >= 0 && ageMs <= 30000;

                const energy = fresh && Number.isFinite(meter.energy_kwh)
                  ? meter.energy_kwh : null;

                const water = fresh && Number.isFinite(meter.water_liters)
                  ? meter.water_liters : null;

                db.run(
                  `INSERT OR IGNORE INTO machine_usage
                   (txid, machine, started_at,
                    start_energy_kwh, start_water_liters, status)
                   VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                           ?, ?, ?)`,
                  [txid, machine, energy, water,
                   fresh && energy !== null && water !== null
                     ? "STARTED" : "MISSING_START"],
                  function (insertErr) {
                    if (insertErr) {
                      console.error("[USAGE START] Insert error:", insertErr);
                    } else {
                      console.log("[USAGE START]", txid,
                                  "saved:", this.changes);
                    }
                  }
                );
              }
            );
          }
          // ===== END USAGE START =====

          // 4. อัพเดทเครื่องเป็น STARTING
          db.run(
            "UPDATE machines SET state = 'STARTING', reserved_until = NULL WHERE machine = ?",
            [machine],
            function (err){
              if (err){
                  console.log ("X UPDATE ERROR:", err);
                } else {
                 console.log("UPDATE STARTING OK:", this.changes);
                }
              }
            );

          // 5. ส่งไป ESP
          const payload = JSON.stringify({
            txid: txid,
            program: program
          });

  if (type === "dry") {
    client.publish(
      `laundry/${machine}/temperatureOption`,
      String(temperatureOption)
    );

    client.publish(
      `laundry/${machine}/wrinkleOption`,
      String(wrinkleOption)
    );

    client.publish(
      `laundry/${machine}/program`,
      program.toString()
    );

    console.log("DRY command:", {
      machine,
      program,
      temperatureOption,
      wrinkleOption
    });

  } else {
    // Wash เดิม
    client.publish(
      `laundry/${machine}/tempPulse`,
      String(tempPulse || 0)
    );

    client.publish(
      `laundry/${machine}/aromaPulse`,
      String(aromaPulse || 0)
    );

    client.publish(
      `laundry/${machine}/program`,
      program.toString()
    );
  }         
          console.log("Start machine:", machine);
          return res.sendStatus(200);
        }
      );
    });
  });
  });
  });  
});

app.post("/request-qr", (req, res) => {
  const { machine } = req.body;
  const now = Date.now();

  console.log("[REQUEST QR] machine =", machine);

  db.get("SELECT * FROM machines WHERE machine = ?", [machine], (err, row) => {

    if(err) {
      console.error(err);
      return res.json({success: false, message: "DB error"});
    }

    if (!row) {
      console.log("Unknown machine -> reject QR:", machine);
      return res.json({
        success: false,
        message: "ไม่พบเครื่อง"
      });
}    

    if (row && (row.state === "RUNNING" || row.state === "STARTING")) {
      return res.json({ success: false, message: "เครื่องกำลังทำงาน" });
    }    

    // ปลด lock ถ้าหมดเวลาแล้ว
    if (row && row.state === "RESERVED" && row.reserved_until <= now) {
      db.run(`UPDATE machines SET state = 'IDLE', reserved_until = NULL WHERE machine = ?`, [machine]);
    }

    if (row && row.status !== "ONLINE") {
      return res.json({ success: false, message: "เครื่องออฟไลน์" });
}

    if (row && row.state === "RESERVED" && row.reserved_until > now) {
      return res.json({ success: false, message: "เครื่องไม่ว่าง" });
    }

    const reservedUntil = now + 120000; // 2 นาที

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
    qr: "TEMP_QR",
    reservedUntil: reservedUntil
  });

  });
});

// ===== รับ status จาก ESP =====
client.subscribe("laundry/+/state");

client.on("message", (topic, message)=>{
        // ===== บันทึกข้อมูลไฟฟ้าและน้ำจาก ESP32 =====
    if (topic === "laundry/machine1/telemetry") {
      let data;

      try {
        data = JSON.parse(message.toString());
      } catch (err) {
        console.error("[TELEMETRY] Invalid JSON:", err.message);
        return;
      }

      const fields = [
        "voltage",
        "current",
        "power",
        "energy_kwh",
        "water_liters"
      ];

      const valid = fields.every(
        key => data[key] === null ||
          (typeof data[key] === "number" && Number.isFinite(data[key]) && data[key] >= 0)
      );

      if (!valid || fields.some(key => data[key] === undefined)) {
        console.error("[TELEMETRY] Invalid measurements");
        return;
      }

      db.run(
        `INSERT INTO machine_telemetry
         (machine, voltage, current, power, energy_kwh, water_liters)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "machine1",
          data.voltage,
          data.current,
          data.power,
          data.energy_kwh,
          data.water_liters
        ],
        function(err) {
          if (err) {
            console.error("[TELEMETRY] DB ERROR:", err.message);
          } else {
            console.log("[TELEMETRY] machine1 saved:", this.lastID);
          }
        }
      );

      return;
    }
    // ===== จบส่วนบันทึก Telemetry =====
    const msg = message.toString().trim().toUpperCase();
    const machine = topic.split("/")[1];
    const type = topic.split("/")[2];

    console.log(`[${type.toUpperCase()}] ${machine} = ${msg}`);

if (type === "state" && msg === "FINISH") {


// ===== CALCULATED ENERGY =====
function calculateUsageEnergy(txid, machine) {
  db.get(
    `SELECT started_at, finished_at
     FROM machine_usage
     WHERE txid=? AND machine=? AND status='FINISHED'`,
    [txid, machine],
    (err, usage) => {
      if (err || !usage || !usage.finished_at) {
        if (err) console.error("[ENERGY CALC]", err);
        return;
      }

      const startMs = Date.parse(usage.started_at);
      const endMs = Date.parse(usage.finished_at);

      if (!Number.isFinite(startMs) ||
          !Number.isFinite(endMs) ||
          endMs <= startMs) {
        console.error("[ENERGY CALC] Invalid time:", txid);
        return;
      }

      const from = new Date(startMs - 30000).toISOString();
      const to = new Date(endMs + 30000).toISOString();

      db.all(
        `SELECT received_at, power
         FROM machine_telemetry
         WHERE machine=?
           AND received_at>=?
           AND received_at<=?
         ORDER BY received_at`,
        [machine, from, to],
        (readErr, rows) => {
          if (readErr) {
            console.error("[ENERGY CALC]", readErr);
            return;
          }

          let energyWh = 0;
          let coveredSeconds = 0;

          for (let i = 1; i < rows.length; i++) {
            const a = rows[i - 1];
            const b = rows[i];

            const t1 = Date.parse(a.received_at);
            const t2 = Date.parse(b.received_at);
            const dt = (t2 - t1) / 1000;

            if (!Number.isFinite(dt) ||
                dt <= 0 || dt > 15 ||
                !Number.isFinite(a.power) ||
                !Number.isFinite(b.power)) {
              continue;
            }

            const left = Math.max(t1, startMs);
            const right = Math.min(t2, endMs);

            if (right <= left) continue;

            const fractionLeft = (left - t1) / (t2 - t1);
            const fractionRight = (right - t1) / (t2 - t1);

            const powerLeft =
              a.power + (b.power - a.power) * fractionLeft;

            const powerRight =
              a.power + (b.power - a.power) * fractionRight;

            const seconds = (right - left) / 1000;

            energyWh +=
              ((powerLeft + powerRight) / 2) * seconds / 3600;

            coveredSeconds += seconds;
          }

          const totalSeconds = (endMs - startMs) / 1000;
          const coverage = coveredSeconds / totalSeconds;

          if (coverage < 0.90) {
            console.log(
              "[ENERGY CALC] Coverage insufficient:",
              txid,
              coverage.toFixed(3)
            );
            return;
          }

          db.run(
            `UPDATE machine_usage
             SET energy_calculated_kwh=?
             WHERE txid=? AND machine=?
               AND status='FINISHED'`,
            [energyWh / 1000, txid, machine],
            function(updateErr) {
              if (updateErr) {
                console.error("[ENERGY CALC] Update:", updateErr);
              } else {
                console.log(
                  "[ENERGY CALC]",
                  txid,
                  energyWh.toFixed(4),
                  "Wh",
                  "coverage:",
                  coverage.toFixed(3),
                  "updated:",
                  this.changes
                );
              }
            }
          );
        }
      );
    }
  );
}
// ===== END CALCULATED ENERGY =====

// ===== USAGE FINISH START =====
if (machine === "machine1") {
  db.get(
    `SELECT txid, start_energy_kwh, start_water_liters
     FROM machine_usage
     WHERE machine=? AND status IN ('STARTED','MISSING_START')
     ORDER BY started_at DESC LIMIT 1`,
    [machine],
    (usageErr, usage) => {
      if (usageErr || !usage) {
        if (usageErr) console.error("[USAGE FINISH] Usage DB error:", usageErr);
        return;
      }

      db.get(
        `SELECT energy_kwh, water_liters, received_at
         FROM machine_telemetry
         WHERE machine=?
         ORDER BY id DESC LIMIT 1`,
        [machine],
        (meterErr, meter) => {
          if (meterErr || !meter) {
            console.error("[USAGE FINISH] No telemetry:", meterErr);
            return;
          }

          const ageMs = Date.now() - Date.parse(meter.received_at);
          const fresh = Number.isFinite(ageMs) &&
                        ageMs >= 0 && ageMs <= 30000;

          const validEnergy =
            Number.isFinite(usage.start_energy_kwh) &&
            Number.isFinite(meter.energy_kwh) &&
            meter.energy_kwh >= usage.start_energy_kwh;

          const validWater =
            Number.isFinite(usage.start_water_liters) &&
            Number.isFinite(meter.water_liters) &&
            meter.water_liters >= usage.start_water_liters;

          const valid = fresh && validEnergy && validWater;

          db.run(
            `UPDATE machine_usage
             SET finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 end_energy_kwh=?,
                 end_water_liters=?,
                 energy_used_kwh=?,
                 water_used_liters=?,
                 status=?
             WHERE txid=?
               AND status IN ('STARTED','MISSING_START')`,
            [
              fresh ? meter.energy_kwh : null,
              fresh ? meter.water_liters : null,
              valid ? meter.energy_kwh - usage.start_energy_kwh : null,
              valid ? meter.water_liters - usage.start_water_liters : null,
              valid ? "FINISHED" : "INCOMPLETE",
              usage.txid
            ],
            function (err) {
              if (err) {
                console.error("[USAGE FINISH] Update error:", err);
              } else {
                console.log("[USAGE FINISH]", usage.txid,
                            "updated:", this.changes);

                if (this.changes === 1 && valid) {
                  calculateUsageEnergy(usage.txid, machine);
                }
              }
            }
          );
        }
      );
    }
  );
}
// ===== USAGE FINISH END =====


  db.run(
    "UPDATE machines SET state='IDLE', reserved_until=NULL WHERE machine=?",
    [machine]
  );
  console.log("Machine Set to IDLE:", machine);
}

if (type === "state" && msg === "IDLE") {
  db.run(
    `UPDATE machines
     SET state='IDLE', reserved_until=NULL
     WHERE machine=?
       AND state != 'RESERVED'`,
    [machine]
  );
}

    if(type === "state" && msg === "RUNNING"){
    db.run(
      "UPDATE machines SET state=? WHERE machine=?",
      ["RUNNING", machine]
    );
    console.log("Machine Set to RUNNING:", machine)
}
    
if(type === "status" && (msg === "ONLINE" || msg === "OFFLINE")){
db.run(
  "UPDATE machines SET status=? WHERE machine=?",
  [msg, machine],
  function(err) {
    if (err) {
      console.log("Status UPDATE ERROR:", err);
      return;
    }

    db.get(
      "SELECT state, status FROM machines WHERE machine=?",
      [machine],
      (err, row) => {
        if (err || !row) return;

        console.log(
          `[MACHINE] ${machine} | STATUS=${row.status} | STATE=${row.state}`
        );
      }
    );
  }
);
}

});

// ===== start server =====
app.listen(3000, ()=>{
    console.log("Server running on port 3000");
});

app.get("/machine-status/:machine", (req, res) => {
  const machine = req.params.machine;

  db.get(
    "SELECT state, status FROM machines WHERE machine = ?",
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
      const available = row.state === "IDLE" && row.status === "ONLINE";
      res.json({
        available,
        state: row.state,
        status: row.status
});
    }
  );
});

app.get("/fix", (req, res) => {
  db.run("DELETE FROM machines WHERE machine IS NULL");
  res.send("fixed");
});


// ===== Multi-Shop: Public Machine List =====
app.get("/shops/:shopId/machines", (req, res) => {
  const shopId = req.params.shopId;

  db.get(
    "SELECT shop_id FROM shops WHERE shop_id = ? AND status = 'ACTIVE'",
    [shopId],
    (err, shop) => {
      if (err) {
        console.error("Shop lookup error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!shop) {
        return res.status(404).json({ error: "Shop not found" });
      }

      db.all(
        `SELECT machine, shop_id, machine_type, model,
                display_name, program_profile, state, status, reserved_until
         FROM machines
         WHERE shop_id = ?
         ORDER BY machine`,
        [shopId],
        (err, rows) => {
          if (err) {
            console.error("Shop machines error:", err);
            return res.status(500).json({ error: "Database error" });
          }

          res.json(rows);
        }
      );
    }
  );
});

app.get("/machines", (req, res) => {
  db.all("SELECT * FROM machines", [], (err, rows) => {
    res.json(rows);
  });
});

// ===== ล้าง reservation ที่หมดอายุอัตโนมัติ =====
setInterval(() => {
  const now = Date.now();

  db.run(
    `UPDATE machines
     SET state = 'IDLE', reserved_until = NULL
     WHERE state = 'RESERVED'
       AND reserved_until IS NOT NULL
       AND reserved_until <= ?`,
    [now],
    function (err) {
      if (err) {
        console.log("Reservation cleanup error:", err);
        return;
      }

      if (this.changes > 0) {
        console.log(`Expired reservation cleared: ${this.changes} machine(s)`);
      }
    }
  );
}, 1000);

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


// ===== รับและบันทึก SMS จาก iPhone =====
const smsToken = require("fs")
  .readFileSync(require("path").join(__dirname, ".sms-token"), "utf8")
  .trim();

db.run(`
  CREATE TABLE IF NOT EXISTS sms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    bank_date TEXT,
    bank_time TEXT,
    receiving_account TEXT,
    amount_satang INTEGER,
    parse_status TEXT NOT NULL DEFAULT 'UNPARSED',
    is_test INTEGER NOT NULL DEFAULT 0
  )
`, (err) => {
  if (err) {
    console.error("[SMS TABLE ERROR]", err.message);
  } else {
    console.log("[SMS] Database table ready");
  }
});


db.run(
  "CREATE UNIQUE INDEX IF NOT EXISTS sms_messages_raw_text_unique ON sms_messages(raw_text)",
  (err) => {
    if (err) console.error("[SMS INDEX ERROR]", err.message);
    else console.log("[SMS] Duplicate protection ready");
  }
);

app.post("/sms-incoming", (req, res) => {
  if (req.get("X-SMS-Token") !== smsToken) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const text = req.body?.text;

  if (typeof text !== "string" || !text.trim() || text.length > 2000) {
    return res.status(400).json({
      ok: false,
      error: "Invalid SMS text"
    });
  }

  const receivedAt = new Date().toISOString();


  const match = text.trim().match(
    /^(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2})\s+บช\s+(X-\d+)\s+เงินเข้า\s+(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\s+คงเหลือ/
  );

  let bankDate = null;
  let bankTime = null;
  let receivingAccount = null;
  let amountSatang = null;
  let parseStatus = "UNRECOGNIZED";

  if (match) {
    const amount =
      Number(match[4].replace(/,/g, "")) * 100 + Number(match[5]);

    if (Number.isSafeInteger(amount) && amount > 0) {
      bankDate = match[1];
      bankTime = match[2];
      receivingAccount = match[3];
      amountSatang = amount;
      parseStatus = receivingAccount === "X-4891"
        ? "PARSED"
        : "ACCOUNT_MISMATCH";
    }
  }

  db.run(
    `INSERT INTO sms_messages (
      received_at, raw_text, bank_date, bank_time,
      receiving_account, amount_satang, parse_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      receivedAt, text, bankDate, bankTime,
      receivingAccount, amountSatang, parseStatus
    ],
    function (err) {
      if (err) {
        
        if (err.code === "SQLITE_CONSTRAINT") {
          return db.get(
            "SELECT id, received_at FROM sms_messages WHERE raw_text = ?",
            [text],
            (lookupErr, row) => {
              if (lookupErr || !row) {
                console.error("[SMS DUPLICATE LOOKUP ERROR]",
                  lookupErr ? lookupErr.message : "Row not found");
                return res.status(500).json({
                  ok: false,
                  error: "SMS duplicate lookup failed"
                });
              }

              console.log("[SMS DUPLICATE] Existing id:", row.id);
              return res.json({
                ok: true,
                duplicate: true,
                id: row.id,
                receivedAt: row.received_at
              });
            }
          );
        }

        console.error("[SMS SAVE ERROR]", err.message);
        return res.status(500).json({
          ok: false,
          error: "SMS save failed"
        });
      }

      console.log("[SMS SAVED]", JSON.stringify({
        id: this.lastID,
        receivedAt,
        text
      }));

      res.json({
        ok: true,
        id: this.lastID,
        receivedAt
      });
    }
  );
});


// ===== API สร้างรายการชำระและจองเครื่อง =====
app.use(
  "/payments",
  require("./payment-bridge.cjs").createSessionRouter()
);


// ===== API รับสลิปและตรวจคู่กับ SMS =====
app.use(
  "/payments",
  require("./payment-slip-api.cjs").createSlipRouter()
);
