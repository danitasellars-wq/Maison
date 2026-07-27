# MAISON

A single-file HTML/CSS/JS home & wedding planning journal app. No build step, no framework, no backend — everything lives in `index.html`. Deployed via GitHub Pages, auto-publishing ~60 seconds after any push to `main`.

- **Repo:** https://github.com/danitasellars-wq/Maison
- **Live app:** https://danitasellars-wq.github.io/Maison/
- **Sister app:** [Daybook](https://github.com/danitasellars-wq/Daybook) (https://danitasellars-wq.github.io/Daybook/) — a separate journaling app sharing the same Google auth client and architectural patterns. Fixes are often prototyped in one app and ported to the other.

## Working agreement

- Edit `index.html` directly for all changes — it is the entire app.
- **Never push automatically.** Only commit/push when the user explicitly says "push this" or "deploy this".
- Use clear, descriptive commit messages explaining *why*, not just what.
- After any push, remind the user to check **https://danitasellars-wq.github.io/Maison/** (allow ~60 seconds for GitHub Pages to rebuild).
- No Node/npm on this machine — there is no build step to run, and `node` is not on PATH. Don't try to `npm install` anything.
- No local dev server is configured for this project. Changes are verified either by reading the code carefully or by checking the live GitHub Pages URL after a push.

## Getting set up on a new Claude Code account

Nothing in this project is tied to a specific Claude/Anthropic account — it's a plain git repo, and Claude Code itself stores no project state outside this folder (aside from `.claude/` conversation history, which isn't needed since this file is the handoff).

