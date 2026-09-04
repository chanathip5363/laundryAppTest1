import machineConfig from "./machineConfig";

function getMachineConfig(machineId) {
  return machineConfig[machineId] || null;
}

export default getMachineConfig;