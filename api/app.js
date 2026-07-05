const { requireAuth } = require("../lib/auth");

function pageHtml() {
  return `<!doctype html>
<html lang="ms">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PostPilot</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/logo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0f172a">
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      background: #f4f5f7;
      color: #111827;
    }

    body { margin: 0; }

    main {
      width: min(880px, calc(100% - 32px));
      margin: 40px auto;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
    }

    .brand img {
      width: 34px;
      height: 34px;
      border-radius: 10px;
    }

    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      box-shadow: 0 14px 35px rgba(15, 23, 42, 0.08);
      padding: 26px;
    }

    .hero {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .hero img {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 5vw, 42px);
      letter-spacing: -0.04em;
    }

    p {
      line-height: 1.55;
      color: #4b5563;
    }

    label {
      display: block;
      margin: 18px 0 8px;
      font-weight: 700;
    }

    input,
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 13px 14px;
      font: inherit;
      background: #fff;
    }

    textarea {
      min-height: 110px;
      resize: vertical;
    }

    button {
      margin-top: 20px;
      border: 0;
      border-radius: 999px;
      padding: 14px 22px;
      background: #111827;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }

    button.secondary {
      margin-top: 0;
      background: #e5e7eb;
      color: #111827;
    }

    button:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    .note { font-size: 14px; }

    .result {
      margin-top: 18px;
      border-radius: 14px;
      padding: 14px;
      white-space: pre-wrap;
      display: none;
    }

    .result.ok {
      display: block;
      background: #ecfdf5;
      border: 1px solid #86efac;
      color: #14532d;
    }

    .result.err {
      display: block;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #7f1d1d;
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <div class="brand">
        <img src="/logo.svg" alt="" width="34" height="34">
        <span>PostPilot</span>
      </div>
      <form method="post" action="/api/logout">
        <button class="secondary" type="submit">Logout</button>
      </form>
    </div>

    <section class="card">
      <div class="hero">
        <img src="/logo.svg" alt="" width="64" height="64">
        <h1>PostPilot</h1>
      </div>
      <p>Upload creative, masukkan salespage link, dan PostPilot akan publish terus ke Facebook Page dengan caption Melayu serta first comment CTA.</p>
      <p class="note">Nota: gambar biasanya sesuai untuk Vercel. Video besar mungkin kena limit upload serverless; kalau video besar, guna local app atau kita sambung storage selepas ini.</p>

      <form id="postForm">
        <label for="creative">Creative gambar/video</label>
        <input id="creative" name="creative" type="file" accept="image/*,video/mp4,video/quicktime,video/webm" required>

        <label for="salespage_link">Salespage link</label>
        <input id="salespage_link" name="salespage_link" type="url" value="https://digitaldominate.com/" required>

        <label for="caption_note">Nota caption / angle (optional)</label>
        <textarea id="caption_note" name="caption_note" placeholder="Contoh: Tekankan masalah leads masuk tapi tak close."></textarea>

        <label for="custom_caption">Custom caption penuh (optional)</label>
        <textarea id="custom_caption" name="custom_caption" placeholder="Kalau isi bahagian ini, sistem guna caption ini terus. Pastikan letak salespage link."></textarea>

        <label for="first_comment">First comment CTA (optional)</label>
        <textarea id="first_comment" name="first_comment" placeholder="Kosongkan untuk auto-generate first comment."></textarea>

        <button type="submit">Post ke Facebook Page</button>
      </form>

      <div id="result" class="result"></div>
    </section>
  </main>

  <script>
    const form = document.getElementById("postForm");
    const result = document.getElementById("result");
    const button = form.querySelector("button");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      result.className = "result";
      result.textContent = "";
      button.disabled = true;
      button.textContent = "Posting...";

      try {
        const response = await fetch("/api/post", {
          method: "POST",
          body: new FormData(form)
        });
        const json = await response.json();
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok || !json.ok) {
          throw new Error(json.error || "Post failed.");
        }

        result.className = "result ok";
        result.textContent = [
          "Posted ke Facebook.",
          \`Post ID: \${json.post_id || "-"}\`,
          \`Link: \${json.permalink_url || "-"}\`,
          \`Comment ID: \${json.comment_id || "-"}\`
        ].join("\\n");
        form.reset();
        document.getElementById("salespage_link").value = "https://digitaldominate.com/";
      } catch (error) {
        result.className = "result err";
        result.textContent = error.message || String(error);
      } finally {
        button.disabled = false;
        button.textContent = "Post ke Facebook Page";
      }
    });
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed.");
    return;
  }

  try {
    requireAuth(req);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.statusCode = 200;
    res.end(pageHtml());
  } catch (error) {
    if (error.statusCode === 500) {
      res.statusCode = 500;
      res.end(error.message);
      return;
    }

    res.statusCode = 302;
    res.setHeader("location", "/login");
    res.end("Redirecting to login.");
  }
};
