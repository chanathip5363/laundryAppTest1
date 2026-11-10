import { useEffect, useRef, useState } from 'react';

function QRPayment({ generateQR, beginPayment, confirmWash, setProgram,
  setStep, setProgramPrice, resetOptions }) {
  const initialRequest = useRef(null);
  const submitting = useRef(false);
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    if (!initialRequest.current) initialRequest.current = beginPayment();
    initialRequest.current.then(data => {
      if (active) setSession(data);
    }).catch(err => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const remaining = session
    ? Math.max(0, Math.ceil((session.reservedUntil - now) / 1000)) : 0;
  const expired = session && now >= session.reservedUntil;

  async function pay() {
    if (submitting.current || !file || !session || expired) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await confirmWash(file, session);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function home() {
    setProgram(0);
    setProgramPrice(0);
    resetOptions();
    setStep(1);
  }

  if (sent) return <>
    <h2>ตรวจชำระผ่านแล้ว</h2>
    <p>ส่งคำสั่งเริ่มเครื่องแล้ว กรุณาตรวจสอบว่าเครื่องเริ่มทำงาน</p>
    <button onClick={home}>กลับหน้าแรก</button>
  </>;

  if (!session) return <>
    <h2>เตรียมรายการชำระ</h2>
    {error ? <><p role="alert">{error}</p><button onClick={home}>กลับหน้าแรก</button></>
      : <p>กำลังตรวจสอบและจองเครื่อง…</p>}
  </>;

  if (expired && !busy) return <>
    <h2>QR หมดอายุ</h2>
    <p>หากยังไม่โอน กรุณาทำรายการใหม่ ห้ามโอนผ่าน QR เดิมที่บันทึกไว้</p>
    <p>หากโอนแล้ว กรุณาติดต่อผู้ดูแลพร้อมสลิป อย่าโอนซ้ำ</p>
    <p>รหัสรายการ: {session.txid}</p>
    {error && <p role="alert">{error}</p>}
    <button onClick={home}>กลับหน้าแรก</button>
  </>;

  return <>
    <h2>ชำระเงิน</h2>
    <img src={generateQR(session.amount)} alt="QR พร้อมเพย์ชำระค่าบริการ"
      style={{ width: '250px' }} />
    <h2>{session.amount.toFixed(2)} บาท</h2>
    <h3>เหลือเวลา {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</h3>
    <p>ตรวจสอบชื่อผู้รับและยอดในแอปธนาคารก่อนยืนยันโอน แล้วแนบสลิป</p>
    <input type="file" accept="image/jpeg,image/png" disabled={busy}
      onChange={event => {
        const chosen = event.target.files?.[0] || null;
        if (chosen && chosen.size > 5 * 1024 * 1024) {
          setFile(null);
          setError('ภาพสลิปต้องมีขนาดไม่เกิน 5 MB');
          return;
        }
        setFile(chosen);
        setError('');
      }} />
    <br />
    <button onClick={pay} disabled={!file || busy || expired}>
      {busy ? 'กำลังตรวจสลิปและส่งคำสั่ง…' : 'ตรวจชำระและเริ่มเครื่อง'}
    </button>
    {error && <p role="alert">{error}</p>}
    <p>รหัสรายการ: {session.txid}</p>
    <p>หากตรวจไม่ผ่าน อย่าโอนซ้ำ ให้ตรวจข้อความแจ้งผลหรือติดต่อผู้ดูแล</p>
  </>;
}

export default QRPayment;
