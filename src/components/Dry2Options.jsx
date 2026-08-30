function Dry2Options({
  dry2price,
  dry2TemperatureOption,
  setDry2TemperatureOption,
  dry2WrinkleOption,
  setDry2WrinkleOption,
  getDry2TotalPrice,
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

      <div style={{ marginBottom: "20px" }}>
        <h4>ลดรอยยับ</h4>

        <button
          onClick={() =>
            setDry2WrinkleOption(!dry2WrinkleOption)
          }
        >
          {dry2WrinkleOption
            ? "ลดรอยยับ +5 บาท ✓"
            : "ลดรอยยับ +5 บาท"}
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h3>
          ราคาพื้นฐาน: {dry2price} บาท
          <br />
          ราคาส่วนเพิ่ม:{" "}
          {getDry2TotalPrice() - (dry2price || 0)} บาท
          <br />
          <strong>
            รวม: {getDry2TotalPrice()} บาท
          </strong>
        </h3>
      </div>

      <button 
        onClick={() => {
          setDry2TemperatureOption(null);
          setDry2WrinkleOption(false);
          setStep(3_2);
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

          if (!dry2TemperatureOption) {
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