# PostPilot

PostPilot is a simple Vercel webapp for uploading a creative, previewing Malay copywriting, and publishing it directly to a Facebook Page after approval.

Copywriting is generated from the uploaded creative note plus the supplied salespage URL. The app fetches the salespage title, meta description, headings, and visible text snippets so it is not locked to one product.

The posting flow is:

1. Upload creative and salespage URL.
2. Preview caption and first comment CTA.
3. Approve to publish, or regenerate for a new copywriting variation.

## Required Vercel Environment Variables

Set these in Vercel Project Settings:

```text
FACEBOOK_PAGE_ID=1201743546357100
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
APP_PASSWORD=strong_login_password
```

Optional:

```text
MAX_UPLOAD_MB=20
```

## Local Facebook Workflow

The original local automation and Telegram workflow is kept under `facebook-posts/`.

## App Icons

The web, iOS, and Android app icons are generated from `public/logo.svg`:

- `public/favicon.ico`
- `public/icons/apple-touch-icon.png`
- `public/icons/android-chrome-192x192.png`
- `public/icons/android-chrome-512x512.png`
