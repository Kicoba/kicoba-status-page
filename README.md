# Kicoba Status

Public status page for Kicoba services.

It shows the current health of Kicoba public-facing surfaces: Landing Page,
Dashboard, API and Agent Execution. It also keeps a 90-day uptime history and
recent incidents.

The site is static and served by GitHub Pages, so it stays up during an outage.
Availability is checked automatically every five minutes.

Live URL: https://status.kicoba.com

## Layout

- `site/` static frontend served by GitHub Pages
- `scripts/` generation and monitoring scripts
- `.github/workflows/` deployment and monitoring workflows
- `monitor.config.json` probe configuration with environment variable references only

## Configuration

Probe URLs are provided as repository secrets or variables and read from the
environment at runtime. They are never committed:

- `PROBE_URL_LANDING`
- `PROBE_URL_DASHBOARD`
- `PROBE_URL_API_STATUS`

## Local setup

Run:

```sh
./scripts/setup.sh
npm ci
npm run build
```

The setup script configures the public repo commit identity:

```text
Kicoba.com <agentic-workspace@kicoba.com>
```

The local pre-commit hook refuses any other commit email.

## License

Licensed under the European Union Public Licence v1.2 (EUPL-1.2). See
[`LICENSE`](LICENSE). Copyright Kicoba, https://kicoba.com.

You are welcome to reuse and adapt this status page for your own services, mostly
through `monitor.config.json` and the repository secrets. If you do, please keep
the link to https://kicoba.com in the page footer. It is a courtesy that supports
the project, not a legal obligation under the EUPL.

