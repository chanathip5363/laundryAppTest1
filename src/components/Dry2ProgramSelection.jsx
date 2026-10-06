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
    <>
      <h2>เลือกโปรแกรมอบ</h2>

      {programs.map((item) => (
        <button
          key={item.program}
          onClick={() => {
            setDry2Program(item.program);
            setDry2TemperatureOption(null);
            setDry2WrinkleOption(false);
            setStep(3_2_2);
          }}
        >
          {item.program} - {item.name}
        </button>
      ))}

      <br />

      <button
        onClick={() => {
          setDry2Program(0);
          setStep(3_2);
        }}
      >
        ย้อนกลับ
      </button>
    </>
  );
}

export default Dry2ProgramSelection;