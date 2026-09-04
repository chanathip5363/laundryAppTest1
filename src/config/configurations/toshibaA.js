const toshibaA = {
  brand: "Toshiba",
  model: "A",
  machineType: "wash",

  programs: {
    1: {
      name: "ชุดกีฬา",
      temperature: ["20", "30", "40"],
      defaultTemperature: "20",
      temperatureCycle: ["20", "20", "30", "40", "normal"],
      aroma: true,
    },

    2: {
      name: "ผ้าขนสัตว์",
      temperature: ["20", "30", "40"],
      defaultTemperature: "40",
      temperatureCycle: ["40", "40", "normal", "20", "30"],
      aroma: false,
    },

    3: {
      name: "ผ้าบอบบาง",
      temperature: ["20", "30", "40"],
      defaultTemperature: "30",
      temperatureCycle: ["30", "30", "40", "normal", "20"],
      aroma: false,
    },

    4: {
      name: "ซักแบบประหยัด",
      temperature: ["20", "30", "40", "60"],
      defaultTemperature: "30",
      temperatureCycle: ["30", "30", "40", "60", "normal", "20"],
      aroma: false,
    },

    5: {
      name: "ผ้าผสม 45 นาที",
      temperature: ["20", "30", "40", "60"],
      defaultTemperature: "30",
      temperatureCycle: ["30", "30", "40", "60", "normal", "20"],
      aroma: true,
    },

    6: {
      name: "ซักด่วน 15 นาที",
      temperature: ["20", "30", "40"],
      defaultTemperature: "normal",
      temperatureCycle: ["normal", "normal", "20", "30", "40"],
      aroma: false,
    },

    7: {
      name: "ผ้าฝ้าย",
      temperature: ["20", "30", "40", "60", "90"],
      defaultTemperature: "40",
      temperatureCycle: ["40", "40", "60", "90", "normal", "20", "30"],
      aroma: true,
    },

    8: {
      name: "ผ้าขาว",
      temperature: ["20", "30", "40", "60"],
      defaultTemperature: "30",
      temperatureCycle: ["30", "30", "40", "60", "normal", "20"],
      aroma: true,
    },

    9: {
      name: "ซักถนอมสีผ้า",
      temperature: ["20", "30", "40"],
      defaultTemperature: "normal",
      temperatureCycle: ["normal", "normal"],
      aroma: false,
    },

    10: {
      name: "ซักอบไอน้ำ",
      temperature: [],
      defaultTemperature: null,
      temperatureCycle: ["normal", "normal"],
      aroma: false,
    },
  },

  temperaturePrice: {
    "20": 3,
    "30": 4,
    "40": 8,
    "60": 15,
    "90": 20,
  },

  communication: {
    protocol: "MQTT",
    topic: null,
    commandFormat: null,
  },
};

export default toshibaA;