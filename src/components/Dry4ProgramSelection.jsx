
function Dry4ProgramSelection({
  dry4price,
  setDry4Program,
  setDry4TemperatureOption,
  setDry4WrinkleOption,
  setStep,
}) {
  const programGroups = {
    24: [
      { program: 8, name: "ไม่ใช้ความร้อน" },
    ],

    33: [
      { program: 1, name: "ผ้าฝ้าย" },
      { program: 5, name: "เสื้อผ้าเด็ก" },
      { program: 6, name: "ผ้าบอบบาง" },
    ],

    46: [
      { program: 2, name: "ผ้าหลายชนิด" },
    ],
  };

  const programs = programGroups[dry4price] || [];

  return (
    <div className="dry-program-selection">
      <div className="dry-program-heading">
        <p>เลือกโปรแกรมที่เหมาะกับชนิดผ้าของคุณ</p>

        <span className="dry-program-price">
          ราคาเริ่มต้น {dry4price} บาท
        </span>
      </div>

      <div className="dry-program-list">
        {programs.map((item) => (
          <button
            key={item.program}
            type="button"
            className="dry-program-card"
            onClick={() => {
              setDry4Program(item.program);
              setDry4TemperatureOption(null);
              setDry4WrinkleOption(false);
              setStep(3_4_2);
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
          setDry4Program(0);
          setStep(3_4);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry4ProgramSelection;
