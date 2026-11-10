import MachineSelectionGrid from "./MachineSelectionGrid";

export default function DryMachineSelection({
  shopId,
  selectedMachine,
  setSelectedMachine,
  setSelectedMachineProfile,
  setStep,
}) {
  return (
    <MachineSelectionGrid
      shopId={shopId}
      machines={[]}
      type="dry"
      onSelect={(machine) => {
        setSelectedMachine(machine.id);
        setSelectedMachineProfile(machine.program_profile);
        setStep(3_1);
      }}
      onBack={() => {
        setSelectedMachine(null);
        setSelectedMachineProfile(null);
        setStep(1);
      }}
    />
  );
}