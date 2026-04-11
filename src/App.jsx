import { useEffect, useState } from "react";
import mqtt from "mqtt";

const broker = "wss://1f987687489a42f296be8b2579cd71f5.s1.eu.hivemq.cloud:8884/mqtt";

const options = {
  username: "ESP32",
  password: "Laundry123",
  reconnectPeriod: 1000
};

function App() {
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("Disconnected");
  const [program, setProgram] = useState(0);
  const [prices, setPrices] = useState({}); // 200369-02 เพิ่ม state เก็บราคา



const [step, setStep] = useState(1);
const [mode, setMode] = useState(null);
const [basePrice, setBasePrice] = useState(0);

// กำหนดขึ้นมาเพื่อกำหนดค่าอ้างอิงว่ามีทั้งหมด กี่องศา บ้าง
const [tempOption, setTempOption] = useState(null);
// "20" | "30" | "40" | "60" | "90" | null

const [aromaOption, setAromaOption] = useState(false);

const [temp, setTemp] = useState(null);
const [spin, setSpin] = useState(null);
const [aroma, setAroma] = useState(null);

const [dry1price, setDry1Prices] = useState({});
const [dry1program, setDry1Program] = useState({});
const [dry2price, setDry2Prices] = useState({});
const [dry2program, setDry2Program] = useState({});

// 220369 15:00 เป็นค่าที่นำมาจากเครื่อง Toshiba 1:ชุดกีฬา 20/30/40 องศา 2:ผ้าขนสัตว์ 20/30/40 องศา 3:ผ้าบอบบาง 20/30/40 องศา 5:ผ้าผสม 20/30/40 องศา
// 7:ผ้าฝ้าย 20/30/40 องศา 8:ผ้าขาว 20/30/40 องศา 9:ซักถนอนสีผ้า 20/30/40 องศา
const tempOptionsMap = {
  1: ["30", "40"],   // step จริง ["20", "30", "40"]
  2: ["30", "40"],   // step จริง ["20", "30", "40"]
  3: ["30", "40"],   // step จริง ["20", "30", "40"]
  4: ["30", "40", "60"],   // step จริง ["20", "30", "40", "60"]  
  5: ["30", "40", "60"],   // step จริง ["20", "30", "40", "60"]
  6: ["30", "40"],   // step จริง ["20", "30", "40"]  
  7: ["30", "40", "60", "90"],   // step จริง ["20", "30", "40", "60", "90"]
  8: ["30", "40", "60"],   // step จริง ["20", "30", "40", "60"]
  // 9: ["20"] เอาออกเพราะเพิ่ม 20 องศา ก็เหมือนไม่เพิิ่ม ไม่ควรคิดเงิน
};

const programNameMap = {
  0:  null,
  1: "ชุดกีฬา",
  2: "ผ้าขนสัตว์",
  3: "ผ้าบอบบาง",
  4: "ซักแบบประหยัด",
  5: "ผ้าผสม 45 นาที",
  6: "ซักด่วน 15 นาที",
  7: "ผ้าฝ้าย",
  8: "ผ้าขาว",
  9: "ซักถนอมสีผ้า",
  10: "ซักอบไอน้ำ"
}

// 220369 15:00 เป็นการ map ค่าราคาที่เพิ่ม เพื่อให้แสดงในหน้าอุณหภูมิ เพราะเดิมมีแต่ องศา แสดงตาม tempOptionMap
// ซึ่งถ้าเพิ่ม (+ 5 บาท) มันจะเพิ่มทุก องศา จึงใช้วิธีนี้และใช้โค้ด °C (+ {tempPriceMap[temp]} บาท)
const tempPriceMap = {
  "20": 3,
  "30": 4,
  "40": 8,
  "60": 15,
  "90": 20
};

const tempCycleMap = {
  1: ["20", "20", "30", "40", "normal"],
  2: ["40", "40", "normal", "20", "30"],
  3: ["30", "30", "40", "normal", "20"],
  4: ["30", "30", "40", "60", "normal", "20"],
  5: ["30", "30", "40", "60", "normal", "20"],
  6: ["normal", "normal", "20", "30", "40"],
  7: ["40", "40", "60", "90", "normal", "20", "30"],
  8: ["30", "30", "40", "60", "normal", "20"],
  9: ["normal", "normal"]
};

const defaultTempMap = {
  1: "20",
  2: "40",
  3: "30",
  4: "30",
  5: "30",
  6: "normal",
  7: "40",
  8: "30",
  9: "normal"
};

const getTempPulse = () => {
  const cycle = tempCycleMap[program] || [];
  const current = defaultTempMap[program];

  // ถ้าไม่เลือก temp → target = normal
  const target = tempOption || "normal";

  let count = 0;
  let i = cycle.indexOf(current);

  while (cycle[i] !== target) {
    i = (i + 1) % cycle.length;
    count++;
  }

  return count;
};

const [programPrice, setProgramPrice] = useState(0);

const STEP_QR = 99;

 const getTotalPrice = () => {
  console.log("programPrice : ", programPrice);
  let total = 0;
  if(programPrice) total += programPrice;
 // ราคาหลักของโปรแกรม

  if (tempOption) {
    total += tempPriceMap[tempOption] ?? 0;
  }

  if (aromaOption) {
    total += 5;
  }
  console.log("totalPrice : ", total);  
  return total;
};

 const generateQR = () => {
  const amount = getTotalPrice() || 0;

  const phone = "0909890860"; // 👈 ใส่เบอร์คุณตรงนี้

  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://promptpay.io/${phone}/${amount}`;
};

const resetOptions = () => {  // เพื่อคืนค่าราคาเป็น 0 บาท ตอนย้อนกลับ
  setTempOption(null); 
  setAromaOption(false);
  setProgramPrice(0);
};


const getAromaPulse = () => {
  return aromaOption ? 1 : 0;
};

const buildCommand = () => {
  return {
    program: program,
    // tempPulse: getTempPulse(),
    aromaPulse: getAromaPulse()
  };
};

const startTempMap = {    // จำนวนพัลส์ให้กลับไปเริ่ม 0 องศา
      1: 3,  // setProgram 1
      2: 1,  // setProgram 2      
      3: 2,  // setProgram 3
      4: 3,  // setProgram 4      
      5: 3,  // setProgram 5
      6: 0,  // setProgram 6      
      7: 3,  // setProgram 7
      8: 3,  // setProgram 8            
      9: 0   // setProgram 9 
    };

// const getTempPulse = () => {
//   if (!tempOption) return 0;

//   const options = tempOptionsMap[program] || [];
//   const index = options.indexOf(tempOption);

//   if (index === -1) return 0;

//   return startTempMap[program] + index;
// };    

const [tempSelected, setTempSelected] = useState(null);
const [aromaSelected, setAromaSelected] = useState(null);


// แก้ MQTT Disconnected โดยต้ดเอา UseEffect มาอยู่ก่อน return




  useEffect(() => {

    fetch("https://laundry-server-me68.onrender.com/prices")
      .then(res => res.json())
      .then(data => {
        console.log("Prices", data);
        setPrices(data);
      });

    const mqttClient = mqtt.connect(broker, options);   
    mqttClient.on("connect", () => {
      console.log("MQTT Connected");
      setStatus("Connected");

      mqttClient.subscribe("laundry/machine1/state");
      mqttClient.subscribe("laundry/machine1/status");
    });

    mqttClient.on("message", (topic, message) => {
      console.log(topic + ":" + message.toString());
    });

    mqttClient.on("error", (err) => {
      console.log("MQTT error:", err);
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, []);

  const confirmWash = async () => {
    try {
      // ทดสอบกันซ้ำ:
      // - ถ้าจะทดสอบให้กดซ้ำแล้วโดนกัน ใช้ txid คงที่ เช่น "TX001"
      // - ถ้าใช้งานจริงค่อยเปลี่ยนเป็น Date.now() หรือ id จาก payment gateway
      const txid = "TX" + Date.now();

      const machine = "machine1";
      // const priceMap = {
      //   1: 15,
      //   2: 15,
      //   3: 20,
      //   4: 20,
      //   5: 25,
      //   6: 25,
      //   7: 30,
      //   8: 30,
      //   9: 35,
      //   10: 35,
      //   11: 40,
      //   12: 40,
      //   13: 50,
      //   14: 50
      // };
      const amount = getTotalPrice();// เดิม = priceMap[program];  // ก่อนหน้าใช้โค้ด const amount = priceMap[program] || 40; หมายถึง ถ้าไม่มีค่าใน mapPrice ใช้ค่า default นี้คือ 40
      // if(!amount){
      //   alert("โปรแกรมนี้ยังไม่ตั้งราคา");  // if นี้ ทำใหม่อีกแบบเลยคือยกเลิก default 40 เป็นว่าถ้ายังไม่กำหนดราคาก็ขึ้น "โปรแกรมนี้ยังไม่ตั้งราคา"
      //   return;
      // }

      console.log("Send webhook:", {
        txid,
        machine,
        program,
          tempPulse: getTempPulse(),        
        aromaPulse: getAromaPulse(),         
        amount
      });

      const res = await fetch("https://laundry-server-me68.onrender.com/webhook", {     // http://localhost:3000/webhook
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          txid,
          machine,
          amount, 
          program,
          tempPulse: getTempPulse(),
          aromaPulse: getAromaPulse()          
        })
      });

      console.log("webhook status =", res.status, "txid =", txid);
    } catch (err) {
      console.log("Webhook error:", err);
    }
  };

  const finishWash = () => {
    if (client) {
      client.publish("laundry/machine1/finish", "done");
      console.log("Finish pressed");
      setStep(1);
      setMode(null);
    }

client.subscribe("laundry/machine1/finish");

client.on("message", (topic, message) => {
  if (topic === "laundry/machine1/finish") {
    console.log("Finish from ESP");

    finishWash();
  }
});

  };




  

  return (

  <div style={{ padding: "40px" }}>
    <h1>Smart Laundry</h1>

    <p>MQTT Status : {status}</p>

    {/* STEP 1 */}
    {step === 1 && (
      <>
        <h2>เลือกประเภท</h2>
        <button onClick={() => {
          setMode("wash");
          setStep(2);
        }}>ซัก</button>

        <button onClick={() => {
          setMode("dry");
          setStep(3);
        }}>อบ</button>

        <br/>
        <button onClick={finishWash}>ซักเสร็จ</button>        

      </>
    )}

    {/* STEP 2 */}
    {step === 2 && (
      <>
        <h2>เลือกราคา</h2>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setPrices(20);
          setStep(2_1);
        }}>20 บาท</button>
   </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br />
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - ซักด่วน 15 นาที <br />    
    - ซักแบบประหยัด 0:57</h4>
   </div>
  </div>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setPrices(30);
          setStep(2_2);
        }}>30 บาท</button>
      </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - ชุดกีฬา 0:45<br/>
    - ผ้าขนสัตว์ 1:07<br/>
    - ผ้าบอบบาง 0:50<br/>
    - ผ้าผสม 45 นาที 0:45<br/>
    - ผ้าฝ้าย 1:18<br/>
    - ผ้าขาว 1:09<br/>
    - ซักถนอมผ้า 1:03<br/>                
    </h4>
   </div>
  </div>

        
<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {     
          setPrices(50);          
          setStep(2_3);
        }}>50 บาท</button>
      </div>
