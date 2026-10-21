
import MachineSelectionGrid from "./MachineSelectionGrid";

export default function DryMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  const machines = [
    { id: "machine5", name: "เครื่องอบ 1", model: "TCL", nextStep: 3_1 },
    { id: "machine6", name: "เครื่องอบ 2", model: "เครื่องอบผ้า", nextStep: 3_2 },
    { id: "machine7", name: "เครื่องอบ 3", model: "เครื่องอบผ้า", nextStep: 3_3 },
    { id: "machine8", name: "เครื่องอบ 4", model: "เครื่องอบผ้า", nextStep: 3_4 },
  ];

  return (
    <MachineSelectionGrid
      machines={machines}
      type="dry"
      onSelect={(machine) => {
        setSelectedMachine(machine.id);
        setStep(machine.nextStep);
      }}
      onBack={() => {
        setSelectedMachine(null);
        setStep(1);
      }}
    />
  );
}
