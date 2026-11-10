import MachineSelectionGrid from "./MachineSelectionGrid";

export default function WashMachineSelection({
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
      type="wash"
      onSelect={(machine) => {
        setSelectedMachine(machine.id);
        setSelectedMachineProfile(machine.program_profile);
        setStep(2);
      }}
      onBack={() => {
        setSelectedMachine(null);
        setSelectedMachineProfile(null);
        setStep(1);
      }}
    />
  );
}