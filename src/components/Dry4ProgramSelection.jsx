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
    <>
      <h2>เลือกโปรแกรมอบ</h2>

      {programs.map((item) => (
        <button
          key={item.program}
          onClick={() => {
            setDry4Program(item.program);
            setDry4TemperatureOption(null);
            setDry4WrinkleOption(false);
            setStep(3_4_2);
          }}
        >
          {item.program} - {item.name}
        </button>
      ))}

      <br />

      <button
        onClick={() => {
          setDry4Program(0);
          setStep(3_4);
        }}
      >
        ย้อนกลับ
      </button>
    </>
  );
}

export default Dry4ProgramSelection;