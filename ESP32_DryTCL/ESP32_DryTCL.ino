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

const char* MACHINE_ID = "machine5";

WiFiClientSecure espClient;
PubSubClient client(espClient);


// ======================================================
// PIN
// ======================================================

#define DOOR_PIN 32
#define BUZZER_PIN 33
// TCL DRY CONTROL
#define POWER_PIN        15
#define ENCODER_A_PIN    16
#define ENCODER_B_PIN    17
#define TEMP_PIN         5
#define ANTI_CREASE_PIN  19
#define START_PIN        18

bool lastState = HIGH;

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

String temperatureOption = "normal";
bool wrinkleOption = false;

// ======================================================
// DELAY LOOP
// ======================================================

void delayloop(unsigned long waitTime) {

  unsigned long start = millis();

  while (millis() - start < waitTime) {

    client.loop();

    processBuzzer();   // 260569 ⭐ เพิ่มบรรทัดนี้

    esp_task_wdt_reset();

    yield();
  }
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


if (t == String("laundry/") + MACHINE_ID + "/temperatureOption") {

  temperatureOption = msg;

  Serial.println(
    "TEMPERATURE OPTION = " + temperatureOption
  );
}


if (t == String("laundry/") + MACHINE_ID + "/wrinkleOption") {

  wrinkleOption = (msg == "true");

  Serial.println(
    String("WRINKLE OPTION = ") +
    (wrinkleOption ? "true" : "false")
  );
}


if (t == String("laundry/") + MACHINE_ID + "/program") {

  program = msg.toInt();

  Serial.println("PROGRAM = " + String(program));
  Serial.println(
    "TEMPERATURE = " + temperatureOption
  );
  Serial.println(
    String("WRINKLE = ") +
    (wrinkleOption ? "true" : "false")
  );

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


  // ----------------------------------------------------
  // PIN MODE
  // ----------------------------------------------------

  // TCL DRY CONTROL
  pinMode(POWER_PIN, OUTPUT);
  pinMode(ENCODER_A_PIN, OUTPUT);
  pinMode(ENCODER_B_PIN, OUTPUT);
  pinMode(TEMP_PIN, OUTPUT);
  pinMode(ANTI_CREASE_PIN, OUTPUT);
  pinMode(START_PIN, OUTPUT);

  digitalWrite(POWER_PIN, LOW);
  digitalWrite(ENCODER_A_PIN, LOW);
  digitalWrite(ENCODER_B_PIN, LOW);
  digitalWrite(TEMP_PIN, LOW);
  digitalWrite(ANTI_CREASE_PIN, LOW);
  digitalWrite(START_PIN, LOW);

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
// TCL Selector Recovery
// -------------------------------------------------

bool selectorMoving =
  prefs.getBool(
    "selectorMoving",
    false
  );

if (selectorMoving) {

  Serial.println(
    "TCL selector recovery skipped"
  );

  // ป้องกันการสั่ง POWER / PROGRAM / START ซ้ำหลัง reboot
  prefs.putBool(
    "selectorMoving",
    false
  );
}


      // -------------------------------------------------
      // State Recovery
      // -------------------------------------------------

      if (previousState == "RUNNING") {


        Serial.println(
          "Was RUNNING before power loss"
        );


        String stateTopic =
          String("laundry/") +
          MACHINE_ID +
          "/state";


        client.publish(
          stateTopic.c_str(),
          "UNKNOWN"
        );


      } else {


        String stateTopic2 =
          String("laundry/") +
          MACHINE_ID +
          "/state";


        client.publish(
          stateTopic2.c_str(),
          machineState.c_str()
        );
      }


      if (state == "RUNNING") {


        Serial.println(
          "Recovering program..."
        );


        String stateTopic3 =
          String("laundry/") +
          MACHINE_ID +
          "/state";


        client.publish(
          stateTopic3.c_str(),
          "RUNNING"
        );
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


      String wrinkleTopic =
        String("laundry/") +
        MACHINE_ID +
        "/wrinkleOption";


      String temperatureTopic =
        String("laundry/") +
        MACHINE_ID +
        "/temperatureOption";


      client.subscribe(
        programTopic.c_str()
      );


      client.subscribe(
        finishTopic.c_str()
      );


      client.subscribe(
        resetTopic.c_str()
      );


      client.subscribe(wrinkleTopic.c_str());

      client.subscribe(temperatureTopic.c_str());

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


Serial.println("TCL START");

digitalWrite(START_PIN, HIGH);

delayloop(800);

digitalWrite(START_PIN, LOW);

delayloop(1000);

Serial.println("TCL START PRESSED");


  machineState = "RUNNING";


  String stateTopic4 =
    String("laundry/") +
    MACHINE_ID +
    "/state";


  client.publish(
    stateTopic4.c_str(),
    "RUNNING"
  );


  Serial.println("[STATE] RUNNING");


  prefs.putString(
    "state",
    "RUNNING"
  );


  prefs.putInt(
    "program",
    program
  );


  Serial.println("Machine Start");


  prefs.putBool(
    "selectorMoving",
    false
  );
}

// ======================================================
// TCL DRY - POWER ON
// ======================================================

void powerOnDryer() {

  Serial.println("TCL POWER ON");

  digitalWrite(POWER_PIN, HIGH);

  delayloop(800);

  digitalWrite(POWER_PIN, LOW);

  // รอหน้าเครื่องเปิดและกลับมาที่ Program 1
  delayloop(2000);

  Serial.println("TCL READY - PROGRAM 1");
}

// ======================================================
// TCL DRY - ROTARY RIGHT 1 STEP
// A -> B
// ======================================================

void stepRight() {

  digitalWrite(ENCODER_A_PIN, HIGH);
  digitalWrite(ENCODER_B_PIN, LOW);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, HIGH);
  digitalWrite(ENCODER_B_PIN, HIGH);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, LOW);
  digitalWrite(ENCODER_B_PIN, HIGH);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, LOW);
  digitalWrite(ENCODER_B_PIN, LOW);
  delayloop(500);
}


