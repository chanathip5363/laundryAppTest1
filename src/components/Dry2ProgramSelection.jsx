
function Dry2ProgramSelection({
  dry2price,
  setDry2Program,
  setDry2TemperatureOption,
  setDry2WrinkleOption,
  setStep,
}) {
  const programGroups = {
    20: [
      { program: 7, name: "อบแห้งด่วน" },
      { program: 8, name: "ไม่ใช้ความร้อน" },
    ],

    30: [
      { program: 1, name: "ผ้าฝ้าย" },
      { program: 5, name: "เสื้อผ้าเด็ก" },
      { program: 6, name: "ผ้าบอบบาง" },
    ],

    40: [
      { program: 2, name: "ผ้าหลายชนิด" },
      { program: 3, name: "ผ้าใยสังเคราะห์" },
      { program: 4, name: "ชุดเครื่องนอน" },
    ],
  };

  const programs = programGroups[dry2price] || [];

  return (
    <div className="dry-program-selection">
      <div className="dry-program-heading">
        <p>เลือกโปรแกรมที่เหมาะกับชนิดผ้าของคุณ</p>

        <span className="dry-program-price">
          ราคาเริ่มต้น {dry2price} บาท
        </span>
      </div>

      <div className="dry-program-list">
        {programs.map((item) => (
          <button
            key={item.program}
            type="button"
            className="dry-program-card"
            onClick={() => {
              setDry2Program(item.program);
              setDry2TemperatureOption(null);
              setDry2WrinkleOption(false);
              setStep(3_2_2);
            }}
          >
            <span className="dry-program-card-icon">
              <span aria-hidden="true">♨</span>
            </span>

            <span className="dry-program-card-content">
              <span className="dry-program-card-name">
                {item.name}
              </span>

              <span className="dry-program-card-code">
                โปรแกรม {item.program}
              </span>
            </span>

            <span className="dry-program-card-arrow">
              →
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          setDry2Program(0);
          setStep(3_2);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry2ProgramSelection;
