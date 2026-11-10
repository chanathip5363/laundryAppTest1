#include <PZEM004Tv30.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <esp_task_wdt.h>  // การทำ watchdog ทำต้อจากเพิ่ม Heartbeat เพื่อป้องกัน ESP ค้าง
#include <Preferences.h>   // การทำ ESP จำโปรแกรมล่าสุด เวลาไฟดับ ESP รีบูต ต่อจากการทำ state โดยใช้หน่วยความจำในตัวของ ESP32 NVS


// ======================================================
// WIFI 2 สถานที่
// ======================================================

// WiFi บ้าน
const char* ssid1 = "napok_home2G";
const char* password1 = "pakpubun";

// WiFi ที่ทำงาน
const char* ssid2 = "NT363_2.4G";
const char* password2 = "Suppakamlang";


// ======================================================
// MQTT
// ======================================================

const char* mqtt_server = "1f987687489a42f296be8b2579cd71f5.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;

const char* mqtt_user = "ESP32";
const char* mqtt_pass = "Laundry123";

const char* MACHINE_ID = "machine1";

WiFiClientSecure espClient;
PubSubClient client(espClient);


// ======================================================
// PIN
// ======================================================

#define D0 4
#define D1 13
#define D2 25
#define D3 26
#define D4 27
#define D7 23       // TEMP
#define D8 18       // START
#define D9 19       // AROMA
#define DOOR_PIN 32
#define BUZZER_PIN 33


// PZEM-004T V3: ESP32 RX=16, TX=17 via 3.3V/5V level converter.
PZEM004Tv30 pzem(Serial2, 16, 17);
const unsigned long PZEM_INTERVAL_MS = 2000;
unsigned long lastPzemRead = 0;
void readPzem();

// PC817: LOW = lock feedback present, HIGH = feedback absent.
const unsigned long DOOR_LOCK_CONFIRM_MS = 500;
const unsigned long DOOR_UNLOCK_CONFIRM_MS = 2000;
const unsigned long DOOR_LOCK_TIMEOUT_MS = 30000;
bool doorRawLocked = false;
bool doorStableLocked = false;
bool doorSampleReady = false;
bool waitingForDoorLock = false;
bool doorFinishSent = false;
unsigned long doorRawSince = 0;
unsigned long doorWaitStarted = 0;

// Explicit declarations also allow ordinary C++ syntax checks.
void processBuzzer();
void handleEvent(int count);
void runProgram(int program);
void startMachine();
void finishMachine();
void resetMachine();
void processDoorLock();
void setMachineState(const char* state);

unsigned long lastStatus = 0; // 200469 เพิ่มอ่าน buuzer

String machineState = "IDLE";  // เป็นการทำ State ของเครื่อง ต่อจากการทำ watchdog ก็จะมี IDLE RUNNING FINISH ERROR OFFLINE เป็นต้น

bool powerOn = false;

volatile int pulseCount = 0;  // 200469 เพิ่มอ่าน buuzer คำสั่งลงไป 4 บรรทัด
volatile unsigned long lastPulseTime = 0;
volatile unsigned long lastValidPulse = 0;

volatile bool buzzerActive = false;   // 200526 เริ่มทำ interrupt trigger

const unsigned long EVENT_GAP = 350;

Preferences prefs;  // การทำ ESP จำโปรแกรมล่าสุด เวลาไฟดับ ESP รีบูต ต่อจากการทำ state โดยใช้หน่วยความจำในตัวของ ESP32 NVS

int program = 0;


// ======================================================
// SELECTOR PATTERN
// ======================================================

byte pattern[16][5] = {

  {0,0,1,0,0}, // 8 - 0
  {0,0,1,0,1}, // 9 - 1
  {1,0,1,0,1}, // 10 - 2
  {1,0,1,0,0}, // 11 - 3
  {1,0,1,1,0}, // 12 - 4
  {1,0,1,1,1}, // 13 - 5
  {0,0,1,1,1}, // 14 - 6
  {0,0,1,1,0}, // 15 - 7
  {0,1,1,1,1}, // 1 - 9 - 8
  {1,1,1,1,1}, // 2 - 10 - 9
  {1,1,1,1,0}, // 3 - 11 - 10
  {1,1,1,0,0}, // 4 - 12 - 11
  {1,1,1,0,1}, // 5 - 13 - 12
  {0,1,1,0,1}, // 6 - 14 - 13
  {0,1,1,0,0}, // 7 - 15 - 14
  {0,1,1,1,0}  // 0 - 8 -15 OFF

};

