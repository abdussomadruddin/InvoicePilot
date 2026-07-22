const test = require("node:test");
const assert = require("node:assert/strict");
const { postPilotHookImageUrl } = require("../lib/supabase-db");

test("PostPilot gallery images use the public Supabase CDN URL", () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co/";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  try {
    assert.equal(
      postPilotHookImageUrl({ storagePath: "gallery/hook image.webp" }),
      "https://project-ref.supabase.co/storage/v1/object/public/postpilot-assets/gallery/hook%20image.webp"
    );
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
