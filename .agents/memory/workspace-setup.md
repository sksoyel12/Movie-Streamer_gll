---
name: Imported workspace setup
description: Dependency and verification behavior for this imported pnpm monorepo.
---

Imported workspaces may not contain `node_modules` even when their managed workflows are configured. Install from the committed pnpm lockfile before running typechecks or restarting artifact workflows.

**Why:** Without dependencies, every workflow reports missing executables and typechecking cannot start; installing from the lockfile restores the existing project without changing its dependency decisions.

**How to apply:** On a fresh import, run the repository's frozen pnpm install before diagnosing workflow or compiler failures. Treat later compiler errors as project-specific only after the install succeeds.