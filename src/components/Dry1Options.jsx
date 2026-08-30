function Dry1Options({
  dry1price,
  dry1TemperatureOption,
  setDry1TemperatureOption,
  dry1WrinkleOption,
  setDry1WrinkleOption,
  getDry1TotalPrice,
  setStep,
  checkMachineBeforePay,
  STEP_QR,
}) {
  return (
    <>
      <h2>เลือก Option</h2>

      <div style={{ marginBottom: "20px" }}>
        <h4>อุณหภูมิการอบ</h4>

        <button
          onClick={() => setDry1TemperatureOption("normal")}
        >
          ปกติ +0 บาท
        </button>

        <button
          onClick={() => setDry1TemperatureOption("medium")}
        >
          กลาง +5 บาท
        </button>

        <button
          onClick={() => setDry1TemperatureOption("high")}
        >
          สูง +10 บาท
        </button>
      </div>

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

      <div style={{ marginBottom: "20px" }}>
        <h3>
          ราคาพื้นฐาน: {dry1price} บาท
          <br />
          ราคาส่วนเพิ่ม:{" "}
          {getDry1TotalPrice() - (dry1price || 0)} บาท
          <br />
          <strong>
            รวม: {getDry1TotalPrice()} บาท
          </strong>
        </h3>
      </div>

      <button 
          onClick={() => {
            setDry1TemperatureOption(null);
            setDry1WrinkleOption(false);
            setStep(3_1);
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

          if (!dry1TemperatureOption) {
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