# Comparison with Upptime

Both this project and [Upptime](https://github.com/upptime/upptime) are open-source
status pages built on the same GitHub-native idea: GitHub Actions run the checks,
GitHub Issues store the incidents, and GitHub Pages serves a static site. No servers,
no subscription.

Upptime, created by Anand Chowdhary, is the mature and widely adopted option in this
space (thousands of teams, MIT licensed). This project is young and deliberately
minimal, so this page is honest about what it does and does not do yet, to help you
pick the right tool.

## At a glance

| Topic | This project | Upptime |
|---|---|---|
| Model | GitHub Actions plus Issues plus Pages | GitHub Actions plus Issues plus Pages |
| Frontend | Single static `index.html`, Tailwind via CDN, no build | Svelte and Sapper progressive web app with a build |
| Footprint | One page you can read and audit in minutes | Full app with many generated files |
| Design | Bespoke look, restyled by editing one HTML and Tailwind file | Its own default status-page theme, themeable |
| Configuration | `monitor.config.json` plus repository secrets | `.upptimerc.yml` |
| Components shown | Curated components you group and label yourself | One entry per monitored endpoint |
| Uptime history | 90-day bar plus a precise uptime percentage per component | Response-time and uptime graphs (24h, 7d, 30d, yearly) |
| Response-time graphs | Not yet | Yes |
| Notifications | Not yet, incidents are tracked as issues | Slack and other channels |
| Internationalization | Copy is English | i18n support |
| License | EUPL-1.2 (European, copyleft) | MIT for code, ODbL for data |
| Maturity and community | Young, small | Established, large community |

## Choose Upptime if

- You want the most feature-rich, battle-tested option, with response-time graphs, notifications, and internationalization.
- You prefer a permissive MIT license and a large community.
- You are comfortable running a small framework app.

## Choose this project if

- You want the smallest possible surface: one static page you can read, audit, and adapt in a single sitting, with no framework build.
- You want to present a curated set of grouped surfaces under your own labels, rather than one line per raw endpoint.
- You want to adapt it mostly through one config file and repository secrets.
- A European public licence (EUPL-1.2) fits your context.

On why the licence choice matters, see [Why the European Union Public Licence](why-eupl.md).
