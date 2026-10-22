import { useEffect, useRef, useState } from 'react';
import { prepareQrImage, saveQrImage } from '../utils/saveQrImage';

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
  const [qrImage, setQrImage] = useState(null);
  const [qrSaving, setQrSaving] = useState(false);
  const [qrSaveError, setQrSaveError] = useState('');
  const qrSaveLock = useRef(false);
  const qrUrl = session ? generateQR(session.amount) : '';
  const qrFilename = session ? `laundry-qr-${session.txid}.png` : '';

  useEffect(() => {
    setQrImage(null);
    setQrSaveError('');
    if (!qrUrl) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    prepareQrImage(qrUrl, qrFilename, { signal: controller.signal })
      .then(image => { if (active) setQrImage(image); })
      .catch(() => {
        if (active) setQrSaveError('เตรียมภาพสำหรับบันทึกไม่สำเร็จ กดเปิดภาพ QR ด้านล่างได้');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [qrUrl, qrFilename]);

  async function saveQR() {
    if (qrSaveLock.current || !qrImage || !session ||
        busy || Date.now() >= session.reservedUntil) return;
    qrSaveLock.current = true;
    setQrSaving(true);
    setQrSaveError('');
    try {
      await saveQrImage(qrImage);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setQrSaveError('บันทึกภาพไม่สำเร็จ กดเปิดภาพ QR ด้านล่างแล้วบันทึกภาพ');
      }
    } finally {
      qrSaveLock.current = false;
      setQrSaving(false);
    }
  }

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
    <img src={qrUrl} alt="QR พร้อมเพย์ชำระค่าบริการ"
      style={{ width: '250px' }} />
    <div style={{ margin: '12px 0' }}>
      <button type="button" onClick={saveQR}
        disabled={!qrImage || qrSaving || busy || expired}>
        {qrSaving ? 'กำลังบันทึก…' : !qrImage && !qrSaveError
          ? 'กำลังเตรียมภาพ QR…' : 'บันทึก QR'}
      </button>
      <p>หากมีเมนูแชร์ ให้เลือกบันทึกภาพ แล้วชำระภายในเวลาที่เหลือ</p>
      {qrSaveError && <>
        <p role="alert">{qrSaveError}</p>
        <a href={qrUrl} target="_blank" rel="noopener noreferrer">เปิดภาพ QR เพื่อบันทึก</a>
      </>}
    </div>
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
