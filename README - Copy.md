# 🧺 Laundry Smart System

## ภาพรวม

Laundry Smart System เป็นระบบควบคุมเครื่องซักผ้าแบบชำระเงินผ่าน QR Code โดยใช้ ESP32 เป็นตัวควบคุมเครื่องซักผ้า, React (Vite) สำหรับ Web Application และ Node.js เป็น Backend Server พร้อมสื่อสารผ่าน MQTT

---

# โครงสร้างโปรเจกต์

```
laundryAppTest1
│
├── src/                     # React Frontend
├── public/
├── laundry-server/          # Node.js Backend
├── package.json
├── vite.config.js
└── README.md
```

---

# เทคโนโลยีที่ใช้

### Frontend

* React
* Vite
* JavaScript

### Backend

* Node.js
* Express
* SQLite

### Hardware

* ESP32 Dev Module
* PC817 Optocoupler
* เครื่องซักผ้า LG / Toshiba

### Communication

* MQTT

### Payment

* PromptPay QR Code

---

# โปรแกรมที่ต้องติดตั้ง

## Windows

* Git
* Node.js
* Arduino IDE

---

# Arduino IDE

ติดตั้ง

* ESP32 by Espressif Systems
* PubSubClient Library

---

# Clone Project

```
git clone <GitHub Repository URL>
```

---

# ติดตั้ง Frontend

เปิด PowerShell

```
cd laundryAppTest1
npm install
npm run dev
```

Frontend จะทำงานที่

```
http://localhost:5173
```

---

# ติดตั้ง Backend

```
cd laundry-server
npm install
npm start
```

Server จะทำงานที่

```
http://localhost:3000
```

---

# ESP32

เลือก Board

```
ESP32 Dev Module
```

Baud Rate

```
115200
```

แก้ไขข้อมูล WiFi

```cpp
const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";
```

Upload โปรแกรม

---

# MQTT

ESP32 เชื่อมต่อ MQTT Broker

Topic หลัก

```
laundry/machine1/program
laundry/machine1/state
laundry/machine1/status
laundry/machine1/finish
laundry/machine1/tempPulse
laundry/machine1/aromaPulse
```

---

# Database

ใช้ SQLite

ตารางหลัก

```
machines
transactions
```

---

# ระบบการทำงาน

```
ลูกค้าเลือกโปรแกรม
        │
        ▼
Web Application
        │
        ▼
สร้าง PromptPay QR
        │
        ▼
ลูกค้าชำระเงิน
        │
        ▼
Backend ตรวจสอบรายการ
        │
        ▼
ส่งคำสั่ง MQTT
        │
        ▼
ESP32
        │
        ▼
เครื่องซักผ้าเริ่มทำงาน
```

---

# Deployment

Frontend

* Vercel

Backend

* Render

---

# การ Restore ระบบ

1. Clone โปรเจกต์จาก GitHub

2. Frontend

```
npm install
npm run dev
```

3. Backend

```
cd laundry-server
npm install
npm start
```

4. Arduino IDE

* ติดตั้ง ESP32 Board
* ติดตั้ง PubSubClient

5. Upload โปรแกรมลง ESP32

6. ตรวจสอบ

* Web เปิดได้
* Server ทำงาน
* MQTT Connected
* QR Code แสดง
* ESP32 Online
* เครื่องซักผ้าทำงาน

---

# ปัญหาที่พบบ่อย

### WiFi.h: No such file or directory

ติดตั้ง ESP32 Board

---

### PubSubClient.h: No such file or directory

ติดตั้ง Library

```
PubSubClient by Nick O'Leary
```

---

### MQTT Offline

ตรวจสอบ

* WiFi
* MQTT Broker
* Username / Password
* Internet

---

### QR Code ไม่แสดง

ตรวจสอบ

* Backend ทำงาน
* Browser Console
* MQTT
* การเชื่อมต่อ Server

---

# สถานะโปรเจกต์

✅ Clone จาก GitHub ได้

✅ Restore ลงเครื่องใหม่ได้

✅ Frontend ทำงาน

✅ Backend ทำงาน

✅ MQTT ทำงาน

✅ PromptPay QR ทำงาน

✅ ESP32 ทำงาน

✅ ควบคุมเครื่องซักผ้าได้

---

# Version

Current Version : v1.0 Stable

ผ่านการทดสอบ Restore บนเครื่องใหม่เรียบร้อย
