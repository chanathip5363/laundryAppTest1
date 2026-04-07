const express = require("express");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const sqlite3 = require("sqlite3").verbose();

const cors = require("cors")

const app = express();
app.use(cors());

const usedTx = new Set();
app.use(bodyParser.json());

// ✅ เพิ่มตรงนี้
app.get('/prices', (req, res) => {
  res.json({
    1: 20,
    2: 30,
    3: 40
  });
});

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
    state TEXT
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