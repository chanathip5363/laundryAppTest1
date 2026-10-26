
function Wash30ProgramSelection({
  packagePrice,
  priceGroupPrograms,
  programNameMap,
  setProgram,
  setProgramPrice,
  setStep,
  resetOptions,
}) {
  const programs = [
    {
      id: 1,
      name: "ชุดกีฬา",
      description: "สำหรับชุดออกกำลังกาย",
      icon: "👕",
    },
    {
      id: 2,
      name: "ผ้าขนสัตว์",
      description: "ดูแลผ้าที่ต้องการความอ่อนโยน",
      icon: "🧶",
    },
    {
      id: 3,
      name: "ผ้าบอบบาง",
      description: "เหมาะสำหรับเนื้อผ้าที่ละเอียดอ่อน",
      icon: "🌸",
    },
    {
      id: 5,
      name: "ผ้าผสม 45 นาที",
      description: "ซักผ้าหลากหลายชนิด",
      icon: "🧺",
    },
    {
      id: 7,
      name: "ผ้าฝ้าย",
      description: "เหมาะสำหรับเสื้อผ้าฝ้ายทั่วไป",
      icon: "👔",
    },
    {
      id: 8,
      name: "ผ้าขาว",
      description: "สำหรับเสื้อผ้าสีขาว",
      icon: "✨",
    },
    {
      id: 9,
      name: "ซักถนอมสีผ้า",
      description: "ช่วยดูแลสีสันของเสื้อผ้า",
      icon: "🎨",
    },
  ];

  const handleSelect = (programId) => {
    setProgram(programId);
    setProgramPrice(packagePrice);
    setStep(2_2_1);
  };

  return (
    <div className="wash30-selection">
      <p className="wash30-subtitle">
        แพ็กเกจซักมาตรฐาน {packagePrice} บาท
      </p>

      <div className="wash30-program-list">
        {programs
          .filter((item) =>
            priceGroupPrograms.some((id) => Number(id) === item.id)
          )
          .map((item) => (
          <button
            key={item.id}
            type="button"
            className="wash30-program-card"
            onClick={() => handleSelect(item.id)}
          >
            <span className="wash30-program-icon">
              {item.icon}
            </span>

            <span className="wash30-program-content">
              <strong>
                {programNameMap[item.id] ?? item.name}
              </strong>
              <small>{item.description}</small>
            </span>

            <span className="wash30-program-arrow">
              →
            </span>
          </button>
        ))}
      </div>

      <div className="wash30-note">
        <span>ⓘ</span>
        <span>
          หลังเลือกโปรแกรม สามารถเลือกอุณหภูมิ
          และน้ำยาหอมเพิ่มเติมได้
        </span>
      </div>

      <button
        type="button"
        className="machine-back"
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(2);
        }}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Wash30ProgramSelection;
