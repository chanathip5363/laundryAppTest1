// Estimated duration from Toshiba panel readings; minutes at base temperature, without AROMA.
const TOSHIBA_MINUTES = Object.freeze({1:45, 2:67, 3:50, 4:57, 5:45, 6:15, 7:78, 8:69, 9:63, 10:159});
const TEMP_EXTRA = Object.freeze({'20':0, '30':0, '40':10, '60':30, '90':60});
function estimateMinutes(profile, program, optionsJson) {
  if (profile !== 'toshibaA') return null;
  const base = TOSHIBA_MINUTES[Number(program)];
  if (!base) return null;
  let command;
  try { command = JSON.parse(optionsJson || '{}').command || {}; }
  catch { return null; }
  const temp = command.tempOption;
  if (temp != null && !Object.hasOwn(TEMP_EXTRA, String(temp))) return null;
  return base + (temp == null ? 0 : TEMP_EXTRA[String(temp)]) + (command.aromaOption === true ? 12 : 0);
}
module.exports = { estimateMinutes };
