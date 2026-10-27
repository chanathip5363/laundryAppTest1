const sqlite3 = require("sqlite3").verbose();

function initializeShopPricing(db) {
  return new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS shop_machine_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id TEXT NOT NULL,
        machine TEXT,
        program_profile TEXT NOT NULL,
        pricing_json TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id),
        FOREIGN KEY (machine) REFERENCES machines(machine)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_pricing_profile
      ON shop_machine_pricing(shop_id, program_profile)
      WHERE machine IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_pricing_machine
      ON shop_machine_pricing(machine)
      WHERE machine IS NOT NULL;

      CREATE TRIGGER IF NOT EXISTS trg_shop_pricing_insert
      BEFORE INSERT ON shop_machine_pricing
      WHEN NEW.machine IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'MACHINE_SHOP_MISMATCH')
        WHERE NOT EXISTS (
          SELECT 1 FROM machines
          WHERE machine = NEW.machine
            AND shop_id = NEW.shop_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_shop_pricing_update
      BEFORE UPDATE ON shop_machine_pricing
      WHEN NEW.machine IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'MACHINE_SHOP_MISMATCH')
        WHERE NOT EXISTS (
          SELECT 1 FROM machines
          WHERE machine = NEW.machine
            AND shop_id = NEW.shop_id
        );
      END;

      CREATE TRIGGER IF NOT EXISTS trg_machine_shop_change_pricing
      BEFORE UPDATE OF shop_id ON machines
      WHEN OLD.shop_id IS NOT NEW.shop_id
      BEGIN
        SELECT RAISE(ABORT, 'MACHINE_HAS_SHOP_PRICING')
        WHERE EXISTS (
          SELECT 1 FROM shop_machine_pricing
          WHERE machine = OLD.machine
        );
      END;
    `, err => err ? reject(err) : resolve());
  });
}

module.exports = { initializeShopPricing };
