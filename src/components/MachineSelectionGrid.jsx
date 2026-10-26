
import { useEffect, useState } from "react";
import getMachineConfigByProfile from "../config/getMachineConfigByProfile";


function MachineIcon({ type }) {
  const isDryer = type === "dry";

  return (
    <svg
      width="54"
      height="54"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8" y="4" width="32" height="40"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      <path
        d="M8 14H40"
        stroke="currentColor"
        strokeWidth="2"
      />

      <circle
        cx="24" cy="29" r="10"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      {isDryer ? (
        <path
          d="M19 25C25 22 20 29 26 29C32 29 25 35 29 35"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M17 30C21 26 26 34 31 29"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      <circle cx="14" cy="9" r="1.5" fill="currentColor" />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" />
    </svg>
  );
}


export default function MachineSelectionGrid({
  shopId,
  machines,
  onSelect,
  onBack,
  type = "wash",
}) {
  const [machineStatus, setMachineStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  useEffect(() => {
    let active = true;
    let requesting = false;

    const loadMachines = async () => {
      if (requesting) return;
      requesting = true;

      try {
        const response = await fetch(
          `https://api.the-oasis-living.com/shops/${encodeURIComponent(shopId)}/machines`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Server error");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid machine data");
        }

        if (!active) return;

        const statusMap = {};

        data.forEach((machine) => {
          statusMap[machine.machine] = machine;
        });

        setMachineStatus(statusMap);
        setServerError(false);
      } catch (error) {
        if (!active) return;

        console.error("Machine status error:", error);
        setMachineStatus({});
        setServerError(true);
      } finally {
        requesting = false;
        if (active) setLoading(false);
      }
    };

    loadMachines();

    const interval = setInterval(loadMachines, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [shopId]);

  const getMachineState = (id) => {
    if (loading || serverError) {
      return {
        label: "กำลังตรวจสอบ",
        className: "unknown",
        available: false,
      };
    }

    const machine = machineStatus[id];

    if (
      type === "wash" &&
      machine &&
      !getMachineConfigByProfile(machine.program_profile)
    ) {
      return {
        label: "ยังไม่รองรับโปรแกรม",
        className: "unknown",
        available: false,
      };
    }

    if (type === "dry" && machine) {
      const legacyDryMachines = ["machine5", "machine6", "machine7", "machine8"];
      const profile = getMachineConfigByProfile(machine.program_profile);

      if (
        (!profile || profile.service !== "dry") &&
        !legacyDryMachines.includes(id)
      ) {
        return {
          label: "ยังไม่รองรับโปรแกรม",
          className: "unknown",
          available: false,
        };
      }
    }

    if (!machine || machine.status !== "ONLINE") {
      return {
        label: "ออฟไลน์",
        className: "offline",
        available: false,
      };
    }

    if (machine.state !== "IDLE") {
      return {
        label:
          machine.state === "RUNNING"
            ? "กำลังทำงาน"
            : "ไม่พร้อมใช้งาน",
        className: "busy",
        available: false,
      };
    }

    if (
      machine.reserved_until &&
      new Date(machine.reserved_until).getTime() > Date.now()
    ) {
      return {
        label: "มีผู้กำลังใช้บริการ",
        className: "busy",
        available: false,
      };
    }

    return {
      label: "ว่าง / พร้อมใช้งาน",
      className: "ready",
      available: true,
    };
  };

  const displayMachines = Object.values(machineStatus)
    .filter((machine) => machine.machine_type === type)
    .map((machine) => ({
      id: machine.machine,
      name: machine.display_name || machine.machine,
      model: machine.model || "",
      program_profile: machine.program_profile,
      nextStep: machines?.find((item) => item.id === machine.machine)?.nextStep,
    }));

  return (
    <div className="machine-selection">
      {serverError && (
        <p className="machine-error">
          ไม่สามารถเชื่อมต่อ Server ได้
        </p>
      )}

      <div className="machine-grid">
        {displayMachines.map((machine) => {
          const state = getMachineState(machine.id);

          return (
            <button
              key={machine.id}
              type="button"
              className={`machine-card ${type === "dry" ? "dryer-machine" : ""}`}
              disabled={!state.available}
              onClick={() => {
                if (state.available) {
                  onSelect({
                    ...machine,
                    program_profile:
                      machineStatus[machine.id]?.program_profile ?? null,
                  });
                }
              }}
            >
            <span className="machine-card-icon">
            <MachineIcon type={type} />
            </span>

              <span className="machine-card-title">
                {machine.name}
              </span>

              <span className="machine-card-model">
                {machine.model}
              </span>

              <span className={`machine-state ${state.className}`}>
                {state.label}
              </span>

              <span className="machine-card-action">
                {state.available
                  ? "เลือกเครื่องนี้ →"
                  : "ไม่สามารถเลือกได้"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="machine-back"
        onClick={onBack}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}