int aromaPulse;
int tempPulse;


// ======================================================
// DELAY LOOP
// ======================================================

void delayloop(unsigned long waitTime) {

  unsigned long start = millis();

  while (millis() - start < waitTime) {

    client.loop();

    processBuzzer();   // 260569 ⭐ เพิ่มบรรทัดนี้
    processDoorLock();

    esp_task_wdt_reset();

    yield();
  }
}


// ======================================================
// SEND PATTERN
// ======================================================

void sendPattern(int pos) {

  digitalWrite(D0, pattern[pos][0]);
  digitalWrite(D1, pattern[pos][1]);
  digitalWrite(D2, pattern[pos][2]);
  digitalWrite(D3, pattern[pos][3]);
  digitalWrite(D4, pattern[pos][4]);
}


// ======================================================
// MQTT CALLBACK
// ======================================================

void callback(char* topic, byte* payload, unsigned int length) {

  String msg;

  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }

  String t = String(topic);


  if (t == String("laundry/") + MACHINE_ID + "/tempPulse") {

    tempPulse = msg.toInt();
  }


  if (t == String("laundry/") + MACHINE_ID + "/aromaPulse") {

    aromaPulse = msg.toInt();
  }


  if (t == String("laundry/") + MACHINE_ID + "/program") {

    program = msg.toInt();

    Serial.println("TEMP = " + String(tempPulse));
    Serial.println("AROMA = " + String(aromaPulse));

    runProgram(program);
  }


  if (t == String("laundry/") + MACHINE_ID + "/finish") {

    finishMachine();
  }


  if (t == String("laundry/") + MACHINE_ID + "/reset") {

    resetMachine();
  }
}


// ======================================================
// BUZZER INTERRUPT
// ======================================================

void IRAM_ATTR onPulse() {

  unsigned long now = millis();

  // กันนับซ้ำจากคลื่นเดียวกัน
  if (now - lastValidPulse > 180) {

    pulseCount++;

    lastValidPulse = now;
  }

  lastPulseTime = now;

  buzzerActive = true;
}


// ======================================================
// PROCESS BUZZER
// ======================================================

void processBuzzer() {

  if (pulseCount > 0 && millis() - lastPulseTime > EVENT_GAP) {

    noInterrupts();

    int count = pulseCount;

    pulseCount = 0;

    interrupts();


    Serial.print("BUZZER COUNT = ");

    Serial.println(count);


    handleEvent(count);
  }
}


// ======================================================
// TRY WIFI
// ลองเชื่อม WiFi 1 ตัว เป็นเวลาไม่เกิน 10 วินาที
// ======================================================

bool tryWiFi(const char* ssid, const char* password) {

  Serial.print("Trying WiFi: ");

  Serial.println(ssid);


  WiFi.disconnect();

  delay(200);


  WiFi.begin(ssid, password);


  unsigned long startAttempt = millis();


  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startAttempt < 10000
  ) {

    esp_task_wdt_reset();

    delay(500);

    Serial.print(".");
  }


  Serial.println();


  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi Connected");

    Serial.print("SSID: ");

    Serial.println(WiFi.SSID());


    Serial.print("IP: ");

    Serial.println(WiFi.localIP());


    Serial.print("Signal RSSI: ");

    Serial.println(WiFi.RSSI());


    return true;
  }


  Serial.println("Connection failed");

  return false;
}


// ======================================================
// CONNECT WIFI
// ลอง WiFi บ้านก่อน
// ถ้าไม่เจอ จะลอง WiFi ที่ทำงาน
// ถ้าไม่เจอทั้งคู่ จะวนลองใหม่
// ======================================================

