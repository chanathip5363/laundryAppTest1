import { useEffect, useState } from "react";
import mqttClient from "./mqtt/mqttClient";
import { getTempPulse } from "./utils/getTempPulse";
import { getAromaPulse } from "./utils/getAromaPulse";
import { MQTT_TOPICS } from "./constants/mqttTopics";
import { setupMqttHandlers } from "./mqtt/mqttHandlers";
import { calculateTotalPrice } from "./price/priceLogic";
import { calculateDryTotalPrice } from "./price/dryPriceLogic";
import ServiceSelection from "./components/ServiceSelection";
import WashPriceSelection from "./components/WashPriceSelection";
import Wash20Selection from "./components/Wash20Selection";
import Wash30ProgramSelection from "./components/Wash30ProgramSelection";
import Wash30Options from "./components/Wash30Options";
import Wash50Selection from "./components/Wash50Selection";
import Dry1Selection from "./components/Dry1Selection";
import Dry1Options from "./components/Dry1Options";
import Dry2Selection from "./components/Dry2Selection";
import Dry2Options from "./components/Dry2Options";
import Dry3Selection from "./components/Dry3Selection";
import Dry3Options from "./components/Dry3Options";
import WashMachineSelection from "./components/WashMachineSelection";
import DryMachineSelection from "./components/DryMachineSelection";
import QRPayment from "./components/QRPayment";
import DrySelection from "./components/DrySelection";
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
const [selectedMachine, setSelectedMachine] = useState(null);
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
const [dry3price, setDry3Prices] = useState({});
const [dry3program, setDry3Program] = useState({});

const [dry1TemperatureOption, setDry1TemperatureOption] = useState(null);
const [dry1WrinkleOption, setDry1WrinkleOption] = useState(false);

const [dry2TemperatureOption, setDry2TemperatureOption] = useState(null);
const [dry2WrinkleOption, setDry2WrinkleOption] = useState(false);

const [dry3TemperatureOption, setDry3TemperatureOption] = useState(null);
const [dry3WrinkleOption, setDry3WrinkleOption] = useState(false);

const getDry1TotalPrice = () => {
  return calculateDryTotalPrice({
    basePrice: dry1price,
    temperatureOption: dry1TemperatureOption,
    wrinkleOption: dry1WrinkleOption,
  });
};

const getDry2TotalPrice = () => {
  return calculateDryTotalPrice({
    basePrice: dry2price,
    temperatureOption: dry2TemperatureOption,
    wrinkleOption: dry2WrinkleOption,
  });
};

const getDry3TotalPrice = () => {
  return calculateDryTotalPrice({
    basePrice: dry3price,
    temperatureOption: dry3TemperatureOption,
    wrinkleOption: dry3WrinkleOption,
  });
};

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
      body: JSON.stringify({ machine: selectedMachine }),
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

      const machine = selectedMachine;
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
        setSelectedMachine(null);
        setStep(1_1);
      }}
      onSelectDry={() => {
        setMode("dry");
        setSelectedMachine(null);
        setStep(1_2);
      }}
    />

    <br />
    <button onClick={finishWash}>ซักเสร็จ</button>
  </>
)}

{/* STEP 1_1 */}
{step === 1_1 && (
  <WashMachineSelection
    selectedMachine={selectedMachine}
    setSelectedMachine={setSelectedMachine}
    setStep={setStep}
  />
)}

{/* STEP 1_2 */}
{step === 1_2 && (
  <DryMachineSelection
    selectedMachine={selectedMachine}
    setSelectedMachine={setSelectedMachine}
    setStep={setStep}
  />
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

    onBack={() => setStep(1_1)}
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
  <Wash50Selection
    program={program}
    programNameMap={programNameMap}
    getTotalPrice={getTotalPrice}
    resetOptions={resetOptions}
    setProgram={setProgram}
    setStep={setStep}
    buildCommand={buildCommand}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
)}
{/* STEP 3 */}
{step === 3 && (
  <DrySelection
    resetOptions={resetOptions}
    setProgram={setProgram}
    setStep={setStep}
  />
)}

{/* STEP 3_1 */}
{step === 3_1 && (
  <Dry1Selection
    setDry1Prices={setDry1Prices}
    setDry1Program={setDry1Program}
    resetOptions={resetOptions}
    setProgram={setProgram}
    setStep={setStep}
  />
)}

{/* STEP 3_1_1 */}
{step === 3_1_1 && (
  <Dry1Options
    dry1price={dry1price}
    dry1TemperatureOption={dry1TemperatureOption}
    setDry1TemperatureOption={setDry1TemperatureOption}
    dry1WrinkleOption={dry1WrinkleOption}
    setDry1WrinkleOption={setDry1WrinkleOption}
    getDry1TotalPrice={getDry1TotalPrice}
    setStep={setStep}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
)}

{/* STEP 3_2 */}
{step === 3_2 && (
  <Dry2Selection
    setDry2Prices={setDry2Prices}
    setDry2Program={setDry2Program}
    setStep={setStep}
  />
)}

{/* STEP 3_2_1 */}
{step === 3_2_1 && (
  <Dry2Options
    dry2price={dry2price}
    dry2TemperatureOption={dry2TemperatureOption}
    setDry2TemperatureOption={setDry2TemperatureOption}
    dry2WrinkleOption={dry2WrinkleOption}
    setDry2WrinkleOption={setDry2WrinkleOption}
    getDry2TotalPrice={getDry2TotalPrice}
    setStep={setStep}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
)}



{/* STEP 3_3 */}
{step === 3_3 && (
  <Dry3Selection
    setDry3Prices={setDry3Prices}
    setDry3Program={setDry3Program}
    setStep={setStep}
  />
)}

{/* STEP 3_3_1 */}
{step === 3_3_1 && (
  <Dry3Options
    dry3price={dry3price}
    dry3TemperatureOption={dry3TemperatureOption}
    setDry3TemperatureOption={setDry3TemperatureOption}
    dry3WrinkleOption={dry3WrinkleOption}
    setDry3WrinkleOption={setDry3WrinkleOption}
    getDry3TotalPrice={getDry3TotalPrice}
    setStep={setStep}
    checkMachineBeforePay={checkMachineBeforePay}
    STEP_QR={STEP_QR}
  />
)}

{step === STEP_QR && (
  <QRPayment
    generateQR={generateQR}
    getTotalPrice={getTotalPrice}
    setProgram={setProgram}
    setStep={setStep}
    setProgramPrice={setProgramPrice}
    resetOptions={resetOptions}
    confirmWash={confirmWash}
  />
)}
  </div>
  );
}

export default App;
