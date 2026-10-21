
function WashingMachineIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8" y="4" width="32" height="40" rx="6"
        stroke="currentColor" strokeWidth="2.5"
      />
      <path
        d="M8 14H40"
        stroke="currentColor" strokeWidth="2"
      />
      <circle
        cx="24" cy="29" r="10"
        stroke="currentColor" strokeWidth="2.5"
      />
      <path
        d="M17 30C21 26 26 34 31 29"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="9" r="1.5" fill="currentColor" />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

function DryerIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8" y="4" width="32" height="40" rx="6"
        stroke="currentColor" strokeWidth="2.5"
      />
      <path
        d="M8 14H40"
        stroke="currentColor" strokeWidth="2"
      />
      <circle
        cx="24" cy="29" r="10"
        stroke="currentColor" strokeWidth="2.5"
      />
      <path
        d="M19 25C25 22 20 29 26 29C32 29 25 35 29 35"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function ServiceSelection({
  onSelectWash,
  onSelectDry,
}) {
  return (
    <div className="service-grid">
      <button
        type="button"
        className="service-card wash-card"
        onClick={onSelectWash}
      >
        <span className="service-icon">
          <WashingMachineIcon />
        </span>

        <span className="service-title">ซักผ้า</span>

        <span className="service-description">
          เลือกเครื่องซักและโปรแกรมที่เหมาะกับคุณ
        </span>

        <span className="service-action">
          เลือกบริการซัก <span>→</span>
        </span>
      </button>

      <button
        type="button"
        className="service-card dry-card"
        onClick={onSelectDry}
      >
        <span className="service-icon">
          <DryerIcon />
        </span>

        <span className="service-title">อบผ้า</span>

        <span className="service-description">
          เลือกเครื่องอบและระดับความร้อนที่ต้องการ
        </span>

        <span className="service-action">
          เลือกบริการอบ <span>→</span>
        </span>
      </button>
    </div>
  );
}
