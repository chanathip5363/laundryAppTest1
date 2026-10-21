
import MachineSelectionGrid from "./MachineSelectionGrid";

export default function WashMachineSelection({
  selectedMachine,
  setSelectedMachine,
  setStep,
}) {
  const machines = [
    { id: "machine1", name: "เครื่องซัก 1", model: "Toshiba" },
    { id: "machine2", name: "เครื่องซัก 2", model: "TCL" },
    { id: "machine3", name: "เครื่องซัก 3", model: "LG" },
    { id: "machine4", name: "เครื่องซัก 4", model: "Samsung" },
  ];

  return (
    <MachineSelectionGrid
      machines={machines}
      type="wash"
      onSelect={(machine) => {
        setSelectedMachine(machine.id);
        setStep(2);
      }}
      onBack={() => {
        setSelectedMachine(null);
        setStep(1);
      }}
    />
  );
}
