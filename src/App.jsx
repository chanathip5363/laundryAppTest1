import { useEffect, useState } from "react";
import mqttClient from "./mqtt/mqttClient";
import { getTempPulse } from "./utils/getTempPulse";
import { getAromaPulse } from "./utils/getAromaPulse";
import { MQTT_TOPICS } from "./constants/mqttTopics";
import { setupMqttHandlers } from "./mqtt/mqttHandlers";
import { calculateTotalPrice } from "./price/priceLogic";
import ServiceSelection from "./components/ServiceSelection";
import WashPriceSelection from "./components/WashPriceSelection";
import Wash20Selection from "./components/Wash20Selection";
import Wash30ProgramSelection from "./components/Wash30ProgramSelection";
import Wash30Options from "./components/Wash30Options";
import {
  tempOptionsMap,
  tempShowOptionsMap,
  aromaOptionsMap,
  programNameMap,
  tempPriceMap,
  tempCycleMap,
  defaultTempMap
} from "./constants/laundryConfig";


function App() {
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("Disconnected");
  const [program, setProgram] = useState(0);
  const [prices, setPrices] = useState({}); // 200369-02 เพิ่ม state เก็บราคา


const [step, setStep] = useState(1);
const [mode, setMode] = useState(null);
const [basePrice, setBasePrice] = useState(0);

const [modeTemp, setModeTemp] = useState(null);

// กำหนดขึ้นมาเพื่อกำหนดค่าอ้างอิงว่ามีทั้งหมด กี่องศา บ้าง
const [tempOption, setTempOption] = useState(null);
// "20" | "30" | "40" | "60" | "90" | null

const [tempShowOption, setTempShowOption] = useState(null);
const [tempShow, setTempShow] = useState(null);

const [aromaOption, setAromaOption] = useState(null);

const [temp, setTemp] = useState(null);
const [spin, setSpin] = useState(null);
const [aroma, setAroma] = useState(null);

const [dry1price, setDry1Prices] = useState({});
const [dry1program, setDry1Program] = useState({});
const [dry2price, setDry2Prices] = useState({});
const [dry2program, setDry2Program] = useState({});

// 220369 15:00 เป็นค่าที่นำมาจากเครื่อง Toshiba 1:ชุดกีฬา 20/30/40 องศา 2:ผ้าขนสัตว์ 20/30/40 องศา 3:ผ้าบอบบาง 20/30/40 องศา 5:ผ้าผสม 20/30/40 องศา
// 7:ผ้าฝ้าย 20/30/40 องศา 8:ผ้าขาว 20/30/40 องศา 9:ซักถนอนสีผ้า 20/30/40 องศา









// 220369 15:00 เป็นการ map ค่าราคาที่เพิ่ม เพื่อให้แสดงในหน้าอุณหภูมิ เพราะเดิมมีแต่ องศา แสดงตาม tempOptionMap
// ซึ่งถ้าเพิ่ม (+ 5 บาท) มันจะเพิ่มทุก องศา จึงใช้วิธีนี้และใช้โค้ด °C (+ {tempPriceMap[temp]} บาท)


const [programPrice, setProgramPrice] = useState(0);

const STEP_QR = 99;

const getTotalPrice = () => {

  return calculateTotalPrice({
    programPrice,
    tempOption,
    aromaOption,
    tempPriceMap
  });

};

 const checkMachineBeforePay = async () => {
  try {
    const res = await fetch("http://localhost:3000/request-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ machine: "machine1" }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "เครื่องไม่ว่าง");
      return false;
    }

    return true;

  } catch (err) {
    console.error(err);
    alert("⚠️ เชื่อมต่อ server ไม่ได้");
    return false;
  }
};


 const generateQR = () => {
  const amount = getTotalPrice() || 0;

  const phone = "0909890860"; // 👈 ใส่เบอร์คุณตรงนี้

  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://promptpay.io/${phone}/${amount}`;
};

const resetOptions = () => {  // เพื่อคืนค่าราคาเป็น 0 บาท ตอนย้อนกลับ
  setTempOption(null); 
  setAromaOption(null);
  setProgramPrice(0);
};


const buildCommand = () => {
  return {
    program: program,
    tempPulse: getTempPulse(program, tempOption),
    aromaPulse: getAromaPulse(aromaOption)
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
      9: 0,   // setProgram 9
      10: null 
    };
  

const [tempSelected, setTempSelected] = useState(null);
const [aromaSelected, setAromaSelected] = useState(null);


// แก้ MQTT Disconnected โดยต้ดเอา UseEffect มาอยู่ก่อน return




  useEffect(() => {

    const mqtt = mqttClient;   
    mqtt.on("connect", () => {
      console.log("MQTT Connected");
      setStatus("Connected");

      mqtt.subscribe(MQTT_TOPICS.MACHINE1.STATE);
      mqtt.subscribe(MQTT_TOPICS.MACHINE1.STATUS);
    });

    mqtt.on("message", (topic, message) => {
      console.log(topic + ":" + message.toString());
    });

    mqtt.on("error", (err) => {
      console.log("MQTT error:", err);
    });

    setClient(mqtt);

    return () => {
  // ไม่ต้องปิด mqttClient เพราะใช้ร่วมกันทั้งโปรแกรม
};

    // return () => {
    //   mqtt.end();
    // };
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
        tempPulse: getTempPulse(program, tempOption),        
        aromaPulse: getAromaPulse(aromaOption),         
        amount
      });

      const res = await fetch("http://localhost:3000/webhook", {     
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          txid,
          machine,
          amount, 
          program,
          tempPulse: getTempPulse(program, tempOption),
          aromaPulse: getAromaPulse(aromaOption)          
        })
      });

      console.log("webhook status =", res.status, "txid =", txid);
    } catch (err) {
      console.log("Webhook error:", err);
    }
  };

  const finishWash = () => {
    if (client) {
      client.publish(MQTT_TOPICS.MACHINE1.FINISH, "done");
      console.log("Finish pressed");
      setStep(1);
      setMode(null);
    }

client.subscribe(MQTT_TOPICS.MACHINE1.FINISH);

setupMqttHandlers(client, {
  finishWash
});

  };




  

  return (

  <div style={{ padding: "40px" }}>
    <h1>Smart Laundry</h1>

    <p>MQTT Status : {status}</p>

{/* STEP 1 */}
{step === 1 && (
  <>
    <ServiceSelection
      onSelectWash={() => {
        setMode("wash");
        setStep(2);
      }}
      onSelectDry={() => {
        setMode("dry");
        setStep(3);
      }}
    />

    <br />
    <button onClick={finishWash}>ซักเสร็จ</button>
  </>
)}

{/* STEP 2 */}
{step === 2 && (
  <WashPriceSelection
    onSelect20={() => {
      setPrices(20);
      setStep(2_1);
    }}

    onSelect30={() => {
      setPrices(30);
      setStep(2_2);
    }}

    onSelect50={() => {
      setPrices(50);
      setStep(2_3);
      setProgram(10);
      setProgramPrice(50);
    }}

    onBack={() => setStep(1)}
  />
)}

{/* STEP 2_1 */}
{step === 2_1 && (
  <Wash20Selection
    program={program}
    programNameMap={programNameMap}
    getTotalPrice={getTotalPrice}
    setProgram={setProgram}
    setProgramPrice={setProgramPrice}
    setSpin={setSpin}
    setAroma={setAroma}
    resetOptions={resetOptions}
    setStep={setStep}
    buildCommand={buildCommand}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
)}


{/* STEP 2_2 */}
{step === 2_2 && (
  <Wash30ProgramSelection
    programNameMap={programNameMap}
    setProgram={setProgram}
    setProgramPrice={setProgramPrice}
    setStep={setStep}
    resetOptions={resetOptions}
  />
)}

{/* STEP 2_2_1 (ซัก) */}
{step === 2_2_1 && mode === "wash" && (
  <Wash30Options
    program={program}
    programNameMap={programNameMap}
    tempOption={tempOption}
    setTempOption={setTempOption}
    tempOptionsMap={tempOptionsMap}
    tempShowOptionsMap={tempShowOptionsMap}
    tempPriceMap={tempPriceMap}
    aromaOption={aromaOption}
    setAromaOption={setAromaOption}
    aromaOptionsMap={aromaOptionsMap}
    getTotalPrice={getTotalPrice}
    resetOptions={resetOptions}
    setProgram={setProgram}
    setStep={setStep}
    buildCommand={buildCommand}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
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

  {/* <p>
    🌡️ อุณหภูมิ:{" "}
    <b>{tempOption ? tempOption + "°C" : "ปกติ"}</b>
  </p> */}

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getTotalPrice()} บาท
  </h2>
</div>

        {/* <button onClick={() => {
          setProgram(10);
          setProgramPrice(50); 
        }}>ซักอบไอน้ำ</button>      คัดลอกคำสั่งไปไว้ตรงราคา 50 บาท แล้ว*/}

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
// onClick={() => {
//   const cmd = buildCommand();
//   console.log(cmd);

//   if(!program){
//     alert("กรุณาเลือกโปรแกรม");
//     return;
//   }
//   if (!window.confirm(`ยืนยันชำระ ${getTotalPrice()} บาท ?`)) 
//     return;
//   //TODO ยิง MQTT หรือไปหน้า QR
//     setStep(STEP_QR);
//   // client.publish("laundry/cmd", JSON.stringify(cmd));
// }}>

onClick={async () => {
  const cmd = buildCommand();
  console.log(cmd);

  if (!program) {
    alert("กรุณาเลือกโปรแกรม");
    return;
  }

  if (!window.confirm(`ยืนยันชำระ ${getTotalPrice()} บาท ?`)) {
    return;
  }

  // ✅ เพิ่มตรงนี้
  const ok = await checkMachineBeforePay();
  if (!ok) return;

  // ✅ ของเดิม
  setStep(STEP_QR);
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
