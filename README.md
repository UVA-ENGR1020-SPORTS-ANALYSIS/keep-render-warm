# Keep Render Warm

This directory contains a standalone Cloudflare Worker designed to prevent cold starts on our Render-hosted backend.

## What is this?
Render automatically spins down free-tier web services after 15 minutes of inactivity. This creates a noticeable delay ("cold start") for the next user who accesses the application while the backend boots back up.

To solve this, this Cloudflare Worker uses a cron trigger (configured in `wrangler.toml` to run every 10 minutes) to send a periodic ping to the backend's health check endpoint (`RENDER_HEALTHCHECK_URL`). This ensures the backend remains perpetually active.

## Why you shouldn't need to touch this
This worker is **completely decoupled** from both the `frontend` and `backend` codebases:
- It has no shared dependencies, files, or references to either the backend or frontend.
- It only communicates with the backend over HTTP via environment variables.
- It contains no business logic or application-specific behavior.

Unless you are explicitly modifying the deployment infrastructure or changing the frequency of the keep-alive pings, you can safely ignore this directory while developing new features for the app.
