import { useEffect, useState } from "react";
function QRPayment({
  generateQR,
  getTotalPrice,
  setProgram,
  setStep,
  setProgramPrice,
  resetOptions,
  confirmWash,
  reservedUntil
}) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!reservedUntil) return;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((reservedUntil - Date.now()) / 1000)
      );

      setTimeLeft(remaining);
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [reservedUntil]);
      const isExpired = reservedUntil && timeLeft === 0;

    if (isExpired) {
      return (
        <>
          <h2>QR หมดอายุ</h2>

          <p>กรุณาทำรายการใหม่</p>

          <button onClick={() => setStep(1)}>
            กลับหน้าแรก
          </button>
        </>
      );
    }      

  return (
    <>
      <h2>ชำระเงิน</h2>

      <img
        src={generateQR()}
        alt="QR"
        style={{ width: "250px" }}
      />

      <h2>{getTotalPrice()} บาท</h2>

      <h3>
        เหลือเวลา {Math.floor(timeLeft / 60)}:
        {String(timeLeft % 60).padStart(2, "0")}
      </h3>      

      <button onClick={() => {
        alert("ชำระเงินสำเร็จ (จำลอง)");
        setProgram(0);
        setStep(1);
        setProgramPrice(0);
        resetOptions();
        confirmWash();
      }}>
        จำลองจ่ายแล้ว
      </button>
    </>
  );
}

export default QRPayment;