// ======================================================
// TCL DRY - ROTARY LEFT 1 STEP
// B -> A
// ======================================================

void stepLeft() {

  digitalWrite(ENCODER_A_PIN, LOW);
  digitalWrite(ENCODER_B_PIN, HIGH);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, HIGH);
  digitalWrite(ENCODER_B_PIN, HIGH);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, HIGH);
  digitalWrite(ENCODER_B_PIN, LOW);
  delayloop(500);

  digitalWrite(ENCODER_A_PIN, LOW);
  digitalWrite(ENCODER_B_PIN, LOW);
  delayloop(500);
}

// ======================================================
// TCL DRY - SELECT PROGRAM
// Start position = Program 1
// ======================================================

void selectProgram(int targetProgram) {

  Serial.print("SELECT PROGRAM = ");
  Serial.println(targetProgram);

  // ป้องกันค่าผิด
  if (targetProgram < 1 || targetProgram > 12) {
    Serial.println("INVALID PROGRAM");
    return;
  }

  // Program 1 = ตำแหน่งเริ่มต้น ไม่ต้องขยับ
  if (targetProgram == 1) {
    Serial.println("PROGRAM 1 - NO MOVE");
    return;
  }

  // Program 2-6 = ไปทางซ้าย B -> A
  if (targetProgram >= 2 && targetProgram <= 6) {

    int steps = targetProgram - 1;

    Serial.print("MOVE LEFT STEPS = ");
    Serial.println(steps);

    for (int i = 0; i < steps; i++) {
      stepLeft();
    }

    return;
  }

  // Program 7-12 = ไปทางขวา A -> B
  if (targetProgram >= 7 && targetProgram <= 12) {

    int steps = targetProgram - 6;

    Serial.print("MOVE RIGHT STEPS = ");
    Serial.println(steps);

    for (int i = 0; i < steps; i++) {
      stepRight();
    }
  }
}

// ======================================================
// TCL DRY - TEMPERATURE
// Default = Normal Dry
//
// Airing     : 2 presses
// Normal Dry : 0 press
// Extra Dry  : 1 press
//
// Program 8-12 cannot change temperature
// ======================================================

void pressTempButton() {

  digitalWrite(TEMP_PIN, HIGH);
  delayloop(800);

  digitalWrite(TEMP_PIN, LOW);
  delayloop(1000);
}

