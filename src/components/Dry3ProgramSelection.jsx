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
    <>
      <h2>เลือกโปรแกรมอบ</h2>

      {programs.map((item) => (
        <button
          key={item.program}
          onClick={() => {
            setDry3Program(item.program);
            setDry3TemperatureOption(null);
            setDry3WrinkleOption(false);
            setStep(3_3_2);
          }}
        >
          {item.program} - {item.name}
        </button>
      ))}

      <br />

      <button
        onClick={() => {
          setDry3Program(0);
          setStep(3_3);
        }}
      >
        ย้อนกลับ
      </button>
    </>
  );
}

export default Dry3ProgramSelection;