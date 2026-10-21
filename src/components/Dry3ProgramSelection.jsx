
function Dry3ProgramSelection({
  dry3price,
  setDry3Program,
  setDry3TemperatureOption,
  setDry3WrinkleOption,
  setStep,
}) {
  const programGroups = {
    30: [
      { program: 8, name: "ไม่ใช้ความร้อน" },
    ],

    40: [
      { program: 1, name: "ผ้าฝ้าย" },
      { program: 5, name: "เสื้อผ้าเด็ก" },
      { program: 6, name: "ผ้าบอบบาง" },
    ],

    50: [
      { program: 2, name: "ผ้าหลายชนิด" },
      { program: 4, name: "ชุดเครื่องนอน" },
    ],
  };

  const programs = programGroups[dry3price] || [];

  return (
    <div className="dry-program-selection">
      <div className="dry-program-heading">
        <p>เลือกโปรแกรมที่เหมาะกับชนิดผ้าของคุณ</p>

        <span className="dry-program-price">
          ราคาเริ่มต้น {dry3price} บาท
        </span>
      </div>

      <div className="dry-program-list">
        {programs.map((item) => (
          <button
            key={item.program}
            type="button"
            className="dry-program-card"
            onClick={() => {
              setDry3Program(item.program);
              setDry3TemperatureOption(null);
              setDry3WrinkleOption(false);
              setStep(3_3_2);
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
          setDry3Program(0);
          setStep(3_3);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry3ProgramSelection;
