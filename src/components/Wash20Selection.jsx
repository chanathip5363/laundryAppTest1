
function Wash20Selection({
  program,
  programNameMap,
  getTotalPrice,
  setProgram,
  setProgramPrice,
  setSpin,
  setAroma,
  resetOptions,
  setStep,
  buildCommand,
  checkMachineBeforePay,
  STEP_QR,
  priceGroupPrograms,
}) {
  const programDetails = {
    quick: {
      description: "เหมาะสำหรับผ้าที่ไม่สกปรกมาก",
      duration: "15 นาที",
    },
    eco: {
      description: "ซักทั่วไปด้วยโปรแกรมประหยัด",
      duration: "57 นาที",
    },
  };

  const getProgramDetail = (programId) => {
    const name = programNameMap[programId] || "";

    if (name.includes("ด่วน")) return programDetails.quick;
    if (name.includes("ประหยัด")) return programDetails.eco;

    return { description: "เลือกโปรแกรมซัก", duration: "" };
  };

  const handleConfirm = async () => {
    if (!program) {
      alert("กรุณาเลือกโปรแกรม");
      return;
    }

    const cmd = buildCommand();
    console.log(cmd);

    if (!window.confirm(
      `ยืนยันชำระ ${getTotalPrice()} บาท ?`
    )) {
      return;
    }

    const ok = await checkMachineBeforePay();
    if (!ok) return;

    setStep(STEP_QR);
  };

  return (
    <div className="wash20-selection">
    <div className="wash20-heading">
      <p>แพ็กเกจซักประหยัด 20 บาท</p>
    </div>

      <div className="wash20-program-list">
        {priceGroupPrograms.map((programId) => {
          const selected = program === programId;
          const detail = getProgramDetail(programId);

          return (
            <button
              key={programId}
              type="button"
              className={`wash20-program-card ${
                selected ? "selected" : ""
              }`}
              aria-pressed={selected}
              onClick={() => {
                setProgram(programId);
                setProgramPrice(20);
                setSpin(0);
                setAroma(0);
              }}
            >
              <span className="wash20-program-icon">
                {detail.duration === "15 นาที" ? "⏱" : "🌿"}
              </span>

              <span className="wash20-program-content">
                <strong>{programNameMap[programId]}</strong>
                <small>{detail.description}</small>
                <span className="wash20-duration">
                  ◷ {detail.duration}
                </span>
              </span>

              <span className="wash20-program-radio">
                {selected ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="wash20-summary">
        <h3>สรุปรายการ</h3>

        <div className="wash20-summary-row">
          <span>โปรแกรม</span>
          <strong>{programNameMap[program] ?? "ยังไม่ได้เลือก"}</strong>
        </div>

        <div className="wash20-summary-row">
          <span>อุณหภูมิ</span>
          <strong>ปกติ</strong>
        </div>

        <div className="wash20-summary-total">
          <strong>ยอดชำระ</strong>
          <span>{getTotalPrice()} บาท</span>
        </div>
      </div>

      <button
        type="button"
        className="wash20-confirm"
        onClick={handleConfirm}
      >
        ยืนยันและชำระเงิน →
      </button>

      <button
        type="button"
        className="wash20-back"
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

export default Wash20Selection;
