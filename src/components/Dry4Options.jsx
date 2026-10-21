
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

  const canAdjustTemperature = dry4program !== 8;

  const temperatureOptions = [
    { value: "normal", name: "ปกติ", price: 0 },
    { value: "medium", name: "กลาง", price: 5 },
    { value: "high", name: "สูง", price: 10 },
  ];

  const temperatureName =
    dry4TemperatureOption === "normal"
      ? "ปกติ"
      : dry4TemperatureOption === "medium"
      ? "กลาง"
      : dry4TemperatureOption === "high"
      ? "สูง"
      : canAdjustTemperature
      ? "ยังไม่ได้เลือก"
      : "ปรับไม่ได้";

  return (
    <div className="dry-options">
      <h3 className="dry-options-program-name">
        {programNameMap[dry4program] ?? ""}
      </h3>

      {/* สรุปรายการ */}
      <div className="dry-options-summary">
        <h3>สรุปรายการ</h3>

        <div className="dry-options-row">
          <span>โปรแกรม</span>
          <strong>
            {programNameMap[dry4program] ?? "-"}
          </strong>
        </div>

        <div className="dry-options-row">
          <span>ระดับการอบ</span>
          <strong>{temperatureName}</strong>
        </div>

        <div className="dry-options-row">
          <span>ลดรอยยับ</span>
          <strong>
            {dry4WrinkleOption ? "ใช้" : "ไม่ใช้"}
          </strong>
        </div>

        <div className="dry-options-total">
          <span>ยอดชำระทั้งหมด</span>
          <strong>
            {getDry4TotalPrice()} บาท
          </strong>
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
                  dry4TemperatureOption === option.value
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setDry4TemperatureOption(option.value)
                }
              >
                <span className="dry-options-choice-name">
                  <span
                    className={`dry-options-radio ${
                      dry4TemperatureOption === option.value
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
              checked={dry4WrinkleOption}
              onChange={(e) =>
                setDry4WrinkleOption(e.target.checked)
              }
            />
            ลดรอยยับ
          </span>

          <strong>+6 บาท</strong>
        </label>
      </div>

      {/* ยืนยันการชำระเงิน */}
      <button
        type="button"
        className="dry-options-confirm"
        onClick={async () => {
          if (!dry4price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            canAdjustTemperature &&
            !dry4TemperatureOption
          ) {
            alert("กรุณาเลือกระดับการอบ");
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
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          setDry4TemperatureOption(null);
          setDry4WrinkleOption(false);
          setStep(3_4_1);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry4Options;
