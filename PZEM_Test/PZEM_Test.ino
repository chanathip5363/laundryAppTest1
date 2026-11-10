#include <PZEM004Tv30.h>

PZEM004Tv30 pzem(Serial2, 16, 17);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("PZEM test started");
}

void loop() {
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power   = pzem.power();
  float energy  = pzem.energy();

  if (isnan(voltage) || isnan(current) ||
      isnan(power) || isnan(energy)) {
    Serial.println("Cannot read PZEM");
  } else {
    Serial.printf("Voltage : %.1f V\n", voltage);
    Serial.printf("Current : %.3f A\n", current);
    Serial.printf("Power   : %.1f W\n", power);
    Serial.printf("Energy  : %.3f kWh\n", energy);
  }

  Serial.println("--------------------");
  delay(2000);
}