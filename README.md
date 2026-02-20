# RC Interactions

![In GAME Dialogue](docs/images/in-game.png)

A modular interaction/dialogue system for FiveM featuring:
- A visual node-based editor (NUI) to design dialogue flows with **16 node types**.
- An in-game runtime: spawns NPCs with idle animations, provides a "Talk" interaction, and runs the flow.
- **10 economy & effects nodes**: give/remove items and money, animations, teleports, random branching, sound effects, and more.
- **24 game variables** for dynamic conditions (player stats, money, items, jobs).
- **Server-side security**: all economy operations validated and rate-limited on the server.
- Framework support via Bridge (QBCore / ESX / Standalone) with multi-inventory compatibility.
- Full test coverage across web, client, and server layers.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Editor (NUI)](#editor-nui)
  - [Node Types](#node-types)
  - [Game Variables](#game-variables)
  - [Runtime (in-game)](#runtime-in-game)
  - [Dialogue Controls](#dialogue-controls)
  - [Call a flow from another script](#call-a-flow-from-another-script)
  - [Dialogue End Trigger](#dialogue-end-trigger)
- [Editor Keyboard Shortcuts](#editor-keyboard-shortcuts)
- [Database](#database)
- [Resource Structure](#resource-structure)
- [Testing](#testing)
- [Screenshots / Images](#screenshots--images)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Visual Node Editor
- **16 node types** organized into 5 categories: Flow, Dialogue, Logic, Economy, Effects.
- **MySQL persistence** (tables: `rc_interactions`, `rc_interaction_groups`).
- **Categorized toolbar** with command palette (Ctrl+K) for quick node creation.
- **Multi-selection**: box/marquee selection + Ctrl+click toggle. Multi-drag, multi-delete, multi-duplicate.
- **Auto-layout**: hierarchical graph algorithm with cycle protection (Ctrl+L).
- **Fit-to-view**, cursor-centered zoom, zoom indicator.
- **Undo/redo** with full property edit history.
- **Duplicate** any node (Ctrl+D).
- **Grid background** and node/connection counters.
- **Import/export** projects as JSON with schema validation.
- **Bilingual**: English and Spanish with ~170 translation keys.

### In-Game Runtime
- World NPCs defined by the START node (coords + model + **idle animation**).
- Optional integration with `qb-target` or `ox_target` (via `Config.UseTarget`).
- Runtime dialogue UI with typewriter effect, keyboard selection, and ESC to cancel.
- Cinematic camera focusing the NPC during conversation.
- **NPC speech/lipsync** during dialogue (configurable via `Config.EnableNpcSpeech`).
- **Per-dialogue animations**: each DIALOGUE node can override the NPC animation.
- **Dialogue end triggers**: event fired when dialogue completes or is cancelled.

### Economy & Effects (Server-Validated)
- Give/remove items and money with **full server-side validation**.
- Active session tracking, per-node cooldowns, input sanitization.
- Multi-inventory support: ox_inventory → qb-inventory → legacy QBCore fallback.

### Game Variables
- **24 built-in variables** from player stats, money, items, jobs, and custom memory.
- **Variable-to-variable comparison** using `$` prefix.
- **6 comparison operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`.

### Developer Experience
- **Automatic version checking** against GitHub releases.
- **Test suites**: Vitest (web), Lua unit tests (client), Lua integration tests (server).
- **Public API**: start interactions from external scripts with custom variable injection.

---

## Screenshots / Images

### In-game dialogue (NUI)

![In GAME Dialogue](docs/images/in-game.png)

### Dashboard

![Dashboard](docs/images/dashboard.png)

### Node editor

![Node Editor](docs/images/node-editor.png)

### Web simulation

![Simulator](docs/images/simulator.png)

---

## Requirements

- **oxmysql** (required): the resource uses `@oxmysql/lib/MySQL.lua`.
- (Optional) **qb-target** or **ox_target** if you want the "Talk" target interaction.
- (Optional) **ox_inventory** or **qb-inventory** for item operations (falls back to Player.Functions if neither is present).
- For building the NUI (only if you modify the web UI): **Node.js**.

---

## Installation

1) **Place the resource**
- Copy the `rc-interactions` folder into your resources directory.
  - Example: `resources/[realcity]/rc-interactions`

2) **Ensure dependencies**
- Ensure `oxmysql` is installed and started.
- If you plan to use target interactions:
  - install and start `qb-target` or `ox_target`.

3) **Database**
- Import [interactions.sql](interactions.sql) (recommended).
- Alternatively, the resource attempts to create tables on start (see `server/main.lua`).

4) **Build the NUI (only if you changed the web UI or `web/dist` is missing)**
```bash
cd web
npm install
npm run build
```

5) **Start the resource**
In your `server.cfg`:
```cfg
ensure oxmysql
ensure rc-interactions
```

---

## Configuration

Edit [shared/config.lua](shared/config.lua).

| Option | Description | Default |
|--------|-------------|---------|
| `Config.Framework` | Framework (auto/qbcore/esx/standalone) | `auto` |
| `Config.Debug` | Debug logs + enables test commands | `true` |
| `Config.CheckForUpdates` | Check GitHub for new versions on start | `true` |
| `Config.InteractionDistance` | Base interaction distance (if implementing proximity checks without target) | `3.0` |
| `Config.UseTarget` | Use qb-target / ox_target for interactions | `true` |
| `Config.EditorCommand` | Command to open the editor | `interactioneditor` |
| `Config.EditorGroup` | Group required to open the editor (Bridge) | `admin` |
| `Config.EnableNpcSpeech` | Enable NPC ambient speech/lipsync during dialogue | `true` |

---

## Usage

### Editor (NUI)

1) Join the server with a player that matches `Config.EditorGroup`.
2) Run the command configured in `Config.EditorCommand`.
3) Create a project, design the flow using the categorized toolbar or command palette (Ctrl+K), and save.

**Permissions**
- The command triggers a server-side check: `rc-interactions:server:checkEditorPermissions`.
- If `Bridge.HasGroup(source, Config.EditorGroup)` is true, the editor opens.

**Spawning an NPC in the world**
- The runtime spawns an NPC when the `START` node has:
  - `data.coords` (x, y, z, w)
  - `data.model` (optional, defaults to `a_m_y_business_01`)
  - `data.animDict` + `data.animName` (optional — idle animation the NPC plays while waiting)

---

### Node Types

The editor supports **16 node types** organized in 5 categories:

#### Flow
| Node | Description | Outputs |
|------|-------------|---------|
| **START** | Entry point. Defines NPC model, coordinates, and optional idle animation. | 1 (main) |
| **END** | Terminates the interaction. Fires `dialogueEnded` event. | 0 |

#### Dialogue
| Node | Description | Outputs |
|------|-------------|---------|
| **DIALOGUE** | Shows text to the player with optional response choices. Supports per-node NPC animation override. | N (one per choice) |

#### Logic
| Node | Description | Outputs |
|------|-------------|---------|
| **CONDITION** | Evaluates a condition using [game variables](#game-variables) with 6 operators. Branches to true/false. | 2 (true/false) |
| **SET_VARIABLE** | Sets a variable in interaction memory. | 1 (main) |
| **EVENT** | Triggers a client or server event with custom data. | 1 (main) |
| **RANDOM** | Random branching with configurable weighted percentages. | N (weighted) |

#### Economy
| Node | Description | Outputs |
|------|-------------|---------|
| **GIVE_ITEM** | Gives item(s) to the player. Server-validated. | 1 (main) |
| **REMOVE_ITEM** | Removes item(s) from the player. Server-validated. | 1 (main) |
| **GIVE_MONEY** | Gives money (cash/bank) to the player. Server-validated. | 1 (main) |
| **REMOVE_MONEY** | Removes money (cash/bank) from the player. Server-validated. | 1 (main) |

#### Effects
| Node | Description | Outputs |
|------|-------------|---------|
| **ANIMATION** | Plays an animation on the NPC or player. Configurable dict, name, target, duration. | 1 (main) |
| **WAIT** | Timed pause in milliseconds. | 1 (main) |
| **TELEPORT** | Teleports the player to coordinates (X, Y, Z, heading). | 1 (main) |
| **NPC_CHANGE** | Changes the NPC model/animation mid-conversation. | 1 (main) |
| **SOUND** | Plays a GTA sound effect. | 1 (main) |

---

### Game Variables

CONDITION nodes can evaluate **24 built-in game variables** plus custom memory variables:

| Category | Variable | Description |
|----------|----------|-------------|
| **Player** | `player:health` | Current health (0-200) |
| | `player:armor` | Current armor (0-100) |
| | `player:stamina` | Current stamina (0-100) |
| | `player:is_dead` | Whether the player is dead |
| | `player:is_wanted` | Whether the player has a wanted level |
| | `player:in_vehicle` | Whether the player is in a vehicle |
| | `player:speed` | Current movement speed |
| | `player:weapon` | Current weapon hash |
| | `player:is_swimming` | Whether the player is swimming |
| | `player:is_falling` | Whether the player is falling |
| | `player:is_running` | Whether the player is running |
| | `player:name` | Player character name |
| | `player:job_name` | Current job name |
| | `player:job_grade` | Current job grade |
| | `player:gang_name` | Current gang name |
| | `player:citizenid` | Citizen ID |
| | `player:gender` | Player gender |
| | `player:phone_number` | Phone number |
| **Money** | `money:cash` | Cash on hand |
| | `money:bank` | Bank balance |
| **Item** | `item:<name>` | Count of item in inventory |
| **Job** | `job:<name>` | Whether player has the specified job |
| **Memory** | `<custom>` | Variables set via SET_VARIABLE nodes |

**Variable references**: Use `$` prefix in the target value to compare against another variable (e.g., target `$money:cash` resolves to the player's cash amount at evaluation time).

---

### Runtime (in-game)

- On resource start and sync, interactions are loaded and NPCs are spawned based on `START` coords.
- NPCs play their configured **idle animation** while waiting for interaction.
- With target enabled (`Config.UseTarget = true`), you will see the **Talk** option.
- When interacting:
  - A camera is created and centered on the NPC.
  - The dialogue UI opens.
  - The NPC plays a **per-dialogue animation** (or default talk animation).
  - Optionally, NPC **speech/lipsync** is played (see `Config.EnableNpcSpeech`).
- Economy operations (give/remove items/money) are **validated server-side**.

### Dialogue Controls

| Key | Action |
|-----|--------|
| **Up/Down arrows** | Navigate options |
| **Enter** | Select option |
| **1–5** | Quick select option |
| **ESC** | Leave/cancel the interaction |

---

### Call a flow from another script

You can start a saved interaction (project) by its UUID from other client or server scripts, optionally injecting custom variables.

- Client (Lua) — export (returns boolean):
```lua
-- Basic usage
local ok = exports['rc-interactions']:StartInteractionById('your-project-uuid')
if not ok then print('Interaction not found') end

-- With custom variables injected into interaction memory
local ok = exports['rc-interactions']:StartInteractionById('your-project-uuid', {
    quest_stage = 'started',
    player_reputation = 50
})
```

- Client (event) — trigger locally:
```lua
TriggerEvent('rc-interactions:client:startInteractionById', 'your-project-uuid')
```

- Server → Client (recommended when starting for a specific player):
```lua
-- server-side
local targetPlayer = 123 -- player server id
TriggerClientEvent('rc-interactions:client:startInteractionById', targetPlayer, 'your-project-uuid')
```

Notes:
- The `projectId` is the UUID shown in the editor and stored in the `rc_interactions` table.
- The client `export` is a client-side function; call it from client scripts or use the server-to-client event when initiating from the server.
- If you want to start the interaction for all players, use `-1` as the target in `TriggerClientEvent`.
- Custom variables passed in the second argument are available in CONDITION and SET_VARIABLE nodes during the flow.

---

### Dialogue End Trigger

When a dialogue ends (either naturally via END node or cancelled via ESC), an event is fired:

```lua
-- Client-side listener
AddEventHandler('rc-interactions:dialogueEnded', function(data)
    print('Dialogue ended:', data.projectId, 'Cancelled:', data.cancelled)
    -- data.projectId = the UUID of the interaction
    -- data.cancelled = true if player pressed ESC, false if reached END node
end)
```

This enables external scripts to react to dialogue completion (e.g., start a mission, update quest state, award reputation).

---

## Editor Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Z** | Undo |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Redo |
| **Ctrl+S** | Save project |
| **Ctrl+D** | Duplicate selected node(s) |
| **Ctrl+L** | Auto-layout all nodes |
| **Ctrl+K** | Open command palette |
| **Delete** | Delete selected node(s) |
| **Escape** | Deselect / Close palette |
| **Ctrl+Click** | Toggle multi-selection |
| **Click+Drag (canvas)** | Marquee/box selection |
| **Scroll wheel** | Zoom (cursor-centered) |

---

## Database

Tables (see [interactions.sql](interactions.sql)):
- `rc_interaction_groups`: project grouping.
- `rc_interactions`: stores the flow as JSON in `data` and a stable `uuid`.

The resource also attempts to ensure tables exist on startup (see `server/main.lua`).

---

## Resource Structure

```
rc-interactions/
├── fxmanifest.lua          - Resource definition + NUI page
├── shared/config.lua       - Global configuration
├── bridge/                 - Framework adapters
│   ├── init.lua            - Auto-detection + universal wrappers
│   ├── qb.lua              - QBCore (ox_inventory/qb-inventory/legacy fallback)
│   ├── esx.lua             - ESX (full implementation)
│   └── standalone.lua      - Standalone (ACE + overridable stubs)
├── server/
│   ├── main.lua            - Persistence, security, economy validation
│   ├── versioncheck.lua    - GitHub release version checking
│   └── tests.lua           - Server-side test harness
├── client/
│   ├── main.lua            - Editor open/close (NUI visibility)
│   ├── runtime.lua         - NPC spawn, interaction flow, 16 node types
│   └── tests.lua           - Client-side test harness
├── web/                    - React app (editor / simulator / runtime UI)
│   ├── components/         - NodeEditor, Dashboard, GameSimulator, RuntimeDialogue
│   ├── contexts/           - Language (EN/ES, ~170 keys)
│   ├── utils/              - flowEngine, gameVariables, fetchNui, uuid
│   ├── __tests__/          - Vitest unit tests (30 tests)
│   └── dist/               - Compiled NUI build
├── interactions.sql        - Database schema
├── CHANGELOG.md            - Version history
└── ROADMAP.md              - Development roadmap
```

---

## Testing

### Web Tests (Vitest)
```bash
cd web
npx vitest run
```
Runs 30 unit tests covering `findNextNode`, `evaluateCondition` (all operators), and `traverseLogic` (complex flows, memory, infinite loop protection).

### Client Tests (In-Game)
```
/rctest all        -- Run all unit test suites
/rctest flow       -- Flow traversal tests
/rctest memory     -- Memory/variable tests
/rctest condition  -- Condition evaluation tests
/rctest bridge     -- Bridge function tests
/rctest spawn      -- NPC spawn tests (interactive)
/rctest dialogue   -- Dialogue flow tests (interactive)
/rctest api        -- Public API tests
/rctest cleanup    -- Clean up test entities
```
Only available when `Config.Debug = true`.

### Server Tests (Console)
```
rctest_sv all          -- Run all server test suites
rctest_sv db           -- Database CRUD tests
rctest_sv bridge       -- Bridge function tests
rctest_sv sync         -- Sync validation tests
rctest_sv permissions  -- Permission check tests
```
Only available when `Config.Debug = true`.

---

## Bridge Function Coverage

| Function | QBCore | ESX | Standalone |
|----------|--------|-----|------------|
| `HasItem` | ✅ | ✅ Client + Server | ✅ Stub (override) |
| `HasGroup` (client) | ✅ Job/Gang | ✅ Job | ✅ ACE |
| `HasGroup` (server) | ✅ ACE-based | ✅ Admin + Job | ✅ ACE-based |
| `Notify` (server) | ✅ | ✅ | ✅ Fallback |
| `GetMoney` | ✅ Client + Server | ✅ Client + Server | ✅ Stub (override) |
| `AddItem` | ✅ ox → qb-inv → legacy | ✅ | ✅ Stub |
| `RemoveItem` | ✅ ox → qb-inv → legacy | ✅ | ✅ Stub |
| `AddMoney` | ✅ | ✅ (cash/bank) | ✅ Stub |
| `RemoveMoney` | ✅ | ✅ (cash/bank) | ✅ Stub |

---

## Contributing

Pull requests are welcome.

1) Branching
- Create a branch like `feature/my-change` or `fix/my-fix`.

2) Guidelines
- Keep changes small and focused.
- If you modify the web UI, always rebuild `web/dist`.
- Run `npx vitest run` before submitting to ensure tests pass.

3) Web build (if you changed `web/`)
```bash
cd web
npm install
npm run build
```

4) Pull request
- Describe the problem, solution, and testing steps.
- Add screenshots if UI changes.

---

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0 (code-specific, non-commercial).

Key points:
- Non-commercial only: you may not use this software for commercial purposes without a separate commercial license from the copyright holder.
- Attribution/Notices: retain copyright notices and this license in source distributions.

Full legal text: https://polyformproject.org/licenses/noncommercial/1.0.0/

Recommended attribution example:

- rc-interactions — A modular interaction/dialogue system for FiveM
- Author: xbymarcos
- Source: https://github.com/xbymarcos/rc-interactions
- Licensed under PolyForm Noncommercial 1.0.0 — https://polyformproject.org/licenses/noncommercial/1.0.0/
