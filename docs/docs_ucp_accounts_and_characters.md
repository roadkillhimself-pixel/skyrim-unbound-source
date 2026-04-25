# Skyrim Unbound UCP Accounts And Characters

## Goal

Move `Skyrim Unbound` away from the current "one master/gateway profile = one player character"
model and toward a persistent world model with:

- one account per user
- up to 3 character slots per account
- persistent save state per character
- a first-party UCP backend that owns registration, login, and session management

## Current Constraint

The native multiplayer save system already persists player state by `profileId`.

That means the safest migration path is:

- keep native world persistence keyed by `profileId`
- make each UCP character own one stable `profileId`
- select the active character before joining the game world

This avoids rewriting the C++ save engine while still enabling proper account and
multi-character behavior.

## Data Model

The first backend slice introduces four persistent concepts in a local SQLite database:

### `accounts`

- `id`
- `username`
- `email`
- `password_hash`
- `password_salt`
- timestamps

### `account_sessions`

- long-lived UCP/web session token
- belongs to one account
- stores the currently selected character for that session

### `characters`

- belongs to one account
- occupies slot `1..3`
- has a stable `profile_id`
- has a display name
- has timestamps and `last_used_at`

### `play_sessions`

- short-lived game-login session token
- belongs to one account and one selected character
- carries the chosen `profile_id`
- scoped to a `server_master_key`

## Why This Split Matters

There are really two different login concepts:

1. UCP account session
- used by the website/UCP
- lets the player register, log in, list characters, create characters, and choose one

2. Game play session
- used by the Skyrim client/server handshake
- should resolve to exactly one selected persistent character

That split lets a player be logged into the website without immediately entering the game,
and lets the game server ask "which character does this session represent?" cleanly.

## First Backend Slice

The current implementation adds a backend foundation on the server HTTP layer:

- `GET /ucp/api/health`
- `POST /ucp/api/auth/register`
- `POST /ucp/api/auth/login`
- `POST /ucp/api/auth/logout`
- `GET /ucp/api/auth/me`
- `GET /ucp/api/characters`
- `POST /ucp/api/characters`
- `POST /ucp/api/characters/select`
- `POST /ucp/api/game/play-session`

These routes are backed by a local SQLite database file:

- default path: `./ucp/skyrim-unbound-ucp.sqlite`

Override path if needed with:

- `ucpDbPath` in server settings

## Bridge To Existing World Persistence

The bridge is:

`account -> character slot -> character.profile_id -> native world save`

In practice:

1. User logs into UCP
2. User creates/selects one of up to 3 characters
3. UCP mints a short-lived play session
4. Game login resolves that play session to the selected character's `profile_id`
5. Native server loads/spawns the persistent world state for that `profile_id`

## What Still Needs To Be Built

The current backend foundation is not the full migration yet.

Next steps:

1. Build the actual UCP web UI
- registration
- login
- character list
- reserve/select character slots

2. Change the Skyrim client auth flow
- stop hardwiring gateway Discord auth
- talk to the Skyrim Unbound UCP instead
- exchange UCP session -> play session

3. Add compatibility/bridge endpoints for game login
- either adapt the existing client to new endpoints directly
- or provide gateway-shaped endpoints that resolve to the selected character

4. Add character-aware server login
- login should treat the chosen character `profile_id` as the player identity for persistence
- account identity should remain available separately for bans/admin/UCP logic

5. Add admin/UCP features
- password reset
- account moderation
- character rename/delete rules
- audit logs

## Design Preference

For `Skyrim Unbound`, the cleanest long-term model is:

- account identity for access and moderation
- character identity for world persistence and roleplay presence
- account/slot management on the web
- actual race and appearance creation inside the game client on first join

Do not collapse those back into one field.