<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - ซักอบด้วยไอน้ำ 2:39<br/>
    - เพื่อการแทรกซึมเข้าใยเนื้อผ้า<br/>
    - เพิ่มประสิทธิภาพในการกำจัดเชื้อโรค<br/>
    </h4>
    </div>
  </div>

        <br /><br />
        <button onClick={() => setStep(1)}>ย้อนกลับ</button>
      </>
    )}

    {/* STEP 2_1 */}
    {step === 2_1 && (
      <>
<h2 style={{marginBottom: "10px"}}>
  {programNameMap[program] ?? "เลือกโปรแกรมซัก"}
</h2>

 <div style={{
  border: "1px solid #e5e7eb",
  padding: "20px",
  borderRadius: "16px",
  marginBottom: "20px",
  background: "#ffffff",
  boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
}}>
  <h3 style={{ marginBottom: "10px" }}>🧾 สรุปรายการ</h3>

  <p>🧺 โปรแกรม: <b>{programNameMap[program] ?? "-"}</b></p>

  <p>
    🌡️ อุณหภูมิ:{" "}
    <b>{tempOption ? tempOption + "°C" : "ปกติ"}</b>
  </p>

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getTotalPrice()} บาท
  </h2>
</div>

        <button onClick={() => {
          setProgram(4);
          setProgramPrice(20);
          setSpin(0);
          setAroma(0);
        }}>ซักแบบประหยัด</button>

        <button onClick={() => {
          setProgram(6);
          setProgramPrice(20);
          setSpin(0);
          setAroma(0);          
        }}>ซักด่วน 15 นาที</button>

        <br/>
        <button onClick={() => {
          resetOptions();   // เป็นการรีเซ็ทราคาให้เป็น  0 บาท ก่อน เพื่อไม่ให้สับสน ราคาติดกับของเดิมที่ไปเลือกก่อนหน้า
          setProgram(0);
          setStep(2)}}>ย้อนกลับ</button>

<button 
  style={{
  width: "100%",
  padding: "15px",
  fontSize: "18px",
  background: "#22c55e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  marginTop: "10px"
}}
onClick={() => {
  const cmd = buildCommand();
  console.log(cmd);

  if(!program){
    alert("กรุณาเลือกโปรแกรม");
    return;
  }
  if (!window.confirm(`ยืนยันชำระ ${getTotalPrice()} บาท ?`)) 
    return;
  //TODO ยิง MQTT หรือไปหน้า QR
    setStep(STEP_QR);
  // client.publish("laundry/cmd", JSON.stringify(cmd));
}}>
  ยืนยันและชำระเงิน</button>

      </>
    )}

    {/* STEP 2_2 */}
    {step === 2_2 && (
      <>
        <h2>เลือกโปรแกรม</h2>

        <button onClick={() => {
          setProgram(1);
          setProgramPrice(30);
          setStep(2_2_1);
        }}>ชุดกีฬา</button>

        <button onClick={() => {
          setProgram(2);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ผ้าขนสัตว์</button>

        <button onClick={() => {
          setProgram(3);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ผ้าบอบบาง</button>

        <button onClick={() => {
          setProgram(5);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ผ้าผสม 45 นาที</button>

        <button onClick={() => {
          setProgram(7);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ผ้าฝ้าย</button>

        <button onClick={() => {
          setProgram(8);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ผ้าขาว</button>

        <button onClick={() => {
          setProgram(9);
          setProgramPrice(30);          
          setStep(2_2_1);
        }}>ซักถนอมสีผ้า</button>                        

        <br />
        <button onClick={() => {
          resetOptions();           
          setProgram(0);          
          setStep(2)}}>ย้อนกลับ</button>
      </>
    )}

    {/* STEP 2_2_1 (ซัก) */}
    {step === 2_2_1 && mode === "wash" && (
      <>
<h2 style={{marginBottom: "10px"}}>
  {programNameMap[program] ?? ""}
</h2>

 <div style={{
  border: "1px solid #e5e7eb",
  padding: "20px",
  borderRadius: "16px",
  marginBottom: "20px",
  background: "#ffffff",
  boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
}}>
  <h3 style={{ marginBottom: "10px" }}>🧾 สรุปรายการ</h3>

  <p>🧺 โปรแกรม: <b>{programNameMap[program] ?? "-"}</b></p>

  <p>
    🌡️ อุณหภูมิ:{" "}
    <b>{tempOption ? tempOption + "°C" : "ปกติ"}</b>
  </p>

  <p>
    🌸 Aroma: <b>{aromaOption ? "เพิ่ม" : "ไม่ใช้"}</b>
  </p>

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getTotalPrice()} บาท
  </h2>
</div>

{/* 🔥 อุณหภูมิ (เลือกได้ตัวเดียว) */}
<div style={{ marginBottom: "15px" }}>
  <h4>🌡️ เพิ่มอุณหภูมิ</h4>
  {/* checkbox */}
</div>

{tempOptionsMap[program]?.map((temp) => (
  <label 
  style={{
  display: "block",
  padding: "8px",
  borderRadius: "8px",
  background: tempOption === temp ? "#e0f2fe" : "transparent"
}}
key={temp}>
    <input
      type="checkbox"
      checked={tempOption === temp}
      onChange={() =>
        setTempOption(tempOption === temp ? null : temp)
      }
    />
    {temp}°C (+ {tempPriceMap[temp] ?? 0} บาท)  {/*// เดิม {temp}°C (+ {tempPriceMap[temp]} บาท) แต่ใส่ ?? 0 เพิ่มกันพลาดเผื่อไม่มีราคา*/}
  </label>
))}
<br />

{/* 🔥 Aroma (อิสระ) */}
<h3>เพิ่มความหอม</h3>

<label>
  <input
    type="checkbox"
    checked={aromaOption}
    onChange={() => {
      setAromaOption(!aromaOption);
      setAroma(1);      
    }}/>เพิ่ม Aroma (+5 บาท)
</label>
        <br/>
        <button onClick={() => {
          resetOptions();
          setProgram(0);                    
          setStep(2_2)}}>ย้อนกลับ</button>

      {/*  <button onClick={() => setStep(6)}>ต่อไป</button> */}

<button 
  style={{
  width: "100%",
  padding: "15px",
  fontSize: "18px",
  background: "#22c55e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  marginTop: "10px"
}}
onClick={() => {
  const cmd = buildCommand();
  console.log(cmd);

  if(!program){
    alert("กรุณาเลือกโปรแกรม");
    return;
  }
  if (!window.confirm(`ยืนยันชำระ ${getTotalPrice()} บาท ?`)) 
    return;
    //TODO ยิง MQTT หรือไปหน้า QR
    setStep(STEP_QR);
  // client.publish("laundry/cmd", JSON.stringify(cmd));
}}>
  ยืนยันและชำระเงิน</button>

      </>
    )}

    {/* STEP 2_3 */}
    {step === 2_3 && (
      <>
<h2 style={{marginBottom: "10px"}}>
  {programNameMap[program] ?? "เลือกโปรแกรมซัก"}
</h2>

 <div style={{
  border: "1px solid #e5e7eb",
  padding: "20px",
  borderRadius: "16px",
  marginBottom: "20px",
  background: "#ffffff",
  boxShadow: "0 4px 10px rgba(0,0,0,0.05)"
}}>
  <h3 style={{ marginBottom: "10px" }}>🧾 สรุปรายการ</h3>

  <p>🧺 โปรแกรม: <b>{programNameMap[program] ?? "-"}</b></p>

  <p>
    🌡️ อุณหภูมิ:{" "}
    <b>{tempOption ? tempOption + "°C" : "ปกติ"}</b>
  </p>

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getTotalPrice()} บาท
  </h2>
</div>

        <button onClick={() => {
          setProgram(10);
          setProgramPrice(50); 
        }}>ซักอบไอน้ำ</button>

        <br/>
        <button onClick={() => {
          resetOptions();
          setProgram(0);                    
          setStep(2)}}>ย้อนกลับ</button>

<button 
  style={{
  width: "100%",
  padding: "15px",
  fontSize: "18px",
  background: "#22c55e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  marginTop: "10px"
}}
onClick={() => {
  const cmd = buildCommand();
  console.log(cmd);

  if(!program){
    alert("กรุณาเลือกโปรแกรม");
    return;
  }
  if (!window.confirm(`ยืนยันชำระ ${getTotalPrice()} บาท ?`)) 
    return;
  //TODO ยิง MQTT หรือไปหน้า QR
    setStep(STEP_QR);
  // client.publish("laundry/cmd", JSON.stringify(cmd));
}}>
  ยืนยันและชำระเงิน</button>

      </>
    )}

    {/* STEP 3 */}
    {step === 3 && (
      <>
        <h2>เลือกระบบ</h2>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setProgram(4);
          setStep(3_1);
        }}>ลมร้อน</button>      </div>
<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - น้ำหนักผ้า 7-8 กก.<br/>
    - ระบบลมร้อนใช้อุณหภูมิสูงในการอบผ้า<br/>
    - เพื่อใหีประสิทธิภาพดีที่สุด ควรตรวจสอบกรองอากาศ ก่อนเริ่มใช้งาน<br/>
    - ระยะเวลาที่แสดงหน้าจอตอนเริ่มทำงาน ~3:30 ชม. แต่ทำงานจริง ~80 ถึง 100 นาที<br/>
    - เพราะว่าระบบมีการตรวจจับความชื้นอยู่เป็นระยะ จึงมีการคำนวณเวลาเสร็จอยู่ตลอด<br/>           
    </h4>
    </div>
  </div>        

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setProgram(4);
          setStep(3_2);
        }}>Heat Pump</button>
      </div>
<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - น้ำหนักผ้า 7-8 กก.<br/>
    - อบด้วยระบบควบแน้นที่อุณหภูมิต่ำ จึงช่วยถนอมผ้ามากขึ้น<br/>
    - เพื่อใหีประสิทธิภาพดีที่สุด ควรตรวจสอบกรองอากาศ ก่อนเริ่มใช้งาน<br/>
    - ระยะเวลา ~80 ถึง 120 นาที<br/>
    </h4>
    </div>
  </div>        
   
    {/* <br /> */}
        <button onClick={() => {
          resetOptions();  
          setProgram(0);                  
          setStep(1)}}>ย้อนกลับ</button>

      </>
    )}

    {/* STEP 3_1 */}
    {step === 3_1 && (
      <>
        <h2>เลือกราคา</h2>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry1Prices(25);
          setDry1Program(1);
        }}>25 บาท</button>
   </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br />
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - Fast Dry 30 นาที <br />    
    - ผ้าเนื้อบาง</h4>
   </div>
  </div>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry1Prices(35);
          setDry1Program(2);
        }}>35 บาท</button>
      </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - Fast Dry 30 นาที <br />    
    - ผ้าเนื้อบาง</h4>
    </div>
  </div>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry1Prices(45);
          setDry1Program(3);
        }}>45 บาท</button>
      </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - Fast Dry 30 นาที <br />    
    - ผ้าเนื้อบาง</h4>
    </div>
  </div>        

        <br />
        <button onClick={() => {
          resetOptions();
          setProgram(0);                    
          setStep(3)}}>ย้อนกลับ</button>
        <button onClick={() => setStep(6)}>ต่อไป</button>              
      </>
    )}    

    {/* STEP 3_2 */}
    {step === 3_2 && (
      <>
        <h2>เลือกราคา</h2>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry2Prices(40);
          setDry2Program(1);
        }}>40 บาท</button>
   </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br />
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - ซักด่วน 15 นาที <br />    
    - ซักแบบประหยัด</h4>
   </div>
  </div>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry2Prices(50);
          setDry2Program(2);
        }}>50 บาท</button>
      </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - Fast Dry 30 นาที <br />    
    - ผ้าเนื้อบาง</h4>
    </div>
  </div>

<div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
{/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
        <button onClick={() => {
          setDry2Prices(60);
          setDry2Program(3);
        }}>60 บาท</button>
      </div>

<div style={{ marginBottom: "10px" }}>
<h4>รายละเอียด<br/>
    - จำนวนผ้า 2 กก. หรือ 15 ชิ้น <br />
    - Fast Dry 30 นาที <br />    
    - ผ้าเนื้อบาง</h4>
    </div>
  </div>

        <br />
        <button onClick={() => setStep(3)}>ย้อนกลับ</button>
        <button onClick={() => setStep(6)}>ต่อไป</button>              
      </>
    )}    


{step === STEP_QR && (
  <>
    <h2>ชำระเงิน</h2>

    <img
      src={generateQR()}
      alt="QR"
      style={{ width: "250px" }}
    />

    <h2>{getTotalPrice()} บาท</h2>

    <button onClick={() => {
      alert("ชำระเงินสำเร็จ (จำลอง)");
      setProgram(0);
      setStep(1);
      setProgramPrice(0);
      resetOptions();
      confirmWash();
    }}>
      จำลองจ่ายแล้ว
    </button>
    
  </>
)}

  </div>

  );
}

export default App;
