
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

  const canAdjustTemperature =
    dry1program >= 1 && dry1program <= 7;

  const temperatureOptions = [
    { value: "airing", name: "Airing", price: 0 },
    { value: "normal", name: "Normal Dry", price: 5 },
    { value: "extra", name: "Extra Dry", price: 10 },
  ];

  const temperatureName =
    dry1TemperatureOption === "airing"
      ? "Airing"
      : dry1TemperatureOption === "normal"
      ? "Normal Dry"
      : dry1TemperatureOption === "extra"
      ? "Extra Dry"
      : canAdjustTemperature
      ? "ยังไม่ได้เลือก"
      : "ปรับไม่ได้";

  return (
    <div className="dry-options">
      <h3 className="dry-options-program-name">
        {programNameMap[dry1program] ?? ""}
      </h3>

      {/* สรุปรายการ */}
      <div className="dry-options-summary">
        <h3>🧾 สรุปรายการ</h3>

        <div className="dry-options-row">
          <span>โปรแกรม</span>
          <strong>
            {programNameMap[dry1program] ?? "-"}
          </strong>
        </div>

        <div className="dry-options-row">
          <span>ระดับการอบ</span>
          <strong>{temperatureName}</strong>
        </div>

        <div className="dry-options-row">
          <span>ลดรอยยับ</span>
          <strong>
            {dry1WrinkleOption ? "ใช้" : "ไม่ใช้"}
          </strong>
        </div>

        <div className="dry-options-total">
          <span>ยอดชำระทั้งหมด</span>
          <strong>{getDry1TotalPrice()} บาท</strong>
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
                  dry1TemperatureOption === option.value
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setDry1TemperatureOption(option.value)
                }
              >
                <span className="dry-options-choice-name">
                  <span
                    className={`dry-options-radio ${
                      dry1TemperatureOption === option.value
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
              checked={dry1WrinkleOption}
              onChange={(e) =>
                setDry1WrinkleOption(e.target.checked)
              }
            />
            ลดรอยยับ
          </span>

          <strong>+5 บาท</strong>
        </label>
      </div>

      {/* ยืนยันการชำระเงิน */}
      <button
        type="button"
        className="dry-options-confirm"
        onClick={async () => {
          if (!dry1price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          if (
            canAdjustTemperature &&
            !dry1TemperatureOption
          ) {
            alert("กรุณาเลือกระดับการอบ");
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
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          setDry1TemperatureOption(null);
          setDry1WrinkleOption(false);
          setStep(3_1_1);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry1Options;