void setTemperature(int targetProgram, String option) {

  // Program 8-12 ไม่สามารถปรับอุณหภูมิได้
  if (targetProgram >= 8 && targetProgram <= 12) {
    Serial.println("TEMP LOCKED FOR PROGRAM 8-12");
    return;
  }

  Serial.print("TEMPERATURE OPTION = ");
  Serial.println(option);

  // ค่าเริ่มต้นของเครื่อง = Normal Dry
  if (option == "normal") {
    Serial.println("NORMAL DRY - NO PRESS");
    return;
  }

  // Normal -> Extra
  if (option == "extra") {
    pressTempButton();
    return;
  }

  // Normal -> Extra -> Airing
  if (option == "airing") {
    pressTempButton();
    pressTempButton();
    return;
  }

  Serial.println("INVALID TEMPERATURE OPTION");
}

// ======================================================
// TCL DRY - ANTI CREASE
// Default = OFF
//
// false : no press
// true  : press 1 time
// Available for Program 1-12
// ======================================================

void setAntiCrease(bool enabled) {

  Serial.print("ANTI CREASE = ");
  Serial.println(enabled ? "ON" : "OFF");

  // ค่าเริ่มต้นของเครื่อง = OFF
  if (!enabled) {
    Serial.println("ANTI CREASE OFF - NO PRESS");
    return;
  }

  digitalWrite(ANTI_CREASE_PIN, HIGH);
  delayloop(800);

  digitalWrite(ANTI_CREASE_PIN, LOW);
  delayloop(1000);

  Serial.println("ANTI CREASE ON");
}

// ======================================================
// RUN PROGRAM
// ======================================================

void runProgram(int program) {

  // ตรวจสอบหมายเลขโปรแกรมก่อนสั่งเครื่อง
  if (program < 1 || program > 12) {
    Serial.println("INVALID TCL PROGRAM");
    return;
  }

  // บันทึกโปรแกรม
  prefs.putInt(
    "program",
    program
  );

  // กำลังอยู่ในขั้นตอนตั้งค่าเครื่อง
  prefs.putBool(
    "selectorMoving",
    true
  );

  Serial.println("====================");
  Serial.println("TCL DRY START SEQUENCE");
  Serial.print("PROGRAM = ");
  Serial.println(program);
  Serial.print("TEMPERATURE = ");
  Serial.println(temperatureOption);
  Serial.print("WRINKLE = ");
  Serial.println(
    wrinkleOption ? "true" : "false"
  );
  Serial.println("====================");

  // 1. เปิดเครื่อง
  powerOnDryer();

  // 2. เลือกโปรแกรมจากตำแหน่งเริ่มต้น Program 1
  selectProgram(program);

  // 3. ตั้งอุณหภูมิ
  // Program 8-12 จะถูกข้ามภายใน setTemperature()
  setTemperature(
    program,
    temperatureOption
  );

  // 4. ตั้ง Anti-Crease
  setAntiCrease(
    wrinkleOption
  );

  // 5. กด START และเปลี่ยนสถานะเป็น RUNNING
  startMachine();
}


// ======================================================
// FINISH MACHINE
// ======================================================

void finishMachine() {

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

      String wrinkleTopic = String("laundry/") + MACHINE_ID + "/wrinkleOption";

      String temperatureTopic = String("laundry/") + MACHINE_ID + "/temperatureOption";


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
        wrinkleTopic.c_str()
      );

      client.subscribe(
        temperatureTopic.c_str()
      );

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


  Serial.println("Reset Machine -> IDLE");


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

  bool current =
    digitalRead(DOOR_PIN);


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


  // ----------------------------------------------------
  // Finish Door Unlock
  // ----------------------------------------------------

  if (
    lastState == HIGH &&
    current == LOW
  ) {


    Serial.println("FINISH DOOR UNLOCK");


    String finishTopic2 =
      String("laundry/") +
      MACHINE_ID +
      "/finish";


    client.publish(
      finishTopic2.c_str(),
      "1"
    );
  }


  lastState = current;


  delayloop(50);


  // ----------------------------------------------------
  // Buzzer
  // ----------------------------------------------------

  if (buzzerActive) {

    processBuzzer();
  }
}