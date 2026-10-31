"use strict";

const mqtt = require("mqtt");

const IDENTIFIER = /^[a-zA-Z0-9_-]+$/;

function assertIdentifier(value, name) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

function commandTopic(shopId, machineId) {
  assertIdentifier(shopId, "shopId");
  assertIdentifier(machineId, "machineId");
  return `laundry/${shopId}/${machineId}/cmd`;
}

function validateCommand(command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new Error("Invalid command");
  }
  if (command.type === "finish") {
  return { type: "finish" };
  }
  if (typeof command.txid !== "string" || !command.txid.trim()) {
    throw new Error("Missing txid");
  }
  if (!Number.isSafeInteger(command.program) || command.program < 1) {
    throw new Error("Invalid program");
  }
  if (command.type === "wash") {
    for (const field of ["tempPulse", "aromaPulse"]) {
      if (!Number.isSafeInteger(command[field]) || command[field] < 0) {
        throw new Error(`Invalid ${field}`);
      }
    }
  } else if (command.type === "dry") {
    if (typeof command.temperatureOption !== "string" && command.temperatureOption !== null) {
      throw new Error("Invalid temperatureOption");
    }
    if (typeof command.wrinkleOption !== "boolean") {
      throw new Error("Invalid wrinkleOption");
    }
  } else {
    throw new Error("Invalid command type");
  }
  return {
    txid: command.txid,
    type: command.type,
    program: command.program,
    ...(command.type === "wash"
      ? { tempPulse: command.tempPulse, aromaPulse: command.aromaPulse }
      : { temperatureOption: command.temperatureOption, wrinkleOption: command.wrinkleOption }),
  };
}

function createMqttManager({
  host = process.env.LAUNDRY_MQTT_HOST || "api.the-oasis-living.com",
  port = Number(process.env.LAUNDRY_MQTT_PORT || 8883),
  username = process.env.LAUNDRY_MQTT_USERNAME,
  password = process.env.LAUNDRY_MQTT_PASSWORD,
} = {}) {
  if (!username || !password) {
    throw new Error("LAUNDRY_MQTT_USERNAME and LAUNDRY_MQTT_PASSWORD are required");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid MQTT port");
  }

  // No connection is created until connect() is explicitly called.
  let client = null;
  let messageHandler = null;

  function connect() {
    if (client) return client;
    client = mqtt.connect(`mqtts://${host}:${port}`, {
      username,
      password,
      rejectUnauthorized: true,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
    });
    client.on("error", err => console.error("[MQTT NEW]", err.message));
    client.on("connect", () => {
      // Multi-shop subscription: broker ACL must authorize laundry/+/+/+.
      for (const type of ["state", "status", "telemetry"]) {
        const topic = `laundry/+/+/${type}`;
        client.subscribe(topic, { qos: 1 }, (err, granted) => {
          if (err || !granted?.some(item => item.qos !== 128)) {
            console.error("[MQTT NEW] Subscribe failed:", topic, err?.message || "Not authorized");
          }
        });
      }
    });
    client.on("message", (topic, payload) => {
      const match = /^laundry\/([^/]+)\/([^/]+)\/(state|status|telemetry)$/.exec(topic);
      if (!match || !messageHandler) return;
      try {
        messageHandler({ shopId: match[1], machineId: match[2], type: match[3], message: payload.toString() });
      } catch (err) {
        console.error("[MQTT NEW] Message handler error:", err.message);
      }
    });
    return client;
  }

  function publishCommand(shopId, machineId, command) {
    if (!client || !client.connected) {
      return Promise.reject(new Error("MQTT broker is not connected"));
    }
    const topic = commandTopic(shopId, machineId);
    const payload = JSON.stringify(validateCommand(command));
    return new Promise((resolve, reject) => {
      client.publish(topic, payload, { qos: 1, retain: false }, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  function onMessage(handler) {
    if (handler !== null && typeof handler !== "function") {
      throw new Error("Invalid MQTT message handler");
    }
    messageHandler = handler;
  }

  function close() {
    if (client) client.end();
    client = null;
  }

  return { connect, publishCommand, onMessage, close };
}

module.exports = { createMqttManager, commandTopic, validateCommand };
