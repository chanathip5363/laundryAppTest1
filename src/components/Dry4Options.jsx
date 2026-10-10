function Dry4Options({
  dry4price,
  dry4program,
  dry4TemperatureOption,
  setDry4TemperatureOption,
  dry4WrinkleOption,
  setDry4WrinkleOption,
  getDry4TotalPrice,
  setStep,
  checkMachineBeforePay,
  STEP_QR,
}) {

  const programNameMap = {
    1: "ผ้าฝ้าย",
    2: "ผ้าหลายชนิด",


    5: "เสื้อผ้าเด็ก",
    6: "ผ้าบอบบาง",

    8: "ไม่ใช้ความร้อน",
  };





  return (
    <>
      <h2 style={{ marginBottom: "10px" }}>
      {programNameMap[dry4program] ?? ""}
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
    👕 โปรแกรม ของ Dry4:{" "}
    <b>{programNameMap[dry4program] ?? "-"}</b>
  </p>

  <p>
    🌡️ ระดับการอบ:{" "}
    <b>
      {dry4TemperatureOption === "normal"
        ? "ปกติ"
        : dry4TemperatureOption === "medium"
        ? "กลาง"
        : dry4TemperatureOption === "high"
        ? "สูง"
        : dry4program >= 8
        ? "ปรับไม่ได้"    
        : "ยังไม่ได้เลือก"}
    </b>
  </p>

  <p>
    👔 ลดรอยยับ:{" "}
    <b>{dry4WrinkleOption ? "ใช้" : "ไม่ใช้"}</b>
  </p>

  <hr style={{ margin: "10px 0" }} />

  <h2 style={{ color: "#2563eb" }}>
    รวม: {getDry4TotalPrice()} บาท
  </h2>
</div>

{dry4program !== 8 && (
      <div style={{ marginBottom: "20px" }}>
        <h4>อุณหภูมิการอบ</h4>

        <button
          onClick={() => setDry4TemperatureOption("normal")}
        >
          ปกติ +0 บาท
        </button>

        <button
          onClick={() => setDry4TemperatureOption("medium")}
        >
          กลาง +5 บาท
        </button>

        <button
          onClick={() => setDry4TemperatureOption("high")}
        >
          สูง +10 บาท
        </button>
      </div>
)}
{dry4program === 8 && (
  <div style={{ marginBottom: "20px" }}>
    <h4>อุณหภูมิการอบ</h4>
    <p>โปรแกรมนี้ไม่สามารถปรับอุณหภูมิได้</p>
  </div>
)}



      <div style={{ marginBottom: "20px" }}>
        <h4>ลดรอยยับ</h4>

        <button
          onClick={() =>
            setDry4WrinkleOption(!dry4WrinkleOption)
          }
        >
          {dry4WrinkleOption
            ? "ลดรอยยับ +6 บาท ✓"
            : "ลดรอยยับ +6 บาท"}
        </button>
      </div>

      <button 
        onClick={() => {
          setDry4TemperatureOption(null);
          setDry4WrinkleOption(false);
          setStep(3_4_1);
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
          if (!dry4price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            dry4program !== 8 &&
            !dry4TemperatureOption
          ) {
            alert("กรุณาเลือกอุณหภูมิ");
            return;
          }


          if (
            !window.confirm(
              `ยืนยันชำระ ${getDry4TotalPrice()} บาท ?`
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

export default Dry4Options;