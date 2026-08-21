function Wash30ProgramSelection({
  programNameMap,
  setProgram,
  setProgramPrice,
  setStep,
  resetOptions,
}) {
  return (
    <>
      <h2>เลือกโปรแกรม</h2>

      <button
        onClick={() => {
          setProgram(1);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[1] ?? "ชุดกีฬา"}
      </button>

      <button
        onClick={() => {
          setProgram(2);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[2] ?? "ผ้าขนสัตว์"}
      </button>

      <button
        onClick={() => {
          setProgram(3);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[3] ?? "ผ้าบอบบาง"}
      </button>

      <button
        onClick={() => {
          setProgram(5);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[5] ?? "ผ้าผสม 45 นาที"}
      </button>

      <button
        onClick={() => {
          setProgram(7);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[7] ?? "ผ้าฝ้าย"}
      </button>

      <button
        onClick={() => {
          setProgram(8);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[8] ?? "ผ้าขาว"}
      </button>

      <button
        onClick={() => {
          setProgram(9);
          setProgramPrice(30);
          setStep(2_2_1);
        }}
      >
        {programNameMap[9] ?? "ซักถนอมสีผ้า"}
      </button>

      <br />

      <button
        onClick={() => {
          resetOptions();
          setProgram(0);
          setStep(2);
        }}
      >
        ย้อนกลับ
      </button>
    </>
  );
}

export default Wash30ProgramSelection;