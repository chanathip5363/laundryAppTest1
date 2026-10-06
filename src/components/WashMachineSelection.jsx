function WashMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  return (
    <>
      <h2>เลือกเครื่องซัก</h2>

      <button
      onClick={() => {
        setSelectedMachine("machine1");
        setStep(2);
      }}
    >
      เครื่องซัก 1
    </button>

    <button
      onClick={() => {
        setSelectedMachine("machine2");
        setStep(2);
      }}
    >
      เครื่องซัก 2
    </button>

    <button
      onClick={() => {
        setSelectedMachine("machine3");
        setStep(2);
      }}
    >
      เครื่องซัก 3
    </button>

    <button
      onClick={() => {
        setSelectedMachine("machine4");
        setStep(2);
      }}
    >
      เครื่องซัก 4
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

export default WashMachineSelection;