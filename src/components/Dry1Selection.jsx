function Dry1Selection({
  setDry1Prices,
  setDry1Program,
  resetOptions,
  setProgram,
  setStep,
}) {
  return (
    <>
      <h2>เลือกรีดราคา</h2>

      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button
            onClick={() => {
              setDry1Prices(25);
              setDry1Program(1);
            }}
          >
            25 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            ราวรีดแห้งเร็ว
            <br />
            - จำนวนผ้า 2 กก. หรือ 15 ชิ้น
            <br />
            - Fast Dry 30 นาที
            <br />
            - ผ้าเนื้อบาง
          </h4>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button
            onClick={() => {
              setDry1Prices(35);
              setDry1Program(2);
            }}
          >
            35 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            ราวรีดแห้งเร็ว
            <br />
            - จำนวนผ้า 2 กก. หรือ 15 ชิ้น
            <br />
            - Fast Dry 30 นาที
            <br />
            - ผ้าเนื้อบาง
          </h4>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button
            onClick={() => {
              setDry1Prices(45);
              setDry1Program(3);
            }}
          >
            45 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            ราวรีดแห้งเร็ว
            <br />
            - จำนวนผ้า 2 กก. หรือ 15 ชิ้น
            <br />
            - Fast Dry 30 นาที
            <br />
            - ผ้าเนื้อบาง
          </h4>
        </div>
      </div>

      <br />

      <button
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(3);
        }}
      >
        ย้อนกลับ
      </button>

      <button onClick={() => setStep(6)}>ต่อไป</button>
    </>
  );
}

export default Dry1Selection;