# Cyaw Stagehand on OCI ARM64

Standalone Stagehand v4.3.0 runner for the existing OCI Ubuntu ARM64 VPS, without building the entire Stagehand monorepo. Chrome for Testing runs in its own Xvfb display with persistent cookies. This setup does not depend on a Browserbase account.

## Deployment verified on 2026-11-02

- Browser launch, localhost CDP, private noVNC viewer: PASS.
- Stagehand attach, status, tabs, and opening new tabs: PASS.
- NPM production dependency audit: zero reported vulnerabilities after a Zod override.
- User systemd recovery timer enabled and active; runs every five minutes and after boot.
- Existing OmniRoute gateway model completion: PASS on a short prompt.
- AI extraction: PASS using OmniRoute `auto` routing (`Example Domain` returned correctly). Some individual free model routes are rate-limited or return HTTP 502.
- AI `observe` finds the correct `Learn more` link: PASS. Natural-language `act` uses Stagehand `observe` with Playwright CDP to click reliably: PASS, verified by navigation to IANA.
- Native Stagehand v4 `locator.click()` timed out in this environment, so the OCI CLI uses `playwright-core` for `click`, `fill`, and supported `act` operations. Both files are synced to the live VPS.
- `npm audit --omit=dev`: zero vulnerabilities reported on the live runtime (2026-11-02).

## Private browser login

Only the account owner should sign in manually. From a Mac on the same Tailscale network:

```bash
ssh -N -L 6081:127.0.0.1:6081 ubuntu@100.118.169.81
```

Leave this tunnel running. Open http://127.0.0.1:6081/vnc.html and click Connect. Use Chrome normally to sign in. Session cookies stay in `~/stagehand-oci/browser-data` (permissions 0700).

**Never expose port 5901, 6081, or 9228 to the public internet.** The viewer uses SSH for access control, not an independent password. Do not enter passwords via CLI scripts or commit any credentials.

## Server setup

Run once, or to redeploy from the fork:

```bash
mkdir -p ~/stagehand-oci
# Copy the files in oci-agent/ here
cd ~/stagehand-oci
npm install
bash start-browser.sh
node cli.mjs status
node cli.mjs tabs
node cli.mjs open https://example.com
```

The server uses its existing Chrome for Testing executable, Xvfb, x11vnc, websockify, Node.js, and npm. The dedicated ports are display `:11`, VNC `127.0.0.1:5901`, private web viewer `127.0.0.1:6081`, and CDP `127.0.0.1:9228`. Other browser sessions on `:10` are untouched.

## Browser commands

```bash
cd ~/stagehand-oci
node cli.mjs tabs
node cli.mjs open https://example.org
node cli.mjs inspect
node cli.mjs click 'a'
node cli.mjs fill 'input[name=q]' 'some text'
STAGEHAND_TAB=0 node cli.mjs inspect
```

`STAGEHAND_TAB` chooses the index from `tabs`. Without it, deterministic commands use the last tab.

AI commands (using the existing private OmniRoute gateway and `auto` routing; some models may be temporarily rate-limited):
```bash
node cli.mjs observe "find the settings button"
node cli.mjs act "click the settings button"
node cli.mjs extract "Summarize this page"
```

The CLI defaults to `STAGEHAND_OMNI_MODEL=auto` and can reuse the existing localhost OmniRoute gateway by reading `HERMES_CUSTOM_LOCALHOST_3001_API_KEY` from the private `~/.hermes/.env` file. No secret is stored in the fork. OmniRoute inference may consume gateway/provider quota. If OmniRoute is unavailable, a supported direct model key can be supplied through `STAGEHAND_API_KEY` and `STAGEHAND_MODEL`.

## Automatic recovery

Copy `systemd/cyaw-stagehand-recover.service` and `systemd/cyaw-stagehand-recover.timer` into `~/.config/systemd/user/`, then run:

```bash
systemctl --user daemon-reload
systemctl --user enable --now cyaw-stagehand-recover.timer
```

With user lingering enabled, the timer checks every five minutes and after reboot. Browser sessions are stored on disk, but websites may require periodic login renewals.

Do not automate payments, posting, sending messages, or account changes without explicit approval of the action.
