function Dry1Options({
  dry1price,
  dry1program,
  dry1TemperatureOption,
  setDry1TemperatureOption,
  dry1WrinkleOption,
  setDry1WrinkleOption,
  getDry1TotalPrice,
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
    9: "กำจัดกลิ่นอับ",
    10: "30 นาที",
    11: "60 นาที",
    12: "120 นาที",
  };

  return (
    <>
  <h2 style={{ marginBottom: "10px" }}>
  {programNameMap[dry1program] ?? ""}
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
      👕 โปรแกรม:{" "}
      <b>{programNameMap[dry1program] ?? "-"}</b>
    </p>

    <p>
      🌡️ ระดับการอบ:{" "}
      <b>
        {dry1TemperatureOption === "airing"
          ? "Airing"
          : dry1TemperatureOption === "normal"
          ? "Normal Dry"
          : dry1TemperatureOption === "extra"
          ? "Extra Dry"
          : dry1program >= 8
          ? "ปรับไม่ได้"
          : "ยังไม่ได้เลือก"}
      </b>
    </p>

    <p>
      👔 ลดรอยยับ:{" "}
      <b>{dry1WrinkleOption ? "ใช้" : "ไม่ใช้"}</b>
    </p>

    <hr style={{ margin: "10px 0" }} />

    <h2 style={{ color: "#2563eb" }}>
      รวม: {getDry1TotalPrice()} บาท
    </h2>
  </div>

{dry1program >= 1 && dry1program <= 7 && (
  
        <div style={{ marginBottom: "20px" }}>
          <h4>อุณหภูมิการอบ</h4>

          <button
            onClick={() => setDry1TemperatureOption("airing")}
          >
            Airing +0 บาท
          </button>

          <button
            onClick={() => setDry1TemperatureOption("normal")}
          >
            Normal Dry +5 บาท
          </button>

          <button
            onClick={() => setDry1TemperatureOption("extra")}
          >
            Extra Dry +10 บาท
          </button>
        </div>
      )}

      {dry1program >= 8 && dry1program <= 12 && (
        <div style={{ marginBottom: "20px" }}>
          <h4>อุณหภูมิการอบ</h4>
          <p>โปรแกรมนี้ไม่สามารถปรับอุณหภูมิได้</p>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h4>ลดรอยยับ</h4>

        <button
          onClick={() =>
            setDry1WrinkleOption(!dry1WrinkleOption)
          }
        >
          {dry1WrinkleOption
            ? "ลดรอยยับ +5 บาท ✓"
            : "ลดรอยยับ +5 บาท"}
        </button>
      </div>

      <button 
          onClick={() => {
            setDry1TemperatureOption(null);
            setDry1WrinkleOption(false);
            setStep(3_1_1);
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
          if (!dry1price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            dry1program >= 1 &&
            dry1program <= 7 &&
            !dry1TemperatureOption
          ) {
            alert("กรุณาเลือกอุณหภูมิ");
            return;
          }

          if (
            !window.confirm(
              `ยืนยันชำระ ${getDry1TotalPrice()} บาท ?`
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

export default Dry1Options;