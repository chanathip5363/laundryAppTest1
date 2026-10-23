import { useEffect, useRef, useState } from 'react';
import { prepareQrImage, saveQrImage } from '../utils/saveQrImage';

function QRPayment({ generateQR, beginPayment, confirmWash, createOmisePayment, checkOmisePayment, createDiscountPayment, checkDiscountPayment, setProgram,
  setStep, setProgramPrice, resetOptions }) {
  const initialRequest = useRef(null);
  const submitting = useRef(false);
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [file, setFile] = useState(null);
  const [method, setMethod] = useState('slip');
  const [discount, setDiscount] = useState(null);
  const [discountLocked, setDiscountLocked] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const drawLock = useRef(false);
  const [omise, setOmise] = useState(null);
  const [omiseLocked, setOmiseLocked] = useState(false);
  const [omiseCreating, setOmiseCreating] = useState(false);
  const omiseCreateLock = useRef(false);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [qrSaving, setQrSaving] = useState(false);
  const [qrSaveError, setQrSaveError] = useState('');
  const qrSaveLock = useRef(false);
  const qrUrl = method === 'omise' ? (omise?.qrUrl || '')
    : method === 'discount' && !discount ? '' : session ? generateQR(session.amount) : '';
  const qrFilename = session ? `laundry-qr-${session.txid}.png` : '';

  useEffect(() => {
    setQrImage(null);
    setQrSaveError('');
    if (!qrUrl || method === 'omise') return;
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
  }, [qrUrl, qrFilename, method]);

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

  async function beginOmise() {
    if (omiseCreateLock.current || !session || Date.now() >= session.reservedUntil) return;
    omiseCreateLock.current = true;
    setOmiseLocked(true);
    setOmiseCreating(true);
    setError('');
    try {
      setOmise(await createOmisePayment(session));
    } catch (err) {
      setError(err.message);
    } finally {
      omiseCreateLock.current = false;
      setOmiseCreating(false);
    }
  }

  useEffect(() => {
    if (method !== 'omise' || !omise || !session || sent) return;
    let active = true;
    let timer;
    async function poll() {
      if (!active || Date.now() >= session.reservedUntil) return;
      let stop = false;
      try {
        const result = await checkOmisePayment(session);
        if (!active) return;
        if (result.status === 'PAID') {
          stop = true;
          if (!submitting.current) {
            submitting.current = true;
            setBusy(true);
            try {
              await confirmWash(null, session, 'omise');
              if (active) { setError(''); setSent(true); }
            } finally {
              submitting.current = false;
              if (active) setBusy(false);
            }
          }
        } else if (result.status === 'failed' || result.status === 'expired') {
          stop = true;
          setError('รายการ Omise ไม่สำเร็จหรือหมดอายุ กรุณาทำรายการใหม่');
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active && !stop) timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [method, omise, session, sent, checkOmisePayment, confirmWash]);

  async function drawDiscount() {
    if (drawLock.current || !session || Date.now() >= session.reservedUntil) return;
    drawLock.current = true;
    setDrawing(true);
    setDiscountLocked(true);
    setError('');
    try {
      const data = await createDiscountPayment(session);
      setSession(current => ({ ...current, amount: data.amount, amountSatang: data.amountSatang }));
      setDiscount(data);
    } catch (err) {
      setError(err.message);
    } finally {
      drawLock.current = false;
      setDrawing(false);
    }
  }

  useEffect(() => {
    if (method !== 'discount' || !discount || !session || sent) return;
    let active = true;
    let timer;
    async function poll() {
      if (!active || Date.now() >= session.reservedUntil) return;
      let stop = false;
      try {
        const result = await checkDiscountPayment(session);
        if (!active) return;
        if (result.status === 'PAID') {
          stop = true;
          if (!submitting.current) {
            submitting.current = true;
            setBusy(true);
            try {
              await confirmWash(null, session, 'discount');
              if (active) { setError(''); setSent(true); }
            } finally {
              submitting.current = false;
              if (active) setBusy(false);
            }
          }
        } else if (result.status === 'failed' || result.status === 'expired') {
          stop = true;
          setError('รายการส่วนลดหมดอายุ กรุณาทำรายการใหม่');
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active && !stop) timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [method, discount, session, sent, checkDiscountPayment, confirmWash]);

  const remaining = session
    ? Math.max(0, Math.ceil((session.reservedUntil - now) / 1000)) : 0;
  const expired = session && now >= session.reservedUntil;

  const validTime = /^\d{1,2}$/.test(hour) && /^\d{1,2}$/.test(minute) &&
    Number(hour) < 24 && Number(minute) < 60;
  const transferTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  const ready = method === 'slip' ? Boolean(file) : validTime;

  async function pay() {
    if (submitting.current || !ready || !session || Date.now() >= session.reservedUntil) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await confirmWash(method === 'slip' ? file : transferTime, session, method);
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
    {qrUrl && <img src={qrUrl} alt="QR พร้อมเพย์ชำระค่าบริการ"
      style={{ width: '250px' }} />}
    {method !== 'omise' && (method !== 'discount' || discount) && <>
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
    </>}
    <h2>{session.amount.toFixed(2)} บาท</h2>
    <h3>เหลือเวลา {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</h3>
    <fieldset disabled={busy || omiseLocked || discountLocked} style={{ margin: '16px 0' }}>
      <legend>เลือกวิธียืนยันการชำระ</legend>
      <button type="button" aria-pressed={method === 'slip'}
        onClick={() => { setMethod('slip'); setError(''); }}>
        {method === 'slip' ? '✓ ' : ''}แนบสลิป
      </button>{' '}
      <button type="button" aria-pressed={method === 'time'}
        onClick={() => { setMethod('time'); setError(''); }}>
        {method === 'time' ? '✓ ' : ''}กรอกเวลาโอน
      </button>
      {' '}<button type="button" aria-pressed={method === 'omise'}
        onClick={() => { setMethod('omise'); setError(''); }}>
        {method === 'omise' ? '✓ ' : ''}Omise (ทดสอบ)
      </button>
      {' '}<button type="button" aria-pressed={method === 'discount'}
        onClick={() => { setMethod('discount'); setError(''); }}>
        {method === 'discount' ? '✓ ' : ''}สุ่มส่วนลด + SMS
      </button>
    </fieldset>
    {method === 'discount' ? <section>
      <h3>ลุ้นส่วนลดก่อนชำระเงิน</h3>
      {!discount ? <>
        <p>กดสุ่มส่วนลด 0.01–0.10 บาท แล้วสแกนจ่ายตามยอดใหม่ที่แสดง</p>
        <button type="button" onClick={drawDiscount} disabled={drawing || expired}>
          {drawing ? 'กำลังสุ่มส่วนลด…' : 'ลุ้นส่วนลด'}
        </button>
      </> : <>
        <p>ราคาเต็ม {(discount.baseAmountSatang / 100).toFixed(2)} บาท</p>
        <h3>ได้รับส่วนลด {(discount.discountSatang / 100).toFixed(2)} บาท</h3>
        <p>ชำระให้ตรงยอด {session.amount.toFixed(2)} บาท ภายในเวลาที่เหลือ</p>
        <p role="status">ระบบกำลังรอ SMS เงินเข้า ไม่ต้องแนบสลิปหรือกรอกเวลา</p>
        <button type="button" disabled={busy || expired}
          onClick={async () => {
            if (submitting.current) return;
            submitting.current = true; setBusy(true); setError('');
            try { await confirmWash(null, session, 'discount'); setSent(true); }
            catch (err) { setError(err.message); }
            finally { submitting.current = false; setBusy(false); }
          }}>ตรวจเงินเข้าและเริ่มเครื่อง</button>
      </>}
    </section> : method === 'omise' ? <section>
      <h3>Omise Test Mode — ไม่ต้องโอนเงินจริง</h3>
      <p>สร้างรายการ แล้วให้ผู้สาธิตกด Testing → Mark as paid ใน Omise Dashboard ระบบจะตรวจผลและส่งคำสั่งเริ่มเครื่องจริง</p>
      <p>เมื่อสร้างรายการ Omise แล้ว จะเปลี่ยนวิธียืนยันในรายการนี้ไม่ได้</p>
      {!omise ? <button type="button" onClick={beginOmise}
        disabled={omiseCreating || expired}>
        {omiseCreating ? 'กำลังสร้าง Omise…' : 'สร้าง QR ทดสอบ Omise'}
      </button> : <>
        <p>รหัส Omise: {omise.chargeId}</p>
        <p role="status">กำลังรอผลชำระจาก Omise…</p>
        <button type="button" disabled={busy || expired}
          onClick={async () => {
            if (submitting.current) return;
            submitting.current = true; setBusy(true); setError('');
            try { await confirmWash(null, session, 'omise'); setSent(true); }
            catch (err) { setError(err.message); }
            finally { submitting.current = false; setBusy(false); }
          }}>ตรวจสถานะและเริ่มเครื่อง</button>
      </>}
    </section> : <>
    <p>ตรวจสอบชื่อผู้รับและยอดในแอปธนาคารก่อนยืนยันโอน</p>
    {method === 'slip' ? <>
    <p>แนบสลิปเพื่อยืนยันการชำระ</p>
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
    </> : <>
      <p>ดูเวลาทำธุรกรรมบนสลิป แล้วกรอกแบบ 24 ชั่วโมง เช่น 14:15</p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <label>ชั่วโมง<br />
          <input type="text" inputMode="numeric" maxLength={2} placeholder="14"
            value={hour} disabled={busy} autoComplete="off"
            style={{ width: '4em', fontSize: '1.2em' }}
            onChange={event => {
              setHour(event.target.value.replace(/[^0-9]/g, '')); setError('');
            }} />
        </label>
        <span>:</span>
        <label>นาที<br />
          <input type="text" inputMode="numeric" maxLength={2} placeholder="15"
            value={minute} disabled={busy} autoComplete="off"
            style={{ width: '4em', fontSize: '1.2em' }}
            onChange={event => {
              setMinute(event.target.value.replace(/[^0-9]/g, '')); setError('');
            }} />
        </label>
      </div>
      <p>ไม่ต้องแนบสลิป ระบบตรวจเวลาและยอดกับ SMS เงินเข้า</p>
    </>}
    <br />
    <button onClick={pay} disabled={!ready || busy || expired}>
      {busy ? 'กำลังตรวจชำระและส่งคำสั่ง…' : 'ตรวจชำระและเริ่มเครื่อง'}
    </button>
    </>}
    {error && <p role="alert">{error}</p>}
    <p>รหัสรายการ: {session.txid}</p>
    <p>หากตรวจไม่ผ่าน อย่าโอนซ้ำ ให้ตรวจข้อความแจ้งผลหรือติดต่อผู้ดูแล</p>
  </>;
}

export default QRPayment;