void connectWiFi() {

  WiFi.mode(WIFI_STA);


  while (WiFi.status() != WL_CONNECTED) {


    // ------------------------------------------
    // ลอง WiFi บ้าน
    // ------------------------------------------

    if (tryWiFi(ssid1, password1)) {

      return;
    }


    // ------------------------------------------
    // ลอง WiFi ที่ทำงาน
    // ------------------------------------------

    if (tryWiFi(ssid2, password2)) {

      return;
    }


    // ------------------------------------------
    // ไม่เจอทั้ง 2 ตัว
    // ------------------------------------------

    Serial.println("No known WiFi found.");

    Serial.println("Retry in 2 seconds...");


    esp_task_wdt_reset();

    delay(2000);
  }
}


// ======================================================
// SETUP
// ======================================================

void setup() {


  // ----------------------------------------------------
  // SERIAL
  // ----------------------------------------------------

  Serial.begin(115200);


  // ----------------------------------------------------
  // WATCHDOG
  // ----------------------------------------------------

  esp_task_wdt_config_t wdt_config = {

    .timeout_ms = 30000,

    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,

    .trigger_panic = true
  };


  esp_task_wdt_init(&wdt_config);

  esp_task_wdt_add(NULL);


  // ----------------------------------------------------
  // Preferences
  // ----------------------------------------------------

  prefs.begin("laundry", false);


  String state = prefs.getString("state", "IDLE");


  program = prefs.getInt("program", 0);


  Serial.println("Last State = ");

  Serial.println(state);


  machineState = state;


  String previousState = machineState;
  if (previousState == "RUNNING" || previousState == "STARTING") {
    machineState = "UNKNOWN";
  }


  // ----------------------------------------------------
  // PIN MODE
  // ----------------------------------------------------

  pinMode(D0, OUTPUT);

  pinMode(D1, OUTPUT);

  pinMode(D2, OUTPUT);

  pinMode(D3, OUTPUT);

  pinMode(D4, OUTPUT);

  pinMode(D7, OUTPUT);  // ปล่อย TEMP โดยไม่เปิด pull-up/down  pinMode(D7, OUTPUT);
  digitalWrite(D7, LOW);

  pinMode(D8, OUTPUT);  // ปล่อย TEMP โดยไม่เปิด pull-up/downpinMode(D8, OUTPUT);
  digitalWrite(D8, LOW);

  pinMode(D9, OUTPUT); // ปล่อย TEMP โดยไม่เปิด pull-up/down pinMode(D9, OUTPUT);
  digitalWrite(D9, LOW);

  pinMode(DOOR_PIN, INPUT_PULLUP);

  pinMode(BUZZER_PIN, INPUT_PULLUP);


  attachInterrupt(
    digitalPinToInterrupt(BUZZER_PIN),
    onPulse,
    FALLING
  );


  // ====================================================
  // CONNECT WIFI
  // ====================================================

  Serial.println();

  Serial.println("==============================");

  Serial.println("Connecting WiFi");

  Serial.println("==============================");


  connectWiFi();


  // ====================================================
  // MQTT
  // ====================================================

  espClient.setInsecure();


  client.setServer(
    mqtt_server,
    mqtt_port
  );


  client.setKeepAlive(60);


  client.setCallback(callback);


  while (!client.connected()) {


    Serial.println("Connecting MQTT...");


    String clientID =
      String("Laundry") + MACHINE_ID;


    String statusTopic =
      String("laundry/") +
      MACHINE_ID +
      "/status";


    if (
      client.connect(
        clientID.c_str(),
        mqtt_user,
        mqtt_pass,
        statusTopic.c_str(),
        0,
        true,
        "OFFLINE"
      )
    ) {


      Serial.println("MQTT Connected");


      client.publish(
        "test/topic",
        "ESP32 connected"
      );


      client.publish(
        statusTopic.c_str(),
        "ONLINE",
        true
      );


      // -------------------------------------------------
      // Selector recovery
      // -------------------------------------------------

      bool selectorMoving =
        prefs.getBool(
          "selectorMoving",
          false
        );


      if (selectorMoving && previousState != "RUNNING" && previousState != "STARTING") {

        Serial.println(
          "Recovery selector position"
        );

        sendPattern(15);

        delayloop(2000);

        runProgram(program);
      }


      // -------------------------------------------------
      // State Recovery
      // -------------------------------------------------

      if (previousState == "RUNNING" || previousState == "STARTING") {
        Serial.println("[RECOVERY] Waiting for actual door lock feedback");
        waitingForDoorLock = true;
        doorFinishSent = false;
        doorSampleReady = false;
        doorStableLocked = false;
        doorWaitStarted = millis();
        setMachineState("UNKNOWN");
      } else {
        String stateTopic = String("laundry/") + MACHINE_ID + "/state";
        client.publish(stateTopic.c_str(), machineState.c_str(), true);
      }


      // -------------------------------------------------
      // MQTT Subscribe
      // -------------------------------------------------

      String programTopic =
        String("laundry/") +
        MACHINE_ID +
        "/program";


      String finishTopic =
        String("laundry/") +
        MACHINE_ID +
        "/finish";


      String resetTopic =
        String("laundry/") +
        MACHINE_ID +
        "/reset";


      String aromaTopic =
        String("laundry/") +
        MACHINE_ID +
        "/aromaPulse";


      String tempTopic =
        String("laundry/") +
        MACHINE_ID +
        "/tempPulse";


      client.subscribe(
        programTopic.c_str()
      );


      client.subscribe(
        finishTopic.c_str()
      );


      client.subscribe(
        resetTopic.c_str()
      );


      client.subscribe(
        aromaTopic.c_str()
      );


      client.subscribe(
        tempTopic.c_str()
      );


    } else {


      Serial.print("Failed, rc=");

      Serial.println(client.state());


      delayloop(2000);
    }
  }
}


