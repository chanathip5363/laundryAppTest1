import mqtt from "mqtt";

const broker = "wss://1f987687489a42f296be8b2579cd71f5.s1.eu.hivemq.cloud:8884/mqtt";

const options = {
  username: "ESP32",
  password: "Laundry123",
  reconnectPeriod: 1000,
};

const mqttClient = mqtt.connect(broker, options);

export default mqttClient;