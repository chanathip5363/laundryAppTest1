function Dry1Selection({
  dry1price,
  setDry1Prices,
  setDry1Program,
  resetOptions,
  setProgram,
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
              setDry1Prices(25);
              setDry1Program(1);
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
              setDry1Prices(35);
              setDry1Program(2);
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
              setDry1Prices(45);
              setDry1Program(3);
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

      <button
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(1_2);
        }}
      >
        ย้อนกลับ
      </button>

      <button
        onClick={() => {
          if (!dry1price) {
            alert("กรุณาเลือกราคา");
            return;
          }

          setStep(3_1_1);
        }}
      >
        ต่อไป
      </button>    
    </>
  );
}

export default Dry1Selection;