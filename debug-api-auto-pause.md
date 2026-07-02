# Debug Session: api-auto-pause

Status: OPEN

## Symptom

- `api-1` container appears as automatically paused/stopped shortly after startup.

## Scope

- Investigate container runtime state, compose configuration, startup command, and process lifecycle.
- Do not modify business logic before evidence is collected.

## Hypotheses

1. The main Node process exits immediately because startup code throws at boot.
2. The container command finishes quickly, so Docker marks the container as exited and the UI shows it as paused/stopped.
3. Healthcheck or restart policy in compose repeatedly changes container state after a failed boot.
4. The container is being manually or externally paused by Docker Desktop, resource management, or another automation.
5. The mounted source path or runtime environment inside the container is invalid, causing the entrypoint to terminate.

## Evidence Log

- `docker ps -a` shows the real container name is `infra-api-1`, not `api-1`.
- `docker inspect infra-api-1` reports:
  - `Status=exited`
  - `Paused=false`
  - `ExitCode=1`
  - `OOMKilled=false`
- `docker logs infra-api-1` repeatedly reports `npm error code EBADPLATFORM`.
- The failing package is `@rollup/rollup-win32-x64-msvc`, which only supports `win32/x64`, while the container runs `linux/x64`.
- `infra/docker-compose.yml` starts the API with:
  - `npm install --omit=dev && node apps/api/src/server.js`
- The root workspace lockfile includes frontend workspace packages, and `package-lock.json` records `@rollup/rollup-win32-x64-msvc`.
- `apps/miniapp/package.json` declares `@rollup/rollup-win32-x64-msvc` in `devDependencies`, which is incompatible with the Linux container.

## Hypothesis Status

1. The main Node process exits immediately because startup code throws at boot.
   - Rejected. Failure happens before `node apps/api/src/server.js` starts.
2. The container command finishes quickly, so Docker marks the container as exited and the UI shows it as paused/stopped.
   - Confirmed in effect. The container exits because the `npm install` step fails.
3. Healthcheck or restart policy in compose repeatedly changes container state after a failed boot.
   - Rejected. No healthcheck or restart policy is defined for `api`.
4. The container is being manually or externally paused by Docker Desktop, resource management, or another automation.
   - Rejected. `Paused=false`; container is simply exited.
5. The mounted source path or runtime environment inside the container is invalid, causing the entrypoint to terminate.
   - Confirmed. The Linux runtime attempts to install a Windows-only Rollup package from the workspace/lockfile context.

## Next Step

- Fixed by narrowing the API container install scope in `infra/docker-compose.yml`:
  - `working_dir` changed to `/workspace/apps/api`
  - install command changed to `npm install --omit=dev --workspaces=false --package-lock=false && node src/server.js`

## Post-fix Verification

- `docker inspect infra-api-1` now reports:
  - `Status=running`
  - `Paused=false`
  - `Running=true`
- `docker exec infra-api-1 ps -o pid,ppid,args` shows the container starts in `apps/api` and performs backend-only install before boot.
- `GET http://localhost:3000/health` returns:
  - `{"ok":true,"service":"easy-points-api","driver":"mysql","db":"ok"}`
- The previous symptom is resolved: container no longer exits immediately because of `EBADPLATFORM`.
