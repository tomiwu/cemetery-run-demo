# cemetery-run-demo

A small low-poly 3D browser game. Drive a black hearse through a night cemetery and protect the chapel from cartoon zombies. Made for phones.

This is a hidden demo: the page has `noindex` and `robots.txt` blocks crawlers. No site links to it.

- Play: https://tomiwu.github.io/cemetery-run-demo/ (after the first deploy)
- Product decisions: [docs/PRD.md](docs/PRD.md)
- Overview: [docs/overview.md](docs/overview.md)
- Third-party assets and licences: [docs/ASSETS.md](docs/ASSETS.md)

## Develop

```bash
npm ci
npm run dev
scripts/precommit.sh
```

## Repository

Public repository. Licence: MIT (see `LICENSE`). Third-party assets keep their own licences (CC0 and SIL OFL 1.1, see `docs/ASSETS.md`).

Code is written by a Sandcastle loop (Claude Code) from GitHub issues. Each PR is squash-merged only when all CI jobs pass.
