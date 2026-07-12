# Kicoba Status

Public status page for Kicoba services.

It shows the current health of Kicoba public-facing surfaces (Landing Page,
Dashboard, API, Agent Execution), a 90-day uptime history for each surface, and
recent incidents.

The site is static and served by GitHub Pages, so it stays up even during an
outage. Availability is checked automatically at a fixed interval.

Live URL: to be configured.

## Layout

- `site/` static frontend served by GitHub Pages
- `scripts/` generation and monitoring scripts
- `.github/workflows/` build, deploy and monitoring workflows
- `monitor.config.json` probe configuration, references environment variables only, never real URLs

## Configuration

Probe URLs are provided as repository secrets or variables and read from the
environment at runtime. They are never committed:

- `PROBE_URL_LANDING`
- `PROBE_URL_DASHBOARD`
- `PROBE_URL_API_STATUS`
