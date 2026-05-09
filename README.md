# GoodOldLauncher
Universal launcher to run all your games as you like and without any problems.

## Good Old Launcher - current MVP

Implemented in this version:
- Core desktop app (Electron + React + Vite)
- Multi-source local scanning plugins:
	- Steam
	- Epic Games
	- GOG
	- EA
- Launcher Engine with per-game profiles
- Compatibility Layer preflight:
	- d3d8to9
	- dgVoodoo2
	- DXVK
- Security and compliance boundaries:
	- launch request validation
	- allowed protocol checks
	- non-shell process launch
- Windows installer (NSIS)

## Stage 1 - Core application

Current stack:
- Electron + React + Vite
- Local modular Core (providers, library aggregation, launch engine, profiles)
- Windows installer via NSIS (electron-builder)

## Run in development mode

```bash
npm install
npm run dev
```

## Build installer (Windows)

```bash
npm run build:win
```

Installer output is generated into `dist-electron/`.

Main installer file:
- `dist-electron/Good Old Launcher Setup 0.1.0.exe`

## Core modules

- `src/core/providers` - source adapters registry (Steam/GOG/EA modules in next stages)
- `src/core/library` - game library aggregation
- `src/core/launch` - launch pipeline
- `src/core/profiles` - per-game compatibility profile store

## Stage 2 - Source adapters (plugins)

Status:
- Local Steam scanner adapter is implemented (`steam-local`).
- Plugin architecture is ready for new adapters (GOG/EA/Epic in next iterations).

## Stage 3 - Launcher Engine

Status:
- Launch flow uses a structured launch request with compatibility plan payload.
- Native launch execution is validated in Electron main process.

## Stage 4 - Compatibility Layer

Status:
- Compatibility planner module exists and prepares layer/borderless intents per game profile.
- Runtime wrapper preflight and auto-injection for required files is implemented.
- Place compatibility files in `compat-packs/` (see `compat-packs/README.txt`).

## Stage 5 - Security and compliance

Status:
- Launch requests are validated at system boundary (allowed protocols, executable validation, args constraints).
- The app uses non-shell process launch and restricted protocol handling.

## Notes

- The launcher does not bundle third-party wrapper DLLs.
- Add your own files to `compat-packs/` according to `compat-packs/README.txt`.
- Use compatibility wrappers responsibly, especially for online games with anti-cheat.

## UI proposal

A static proposal is available in `docs/mockups/core-layout-proposal.html`.
