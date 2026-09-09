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

const char* MACHINE_ID = "machine3";

WiFiClientSecure espClient;
PubSubClient client(espClient);


// ======================================================
// PIN
// ======================================================

#define D0 15
#define D1 2
#define D2 4
#define D5 16
#define D6 17
#define D7 5    // temp
#define D8 18   // start
#define D9 19   // arom
#define DOOR_PIN 32
#define BUZZER_PIN 33


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


// ======================================================
// SELECTOR PATTERN
// ======================================================

byte pattern[16][5] = {


  {1,0,1,1,0}, // 12 - 4
  {1,0,1,1,1}, // 13 - 5
  {0,0,1,0,0}, // 8 - 0
  {0,0,1,0,1}, // 9 - 1
  {1,0,1,0,1}, // 10 - 2
  {1,0,1,0,0}, // 11 - 3  
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
  digitalWrite(D5, pattern[pos][3]);
  digitalWrite(D6, pattern[pos][4]);
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


  // ----------------------------------------------------
  // PIN MODE
  // ----------------------------------------------------

  pinMode(D0, OUTPUT);

  pinMode(D1, OUTPUT);

  pinMode(D2, OUTPUT);

  pinMode(D5, OUTPUT);

  pinMode(D6, OUTPUT);

  pinMode(D7, OUTPUT);

  pinMode(D8, OUTPUT);

  pinMode(D9, OUTPUT);

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
        "ONLINE"
      );


      // -------------------------------------------------
      // Selector recovery
      // -------------------------------------------------

      bool selectorMoving =
        prefs.getBool(
          "selectorMoving",
          false
        );


      if (selectorMoving) {

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


  digitalWrite(D8, HIGH);


  Serial.println("TOUCH BTN POWER");


  delayloop(1000);


  digitalWrite(D8, LOW);


  Serial.println("POWER ON");


  delayloop(1000);


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


  delayloop(3000);


  Serial.println("Goto Cal+1");


  sendPattern(1);


  delayloop(3000);


  // i = 2 เพราะ Goto Calibate+1 ไปแล้ว

  for (int i = 2; i <= program; i++) {


    Serial.print("Position ");

    Serial.println(i);


    sendPattern(i);


    delayloop(800);


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


    if (
      client.connect(
        clientID.c_str(),
        mqtt_user,
        mqtt_pass
      )
    ) {


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


      client.subscribe(
        programTopic.c_str()
      );


      client.subscribe(
        finishTopic.c_str()
      );


      client.subscribe(
        resetTopic.c_str()
      );


    } else {


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
      "ONLINE"
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