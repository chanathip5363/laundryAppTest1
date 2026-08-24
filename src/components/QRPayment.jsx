function QRPayment({
  generateQR,
  getTotalPrice,
  setProgram,
  setStep,
  setProgramPrice,
  resetOptions,
  confirmWash
}) {
  return (
    <>
      <h2>ชำระเงิน</h2>

      <img
        src={generateQR()}
        alt="QR"
        style={{ width: "250px" }}
      />

      <h2>{getTotalPrice()} บาท</h2>

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