#!/usr/bin/env node

const { migrateDriveDataToSupabase } = require("../lib/invoices");

migrateDriveDataToSupabase()
  .then((result) => {
    console.log(JSON.stringify({
      ok: true,
      clientCount: result.clientCount,
      settingsMigrated: result.settingsMigrated,
    }, null, 2));
  })
  .catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
