MQTT MIGRATION - WINDOWS BUILD TEST ONLY (2026-11-04)

Files: src/App.jsx, laundry-server/server.cjs, laundry-server/mqtt-manager.cjs

Do not deploy this ZIP to VPS yet.
Tests performed here: node --check for CJS; mocked MQTT manager publish for wash/dry/finish/reset and disconnected rejection.
NOT performed: Vite build (full React project/dependencies not provided), live MQTT broker or payment webhook integration.
No edits to payment-bridge.cjs, admin-router.cjs, txid, RUNNING, Door Lock.
React hidden finish buttons and function removed.
Known existing behavior: webhook writes SUCCESS and responds before MQTT publish confirmation; this ZIP does not change payment semantics.

On Windows, test using a separate Git worktree or back up existing files before replacing.
