#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log(`Set SUPABASE_DB_URL dahulu, kemudian run:

  npm run supabase:setup

Atau buka Supabase SQL Editor dan paste file ini:

  ${schemaPath}
`);
  process.exit(0);
}

const result = spawnSync("psql", [databaseUrl, "-f", schemaPath], {
  stdio: "inherit",
});

if (result.error && result.error.code === "ENOENT") {
  console.error("psql tidak dijumpai. Install PostgreSQL client atau paste supabase/schema.sql dalam Supabase SQL Editor.");
  process.exit(1);
}

process.exit(result.status || 0);
