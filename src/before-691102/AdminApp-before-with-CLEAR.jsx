import { useEffect, useState } from "react";
import MachineRunTime from "../components/MachineRunTime";

const API = "https://api.the-oasis-living.com";

export default function AdminApp() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopsError, setShopsError] = useState("");
  const [selectedShop, setSelectedShop] = useState(null);
  const [machines, setMachines] = useState([]);
  const [machinesError, setMachinesError] = useState("");
  const [machinesLoading, setMachinesLoading] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState("");
  const [editMachineModel, setEditMachineModel] = useState("");
  const [editMachineProfile, setEditMachineProfile] = useState("");
  const [savingMachine, setSavingMachine] = useState(false);
  const [editMachineError, setEditMachineError] = useState("");

  const [pricingMachine, setPricingMachine] = useState(null);
  const [pricingDraft, setPricingDraft] = useState(null);
  const [pricingSource, setPricingSource] = useState("");
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingSuccess, setPricingSuccess] = useState("");

  function updatePricingField(field, value) {
    setPricingDraft(previous => ({ ...previous, [field]: value }));
    setPricingSuccess("");
  }

  function parseProgramIds(text) {
    const values = text.split(/[,\s]+/).filter(Boolean);
    if (!values.length || values.some(value => !/^\d+$/.test(value) || Number(value) < 1)) {
      throw new Error("กรุณาระบุหมายเลขโปรแกรมเป็นจำนวนเต็มบวก คั่นด้วยเครื่องหมายจุลภาค");
    }
    return values.map(Number);
  }

  async function openPricing(machine) {
    if (!selectedShop || pricingLoading) return;
    setPricingMachine(machine);
    setPricingDraft(null);
    setPricingError("");
    setPricingSuccess("");
    setPricingLoading(true);
    try {
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines/${encodeURIComponent(machine.machine)}/pricing`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!response.ok) throw new Error(response.status === 404
        ? "ไม่พบข้อมูลเครื่องหรือ API ราคายังไม่ได้ติดตั้งบน Server"
        : "ไม่สามารถโหลดราคาได้ (HTTP " + response.status + ")");
      const data = await response.json();
      const fields = machine.machine_type === "wash"
        ? ["priceGroups", "temperaturePrice", "aromaPrice"]
        : ["priceGroups", "temperatureRule", "wrinklePrice"];
      const draft = Object.fromEntries(fields.map(key => [key, data[key]]));
      if (fields.some(key => draft[key] === undefined)) {
        throw new Error("ข้อมูลราคาไม่ครบ ไม่สามารถแก้ไขได้");
      }
      setPricingDraft(draft);
      setPricingSource(data.pricingSource || "");
    } catch (err) {
      setPricingError(err.message);
    } finally {
      setPricingLoading(false);
    }
  }

  async function savePricing(event) {
    event.preventDefault();
    if (!selectedShop || !pricingMachine || !pricingDraft || pricingSaving) return;
    setPricingError("");
    setPricingSuccess("");
    setPricingSaving(true);
    try {
      const priceKeys = Object.keys(pricingDraft.priceGroups);
      if (!priceKeys.length || priceKeys.some(price =>
        !/^\d+(?:\.\d{1,2})?$/.test(price) ||
        Number(price) <= 0 || Number(price) > 100000
      ) || new Set(priceKeys.map(Number)).size !== priceKeys.length) {
        throw new Error("ราคากลุ่มไม่ถูกต้องหรือมีราคาซ้ำกัน");
      }
      const groups = Object.fromEntries(Object.entries(pricingDraft.priceGroups).map(([price, ids]) => [
        price, typeof ids === "string" ? parseProgramIds(ids) : ids
      ]));
      const allIds = Object.values(groups).flat();
      if (new Set(allIds).size !== allIds.length) {
        throw new Error("หมายเลขโปรแกรมซ้ำกันระหว่างกลุ่มราคา");
      }
      const pricing = { ...pricingDraft, priceGroups: groups };
      if (pricingMachine.machine_type === "dry") {
        pricing.temperatureRule = {
          ...pricing.temperatureRule,
          programs: typeof pricing.temperatureRule.programs === "string"
            ? parseProgramIds(pricing.temperatureRule.programs)
            : pricing.temperatureRule.programs
        };
      }
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines/${encodeURIComponent(pricingMachine.machine)}/pricing`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ pricing })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (HTTP ${response.status})`);
      setPricingDraft(pricing);
      setPricingSource("machine");
      setPricingSuccess("บันทึกราคาเรียบร้อยแล้ว");
    } catch (err) {
      setPricingError(err.message);
    } finally {
      setPricingSaving(false);
    }
  }

  function priceNumberInput(value, onChange, label) {
    return (
      <label style={{ display: "block", marginBottom: 8 }}>
        {label} (บาท){" "}
        <input type="number" min="0" max="100000" step="0.01" required
          value={value ?? ""}
          onChange={event => onChange(event.target.value === "" ? "" : Number(event.target.value))}
          style={{ width: 100 }} />
      </label>
    );
  }

  function startEditMachine(machine) {
    setEditingMachine(machine.machine);
    setEditMachineName(machine.display_name || "");
    setEditMachineModel(machine.model || "");
    setEditMachineProfile(machine.program_profile || "");
    setEditMachineError("");
  }

  async function handleSaveMachine(event) {
    event.preventDefault();
    if (!selectedShop || !editingMachine || savingMachine) return;

    setSavingMachine(true);
    setEditMachineError("");

    try {
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines/${encodeURIComponent(editingMachine)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            display_name: editMachineName.trim(),
            model: editMachineModel.trim(),
            program_profile: editMachineProfile.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "เครื่องไม่ว่าง ไม่สามารถแก้ไขข้อมูลได้"
            : "บันทึกข้อมูลเครื่องไม่สำเร็จ"
        );
      }

      const data = await response.json();
      setMachines(previous => previous.map(machine =>
        machine.machine === editingMachine
          ? { ...machine, ...data }
          : machine
      ));
      setEditingMachine(null);
    } catch (err) {
      setEditMachineError(err.message);
    } finally {
      setSavingMachine(false);
    }
  }

  const [updatingMachine, setUpdatingMachine] = useState(null);
  const [updateMachineError, setUpdateMachineError] = useState("");


  const [showDeletedMachines, setShowDeletedMachines] = useState(false);
  const [deletingMachine, setDeletingMachine] = useState(null);
  const [deleteMachineError, setDeleteMachineError] = useState("");

  async function handleDeleteMachine(machine) {
    if (!window.confirm(
      `ยืนยันลบ ${machine.display_name || machine.machine} (${machine.machine}) ออกจากร้าน?\\nประวัติเดิมจะยังถูกเก็บไว้`
    )) return;

    setDeletingMachine(machine.machine);
    setDeleteMachineError("");

    try {
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines/${encodeURIComponent(machine.machine)}/delete`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(response.status === 409
          ? "เครื่องกำลังทำงาน ถูกจอง หรือถูกลบไปแล้ว"
          : "ไม่สามารถลบเครื่องได้");
      }

      const data = await response.json();
      setMachines(previous => previous.map(item =>
        item.machine === machine.machine
          ? { ...item, enabled: 0, deleted_at: data.deleted_at }
          : item
      ));
    } catch (err) {
      setDeleteMachineError(err.message);
    } finally {
      setDeletingMachine(null);
    }
  }

  async function handleToggleMachine(machine) {
    if (!selectedShop || updatingMachine) return;

    const nextEnabled = machine.enabled !== 1;

    if (!nextEnabled && machine.state !== "IDLE") {
      setUpdateMachineError("ปิดใช้งานได้เฉพาะเครื่องที่ว่าง (IDLE)");
      return;
    }

    setUpdatingMachine(machine.machine);
    setUpdateMachineError("");

    try {
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines/${encodeURIComponent(machine.machine)}/enabled`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled: nextEnabled }),
        }
      );

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("เครื่องไม่ว่างหรือมีการจองอยู่ ไม่สามารถปิดใช้งานได้");
        }
        throw new Error("ไม่สามารถเปลี่ยนสถานะเครื่องได้");
      }

      const data = await response.json();

      setMachines((previous) =>
        previous.map((item) =>
          item.machine === machine.machine
            ? { ...item, enabled: data.enabled }
            : item
        )
      );
    } catch (err) {
      setUpdateMachineError(err.message);
    } finally {
      setUpdatingMachine(null);
    }
  }
  const [newShopId, setNewShopId] = useState("");
  const [newShopName, setNewShopName] = useState("");
  const [creatingShop, setCreatingShop] = useState(false);
  const [createShopError, setCreateShopError] = useState("");
  const [createShopSuccess, setCreateShopSuccess] = useState("");

  const [newMachineType, setNewMachineType] = useState("wash");
  const [newMachineModel, setNewMachineModel] = useState("");
  const [newMachineName, setNewMachineName] = useState("");
  const [newMachineProfile, setNewMachineProfile] = useState("");
  const [creatingMachine, setCreatingMachine] = useState(false);
  const [createMachineError, setCreateMachineError] = useState("");
  const [createMachineSuccess, setCreateMachineSuccess] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        throw new Error("Username หรือ Password ไม่ถูกต้อง");
      }

      const shopsResponse = await fetch(`${API}/admin/shops`, {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      if (!shopsResponse.ok) {
        setShopsError("ไม่สามารถโหลดรายชื่อร้านได้");
        setShops([]);
      } else {
        const shopsData = await shopsResponse.json();
        setShops(Array.isArray(shopsData) ? shopsData : shopsData.shops || []);
        setShopsError("");
      }

      setToken(data.token);
      setUser(data.user);
      setPassword("");
    } catch (err) {
      setError(err.message || "ไม่สามารถเข้าสู่ระบบได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShop(event) {
    event.preventDefault();
    setCreateShopError("");
    setCreateShopSuccess("");
    setCreatingShop(true);

    try {
      const response = await fetch(`${API}/admin/shops`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_id: newShopId.trim(),
          shop_name: newShopName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("รหัสร้านนี้มีอยู่แล้ว");
        }
        throw new Error("ไม่สามารถเพิ่มร้านได้");
      }

      setShops((previous) => [...previous, data.shop]);
      setNewShopId("");
      setNewShopName("");
      setCreateShopSuccess("เพิ่มร้านใหม่สำเร็จ");
    } catch (err) {
      setCreateShopError(err.message);
    } finally {
      setCreatingShop(false);
    }
  }

  async function handleCreateMachine(event) {
    event.preventDefault();
    if (!selectedShop || creatingMachine || machinesLoading) return;

    setCreateMachineError("");
    setCreateMachineSuccess("");
    setCreatingMachine(true);

    try {
      const shopId = selectedShop.shop_id;
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(shopId)}/machines`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            machine_type: newMachineType,
            model: newMachineModel.trim() || null,
            display_name: newMachineName.trim(),
            program_profile: newMachineProfile.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("รหัสเครื่องนี้มีอยู่แล้ว");
        }
        if (response.status === 404) {
          throw new Error("ไม่พบร้านที่เลือก");
        }
        if (response.status === 400) {
          throw new Error("ข้อมูลเครื่องไม่ถูกต้อง");
        }
        throw new Error("ไม่สามารถเพิ่มเครื่องได้");
      }

      const data = await response.json();
      setMachines((previous) => [...previous, data.machine]);
      setNewMachineModel("");
      setNewMachineName("");
      setNewMachineProfile("");
      setCreateMachineSuccess(`ลงทะเบียนเครื่อง ${data.machine.machine} สำเร็จ`);
    } catch (err) {
      setCreateMachineError(err.message);
    } finally {
      setCreatingMachine(false);
    }
  }

  // Refresh run-time status without interrupting machine editing forms.
  useEffect(() => {
    if (!selectedShop || !token) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `${API}/admin/shops/${encodeURIComponent(selectedShop.shop_id)}/machines`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const incoming = Array.isArray(data) ? data : data.machines || [];
        setMachines(previous => previous.map(machine => {
          const fresh = incoming.find(item => item.machine === machine.machine);
          return fresh ? { ...machine, state: fresh.state, status: fresh.status,
            run_started_at: fresh.run_started_at, estimated_minutes: fresh.estimated_minutes } : machine;
        }));
      } catch { /* retain last known status */ }
    };
    const interval = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [selectedShop?.shop_id, token]);

  async function handleSelectShop(shop) {
    setCreateMachineError("");
    setCreateMachineSuccess("");
    setPricingMachine(null);
    setPricingDraft(null);
    setSelectedShop(shop);
    setMachines([]);
    setMachinesError("");
    setMachinesLoading(true);

    try {
      const response = await fetch(
        `${API}/admin/shops/${encodeURIComponent(shop.shop_id)}/machines`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error("ไม่สามารถโหลดข้อมูลเครื่องได้");
      }

      const data = await response.json();
      setMachines(Array.isArray(data) ? data : data.machines || []);
    } catch (err) {
      setMachinesError(err.message);
    } finally {
      setMachinesLoading(false);
    }
  }

  async function handleLogout() {
    const currentToken = token;
    setToken("");
    setUser(null);
    setShops([]);
    setShopsError("");
    setPricingMachine(null);
    setPricingDraft(null);
    setSelectedShop(null);
    setMachines([]);
    setMachinesError("");

    try {
      await fetch(`${API}/admin/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
    } catch {
      // Session on the server will expire automatically.
    }
  }

  return (
    <main style={{
      maxWidth: 480,
      margin: "60px auto",
      padding: 24,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>Smart Laundry Admin</h1>
      <p>ระบบบริหารจัดการร้านสะดวกซัก</p>

      {user ? (
        <section>
          <h2>เข้าสู่ระบบสำเร็จ</h2>
          <p>ผู้ใช้งาน: {user.username}</p>
          <p>สิทธิ์: {user.role}</p>

          <h3>เพิ่มร้านใหม่</h3>
          <form onSubmit={handleCreateShop}>
            <label htmlFor="new-shop-id">รหัสร้าน</label>
            <input
              id="new-shop-id"
              value={newShopId}
              onChange={(event) => setNewShopId(event.target.value)}
              placeholder="เช่น shop002"
              pattern="shop[a-zA-Z0-9_-]{1,30}"
              required
              style={{ display: "block", width: "100%", marginBottom: 12 }}
            />

            <label htmlFor="new-shop-name">ชื่อร้าน</label>
            <input
              id="new-shop-name"
              value={newShopName}
              onChange={(event) => setNewShopName(event.target.value)}
              maxLength={100}
              required
              style={{ display: "block", width: "100%", marginBottom: 12 }}
            />

            <button type="submit" disabled={creatingShop}>
              {creatingShop ? "กำลังบันทึก..." : "เพิ่มร้านใหม่"}
            </button>

            {createShopError && <p role="alert" style={{ color: "red" }}>{createShopError}</p>}
            {createShopSuccess && <p role="status">{createShopSuccess}</p>}
          </form>

          <h3>ร้านค้าของฉัน</h3>
          {shopsError && <p role="alert">{shopsError}</p>}
          {shops.length === 0 && !shopsError && <p>ยังไม่มีข้อมูลร้าน</p>}

          <ul>
            {shops.map((shop) => (
              <li key={shop.shop_id}>
                <button type="button" onClick={() => handleSelectShop(shop)}>
                  {shop.shop_name} ({shop.shop_id})
                </button>
              </li>
            ))}
          </ul>

          {selectedShop && (
            <section>
              <h3>เครื่องในร้าน: {selectedShop.shop_name}</h3>
              {machinesLoading && <p>กำลังโหลดข้อมูลเครื่อง...</p>}
              {machinesError && <p role="alert">{machinesError}</p>}
              {!machinesLoading && !machinesError && machines.length === 0 &&
                <p>ยังไม่มีเครื่องในร้านนี้</p>}

              <ul>
              <h4>ลงทะเบียนเครื่องใหม่</h4>
              <form onSubmit={handleCreateMachine}>
                <p>ระบบจะสร้างรหัสเครื่องให้อัตโนมัติ</p>

                <label htmlFor="new-machine-type">ประเภทเครื่อง</label>
                <select
                  id="new-machine-type"
                  value={newMachineType}
                  onChange={(e) => setNewMachineType(e.target.value)}
                  style={{ display: "block", width: "100%", marginBottom: 12 }}
                >
                  <option value="wash">เครื่องซัก</option>
                  <option value="dry">เครื่องอบ</option>
                </select>

                <label htmlFor="new-machine-model">ยี่ห้อ / รุ่น</label>
                <input
                  id="new-machine-model"
                  value={newMachineModel}
                  onChange={(e) => setNewMachineModel(e.target.value)}
                  maxLength={100}
                  style={{ display: "block", width: "100%", marginBottom: 12 }}
                />

                <label htmlFor="new-machine-name">ชื่อแสดงบนเว็บไซต์</label>
                <input
                  id="new-machine-name"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  maxLength={100}
                  required
                  style={{ display: "block", width: "100%", marginBottom: 12 }}
                />

                <label htmlFor="new-machine-profile">Program Profile</label>
                <input
                  id="new-machine-profile"
                  value={newMachineProfile}
                  onChange={(e) => setNewMachineProfile(e.target.value)}
                  placeholder="เช่น toshibaA (ถ้ามี)"
                  maxLength={100}
                  style={{ display: "block", width: "100%", marginBottom: 12 }}
                />

                <button type="submit" disabled={creatingMachine || machinesLoading}>
                  {creatingMachine ? "กำลังบันทึก..." : "เพิ่มเครื่องใหม่"}
                </button>

                {createMachineError && (
                  <p role="alert" style={{ color: "red" }}>{createMachineError}</p>
                )}
                {createMachineSuccess && (
                  <p role="status">{createMachineSuccess}</p>
                )}
              </form>

                {updateMachineError && (
                  <p role="alert" style={{ color: "red" }}>
                    {updateMachineError}
                  </p>
                )}
                {editingMachine && (
                  <form onSubmit={handleSaveMachine}>
                    <h4>แก้ไขข้อมูล {editingMachine}</h4>
                    <label>ชื่อแสดงบนเว็บไซต์
                      <input
                        value={editMachineName}
                        onChange={e => setEditMachineName(e.target.value)}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>ยี่ห้อ / รุ่น
                      <input
                        value={editMachineModel}
                        onChange={e => setEditMachineModel(e.target.value)}
                        maxLength={100}
                      />
                    </label>
                    <label>Program Profile
                      <input
                        value={editMachineProfile}
                        onChange={e => setEditMachineProfile(e.target.value)}
                        maxLength={100}
                      />
                    </label>
                    {editMachineError && (
                      <p role="alert">{editMachineError}</p>
                    )}
                    <button type="submit" disabled={savingMachine}>
                      {savingMachine ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                    <button
                      type="button"
                      disabled={savingMachine}
                      onClick={() => setEditingMachine(null)}
                    >
                      ยกเลิก
                    </button>
                  </form>
                )}
                <div style={{ marginBottom: 12 }}>
                  <button type="button" onClick={() => setShowDeletedMachines(false)}>
                    เครื่องปัจจุบัน ({machines.filter(m => m.deleted_at == null).length})
                  </button>
                  {" "}
                  <button type="button" onClick={() => setShowDeletedMachines(true)}>
                    เครื่องที่ลบแล้ว ({machines.filter(m => m.deleted_at != null).length})
                  </button>
                </div>
                {deleteMachineError && (
                  <p role="alert" style={{ color: "red" }}>{deleteMachineError}</p>
                )}
                {machines.filter(machine =>
                  showDeletedMachines
                    ? machine.deleted_at != null
                    : machine.deleted_at == null
                ).map((machine) => (
                  <li key={machine.machine}>
                    {machine.display_name || machine.machine}
                    {" — "}
                    {machine.machine_type === "wash" ? "เครื่องซัก" : "เครื่องอบ"}
                    {" — "}
                    {machine.status}
                    <MachineRunTime machine={machine} />
                    {" "}
                    <button
                      type="button"
                      disabled={savingMachine || machine.deleted_at != null || machine.state !== "IDLE"}
                      onClick={() => startEditMachine(machine)}
                    >
                      แก้ไขข้อมูล
                    </button>
                    {" — "}
                     {machine.deleted_at == null && (
                       <>
                         {" "}
                         <button type="button" onClick={() => openPricing(machine)}>
                           จัดการราคา
                         </button>
                       </>
                     )}
                    {machine.deleted_at != null
                      ? "ลบแล้ว: " + new Date(machine.deleted_at).toLocaleString("th-TH")
                      : machine.enabled === 1 ? "เปิดให้บริการ" : "ปิดให้บริการ"}
                    {" "}
                    <button
                      type="button"
                      disabled={
                        machine.deleted_at != null || updatingMachine !== null ||
                        (machine.enabled === 1 && machine.state !== "IDLE")
                      }
                      onClick={() => handleToggleMachine(machine)}
                    >
                      {updatingMachine === machine.machine
                        ? "กำลังบันทึก..."
                        : machine.enabled === 1
                          ? "ปิดใช้งาน"
                          : "เปิดใช้งาน"}
                    </button>
                    {machine.deleted_at == null && (
                      <>
                        {" "}
                        <button
                          type="button"
                          disabled={
                            deletingMachine !== null ||
                            machine.state !== "IDLE" ||
                            (machine.reserved_until != null &&
                              machine.reserved_until > Date.now())
                          }
                          onClick={() => handleDeleteMachine(machine)}
                        >
                          {deletingMachine === machine.machine ? "กำลังลบ..." : "ลบเครื่อง"}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {pricingMachine && (
                <section style={{ border: "1px solid #bbb", borderRadius: 8, padding: 16, marginTop: 18 }}>
                  <h4>จัดการราคา: {pricingMachine.display_name || pricingMachine.machine}</h4>
                  <p>เครื่อง {pricingMachine.machine} — {pricingMachine.machine_type === "wash" ? "ซัก" : "อบ"}</p>
                  {pricingLoading && <p>กำลังโหลดราคา...</p>}
                  {pricingError && <p role="alert" style={{ color: "red" }}>{pricingError}</p>}
                  {pricingSuccess && <p role="status" style={{ color: "green" }}>{pricingSuccess}</p>}
                  {pricingDraft && (
                    <form onSubmit={savePricing}>
                      <p>แหล่งราคา: {pricingSource || "ไม่ระบุ"} (เมื่อบันทึกจะเป็นราคาเฉพาะเครื่องนี้)</p>
                      <h4>กลุ่มราคาและโปรแกรมที่เปิดให้บริการ</h4>
                      {Object.entries(pricingDraft.priceGroups).map(([price, programs]) => (
                        <div key={price} style={{ marginBottom: 12 }}>
                          <label style={{ display: "block", marginBottom: 6 }}>
                            ราคากลุ่ม (บาท){" "}
                            <input type="number" min="0.01" max="100000" step="0.01" required
                              style={{ width: 110 }}
                              value={price}
                              onChange={event => {
                                const nextPrice = event.target.value;
                                if (!/^\d+(?:\.\d{0,2})?$/.test(nextPrice)) return;
                                if (nextPrice !== price && Object.hasOwn(pricingDraft.priceGroups, nextPrice)) {
                                  setPricingError("มีกลุ่มราคานี้อยู่แล้ว");
                                  return;
                                }
                                const next = {};
                                for (const [key, value] of Object.entries(pricingDraft.priceGroups)) {
                                  next[key === price ? nextPrice : key] = value;
                                }
                                setPricingError("");
                                updatePricingField("priceGroups", next);
                              }} />
                          </label>
                          <label>หมายเลขโปรแกรม (คั่นด้วย ,)
                            <input style={{ display: "block", width: "100%" }}
                              value={Array.isArray(programs) ? programs.join(", ") : programs}
                              onChange={event => updatePricingField("priceGroups", {
                                ...pricingDraft.priceGroups, [price]: event.target.value
                              })} />
                          </label>
                          <button type="button" onClick={() => {
                            const next = { ...pricingDraft.priceGroups };
                            delete next[price];
                            updatePricingField("priceGroups", next);
                          }}>ลบกลุ่มนี้</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const price = window.prompt("ราคาเริ่มต้นของกลุ่มใหม่ (บาท)");
                        if (price === null) return;
                        const amount = Number(price);
                        if (!/^\d+(?:\.\d{1,2})?$/.test(price) || amount <= 0 ||
                            Object.hasOwn(pricingDraft.priceGroups, String(amount))) {
                          setPricingError("ราคาไม่ถูกต้องหรือมีกลุ่มราคานี้แล้ว");
                          return;
                        }
                        setPricingError("");
                        updatePricingField("priceGroups", {
                          ...pricingDraft.priceGroups, [String(amount)]: ""
                        });
                      }}>+ เพิ่มกลุ่มราคา</button>
                      {pricingMachine.machine_type === "wash" ? (
                        <>
                          <h4>ค่าอุณหภูมิซักเพิ่มเติม</h4>
                          {Object.entries(pricingDraft.temperaturePrice).map(([temp, value]) => (
                            <div key={temp}>{priceNumberInput(value, next => updatePricingField("temperaturePrice", {
                              ...pricingDraft.temperaturePrice, [temp]: next
                            }), `${temp}°C`)}</div>
                          ))}
                          <h4>ค่าน้ำหอม</h4>
                          {priceNumberInput(pricingDraft.aromaPrice, next => updatePricingField("aromaPrice", next), "น้ำหอม")}
                        </>
                      ) : (
                        <>
                          <h4>ค่าอุณหภูมิอบเพิ่มเติม</h4>
                          {Object.entries(pricingDraft.temperatureRule.prices).map(([option, value]) => (
                            <div key={option}>{priceNumberInput(value, next => updatePricingField("temperatureRule", {
                              ...pricingDraft.temperatureRule,
                              prices: { ...pricingDraft.temperatureRule.prices, [option]: next }
                            }), option)}</div>
                          ))}
                          <label>โปรแกรมที่ใช้ค่าอุณหภูมิเพิ่มเติม (คั่นด้วย ,)
                            <input style={{ display: "block", width: "100%" }}
                              value={Array.isArray(pricingDraft.temperatureRule.programs)
                                ? pricingDraft.temperatureRule.programs.join(", ")
                                : pricingDraft.temperatureRule.programs}
                              onChange={event => updatePricingField("temperatureRule", {
                                ...pricingDraft.temperatureRule, programs: event.target.value
                              })} />
                          </label>
                          <h4>ค่าป้องกันผ้ายับ</h4>
                          {priceNumberInput(pricingDraft.wrinklePrice, next => updatePricingField("wrinklePrice", next), "ป้องกันผ้ายับ")}
                        </>
                      )}
                      <p style={{ fontSize: 13 }}>หมายเลขโปรแกรมต้องตรงกับโปรแกรมที่เครื่องรองรับ การลบหมายเลขออกจากกลุ่มราคาจะทำให้ไม่สามารถซื้อโปรแกรมนั้นได้</p>
                      <button type="submit" disabled={pricingSaving}>
                        {pricingSaving ? "กำลังบันทึก..." : "บันทึกราคา"}
                      </button>{" "}
                      <button type="button" disabled={pricingSaving} onClick={() => {
                        setPricingMachine(null); setPricingDraft(null); setPricingError("");
                      }}>ปิด</button>
                    </form>
                  )}
                  {!pricingDraft && !pricingLoading && (
                    <button type="button" onClick={() => { setPricingMachine(null); setPricingError(""); }}>ปิด</button>
                  )}
                </section>
              )}
             </section>
          )}

          <button onClick={handleLogout}>ออกจากระบบ</button>
        </section>
      ) : (
        <form onSubmit={handleLogin}>
          <label htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            style={{ display: "block", width: "100%", marginBottom: 16 }}
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            style={{ display: "block", width: "100%", marginBottom: 16 }}
          />

          {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      )}
    </main>
  );
}
