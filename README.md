# PostPilot

PostPilot is a simple Vercel webapp for uploading a creative and publishing it directly to a Facebook Page with a Malay caption and first comment CTA.

## Required Vercel Environment Variables

Set these in Vercel Project Settings:

```text
FACEBOOK_PAGE_ID=1201743546357100
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
```

Optional:

```text
MAX_UPLOAD_MB=20
```

## Local Facebook Workflow

The original local automation and Telegram workflow is kept under `facebook-posts/`.
