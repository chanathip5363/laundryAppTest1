function getShopPricing(db, { shopId, machine, programProfile }) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT pricing_json, machine
      FROM shop_machine_pricing
      WHERE shop_id = ?
        AND program_profile = ?
        AND (machine = ? OR machine IS NULL)
      ORDER BY CASE WHEN machine = ? THEN 0 ELSE 1 END
      LIMIT 1
    `, [shopId, programProfile, machine, machine], (err, row) => {
      if (err) {
        if (err.code === "SQLITE_ERROR" &&
            /no such table: shop_machine_pricing\b/.test(err.message)) {
          return resolve(null);
        }
        return reject(err);
      }
      if (!row) return resolve(null);

      try {
        resolve({
          source: row.machine ? "machine" : "shop",
          pricing: JSON.parse(row.pricing_json)
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { getShopPricing };
