function WashMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  return (
    <>
      <h2>เลือกเครื่องซัก</h2>

      <button
        onClick={() => setSelectedMachine("machine1")}
      >
        เครื่องซัก 1
      </button>

      <button
        onClick={() => setSelectedMachine("machine2")}
      >
        เครื่องซัก 2
      </button>

      <button
        onClick={() => setSelectedMachine("machine3")}
      >
        เครื่องซัก 3
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

      <button
        onClick={() => {
          if (!selectedMachine) {
            alert("กรุณาเลือกเครื่องซัก");
            return;
          }

          setStep(2);
        }}
      >
        ต่อไป
      </button>
    </>
  );
}

export default WashMachineSelection;