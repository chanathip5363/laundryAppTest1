import { useEffect, useState } from "react";

export default function MachineRunTime({ machine }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (machine?.state !== "RUNNING") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [machine?.state]);
  if (machine?.state !== "RUNNING") return null;
  const started = Number(machine.run_started_at);
  if (!Number.isFinite(started) || started <= 0) {
    return <span style={{ display: "block" }}>กำลังทำงาน (ยังไม่มีข้อมูลเวลาเริ่ม)</span>;
  }
  const elapsed = Math.max(0, Math.floor((now - started) / 60000));
  const total = Number(machine.estimated_minutes);
  const hasEstimate = machine.estimated_minutes != null && Number.isFinite(total) && total > 0;
  const remaining = hasEstimate ? Math.max(0, total - elapsed) : null;
  return <span style={{ display: "block", marginTop: 6, fontSize: "0.9em" }}>
    ทำงานแล้ว {elapsed} นาที
    {hasEstimate ? ` · เหลือประมาณ ${remaining} นาที` : " · ยังไม่มีเวลาประมาณของโปรแกรม"}
  </span>;
}
