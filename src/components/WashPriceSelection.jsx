function WashPriceSelection({
  onSelect20,
  onSelect30,
  onSelect50,
  onBack,
}) {
  return (
    <>
      <h2>เลือกซักราคา</h2>

      {/* 20 บาท */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button onClick={onSelect20}>
            20 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด<br />
            - จำนวนผ้า 2 กก. หรือ 15 ชิ้น<br />
            - ซักด่วน 15 นาที<br />
            - ซักแบบประหยัด 0:57
          </h4>
        </div>
      </div>

      {/* 30 บาท */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button onClick={onSelect30}>
            30 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด<br />
            - ชุดกีฬา 0:45<br />
            - ผ้าขนสัตว์ 1:07<br />
            - ผ้าบาง 0:50<br />
            - ผ้าผสม 45 นาที 0:45<br />
            - ผ้าถนอมผ้า 1:03
          </h4>
        </div>
      </div>

      {/* 50 บาท */}
      <div
        style={{
          display: "flex",
          gap: "40px",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div style={{ width: "120px" }}>
          <button onClick={onSelect50}>
            50 บาท
          </button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>
            รายละเอียด<br />
            - ซักอบด้วยไอน้ำ 2:39<br />
            - เพิ่มประสิทธิภาพในการแทรกซึมเข้าใยเนื้อผ้า<br />
            - เพิ่มประสิทธิภาพในการกำจัดเชื้อโรค
          </h4>
        </div>
      </div>

      <br />
      <br />

      <button onClick={onBack}>
        ย้อนกลับ
      </button>
    </>
  );
}

export default WashPriceSelection;