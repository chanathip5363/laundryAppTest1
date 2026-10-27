import { useState } from "react";

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

  async function handleSelectShop(shop) {
    setCreateMachineError("");
    setCreateMachineSuccess("");
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

                {machines.map((machine) => (
                  <li key={machine.machine}>
                    {machine.display_name || machine.machine}
                    {" — "}
                    {machine.machine_type === "wash" ? "เครื่องซัก" : "เครื่องอบ"}
                    {" — "}
                    {machine.status}
                  </li>
                ))}
              </ul>
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
