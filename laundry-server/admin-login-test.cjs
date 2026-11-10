const express = require("express");
const { createAdminRouter } = require("./admin-router.cjs");
const readline = require("node:readline/promises");

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const username = await rl.question("Admin username: ");
  rl.close();

  const password = require("node:child_process").execFileSync(
    "python3",
    ["-c", "import getpass; print(getpass.getpass('Admin password: '))"],
    { stdio: ["inherit", "pipe", "inherit"], encoding: "utf8" }
  ).trimEnd();

  const app = express();
  app.use(express.json());
  app.use("/admin", createAdminRouter());

  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/admin`;

    const login = await fetch(base + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await login.json();
    console.log("Login HTTP:", login.status);

    if (!login.ok) {
      console.log("Login error:", data.error);
      return;
    }

    const me = await fetch(base + "/me", {
      headers: { Authorization: `Bearer ${data.token}` }
    });

    console.log("Session HTTP:", me.status);
    console.log("Session valid:", me.ok);


    const shopsResponse = await fetch(base + "/shops", {
      headers: { Authorization: `Bearer ${data.token}` }
    });

    const shopsData = await shopsResponse.json();

    console.log("Shops HTTP:", shopsResponse.status);
    console.log("Shops:", shopsData.shops?.map(s => ({
      id: s.shop_id,
      name: s.shop_name
    })));


    const machinesResponse = await fetch(base + "/shops/shop001/machines", {
      headers: { Authorization: `Bearer ${data.token}` }
    });

    const machinesData = await machinesResponse.json();

    console.log("Machines HTTP:", machinesResponse.status);
    console.log("Machine count:", machinesData.machines?.length);
    console.log("Machines:", machinesData.machines?.map(m => ({
      id: m.machine,
      name: m.display_name,
      type: m.machine_type
    })));

    const logout = await fetch(base + "/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.token}` }
    });

    const afterLogout = await fetch(base + "/me", {
      headers: { Authorization: `Bearer ${data.token}` }
    });

    console.log("Logout HTTP:", logout.status);
    console.log("After logout HTTP:", afterLogout.status);
    console.log("Logout test passed:",
      login.status === 200 &&
      me.status === 200 &&
      logout.status === 200 &&
      afterLogout.status === 401);

  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error("Test error:", err.message);
  process.exitCode = 1;
});
