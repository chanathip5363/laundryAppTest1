
function Wash30Options({
  program,
  programNameMap,
  tempOption,
  setTempOption,
  tempOptionsMap,
  tempShowOptionsMap,
  tempPriceMap,
  aromaOption,
  setAromaOption,
  aromaOptionsMap,
  getTotalPrice,
  resetOptions,
  setProgram,
  setStep,
  buildCommand,
  checkMachineBeforePay,
  STEP_QR,
}) {
  const temperatures = tempOptionsMap[program] ?? [];
  const aromas = aromaOptionsMap[program] ?? [];

  const handleConfirm = async () => {
    if (!program) {
      alert("กรุณาเลือกโปรแกรม");
      return;
    }

    const cmd = buildCommand();
    console.log(cmd);

    if (
      !window.confirm(
        `ยืนยันชำระ ${getTotalPrice()} บาท ?`
      )
    ) {
      return;
    }

    const ok = await checkMachineBeforePay();
    if (!ok) return;

    setStep(STEP_QR);
  };

  return (
    <div className="wash30-options">
      <div className="wash30-options-program">
        <span>โปรแกรมที่เลือก</span>
        <strong>
          {programNameMap[program] ?? "-"}
        </strong>
      </div>

      {temperatures.length > 0 && (
        <section className="wash30-options-section">
          <h3>🌡️ เลือกอุณหภูมิ</h3>
          <p>เลือกอุณหภูมิที่ต้องการ หรือใช้ค่าปกติ</p>

          <div className="wash30-options-list">
            <label
              className={`wash30-option-item ${
                tempOption == null ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="wash30-temperature"
                checked={tempOption == null}
                onChange={() => setTempOption(null)}
              />
              <span className="wash30-option-text">
                <strong>ปกติ</strong>
                <small>ไม่เพิ่มราคา</small>
              </span>
            </label>

            {temperatures.map((temp) => (
              <label
                key={temp}
                className={`wash30-option-item ${
                  tempOption === temp ? "selected" : ""
                }`}
              >
                <input
                  type="radio"
                  name="wash30-temperature"
                  checked={tempOption === temp}
                  onChange={() => setTempOption(temp)}
                />

                <span className="wash30-option-text">
                  <strong>{temp}°C</strong>
                  <small>
                    เพิ่ม {tempPriceMap[temp] ?? 0} บาท
                  </small>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}


      {aromas.length > 0 && (
        <section className="wash30-options-section">
          <h3>🌸 เพิ่มความหอม</h3>
          <p>เลือกเพิ่มน้ำยาหอมตามต้องการ</p>

          <div className="wash30-options-list">
            {aromas.map((aroma) => (
              <label
                key={aroma}
                className={`wash30-option-item ${
                  aromaOption === aroma ? "selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={aromaOption === aroma}
                  onChange={() =>
                    setAromaOption(
                      aromaOption === aroma ? null : aroma
                    )
                  }
                />

                <span className="wash30-option-text">
                  <strong>{aroma}</strong>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}


      <div className="wash30-options-summary">
        <h3>สรุปรายการ</h3>

        <div className="wash30-options-row">
          <span>โปรแกรม</span>
          <strong>
            {programNameMap[program] ?? "-"}
          </strong>
        </div>

        <div className="wash30-options-row">
          <span>อุณหภูมิ</span>
          <strong>
            {tempOption != null
              ? `${tempOption}°C`
              : "ปกติ"}
          </strong>
        </div>

        <div className="wash30-options-row">
          <span>น้ำยาหอม</span>
          <strong>
            {aromaOption != null
              ? String(aromaOption)
              : "ไม่ใช้"}
          </strong>
        </div>

        <div className="wash30-options-total">
          <strong>ยอดชำระ</strong>
          <span>{getTotalPrice()} บาท</span>
        </div>
      </div>

      <button
        type="button"
        className="wash30-options-confirm"
        onClick={handleConfirm}
      >
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(2_2);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Wash30Options;
