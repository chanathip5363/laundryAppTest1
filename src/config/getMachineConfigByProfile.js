import toshibaA from "./configurations/toshibaA";
import tclB from "./configurations/tclB";
import lgC from "./configurations/lgC";
import samsungD from "./configurations/samsungD";
import tclDry1 from "./configurations/tclDry1";

const profiles = {
  tclDry1: {
    service: "dry",
    brand: "TCL",
    model: "Dry1",
    config: tclDry1,
  },
  toshibaA: {
    service: "wash",
    brand: "Toshiba",
    model: "A",
    config: toshibaA,
  },
  tclB: {
    service: "wash",
    brand: "TCL",
    model: "B",
    config: tclB,
  },
  lgC: {
    service: "wash",
    brand: "LG",
    model: "C",
    config: lgC,
  },
  samsungD: {
    service: "wash",
    brand: "Samsung",
    model: "D",
    config: samsungD,
  },
};

export default function getMachineConfigByProfile(profile) {
  return profiles[profile] || null;
}
