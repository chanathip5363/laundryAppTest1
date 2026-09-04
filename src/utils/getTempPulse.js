export function getTempPulse(
  program,
  tempOption,
  machineConfig
) {
  const programConfig = machineConfig?.config?.programs?.[program];

  if (!programConfig) {
    return 0;
  }

  const cycle = programConfig.temperatureCycle || [];
  const current = programConfig.defaultTemperature;

  // ถ้าไม่เลือก temp → target = normal
  const target = tempOption || "normal";

  let count = 0;
  let i = cycle.indexOf(current);

  if (i === -1 || cycle.length === 0) {
    return 0;
  }

  while (cycle[i] !== target) {
    i = (i + 1) % cycle.length;
    count++;

    if (count > cycle.length) {
      return 0;
    }
  }

  return count;
}