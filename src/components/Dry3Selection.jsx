function Dry3Selection({
  setDry3Prices,
  setDry3Program,
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
              setDry3Prices(25);
              setDry3Program(1);
            }}
          >
            25 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
            <br />
            - จำนวนผ้า 2 กก. หรือ 10 ชิ้น
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
              setDry3Prices(35);
              setDry3Program(2);
            }}
          >
            35 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
            <br />
            - จำนวนผ้า 4 กก. หรือ 15 ชิ้น
            <br />
            - 60 นาที
            <br />
            - ผ้าทั่วไป ไม่รวมผ้าหนา
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
              setDry3Prices(45);
              setDry3Program(3);
            }}
          >
            45 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด
            <br />
            - จำนวนผ้า 5 กก. หรือ 20 ชิ้น
            <br />
            - 1 ชม. 30 นาที
            <br />
            - ผ้าผสม
          </h4>
        </div>
      </div>

      <br />

      <button onClick={() => setStep(1_2)}>
        ย้อนกลับ
      </button>

      <button onClick={() => setStep(3_3_1)}>
        ต่อไป
      </button>
    </>
  );
}

export default Dry3Selection;