// ======================================================
// START MACHINE
// ======================================================

void startMachine() {
  // Save STARTING before issuing the touch pulse; RUNNING needs lock feedback.
  waitingForDoorLock = false;
  doorFinishSent = false;
  doorSampleReady = false;
  doorStableLocked = false;
  setMachineState("STARTING");
  prefs.putInt("program", program);
  prefs.putBool("selectorMoving", false);

  digitalWrite(D8, HIGH);
  Serial.println("TOUCH BTN POWER");
  delayloop(800);
  digitalWrite(D8, LOW);
  Serial.println("POWER ON");
  delayloop(1000);

  // Start the timeout only after the original touch sequence is complete.
  doorSampleReady = false;
  doorWaitStarted = millis();
  waitingForDoorLock = (machineState == "STARTING");
  Serial.println("[DOOR] Waiting for lock (GPIO32 LOW)");
}

// ======================================================
// DOOR LOCK FEEDBACK
// ======================================================

void setMachineState(const char* state) {
  machineState = state;
  prefs.putString("state", state);
  String topic = String("laundry/") + MACHINE_ID + "/state";
  client.publish(topic.c_str(), state, true);
  Serial.print("[STATE] ");
  Serial.println(state);
}

void processDoorLock() {
  unsigned long now = millis();
  bool locked = (digitalRead(DOOR_PIN) == LOW);
  if (!doorSampleReady || locked != doorRawLocked) {
    doorSampleReady = true;
    doorRawLocked = locked;
    doorRawSince = now;
  }

  unsigned long confirmTime = locked ? DOOR_LOCK_CONFIRM_MS : DOOR_UNLOCK_CONFIRM_MS;
  if (now - doorRawSince >= confirmTime && doorStableLocked != locked) {
    doorStableLocked = locked;
    Serial.println(locked ? "[DOOR] LOCKED" : "[DOOR] UNLOCKED");

    if (!locked && machineState == "RUNNING" && !doorFinishSent) {
      doorFinishSent = true;
      Serial.println("FINISH DOOR UNLOCK");
      String topic = String("laundry/") + MACHINE_ID + "/finish";
      // The existing /finish callback performs finishMachine().
      // Mark sent only on success so the main loop can retry if disconnected.
      doorFinishSent = client.publish(topic.c_str(), "1");
    }
  }

  // Retry a failed finish publication without repeating hardware actions here.
  if (!locked && !doorStableLocked && now - doorRawSince >= DOOR_UNLOCK_CONFIRM_MS &&
      machineState == "RUNNING" && !doorFinishSent) {
    String topic = String("laundry/") + MACHINE_ID + "/finish";
    doorFinishSent = client.publish(topic.c_str(), "1");
  }

  if (waitingForDoorLock && locked && doorStableLocked) {
    waitingForDoorLock = false;
    setMachineState("RUNNING");
    Serial.println("Machine Start confirmed by Door Lock");
  } else if (waitingForDoorLock && now - doorWaitStarted >= DOOR_LOCK_TIMEOUT_MS) {
    waitingForDoorLock = false;
    setMachineState("ERROR");
    Serial.println("[DOOR] Lock not confirmed within 30 seconds; inspect door and retry after reset");
  }
}


