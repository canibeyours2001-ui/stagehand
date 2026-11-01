# Cyaw Stagehand — OCI ARM64 browser agent

Self-hosted Stagehand v4.3.0, using Chrome for Testing, persistent browser-data, a private noVNC viewer, and a localhost-only Chrome DevTools port. No Browserbase account is required.

## Server installation
Run on the OCI ARM server (not on the 1 GB micro):
```bash
mkdir -p ~/stagehand-oci
# Copy files from this directory to ~/stagehand-oci
cd ~/stagehand-oci
npm install
bash start-browser.sh
npm run status
node cli.mjs tabs
```

## Manual login — only done by the account owner
From your Mac, SSH-forward the PRIVATE viewer; keep this terminal open:
```bash
ssh -N -L 6081:127.0.0.1:6081 ubuntu@YOUR_OCI_VPS_HOST
```
Then visit http://127.0.0.1:6081/vnc.html and press Connect. Browse to your sites in the Chrome window and sign in manually. Cookies remain in `~/stagehand-oci/browser-data/`. **Do not expose TCP 6081, 5901, or 9228 publicly.** The localhost-only viewer intentionally has no independent password, since SSH protects it.

## Use after login
```bash
cd ~/stagehand-oci
node cli.mjs status
node cli.mjs tabs
node cli.mjs open https://example.com
```
For AI actions, provide your own supported model provider key in the server's environment (never commit secrets):
```bash
export STAGEHAND_MODEL='google/gemini-2.5-flash'
export STAGEHAND_API_KEY='YOUR_PROVIDER_API_KEY'
node cli.mjs act "click the settings button"
node cli.mjs observe "find the account menu"
node cli.mjs extract "What is the current page about?"
```
The model is not needed for deterministic navigation or tabs. Stagehand's local browser does not get free model inference from the Browserbase Gateway. Prefer short actions, and verify destructive or externally visible actions before using automation.

## Operational boundaries
- Dedicated X11 display :11, VNC TCP 5901, private web viewer 6081, and CDP 9228.
- Existing :10/5900/6080 viewer is deliberately untouched.
- Chrome profile persists, but restarting the VPS may require rerunning `bash start-browser.sh`.
- VNC and CDP are bound to loopback and are not exposed to the public network.
- The code works from this subdirectory without building the enormous Stagehand monorepo.
- Run `npm audit --omit=dev` to verify the Zod security override.
