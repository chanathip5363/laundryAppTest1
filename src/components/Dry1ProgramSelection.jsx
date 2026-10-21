
function Dry1ProgramSelection({
  dry1price,
  setDry1Program,
  setDry1TemperatureOption,
  setDry1WrinkleOption,
  setStep,
}) {
  const programGroups = {
    25: [
      { program: 7, name: "อบแห้งด่วน" },
      { program: 8, name: "ไม่ใช้ความร้อน" },
      { program: 10, name: "30 นาที" },
    ],

    35: [
      { program: 1, name: "ผ้าฝ้าย" },
      { program: 5, name: "เสื้อผ้าเด็ก" },
      { program: 6, name: "ผ้าบอบบาง" },
      { program: 9, name: "กำจัดกลิ่นอับ" },
      { program: 11, name: "60 นาที" },
    ],

    45: [
      { program: 2, name: "ผ้าหลายชนิด" },
      { program: 3, name: "ผ้าใยสังเคราะห์" },
      { program: 4, name: "ชุดเครื่องนอน" },
      { program: 12, name: "120 นาที" },
    ],
  };

  const programs = programGroups[dry1price] || [];

  return (
    <div className="dry-program-selection">
      <div className="dry-program-heading">
        <p>เลือกโปรแกรมที่เหมาะกับชนิดผ้าของคุณ</p>
        <span className="dry-program-price">
          ราคาเริ่มต้น {dry1price} บาท
        </span>
      </div>

      <div className="dry-program-list">
        {programs.map((item) => (
          <button
            key={item.program}
            type="button"
            className="dry-program-card"
            onClick={() => {
              setDry1Program(item.program);
              setDry1TemperatureOption(null);
              setDry1WrinkleOption(false);
              setStep(3_1_2);
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
          setDry1Program(0);
          setStep(3_1);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry1ProgramSelection;
