# Kicoba Status

Public status page for Kicoba services.

It shows the current health of Kicoba public-facing surfaces: Landing Page,
Dashboard, API and Agent Execution. It also keeps a 90-day uptime history and
recent incidents.

The site is static and served by GitHub Pages, so it stays up during an outage.
Availability is checked automatically every five minutes.

Live URL: https://status.kicoba.com

## How it compares

Already know Upptime or another status page? See
[how this compares to Upptime](docs/comparison-with-upptime.md).

## Layout

- `site/` static frontend served by GitHub Pages
- `scripts/` generation and monitoring scripts
- `.github/workflows/` deployment and monitoring workflows
- `monitor.config.json` component definitions and probe configuration, with environment variable references only

## Configuration

Everything about the tracked services lives in `monitor.config.json`. To adopt
this status page for your own services, edit that one file. It has two parts:

- `components` is the list of services shown on the page. Each entry is an `id`
  used in issue labels (`component:<id>`) and a human `label` rendered in the UI.
- `probes` is how each component is checked. A `http-200` probe maps one URL to
  one component. An `api-status-json` probe reads a JSON object of
  `{ key: status }` and maps each payload key to a component id, so a single
  backend endpoint can report several components at once.

Probe URLs are never committed. They are provided as repository secrets or
variables and read from the environment at runtime through the `urlEnv` names in
the config. The default Kicoba configuration reads:

- `PROBE_URL_LANDING`
- `PROBE_URL_DASHBOARD`
- `PROBE_URL_API_STATUS`

## Use it for your own services

This is Kicoba's own status page, and you are welcome to run it for yours:

1. Fork the repository.
2. Edit `monitor.config.json` with your own `components` and `probes` (see Configuration above).
3. Add your probe URLs as repository secrets or variables, using the `urlEnv` names from your config.
4. Set your branding: edit the header in `site/index.html` and put your domain in `site/CNAME`.
5. Enable GitHub Pages on your fork and point your DNS at it.
6. The commit-identity enforcement (`scripts/setup.sh` plus `.githooks/pre-commit`) is specific to the Kicoba repository. Remove it or replace it with your own identity.

Please keep the `https://kicoba.com` link in the footer as a courtesy (see License).

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
[`LICENSE`](LICENSE). Copyright Kicoba, https://kicoba.com. For why a European
licence over US-origin ones like MIT or Apache, see
[docs/why-eupl.md](docs/why-eupl.md).

You are welcome to reuse and adapt this status page for your own services, mostly
through `monitor.config.json` and the repository secrets. If you do, please keep
the link to https://kicoba.com in the page footer. It is a courtesy that supports
the project, not a legal obligation under the EUPL.

