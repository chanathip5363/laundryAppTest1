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
  return (
    <>
      <h2 style={{ marginBottom: "10px" }}>
        {programNameMap[program] ?? ""}
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
          🌡️ อุณหภูมิ:{" "}
          <b>
            {tempOption ? tempOption + "°C" : "ปกติ"}
          </b>
        </p>

        <p>
          🌸 Aroma:{" "}
          <b>
            {aromaOption ? "เพิ่ม" : "ไม่ใช้"}
          </b>
        </p>

        <hr style={{ margin: "10px 0" }} />

        <h2 style={{ color: "#2563eb" }}>
          รวม: {getTotalPrice()} บาท
        </h2>
      </div>

      {/* อุณหภูมิที่แสดงตามความสามารถของแต่ละโปรแกรม */}
      {tempShowOptionsMap[program]?.map((tempShow) => (
        <label
          key={tempShow}
          style={{
            display: "block",
            padding: "8px",
            borderRadius: "8px",
          }}
        >
          🌡️ เพิ่มอุณหภูมิ
        </label>
      ))}

      {tempOptionsMap[program]?.map((temp) => (
        <label
          key={temp}
          style={{
            display: "block",
            padding: "8px",
            borderRadius: "8px",
            background:
              tempOption === temp
                ? "#e0f2fe"
                : "transparent",
          }}
        >
          <input
            type="checkbox"
            checked={tempOption === temp}
            onChange={() =>
              setTempOption(
                tempOption === temp ? null : temp
              )
            }
          />
          {temp}°C (+ {tempPriceMap[temp] ?? 0} บาท)
        </label>
      ))}

      <br />

      {aromaOptionsMap[program]?.map((aroma) => (
        <label
          key={aroma}
          style={{
            display: "block",
            padding: "8px",
            borderRadius: "8px",
            background:
              aromaOption === aroma
                ? "#e0f2fe"
                : "transparent",
          }}
        >
          <h3>เพิ่มความหอม</h3>

          <input
            type="checkbox"
            checked={aromaOption === aroma}
            onChange={() =>
              setAromaOption(
                aromaOption === aroma ? null : aroma
              )
            }
          />

          {aroma}
        </label>
      ))}

      <br />

      <button
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(2_2);
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

export default Wash30Options;