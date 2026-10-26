const tclDry1 = {
  brand: "TCL",
  model: "Dry1",
  machineType: "dry",
  dryerType: "dry1",

  priceGroups: {
    25: [7, 8, 10],
    35: [1, 5, 6, 9, 11],
    45: [2, 3, 4, 12],
  },

  priceOptions: [
    {
      price: 25,
      name: "Fast Dry",
      time: "30 นาที",
      quantity: "ผ้า 2 กก. หรือประมาณ 10 ชิ้น",
      description: "เหมาะสำหรับผ้าเนื้อบาง",
    },
    {
      price: 35,
      name: "อบผ้าทั่วไป",
      time: "60 นาที",
      quantity: "ผ้า 4 กก. หรือประมาณ 15 ชิ้น",
      description: "เหมาะสำหรับผ้าทั่วไป ไม่รวมผ้าหนา",
    },
    {
      price: 45,
      name: "อบผ้าผสม",
      time: "90 นาที",
      quantity: "ผ้า 5 กก. หรือประมาณ 20 ชิ้น",
      description: "เหมาะสำหรับผ้าผสม",
    },
  ],

  programs: {
    1: { name: "ผ้าฝ้าย" },
    2: { name: "ผ้าหลายชนิด" },
    3: { name: "ผ้าใยสังเคราะห์" },
    4: { name: "ชุดเครื่องนอน" },
    5: { name: "เสื้อผ้าเด็ก" },
    6: { name: "ผ้าบอบบาง" },
    7: { name: "อบแห้งด่วน" },
    8: { name: "ไม่ใช้ความร้อน" },
    9: { name: "กำจัดกลิ่นอับ" },
    10: { name: "30 นาที" },
    11: { name: "60 นาที" },
    12: { name: "120 นาที" },
  },

  adjustableTemperaturePrograms: [1, 2, 3, 4, 5, 6, 7],

  temperatureOptions: [
    { value: "airing", name: "Airing", price: 0 },
    { value: "normal", name: "Normal Dry", price: 5 },
    { value: "extra", name: "Extra Dry", price: 10 },
  ],

  wrinklePrice: 5,

  communication: {
    protocol: "MQTT",
    topic: null,
    commandFormat: null,
  },
};

export default tclDry1;
