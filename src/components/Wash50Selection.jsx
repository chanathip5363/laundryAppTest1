
function Wash50Selection({
  program,
  programNameMap,
  getTotalPrice,
  aromaOption,
  setAromaOption,
  aromaOptionsMap,
  resetOptions,
  setProgram,
  setStep,
  buildCommand,
  checkMachineBeforePay,
  STEP_QR,
}) {
  const aromas = aromaOptionsMap[program] ?? [];

  const handleConfirm = async () => {
    const cmd = buildCommand();
    console.log(cmd);

    if (!program) {
      alert("กรุณาเลือกโปรแกรม");
      return;
    }

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
    <div className="wash50-selection">

      <div className="wash50-program">
        <div className="wash50-program-icon">
          ♨️
        </div>

        <div className="wash50-program-info">
          <strong>
            {programNameMap[program] ??
              "ซักด้วยไอน้ำ"}
          </strong>

          <span>
            โปรแกรมซักพิเศษด้วยไอน้ำ
          </span>

          <small>
            ⏱ ระยะเวลาประมาณ 2 ชั่วโมง 39 นาที
          </small>
        </div>
      </div>

      {aromas.length > 0 && (
        <section className="wash30-options-section">
          <h3>🌸 AROMA</h3>
          <p>เลือกเพิ่มน้ำยาหอมตามต้องการ</p>

          <div className="wash30-options-list">
            {aromas.map((aroma) => (
              <label
                key={aroma}
                className={`wash30-option-item ${
                  aromaOption === aroma
                    ? "selected"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={aromaOption === aroma}
                  onChange={() =>
                    setAromaOption(
                      aromaOption === aroma
                        ? null
                        : aroma
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
          <span>AROMA</span>
          <strong>
            {aromaOption ? "เพิ่ม" : "ไม่ใช้"}
          </strong>
        </div>

        <div className="wash30-options-total">
          <strong>ยอดชำระ</strong>
          <span>
            {getTotalPrice()} บาท
          </span>
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
          setStep(2);
        }}
      >
        ← ย้อนกลับ
      </button>

    </div>
  );
}

export default Wash50Selection;
