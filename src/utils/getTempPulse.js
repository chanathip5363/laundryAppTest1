import {
  tempCycleMap,
  defaultTempMap
} from "../constants/laundryConfig";


export function getTempPulse(program, tempOption) {

  const cycle = tempCycleMap[program] || [];
  const current = defaultTempMap[program];

  // ถ้าไม่เลือก temp → target = normal
  const target = tempOption || "normal";

  let count = 0;
  let i = cycle.indexOf(current);

  while (cycle[i] !== target) {
    i = (i + 1) % cycle.length;
    count++;
  }

  return count;
}