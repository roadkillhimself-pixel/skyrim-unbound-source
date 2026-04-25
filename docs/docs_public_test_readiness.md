# Public Test Readiness

This guide is for the moment when a local SkyMP setup needs to become a real remote test server.

## What "public test" means here

For outside testers to connect successfully, the project needs more than a running `node dist_back/skymp5-server.js`.

At minimum you need:

- `offlineMode` disabled on the server
- a real `master` URL
- a real `masterKey`
- remote clients configured to use the same master key
- public routing for gameplay traffic and UI asset traffic
- HTTPS in front of UCP/admin/website traffic before real accounts are used

## Ready-made helpers

This repository now includes:

- [public-test-server-overlay.example.json](/C:/Users/justa%20knifewound/source/repos/skymp/misc/public-test/public-test-server-overlay.example.json)
- [public-test-client-overlay.example.json](/C:/Users/justa%20knifewound/source/repos/skymp/misc/public-test/public-test-client-overlay.example.json)
- [preflight_public_test.ps1](/C:/Users/justa%20knifewound/source/repos/skymp/misc/public-test/preflight_public_test.ps1)
- [launch_public_test_server.cmd](/C:/Users/justa%20knifewound/source/repos/skymp/misc/public-test/launch_public_test_server.cmd)

The overlay files are intentionally small. Copy their values into your real settings files instead of replacing your whole local config.

Keep concrete machine profiles local. Do not commit real public IPs, master keys, server passwords, Discord tokens, SMTP credentials, or generated debug bundles.

For a local staged profile, copy the example overlays to ignored local files and fill in machine-specific values:

- `misc/public-test/skyrim-unbound-public-test.server-settings.json`
- `misc/public-test/skyrim-unbound-public-test.client-settings.json`

Those local files are intentionally ignored by git.

## Recommended path

1. Keep your current local/offline config for development.
2. Create a separate public-test settings variant by copying the overlay values into:
   - `build/dist/server/server-settings.json`
   - tester client `skymp5-client-settings.txt`
3. Run:
   - `misc\public-test\preflight_public_test.cmd`
4. Fix any blocking errors.
5. If you want to switch the current machine over to the staged public-test config, run:
   - `misc\public-test\apply_public_test_config.cmd`
   That script backs up the current live files first.
6. Open the required ports:
   - UDP `port`
   - TCP `uiPort` where `uiPort = 3000` for default `7777`, otherwise `port + 1`
   You can use:
   - `misc\public-test\open_public_test_ports.cmd`
   That script adds Windows Firewall rules and also tries to create UPnP router mappings if the router exposes them.
7. Give testers the public IP/domain plus a client config that uses the same `server-master-key`.
8. Put the public HTTP surface behind TLS before creating real accounts:
   - set `ucpPublicUrl` to an `https://` URL
   - bind `uiListenHost` to localhost when using a reverse proxy
   - keep security-question password reset disabled unless you have an additional verification policy

## Current project default

The current local build is still a local/offline profile-based setup. That is expected during development, but it is not yet a real public-test configuration.
