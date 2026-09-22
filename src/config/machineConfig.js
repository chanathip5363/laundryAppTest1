import toshibaA from "./configurations/toshibaA";
import tclB from "./configurations/tclB";
import lgC from "./configurations/lgC";
import samsungD from "./configurations/samsungD";

const machineConfig = {
  machine1: {
    brand: "Toshiba",
    model: "A",
    config: toshibaA,
  },

  machine2: {
    brand: "TCL",
    model: "B",
    config: tclB,
  },

  machine3: {
    brand: "LG",
    model: "C",
    config: lgC,
  },

  machine4: {
    brand: "Samsung",
    model: "D",
    config: samsungD,
  },  
};

export default machineConfig;