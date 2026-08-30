function Dry3Options({
  dry3price,
  dry3TemperatureOption,
  setDry3TemperatureOption,
  dry3WrinkleOption,
  setDry3WrinkleOption,
  getDry3TotalPrice,
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
          onClick={() => setDry3TemperatureOption("normal")}
        >
          ปกติ +0 บาท
        </button>

        <button
          onClick={() => setDry3TemperatureOption("medium")}
        >
          กลาง +5 บาท
        </button>

        <button
          onClick={() => setDry3TemperatureOption("high")}
        >
          สูง +10 บาท
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h4>ลดรอยยับ</h4>

        <button
          onClick={() =>
            setDry3WrinkleOption(!dry3WrinkleOption)
          }
        >
          {dry3WrinkleOption
            ? "ลดรอยยับ +5 บาท ✓"
            : "ลดรอยยับ +5 บาท"}
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>
          ราคาพื้นฐาน: {dry3price} บาท
          <br />
          ราคาส่วนเพิ่ม:{" "}
          {getDry3TotalPrice() - (dry3price || 0)} บาท
          <br />
          <strong>
            รวม: {getDry3TotalPrice()} บาท
          </strong>
        </h3>
      </div>

      <button 
        onClick={() => {
            setDry3TemperatureOption(null);
            setDry3WrinkleOption(false);
            setStep(3_3);
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
          if (!dry3price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (!dry3TemperatureOption) {
            alert("กรุณาเลือกอุณหภูมิ");
            return;
          }

          if (
            !window.confirm(
              `ยืนยันชำระ ${getDry3TotalPrice()} บาท ?`
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

export default Dry3Options;