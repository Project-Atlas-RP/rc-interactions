# Changelog

All notable changes to **RC Interactions** are documented here.  
This project follows [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-02-20

### 🎯 Highlights

Version 1.1.0 is a major feature release that transforms RC Interactions from a basic dialogue system into a full-featured NPC interaction engine. It adds **10 new node types**, a **complete server-side security model**, **24 game variables** for dynamic conditions, a **rewritten editor UX**, and comprehensive **test coverage** across all layers.

---

### ✨ New Node Types (Phase 2 — Complete)

Ten new node types expand what you can build without writing any code:

| Node | Description |
|------|-------------|
| **GIVE_ITEM** | Give item(s) to the player. Processed server-side with full validation. |
| **REMOVE_ITEM** | Remove item(s) from the player. Server-side with inventory compatibility. |
| **GIVE_MONEY** | Give money (cash/bank) to the player. Amount limits enforced server-side. |
| **REMOVE_MONEY** | Remove money (cash/bank) from the player. |
| **ANIMATION** | Play an animation on the NPC or player mid-conversation. Configurable dictionary, name, target, and duration. |
| **WAIT** | Timed pause before continuing to the next node (in milliseconds). |
| **RANDOM** | Random branching with configurable weighted percentages per output. |
| **TELEPORT** | Teleport the player to specific coordinates (X, Y, Z, heading). |
| **NPC_CHANGE** | Change the NPC model and/or animation mid-conversation for multi-character scenes. |
| **SOUND** | Play a GTA sound effect during the dialogue flow. |

The system now supports **16 node types** total (previously 6).

---

### 🔒 Server-Side Security Model (New)

All economy-affecting operations (GIVE_ITEM, REMOVE_ITEM, GIVE_MONEY, REMOVE_MONEY) are now **fully validated server-side**:

- **Single endpoint architecture**: One secure `processNode(projectId, nodeId)` callback. The server resolves node data from its own cache — never trusts client data.
- **Active sessions**: Tracks which player has an active interaction (`ActiveSessions`).
- **Per-node cooldowns**: 3-second cooldown per node prevents rapid replay of economy nodes (`NodeCooldowns`).
- **Global economy cooldown**: 1-second minimum between any economy operation per player.
- **Input sanitization**: Item names stripped of special characters, amounts clamped to configured maximums (`MAX_ITEM_COUNT = 100`, `MAX_MONEY_AMOUNT = 1,000,000`).
- **Cached interactions**: Server maintains its own copy of all interaction data (`CachedInteractions`), synchronized with the database.
- **Session lifecycle**: Automatic cleanup on disconnect (`playerDropped`).

---

### 🎮 Game Variables System (New)

**24 game variables** are now available for use in CONDITION nodes, organized in 5 categories:

| Category | Variables |
|----------|-----------|
| **Player** | `player:health`, `player:armor`, `player:stamina`, `player:is_dead`, `player:is_wanted`, `player:in_vehicle`, `player:speed`, `player:weapon`, `player:is_swimming`, `player:is_falling`, `player:is_running`, `player:name`, `player:job_name`, `player:job_grade`, `player:gang_name`, `player:citizenid`, `player:gender`, `player:phone_number` |
| **Money** | `money:cash`, `money:bank` |
| **Item** | `item:<name>` (dynamic, checks inventory count) |
| **Job** | `job:<name>` (dynamic, checks if player has job) |
| **Memory** | Custom variables set during the flow |

- **Variable-to-variable comparison**: Use the `$` prefix to compare one variable against another (e.g., target value `$money:cash` compares against the resolved value).
- **Full operator support**: `==`, `!=`, `>`, `<`, `>=`, `<=` work with both strings and numbers.
- **Typed variable catalog**: The editor provides a browsable picker with descriptions for all available variables.

---

### 🎨 Editor UX Overhaul

The visual node editor has been significantly improved:

- **Grid background**: Subtle dot grid for visual alignment.
- **Categorized toolbar**: Nodes organized into Flow, Dialogue, Logic, Economy, and Effects categories.
- **Command palette**: Quick node search and creation (Ctrl+K).
- **Multi-selection**: Box/marquee selection on the canvas + Ctrl+click to toggle individual nodes.
- **Multi-drag/delete/duplicate**: Operate on multiple nodes simultaneously.
- **Auto-layout**: Hierarchical Sugiyama-like algorithm with cycle protection (Ctrl+L).
- **Fit-to-view**: Zoom and pan to fit all nodes on screen.
- **Duplicate node**: Clone any node with Ctrl+D.
- **Cursor-centered zoom**: Zoom focuses on mouse position.
- **Zoom indicator**: Shows current zoom percentage.
- **Node & connection counter**: Live count in the editor toolbar.
- **Keyboard hints**: Visual shortcut reference overlay.
- **Property edit history**: Undo/redo tracks property changes.

**Keyboard shortcuts:**
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Save |
| Ctrl+D | Duplicate selected |
| Ctrl+L | Auto-layout |
| Ctrl+K | Command palette |
| Delete | Delete selected |
| Escape | Deselect / Close palette |

---

### 🤖 NPC Improvements

- **Idle animation on START node**: Configure `animDict` and `animName` directly on the START node. The NPC will play this animation in a loop while waiting for player interaction.
- **Per-dialogue animation**: Each DIALOGUE node can override the NPC animation with a custom `animDict`/`animName`, returning to the default talk animation when not specified.
- **NPC speech/lipsync loop**: When `Config.EnableNpcSpeech = true`, the NPC plays ambient speech lines during dialogue for realistic lip movement. Uses a token-based cancellation system for clean cleanup.
- **NPC model change mid-conversation**: The NPC_CHANGE node allows switching the NPC model during a conversation for multi-character scenes.

---

### 🔌 Dialogue End Triggers (Community Contribution)

- New event `rc-interactions:dialogueEnded` fires when a dialogue ends (both naturally via END node or cancelled via ESC).
- Payload: `{ projectId: string, cancelled: boolean }`.
- Enables external scripts to react to dialogue completion (e.g., start a mission, update quest state).

*Contributed by @BlackDahlia313 (#2).*

---

### 🌐 Bridge Improvements

- **Inventory fallback chain (QBCore)**: `AddItem` and `RemoveItem` now try `ox_inventory` → `qb-inventory` → `Player.Functions.AddItem` with `pcall` protection at each step.
- **Complete ESX bridge**: `HasItem`, `GetMoney`, `AddItem`, `RemoveItem`, `AddMoney`, `RemoveMoney` fully implemented. `GetMoney` correctly distinguishes cash from bank accounts.
- **Complete standalone bridge**: All functions implemented as overridable stubs with warning messages.
- **`GetMoney` added to all bridges**: Money-based conditions (`money:cash`, `money:bank`) now work across all frameworks (previously always returned false).
- **`HasItem` added to ESX and Standalone**: Item-based conditions now work across all frameworks.

---

### 🧪 Test Coverage (New)

Three test harnesses provide comprehensive coverage:

| Layer | Framework | Tests | Command |
|-------|-----------|-------|---------|
| **Web (flowEngine)** | Vitest | 30 tests | `cd web && npx vitest run` |
| **Client (Lua)** | Custom | 7 suites (~40+ tests) | `/rctest all` (in-game) |
| **Server (Lua)** | Custom | 4 suites (~20+ tests) | `/rctest_sv all` (console) |

- **Web tests**: `findNextNode`, `evaluateCondition` (all operators), `traverseLogic` (complex flows, infinite loop protection, memory management).
- **Client tests**: Flow traversal, memory management, condition evaluation, bridge functions, NPC spawning, dialogue flow regression tests, public API.
- **Server tests**: Database CRUD, bridge functions, sync validation, permission checks.

Test commands are only registered when `Config.Debug = true`.

---

### 🔄 Version Check (New)

- Automatic update checking against GitHub Releases on resource start.
- Semantic version comparison with formatted release notes in the server console.
- Controlled via `Config.CheckForUpdates` (default: `true`).
- 3-second startup delay to avoid interfering with server boot.

---

### 🌍 Internationalization

- **~170 translation keys** in English and Spanish.
- All editor strings are now translatable (previously many were hardcoded in English).
- New keys cover: all 10 new node types, 5 node categories, 24 game variable labels and hints, animation fields, auto-layout, command palette, multi-selection, and more.

---

### 📡 Public API Enhancements

The `StartInteractionById` export now accepts an optional `customVars` table:

```lua
-- Inject custom variables into the interaction memory before starting
exports['rc-interactions']:StartInteractionById('project-uuid', {
    quest_stage = 'started',
    player_reputation = 50
})
```

These variables are available in CONDITION and SET_VARIABLE nodes during the flow.

---

### ⚙️ Configuration Changes

| Option | Description | Default | Status |
|--------|-------------|---------|--------|
| `Config.CheckForUpdates` | Enable automatic version checking against GitHub | `true` | **New** |
| `Config.EnableNpcSpeech` | Enable NPC ambient speech/lipsync during dialogue | `true` | **New** |

---

### 🐛 Bug Fixes

- **`HasItem` missing in ESX bridge**: Caused runtime crash on item conditions. Now fully implemented.
- **`HasItem` missing in Standalone bridge**: Now implemented as overridable stub.
- **`HasGroup` inconsistency**: Unified behavior across QBCore (ACE + job/gang), ESX (admin + job), Standalone (ACE).
- **`GetMoney` missing in all bridges**: Money conditions always returned false. Now implemented in all three bridges.
- **`SET_VARIABLE` not handled in runtime**: The flow silently stopped at SET_VARIABLE nodes. Now correctly processes and continues.
- **IDs generated with `Date.now()`**: Risk of collision on fast operations. Replaced with `crypto.randomUUID()` with fallback for FiveM's CEF browser.
- **No JSON validation on import**: Importing malformed JSON could break the editor. Now validates structure before importing.
- **Hardcoded i18n strings**: ~20+ strings were hardcoded in English. All now use the translation system.
- **GameSimulator navigation broken**: Choice selection used `choice.nextNodeId` (null in imported JSON). Now correctly resolves via `project.connections`.
- **QBCore `Player.Functions.AddItem` nil when using ox_inventory**: Added pcall fallback chain for inventory compatibility.
- **Replay protection blocking legitimate loops**: Binary processed-nodes tracking prevented revisiting economy nodes. Replaced with per-node cooldown (3 seconds) to allow flow loops.

---

### 📁 New Files

| File | Purpose |
|------|---------|
| `server/versioncheck.lua` | GitHub release version checking |
| `server/tests.lua` | Server-side test harness |
| `client/tests.lua` | Client-side test harness |
| `web/utils/flowEngine.ts` | Pure logic engine extracted for testing |
| `web/utils/gameVariables.ts` | Typed catalog of 24 game variables |
| `web/utils/uuid.ts` | UUID generation with CEF fallback |
| `web/__tests__/flowEngine.test.ts` | Vitest unit tests for flow engine |
| `CHANGELOG.md` | This file |

---

### ⬆️ Upgrade Notes

1. **Database**: No schema changes. The existing `rc_interactions` and `rc_interaction_groups` tables are compatible.
2. **Configuration**: Two new optional config options (`CheckForUpdates`, `EnableNpcSpeech`). Both default to `true`. No action required.
3. **Bridge**: If you have custom bridge overrides, the new functions (`AddItem`, `RemoveItem`, `AddMoney`, `RemoveMoney`, `GetMoney`) may need corresponding implementations.
4. **Web build**: If you're running from source, rebuild the NUI: `cd web && npm install && npm run build`.

---

## [1.0.1] — 2026-01-28

- Initial public release.
- 6 node types: START, DIALOGUE, CONDITION, SET_VARIABLE, EVENT, END.
- QBCore/ESX/Standalone bridge with auto-detection.
- Visual node editor with NUI.
- In-game runtime with target interaction, camera, and typewriter dialogue.
- MySQL persistence via oxmysql.
- English and Spanish translations.
- Export/import projects as JSON.
