function DryMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  return (
    <>
      <h2>เลือกเครื่องอบ</h2>

    <button
      onClick={() => {
        setSelectedMachine("machine5");
        setStep(3_1);
      }}
    >
      เครื่องอบ 1
    </button>

    <button
      onClick={() => {
        setSelectedMachine("machine6");
        setStep(3_2);
      }}
    >
      เครื่องอบ 2
    </button>

    <button
      onClick={() => {
        setSelectedMachine("dry3");
        setStep(3_3);
      }}
    >
      เครื่องอบ 3
    </button>


      <br />

      <button
        onClick={() => {
          setSelectedMachine(null);
          setStep(1);
        }}
      >
        ย้อนกลับ
      </button>

    </>
  );
}

export default DryMachineSelection;