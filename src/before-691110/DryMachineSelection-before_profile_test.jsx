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
        const nextStep =
          machine.program_profile === "tclDry1" ? 3_1 : undefined;

        if (nextStep === undefined) {
          console.warn("Dryer route not configured:", machine.id);
          return;
        }

        setSelectedMachine(machine.id);
        setSelectedMachineProfile(machine.program_profile);
        setStep(nextStep);
      }}
      onBack={() => {
        setSelectedMachine(null);
        setSelectedMachineProfile(null);
        setStep(1);
      }}
    />
  );
}