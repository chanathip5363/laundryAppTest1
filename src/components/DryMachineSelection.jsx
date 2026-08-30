function DryMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  return (
    <>
      <h2>เลือกเครื่องอบ</h2>

      <button
        onClick={() => setSelectedMachine("dry1")}
      >
        เครื่องอบ 1
      </button>

      <button
        onClick={() => setSelectedMachine("dry2")}
      >
        เครื่องอบ 2
      </button>

      <button
        onClick={() => setSelectedMachine("dry3")}
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

      <button
        onClick={() => {
          if (!selectedMachine) {
            alert("กรุณาเลือกเครื่องอบ");
            return;
          }

          if (selectedMachine === "dry1") {
            setStep(3_1);
          } else if (selectedMachine === "dry2") {
            setStep(3_2);
          } else if (selectedMachine === "dry3") {
            setStep(3_3);
          }
        }}
      >
        ต่อไป
      </button>
    </>
  );
}

export default DryMachineSelection;