
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

  const canAdjustTemperature = dry2program !== 8;

  const temperatureOptions = [
    { value: "normal", name: "ปกติ", price: 0 },
    { value: "medium", name: "กลาง", price: 5 },
    { value: "high", name: "สูง", price: 10 },
  ];

  const temperatureName =
    dry2TemperatureOption === "normal"
      ? "ปกติ"
      : dry2TemperatureOption === "medium"
      ? "กลาง"
      : dry2TemperatureOption === "high"
      ? "สูง"
      : canAdjustTemperature
      ? "ยังไม่ได้เลือก"
      : "ปรับไม่ได้";

  return (
    <div className="dry-options">
      <h3 className="dry-options-program-name">
        {programNameMap[dry2program] ?? ""}
      </h3>

      {/* สรุปรายการ */}
      <div className="dry-options-summary">
        <h3>🧾 สรุปรายการ</h3>

        <div className="dry-options-row">
          <span>โปรแกรม</span>
          <strong>
            {programNameMap[dry2program] ?? "-"}
          </strong>
        </div>

        <div className="dry-options-row">
          <span>ระดับการอบ</span>
          <strong>{temperatureName}</strong>
        </div>

        <div className="dry-options-row">
          <span>ลดรอยยับ</span>
          <strong>
            {dry2WrinkleOption ? "ใช้" : "ไม่ใช้"}
          </strong>
        </div>

        <div className="dry-options-total">
          <span>ยอดชำระทั้งหมด</span>
          <strong>{getDry2TotalPrice()} บาท</strong>
        </div>
      </div>

      {/* ตัวเลือกระดับการอบ */}
      <div className="dry-options-section">
        <h3>ระดับการอบ</h3>

        {canAdjustTemperature ? (
          <div className="dry-options-list">
            {temperatureOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`dry-options-choice ${
                  dry2TemperatureOption === option.value
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setDry2TemperatureOption(option.value)
                }
              >
                <span className="dry-options-choice-name">
                  <span
                    className={`dry-options-radio ${
                      dry2TemperatureOption === option.value
                        ? "checked"
                        : ""
                    }`}
                  />
                  {option.name}
                </span>

                <span className="dry-options-choice-price">
                  +{option.price} บาท
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="dry-options-notice">
            โปรแกรมนี้ไม่สามารถปรับระดับการอบได้
          </p>
        )}
      </div>

      {/* ลดรอยยับ */}
      <div className="dry-options-section">
        <h3>ลดรอยยับ</h3>

        <label className="dry-options-wrinkle">
          <span className="dry-options-wrinkle-name">
            <input
              type="checkbox"
              checked={dry2WrinkleOption}
              onChange={(e) =>
                setDry2WrinkleOption(e.target.checked)
              }
            />
            ลดรอยยับ
          </span>

          <strong>+3 บาท</strong>
        </label>
      </div>

      {/* ยืนยันการชำระเงิน */}
      <button
        type="button"
        className="dry-options-confirm"
        onClick={async () => {
          if (!dry2price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            canAdjustTemperature &&
            !dry2TemperatureOption
          ) {
            alert("กรุณาเลือกระดับการอบ");
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
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          setDry2TemperatureOption(null);
          setDry2WrinkleOption(false);
          setStep(3_2_1);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry2Options;
