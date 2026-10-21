
function Dry3Options({
  dry3price,
  dry3program,
  dry3TemperatureOption,
  setDry3TemperatureOption,
  dry3WrinkleOption,
  setDry3WrinkleOption,
  getDry3TotalPrice,
  setStep,
  checkMachineBeforePay,
  STEP_QR,
}) {
  const programNameMap = {
    1: "ผ้าฝ้าย",
    2: "ผ้าหลายชนิด",
    4: "ชุดเครื่องนอน",
    5: "เสื้อผ้าเด็ก",
    6: "ผ้าบอบบาง",
    8: "ไม่ใช้ความร้อน",
  };

  const canAdjustTemperature = dry3program !== 8;

  const temperatureOptions = [
    { value: "normal", name: "ปกติ", price: 0 },
    { value: "medium", name: "กลาง", price: 5 },
    { value: "high", name: "สูง", price: 10 },
  ];

  const temperatureName =
    dry3TemperatureOption === "normal"
      ? "ปกติ"
      : dry3TemperatureOption === "medium"
      ? "กลาง"
      : dry3TemperatureOption === "high"
      ? "สูง"
      : canAdjustTemperature
      ? "ยังไม่ได้เลือก"
      : "ปรับไม่ได้";

  return (
    <div className="dry-options">
      <h3 className="dry-options-program-name">
        {programNameMap[dry3program] ?? ""}
      </h3>

      {/* สรุปรายการ */}
      <div className="dry-options-summary">
        <h3>สรุปรายการ</h3>

        <div className="dry-options-row">
          <span>โปรแกรม</span>
          <strong>
            {programNameMap[dry3program] ?? "-"}
          </strong>
        </div>

        <div className="dry-options-row">
          <span>ระดับการอบ</span>
          <strong>{temperatureName}</strong>
        </div>

        <div className="dry-options-row">
          <span>ลดรอยยับ</span>
          <strong>
            {dry3WrinkleOption ? "ใช้" : "ไม่ใช้"}
          </strong>
        </div>

        <div className="dry-options-total">
          <span>ยอดชำระทั้งหมด</span>
          <strong>
            {getDry3TotalPrice()} บาท
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
                  dry3TemperatureOption === option.value
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setDry3TemperatureOption(option.value)
                }
              >
                <span className="dry-options-choice-name">
                  <span
                    className={`dry-options-radio ${
                      dry3TemperatureOption === option.value
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
              checked={dry3WrinkleOption}
              onChange={(e) =>
                setDry3WrinkleOption(e.target.checked)
              }
            />
            ลดรอยยับ
          </span>

          <strong>+8 บาท</strong>
        </label>
      </div>

      {/* ยืนยันการชำระเงิน */}
      <button
        type="button"
        className="dry-options-confirm"
        onClick={async () => {
          if (!dry3price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            canAdjustTemperature &&
            !dry3TemperatureOption
          ) {
            alert("กรุณาเลือกระดับการอบ");
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
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          setDry3TemperatureOption(null);
          setDry3WrinkleOption(false);
          setStep(3_3_1);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry3Options;
