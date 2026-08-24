function Dry2Selection({
  setDry2Prices,
  setDry2Program,
  setStep,
}) {
  return (
    <>
      <h2>เลือกราคา</h2>

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
              setDry2Prices(40);
              setDry2Program(1);
            }}
          >
            40 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
            <br />
            - จำนวนผ้า 2 กก. หรือ 15 ชิ้น
            <br />
            - ซักด่วน 15 นาที
            <br />
            - ซักแบบประหยัด
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
              setDry2Prices(50);
              setDry2Program(2);
            }}
          >
            50 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
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
              setDry2Prices(60);
              setDry2Program(3);
            }}
          >
            60 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
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

      <button onClick={() => setStep(3)}>ย้อนกลับ</button>
      <button onClick={() => setStep(6)}>ต่อไป</button>
    </>
  );
}

export default Dry2Selection;