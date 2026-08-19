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
}) {
  return (
    <>
      <h2 style={{ marginBottom: "10px" }}>
        {programNameMap[program] ?? "เลือกโปรแกรมซัก"}
      </h2>

      <div
        style={{
          border: "1px solid #e5e7eb",
          padding: "20px",
          borderRadius: "16px",
          marginBottom: "20px",
          background: "#ffffff",
          boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        }}
      >
        <h3 style={{ marginBottom: "10px" }}>
          🧾 สรุปรายการ
        </h3>

        <p>
          🧺 โปรแกรม:{" "}
          <b>{programNameMap[program] ?? "-"}</b>
        </p>

        <p>
          🌡️ อุณหภูมิ: <b>ปกติ</b>
        </p>

        <hr style={{ margin: "10px 0" }} />

        <h2 style={{ color: "#2563eb" }}>
          รวม: {getTotalPrice()} บาท
        </h2>
      </div>

      <button
        onClick={() => {
          setProgram(4);
          setProgramPrice(20);
          setSpin(0);
          setAroma(0);
        }}
      >
        ซักแบบประหยัด
      </button>

      <button
        onClick={() => {
          setProgram(6);
          setProgramPrice(20);
          setSpin(0);
          setAroma(0);
        }}
      >
        ซักด่วน 15 นาที
      </button>

      <br />

      <button
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(2);
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
        }}
      >
        ยืนยันและชำระเงิน
      </button>
    </>
  );
}

export default Wash20Selection;