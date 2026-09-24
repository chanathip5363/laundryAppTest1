import toshibaA from "./configurations/toshibaA";
import tclB from "./configurations/tclB";
import lgC from "./configurations/lgC";
import samsungD from "./configurations/samsungD";

const machineConfig = {
  machine1: {
    service: "wash",
    brand: "Toshiba",
    model: "A",
    config: toshibaA,
  },

  machine2: {
    service: "wash",
    brand: "TCL",
    model: "B",
    config: tclB,
  },

  machine3: {
    service: "wash",
    brand: "LG",
    model: "C",
    config: lgC,
  },

  machine4: {
    service: "wash",
    brand: "Samsung",
    model: "D",
    config: samsungD,
  },  

  machine5: {
    service: "dry",
    brand: "TCL",
    model: "Dry1",
    drySystem: "hot-air",
  },  
};

export default machineConfig;