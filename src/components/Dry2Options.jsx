function Dry2Options({
  dry2price,
  dry2program,
  dry2TemperatureOption,
  setDry2TemperatureOption,
  dry2WrinkleOption,
  setDry2WrinkleOption,
  getDry2TotalPrice,
  setStep,
  checkMachineBeforePay,
  STEP_QR,
}) {

  const programNameMap = {
    1: "ผ้าฝ้าย",
    2: "ผ้าหลายชนิด",
    3: "ผ้าใยสังเคราะห์",
    4: "ชุดเครื่องนอน",
    5: "เสื้อผ้าเด็ก",
    6: "ผ้าบอบบาง",
    7: "อบแห้งด่วน",
    8: "ไม่ใช้ความร้อน",
  };





  return (
    <>
      <h2 style={{ marginBottom: "10px" }}>
      {programNameMap[dry2program] ?? ""}
      </h2>

<div
  style={{
    border: "1px solid #e5e7eb",
    padding: "20px",
    borderRadius: "16px",
    marginBottom: "20px",
    background: "#ffffff",
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
  }}
>
  <h3 style={{ marginBottom: "10px" }}>
    🧾 สรุปรายการ
  </h3>

  <p>
    👕 โปรแกรม ของ Dry2:{" "}
    <b>{programNameMap[dry2program] ?? "-"}</b>
  </p>

  <p>
    🌡️ ระดับการอบ:{" "}
    <b>
      {dry2TemperatureOption === "normal"
        ? "ปกติ"
        : dry2TemperatureOption === "medium"
        ? "กลาง"
        : dry2TemperatureOption === "high"
        ? "สูง"
        : dry2program >= 8
        ? "ปรับไม่ได้"    
        : "ยังไม่ได้เลือก"}
    </b>
  </p>

  <p>
    👔 ลดรอยยับ:{" "}
    <b>{dry2WrinkleOption ? "ใช้" : "ไม่ใช้"}</b>
  </p>

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getDry2TotalPrice()} บาท
  </h2>
</div>

{dry2program !== 8 && (
      <div style={{ marginBottom: "20px" }}>
        <h4>อุณหภูมิการอบ</h4>

        <button
          onClick={() => setDry2TemperatureOption("normal")}
        >
          ปกติ +0 บาท
        </button>

        <button
          onClick={() => setDry2TemperatureOption("medium")}
        >
          กลาง +5 บาท
        </button>

        <button
          onClick={() => setDry2TemperatureOption("high")}
        >
          สูง +10 บาท
        </button>
      </div>
)}
{dry2program === 8 && (
  <div style={{ marginBottom: "20px" }}>
    <h4>อุณหภูมิการอบ</h4>
    <p>โปรแกรมนี้ไม่สามารถปรับอุณหภูมิได้</p>
  </div>
)}



      <div style={{ marginBottom: "20px" }}>
        <h4>ลดรอยยับ</h4>

        <button
          onClick={() =>
            setDry2WrinkleOption(!dry2WrinkleOption)
          }
        >
          {dry2WrinkleOption
            ? "ลดรอยยับ +3 บาท ✓"
            : "ลดรอยยับ +3 บาท"}
        </button>
      </div>

      <button 
        onClick={() => {
          setDry2TemperatureOption(null);
          setDry2WrinkleOption(false);
          setStep(3_2_1);
        }}
      >
        ย้อนกลับ
      </button>

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
          marginTop: "10px",
        }}
        onClick={async () => {
          if (!dry2price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            dry2program !== 8 &&
            !dry2TemperatureOption
          ) {
            alert("กรุณาเลือกอุณหภูมิ");
            return;
          }


          if (
            !window.confirm(
              `ยืนยันชำระ ${getDry2TotalPrice()} บาท ?`
            )
          ) {
            return;
          }

          const ok = await checkMachineBeforePay();

          if (!ok) return;

          setStep(STEP_QR);
        }}
      >
        ยืนยันและชำระเงิน
      </button>
    </>
  );
}

export default Dry2Options;