**If the new account runs on this same computer** (most likely case): the repo is already sitting right here at `C:\Users\Danita\OneDrive\Claude\Maison`, fully set up with its GitHub remote and working tree. Just point the new Claude Code session at this same folder — nothing to clone, move, or reconfigure. Git push auth (Git for Windows' bundled Credential Manager) is tied to the Windows user session, not the Claude account, so it keeps working unchanged.

**Only if this is genuinely a new machine** would a clone be needed:
```bash
git clone https://github.com/danitasellars-wq/Maison.git
```
First push would then prompt a browser-based GitHub login (sign in as `danitasellars-wq`) since there's no stored credential yet on that machine. No `.env` files, no secrets, no other local config to carry over — the Google OAuth client (below) is owned by a Google Cloud project independent of both GitHub and any Claude account, so it needs no changes either way.

## Google auth & Drive setup

Sign-in uses Google Identity Services (`accounts.google.com/gsi/client`), client ID:

```
643043876163-9evtski9p2oqs4s1pg0nn4g1tnqdeiv8.apps.googleusercontent.com
```

This client ID is shared with Daybook and is authorised for the `danitasellars-wq.github.io` origin (and localhost). It lives in a Google Cloud project unrelated to this Claude account or to GitHub — moving accounts requires **no changes here**. If it ever needs inspecting: Google Cloud Console → APIs & Services → Credentials, on whichever Google account originally created it.

Three distinct Google Drive integrations exist, using **two different OAuth flows**:

1. **Sign-in** — `google.accounts.id` (GSI), returns a JWT parsed for `sub`/`email`/`name`. Session persisted 7 days in `localStorage['maison_sess']`, restored silently on load.
2. **Invisible cross-device sync** — scope `https://www.googleapis.com/auth/drive.appdata`. Uses the **implicit-grant redirect flow** (no popups — popups get silently blocked, especially once the app is installed to a home screen). Redirects to `accounts.google.com/o/oauth2/v2/auth` with `redirect_uri = location.origin + location.pathname` and back again, token landing in the URL hash. Writes the whole app-data blob as `maison_data.json` in the user's hidden Drive `appDataFolder`, newest-write-wins via a `lastwrite` timestamp. Debounced ~2.5s after each save. Reconnects itself silently (`prompt=none`) once per session if it was previously enabled and the ~1hr token has expired.
3. **Visible Drive backup** — broader scope `https://www.googleapis.com/auth/drive` (same redirect-flow pattern, its own token/state), lets the user pick a real folder in their own visible Drive and writes `maison-backup.json` there — a human-inspectable safety net, separate from the invisible sync file. Because it requests a wider scope than the sync feature, Google may show an "unverified app" warning on connect — this is expected and safe to click through. **Both integrations must not call `location.href` redirect in the same tick** — a bug (fixed 2026-07-22, commit `20cde68`) had the backup's redirect clobber the sync's, so `driveBoot()` now returns whether it redirected, and callers only call `bkDriveBoot()` if it didn't.

Neither Drive integration needs any Google Cloud Console changes to keep working after an account move — the redirect URI is derived from `location.origin`, which stays `https://danitasellars-wq.github.io/Maison/` regardless of who's signed into Claude Code.

## Data & storage architecture

- All app data lives in `localStorage`, namespaced `maison_{googleSub}_{key}` (e.g. `maison_abc123_home`, `..._wedding`, `..._recipes`, `..._music`, `..._wallpaper`, `..._notes_{section}`).
- **Photos are never stored as raw base64 in localStorage** (fixed 2026-07-21/22) — that was the root cause of "out of storage" errors, since browsers hard-cap localStorage at ~5MB regardless of device or Drive space. The current pipeline, applied at every photo-capture point in the app:
  - `processPhotoDataURL(dataURL)` → produces a small thumbnail (~900px, JPEG q.72) that becomes the `img` field saved in the synced JSON, **and** a fuller-res blob (~1600px, JPEG q.85) stored separately.
  - The full-res blob goes into IndexedDB (`maison_media` DB, `photos` store, keyed by the photo's own `id`) and is mirrored to Drive's `appDataFolder` as an individual file named `mzphoto_{id}.jpg`, so it still syncs across devices without bloating the JSON blob.
  - `migrateInlinePhotos()` runs once per login and auto-converts any old inline-base64 photos it finds (pre-fix data) into this scheme, freeing up jammed localStorage immediately.
  - Every photo-delete path (recipes, room/global mood board tiles, side panel delete, whole-recipe delete, "Clear All My Data") also deletes the matching IndexedDB blob and the Drive mirror file.
  - Floorplan and wallpaper images are single, bounded (not per-array) — they're compressed the same way but stored directly as a dataURL with no IndexedDB/Drive-file mirroring, since one compressed image is in no danger of filling the quota.
  - `navigator.storage.persist()` is requested on login to reduce the odds of the browser evicting IndexedDB data under storage pressure.

## Design system

CSS custom properties: `--ink:#1c140a` `--cream:#f7f3ed` `--bone:#ede4d5` `--warm:#c9b89a` `--muted:#8a7a68` `--red:#a82020` `--green:#2a5f3f` `--gold:#b8962e` `--teal:#2a7070`. Fonts: Cormorant Garamond (headings/UI labels, small-caps letter-spacing) + EB Garamond (body). No emoji in the dashboard cards or other "classy" surfaces — Danita explicitly dislikes emoji-heavy UI there; small emoji icons are still used sparingly elsewhere (e.g. 📷 Add Photo buttons) where it doesn't clash.

## Feature inventory (current state)

- **Dashboard** (landing screen after sign-in) — 2×3 typographic card grid (numbered 01–06, no icons/emoji), one card per section with a live summary line; nav tabs hide on this screen; "Recently Added" feed below the grid; tapping the MAISON brand name returns here from anywhere.
- **Our Home** — rooms with photos, floor plan upload with clickable room markers, per-room mood boards (colour palette + image tiles), quick notes.
- **Wedding** / **Honeymoon** — inspiration photo galleries, budget tracking, global mood boards (wedding tab), quick notes.
- **Days Out** — trip plans with their own photo galleries.
- **Recipes** — structured **Ingredients** (one per line, e.g. "200g flour"; leading quantity auto-detected) + **Method** (paste instructions, each line auto-numbered — also handles inline-numbered pasted text like "1. Preheat... 2. Mix...") + **Tips** (free text) + **Servings** field. Recipe view has live **serving-size scaling** (−/+ buttons recompute every ingredient quantity, including clean fraction display like ¼ ½ ¾). **Cook Mode** toggle keeps the screen awake via the Wake Lock API while viewing a recipe — only reports "on" when a lock was actually acquired, and explains why if the browser doesn't support it or the request fails. Recipes are editable after creation (not just add/delete). Extra photos per recipe, camera capture routes new photos to any existing recipe.
- **Music** — playlists/song groups with title, artist, link, notes.
- **Side panel** (all photos) — Photos/Links tab switcher; photo filters per section incl. Recipes and Archived; Links tab aggregates every link saved anywhere in the app plus manually-added links (`saved_links`).
- **Long-press to reassign** — press and hold any photo (600ms, mouse or touch) to move it to a different section/context without going through the side panel.
- **Quick Notes** — a notes button in Home/Wedding/Honeymoon/Recipes/Music, persisted per-section (`notes_{section}`), gold-highlighted when notes exist.
- **Wallpaper** — Settings → Customise Wallpaper: upload a photo, apply to all pages or pick specific sections individually.
- **PWA install** — `manifest.json` + `icon.svg` (dark rounded-square, serif "M", gold accent dot) let the app install to a phone home screen via Chrome's "Add to Home Screen", launching full-screen with no browser chrome.
- **Settings modal** — Account/sign-out, Wallpaper, Feedback (email or clipboard), Cloud Sync (status + Sync Now + Turn Off/Reconnect), Google Drive Backup (connect/choose folder/back up now/pause/change folder/disconnect), Clear All My Data.

## GitHub Actions / "Claude Code Remote" exploration

`.github/workflows/claude.yml` (added early, commit `899cfeb`, predates most feature work) wires up `anthropics/claude-code-action@beta` to respond to `@claude` mentions in GitHub issues and issue comments — i.e. Claude Code can be invoked directly from a GitHub issue rather than a local session ("Claude Code Remote"-style). Current config:

```yaml
on:
  issue_comment: { types: [created] }
  issues: { types: [opened] }
permissions: { contents: write, issues: write, pull-requests: write }
jobs:
  claude:
    if: contains(comment/issue body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

**This requires an `ANTHROPIC_API_KEY` repository secret** (Settings → Secrets and variables → Actions, on the `danitasellars-wq/Maison` repo) to function — that secret lives on GitHub, not tied to any Claude Code account, so it does **not** need to move with the account switch. Status: this was set up as an exploration and hasn't been a primary part of the workflow so far — all real feature work in this project has gone through local Claude Code sessions editing `index.html` directly, then a manual push. Worth revisiting if the new account wants to try filing a GitHub issue and having Claude act on it directly; verify the `ANTHROPIC_API_KEY` secret is still present and valid first.

## Known caveats

- Wake Lock API (Cook Mode) isn't supported on all browsers/OS versions — the toggle degrades gracefully with an explanatory alert rather than silently doing nothing.
- `localStorage` and IndexedDB data are per-device/per-browser, not per-account — moving Claude Code accounts has zero effect on any user's actual saved data; only Drive sync/backup (tied to the user's own Google account) carries data across devices.
- Photo/quality tradeoff: images are capped at ~1600px full-res / ~900px thumbnail to keep sync and storage sustainable — noticeably lower resolution than an original phone photo, by design.
