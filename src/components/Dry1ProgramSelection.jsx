function Dry1ProgramSelection({
  dry1price,
  setDry1Program,
  setDry1TemperatureOption,
  setDry1WrinkleOption,
  setStep,
}) {
  const programGroups = {
    25: [
      { program: 7, name: "Fast Dry" },
      { program: 8, name: "Air Dry" },
      { program: 10, name: "30 min" },
    ],

    35: [
      { program: 1, name: "Cotton" },
      { program: 5, name: "Baby Care" },
      { program: 6, name: "Delicate" },
      { program: 9, name: "Refresh" },
      { program: 11, name: "60 min" },
    ],

    45: [
      { program: 2, name: "Mix" },
      { program: 3, name: "Synthetics" },
      { program: 4, name: "Heavy" },
      { program: 12, name: "120 min" },
    ],
  };

  const programs = programGroups[dry1price] || [];

  return (
    <>
      <h2>เลือกโปรแกรมอบ</h2>

      {programs.map((item) => (
        <button
          key={item.program}
          onClick={() => {
            setDry1Program(item.program);
            setDry1TemperatureOption(null);
            setDry1WrinkleOption(false);
            setStep(3_1_2);
          }}
        >
          {item.program} - {item.name}
        </button>
      ))}

      <br />

      <button
        onClick={() => {
          setDry1Program(0);
          setStep(3_1);
        }}
      >
        ย้อนกลับ
      </button>
    </>
  );
}

export default Dry1ProgramSelection;