// ======================================================
// RUN PROGRAM
// ======================================================

void runProgram(int program) {


  prefs.putInt(
    "program",
    program
  );


  prefs.putBool(
    "selectorMoving",
    true
  );


  Serial.println("Goto Cal");


  sendPattern(0);


  delayloop(2000);


  Serial.println("Goto Cal+1");


  sendPattern(1);


  delayloop(2000);


  // i = 2 เพราะ Goto Calibate+1 ไปแล้ว

  for (int i = 2; i <= program; i++) {


    Serial.print("Position ");

    Serial.println(i);


    sendPattern(i);


    delayloop(400);


    client.loop();
  }


  delayloop(2000);


  // ----------------------------------------------------
  // Temperature Pulse
  // ----------------------------------------------------

  for (int i = 0; i < tempPulse; i++) {
    digitalWrite(D7, HIGH);
    Serial.println("TEMP Pulse ON");
    delayloop(800);
    digitalWrite(D7, LOW);
    Serial.println("TEMP Pulse OFF");
    delayloop(1000);
  }

  delayloop(2000);


  // ----------------------------------------------------
  // Aroma Pulse
  // ----------------------------------------------------

  for (int i = 0; i < aromaPulse; i++) {

    digitalWrite(D9, HIGH);
    Serial.println("AROMA Pulse ON");
    delayloop(800);
    digitalWrite(D9, LOW);
    Serial.println("AROMA Pulse OFF");
    delayloop(1000);
  }

  delayloop(2000);


  startMachine();
}


// ======================================================
// FINISH MACHINE
// ======================================================

void finishMachine() {
  waitingForDoorLock = false;
  doorFinishSent = true;



  Serial.println("Finish → OFF");


  digitalWrite(D8, HIGH);


  Serial.println("TOUCH BTN POWER");


  delayloop(800);


  digitalWrite(D8, LOW);


  Serial.println("POWER OFF");


  delayloop(1000);


  sendPattern(15);


  delayloop(2000);


  machineState = "FINISH";


  String stateTopic5 =
    String("laundry/") +
    MACHINE_ID +
    "/state";


  client.publish(
    stateTopic5.c_str(),
    "FINISH"
  );


  Serial.println("[STATE] FINISH");


  prefs.putString(
    "state",
    "FINISH"
  );


  Serial.println("Machine Finish");


  resetMachine();
}


// ======================================================
// MQTT RECONNECT
// ======================================================

void reconnect() {


  Serial.println("[MQTT] Reconnecting...");


  while (!client.connected()) {


      String clientID =
        String("Laundry") +
        MACHINE_ID;

      String statusTopic =
        String("laundry/") +
        MACHINE_ID +
        "/status";

      if (
        client.connect(
          clientID.c_str(),
          mqtt_user,
          mqtt_pass,
          statusTopic.c_str(),
          0,
          true,
          "OFFLINE"
        )
      ) {

      Serial.println("[MQTT] Reconnected OK");

      String programTopic =
        String("laundry/") +
        MACHINE_ID +
        "/program";


      String finishTopic =
        String("laundry/") +
        MACHINE_ID +
        "/finish";


      String resetTopic =
        String("laundry/") +
        MACHINE_ID +
        "/reset";

      String aromaTopic = String("laundry/") + MACHINE_ID + "/aromaPulse";

      String tempTopic = String("laundry/") + MACHINE_ID + "/tempPulse";


      client.subscribe(
        programTopic.c_str()
      );


      client.subscribe(
        finishTopic.c_str()
      );


      client.subscribe(
        resetTopic.c_str()
      );

      client.subscribe(aromaTopic.c_str());

      client.subscribe(tempTopic.c_str());

    } else {

  Serial.print("[MQTT] Failed, state = ");
  Serial.println(client.state());

  Serial.print("[WiFi] status = ");
  Serial.println(WiFi.status());

  Serial.print("[WiFi] RSSI = ");
  Serial.println(WiFi.RSSI());

      delayloop(2000);
    }
  }
}


