"const express = require(""express"");
const bodyParser = require(""body-parser"");
const mqtt = require(""mqtt"");
const sqlite3 = require(""sqlite3"").verbose();

const app = express();
app.use(bodyParser.json());

// ===== MQTT =====
const client = mqtt.connect(""mqtt://broker.hivemq.com"");

client.on(""connect"", () => {
    console.log(""MQTT connected"");
});

// ===== DATABASE =====
const db = new sqlite3.Database(""./database.db"");

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
    db.get(""SELECT state FROM machines WHERE machine=?"", [machine], (err,row)=>{
        if(err || !row){
            return callback(false);
        }
        callback(row.state === ""RUNNING"");
    });
}

// ===== webhook จาก payment =====
app.post(""/webhook"", (req,res)=>{

    const { txid, machine, amount, program } = req.body;

    console.log(""Payment received:"", txid);

    // 1. กัน tx ซ้ำ
    db.get(""SELECT * FROM transactions WHERE txid=?"", [txid], (err,row)=>{
        if(row){
            console.log(""Duplicate TXID -> ignore"");
            return res.sendStatus(200);
        }

        // 2. เช็คเครื่องว่าง
        isMachineRunning(machine, (running)=>{

            if(running){
                console.log(""Machine busy -> reject payment"");

                db.run(
                  ""INSERT INTO transactions VALUES (?,?,?,?)"",
                  [txid, machine, amount, ""REJECTED""]
                );

                return res.sendStatus(200);
            }

            // 3. บันทึก transaction
            db.run(
              ""INSERT INTO transactions VALUES (?,?,?,?)"",
              [txid, machine, amount, ""SUCCESS""]
            );

            // 4. อัพเดทเครื่องเป็น RUNNING
            db.run(
              ""INSERT OR REPLACE INTO machines VALUES (?,?)"",
              [machine, ""RUNNING""]
            );

            // 5. ส่งไป ESP
            const payload = JSON.stringify({
                txid: txid,
                program: program
            });

            client.publish(`laundry/${machine}/start`, payload);

            console.log(""Start machine:"", machine);

            res.sendStatus(200);
        });
    });
});

// ===== รับ status จาก ESP =====
client.subscribe(""laundry/+/status"");

client.on(""message"", (topic, message)=>{

    const msg = message.toString();
    const machine = topic.split(""/"")[1];

    console.log(""Status:"", machine, msg);

    if(msg === ""FINISH""){
        db.run(
          ""UPDATE machines SET state=? WHERE machine=?"",
          [""IDLE"", machine]
        );
    }
});

// ===== start server =====
app.listen(3000, ()=>{
    console.log(""Server running on port 3000"");
});"