import { MQTT_TOPICS } from "../constants/mqttTopics";

export function setupMqttHandlers(client, handlers = {}) {

  client.on("message", (topic, message) => {

    const payload = message.toString();

    console.log(topic + ":" + payload);


    if (topic === MQTT_TOPICS.MACHINE1.FINISH) {

      console.log("Finish from ESP");


      if (handlers.finishWash) {
        handlers.finishWash();
      }

    }

  });

}