// ======================================================
// CHECK WIFI / AUTO RECONNECT
// ถ้า WiFi หลุด จะลอง WiFi บ้าน + ที่ทำงานใหม่
// ======================================================

void checkWiFi() {


  if (WiFi.status() != WL_CONNECTED) {


    Serial.println();

    Serial.println("Wifi Lost... Reconnecting");


    connectWiFi();


    Serial.println("Wifi Reconnected");

    Serial.print("Connected to: ");

    Serial.println(WiFi.SSID());
  }
}


// ======================================================
// RESET MACHINE
// ======================================================

void resetMachine() {
  waitingForDoorLock = false;
  doorFinishSent = false;



  Serial.println("Reset Machine -> IDLE");


  sendPattern(15);


  machineState = "IDLE";


  String stateTopic6 =
    String("laundry/") +
    MACHINE_ID +
    "/state";


  client.publish(
    stateTopic6.c_str(),
    "IDLE"
  );


  prefs.putString(
    "state",
    "IDLE"
  );


  prefs.putInt(
    "program",
    0
  );


  Serial.println("[STATE] IDLE");
}


// ======================================================
// HANDLE BUZZER EVENT
// ======================================================

void handleEvent(int count) {


  if (count == 1) {

    Serial.println("1 beep");
  }


  else if (count == 2) {

    Serial.println("2 beep");
  }


  else if (count == 3) {

    Serial.println("3 beep");
  }


  else if (count == 4) {

    Serial.println("4 beep = OFF");

    powerOn = false;
  }


  else if (count == 5) {


    if (!powerOn) {

      Serial.println("5 beep = ON");

      powerOn = true;


    } else {

      Serial.println("4 beep = OFF (extra pulse)");

      powerOn = false;
    }
  }


  else if (count == 6) {

    Serial.println("5 beep = ON (extra pulse)");

    powerOn = true;
  }
}


// ======================================================
// LOOP
// ======================================================

// Read outside delayloop() to preserve touch pulse timing.
// Energy total belongs to the PZEM; this does not reset or store it.
void readPzem() {
  if (millis() - lastPzemRead < PZEM_INTERVAL_MS) return;
  lastPzemRead = millis();

  esp_task_wdt_reset();
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power = pzem.power();
  float energy = pzem.energy();
  esp_task_wdt_reset();

  if (isnan(voltage) || isnan(current) ||
      isnan(power) || isnan(energy)) {
    Serial.println("[PZEM] Cannot read PZEM");
    return;
  }

  Serial.printf("[PZEM] Voltage : %.1f V\n", voltage);
  Serial.printf("[PZEM] Current : %.3f A\n", current);
  Serial.printf("[PZEM] Power   : %.1f W\n", power);
  Serial.printf("[PZEM] Energy total : %.3f kWh\n", energy);
}

void loop() {


  // ----------------------------------------------------
  // Check WiFi
  // ----------------------------------------------------

  checkWiFi();


  // ----------------------------------------------------
  // Check MQTT
  // ----------------------------------------------------

  if (!client.connected()) {

    reconnect();
  }


  client.loop();


  // ----------------------------------------------------
  // Door
  // ----------------------------------------------------

  processDoorLock();

  readPzem();


  // ----------------------------------------------------
  // Heartbeat
  // ----------------------------------------------------

  if (millis() - lastStatus > 30000) {


    String statusTopic =
      String("laundry/") +
      MACHINE_ID +
      "/status";


    client.publish(
      statusTopic.c_str(),
      "ONLINE",
      true
    );

    String stateTopic =
      String("laundry/") +
      MACHINE_ID +
      "/state";

    client.publish(
      stateTopic.c_str(),
      machineState.c_str(),
      true
    );

    Serial.println("[STATUS] ONLINE");


    lastStatus = millis();
  }


  // ----------------------------------------------------
  // Watchdog
  // ----------------------------------------------------

  esp_task_wdt_reset();


  delayloop(50);


  // ----------------------------------------------------
  // Buzzer
  // ----------------------------------------------------

  if (buzzerActive) {

    processBuzzer();
  }
}