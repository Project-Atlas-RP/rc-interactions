# RC-Interactions — Roadmap

> Last updated: February 20, 2026  
> Status: **Active Development** — v1.1.0 released

This document outlines the planned evolution of `rc-interactions`, organized by priority phases. Each phase contains specific tasks with status tracking.

---

## Table of Contents

- [Phase 1 — Critical Stability & Bug Fixes](#phase-1--critical-stability--bug-fixes)
- [Phase 2 — New Node Types](#phase-2--new-node-types)
- [Phase 3 — Editor UX Improvements](#phase-3--editor-ux-improvements)
- [Phase 4 — In-Game Runtime Enhancements](#phase-4--in-game-runtime-enhancements)
- [Phase 5 — Variables & State System](#phase-5--variables--state-system)
- [Phase 6 — Infrastructure & Quality](#phase-6--infrastructure--quality)
- [Phase 7 — UI/UX Visual Evolution](#phase-7--uiux-visual-evolution)
- [Implementation Timeline](#implementation-timeline)

---

## Phase 1 — Critical Stability & Bug Fixes

> **Priority:** 🔴 Immediate  
> **Goal:** Fix issues that cause runtime errors or broken functionality.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1.1 | **Missing `HasItem` in ESX bridge** | `Bridge.ESX.HasItem()` is called by the wrapper in `bridge/init.lua` but is never defined in `bridge/esx.lua`. Causes runtime crash when using CONDITION nodes with `item:` prefix. | ✅ Done |
| 1.2 | **Missing `HasItem` in Standalone bridge** | Same issue as ESX — `Bridge.Standalone.HasItem()` is not defined. The wrapper in `init.lua` falls back to `return true` for standalone, but the function should exist explicitly. | ✅ Done |
| 1.3 | **`HasGroup` inconsistency across bridges** | QBCore server uses ACE permissions (`HasPermission`), client compares `job.name`/`gang.name`. ESX only checks admin groups (`getGroup()`), not jobs. Standalone uses ACE. Behavior should be consistent. | ✅ Done |
| 1.4 | **`GetMoney` missing in all bridges** | `CheckCondition` in `client/runtime.lua` always returns `false` for `money:` conditions because no bridge implements a `GetMoney` function. Money-based conditions are completely non-functional. | ✅ Done |
| 1.5 | **IDs generated with `Date.now()`** | Project and node IDs use `Date.now().toString()` which risks collisions on fast operations. Should migrate to `crypto.randomUUID()` or a proper UUID library. | ✅ Done |
| 1.6 | **No JSON schema validation on import** | Importing a project from JSON performs no validation. A malformed JSON can silently break the editor or runtime. | ✅ Done |
| 1.7 | **Hardcoded strings outside i18n** | Labels like "NPC MODEL", "COORDS", "UNDO", "REDO", "RESET VIEW", "Waiting for event...", "DESTROY NODE" are hardcoded in English and not part of the `LanguageContext` translation system. | ✅ Done |
| 1.8 | **`SET_VARIABLE` not handled in runtime** | `ProcessNode` in `client/runtime.lua` did not handle `SET_VARIABLE` node type, causing the flow to silently stop. | ✅ Done |

---

## Phase 2 — New Node Types

> **Priority:** 🟡 High  
> **Goal:** Expand the flow engine with essential interaction building blocks.

Currently the system has 6 node types: `START`, `DIALOGUE`, `CONDITION`, `SET_VARIABLE`, `EVENT`, `END`.

| # | Node | Description | Ports | Status |
|---|------|-------------|-------|--------|
| 2.1 | **`GIVE_ITEM`** | Give item(s) to the player. `Bridge.AddItem` already exists but no node uses it. Config: item name, count. | 1 out (`main`) | ✅ Done |
| 2.2 | **`REMOVE_ITEM`** | Remove item(s) from the player. `Bridge.RemoveItem` already exists. Config: item name, count. | 1 out (`main`) | ✅ Done |
| 2.3 | **`GIVE_MONEY`** | Give money to the player. Config: money type (`cash`/`bank`), amount. Uses `Bridge.AddMoney`. | 1 out (`main`) | ✅ Done |
| 2.4 | **`REMOVE_MONEY`** | Remove money from the player. Config: money type, amount. Uses `Bridge.RemoveMoney`. | 1 out (`main`) | ✅ Done |
| 2.5 | **`ANIMATION`** | Play a specific animation on the NPC or player mid-conversation. Config: anim dict, anim name, target (npc/player), duration. Also: per-DIALOGUE-node animation fields (animDict/animName) for custom NPC reactions per response. | 1 out (`main`) | ✅ Done |
| 2.6 | **`WAIT`** | Timed pause before continuing to the next node. Config: duration in ms. Useful for dramatic pacing. | 1 out (`main`) | ✅ Done |
| 2.7 | **`RANDOM`** | Random branching with configurable percentages. Config: N outputs with weight values (e.g., 70%/30%). | N out (weighted) | ✅ Done |
| 2.8 | **`TELEPORT`** | Move the player to specific coordinates after a dialogue. Config: x, y, z, heading. | 1 out (`main`) | ✅ Done |
| 2.9 | **`NPC_CHANGE`** | Change the NPC model/animation mid-conversation (for multi-character scenes). Config: new model, optional animation. | 1 out (`main`) | ✅ Done |
| 2.10 | **`SOUND`** | Play a sound effect during dialogue. Config: sound name/file, volume. | 1 out (`main`) | ✅ Done |

### Implementation notes for new nodes

Each new node requires changes in **4 locations**:

1. **`web/types.ts`** — Add to `NodeType` enum.
2. **`web/components/NodeEditor.tsx`** — Add visual representation, color scheme, property sidebar fields, port configuration.
3. **`web/components/GameSimulator.tsx`** — Add handling in `traverseLogic()`.
4. **`client/runtime.lua`** — Add `elseif node.type == 'TYPE'` block in `ProcessNode()`.

---

## Phase 3 — Editor UX Improvements

> **Priority:** 🟢 Medium  
> **Goal:** Improve productivity and usability of the visual node editor.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 3.1 | **Keyboard shortcuts** | `Ctrl+Z`/`Ctrl+Y` (undo/redo), `Ctrl+S` (save), `Delete` (remove node), `Ctrl+D` (duplicate node), `Ctrl+L` (auto-layout), `Ctrl+K` (command palette). | ✅ Done |
| 3.2 | **Copy/Paste nodes** | Select one or multiple nodes and duplicate them with their internal connections preserved. | ⬜ Todo |
| 3.3 | **Multi-selection** | Ctrl+click toggle + drag-rectangle (marquee) to select multiple nodes for bulk move/delete/duplicate. | ✅ Done |
| 3.4 | **Snap-to-grid** | Optional grid alignment to keep the canvas organized. Toggle on/off. | ⬜ Todo |
| 3.5 | **Minimap** | Small overview of the full graph for navigation in large projects. | ⬜ Todo |
| 3.6 | **Visual validation** | Highlight disconnected nodes, detect multiple START nodes, detect infinite loops, warn about nodes with no output connections. | ⬜ Todo |
| 3.7 | **Auto-layout** | Hierarchical Sugiyama-lite algorithm with BFS layering, median heuristic crossing minimization, and cycle protection. Accessible via toolbar button or Ctrl+L. | ✅ Done |
| 3.8 | **Auto-save** | Automatically save every N seconds with a visual "unsaved changes" indicator (●) in the header. | ⬜ Todo |
| 3.9 | **Search in editor** | Search nodes by text content or NPC name within the canvas. Jump to matching node. | ⬜ Todo |
| 3.10 | **Comment nodes** | A "note" node type that doesn't affect the flow but allows documenting sections of the graph. | ⬜ Todo |

---

## Phase 4 — In-Game Runtime Enhancements

> **Priority:** 🔵 Medium  
> **Goal:** Improve the player's experience during interactions.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 4.1 | **Skip typewriter effect** | Allow the player to click or press a key to instantly reveal the full dialogue text instead of waiting for the typewriter animation. | ⬜ Todo |
| 4.2 | **Conversation history** | Scroll up to re-read previous messages in the active dialogue session. | ⬜ Todo |
| 4.3 | **NPC avatar/portrait** | Display a portrait or image of the NPC alongside the dialogue text. Configurable per START node. | ⬜ Todo |
| 4.4 | **Multiple camera angles** | Configurable camera angles per DIALOGUE node: close-up, lateral, over-the-shoulder, wide shot. | ⬜ Todo |
| 4.5 | **Player animations** | The player character should also play a "listening" or "talking" animation during the interaction. | ⬜ Todo |
| 4.6 | **Proximity fallback (no target)** | When `Config.UseTarget = false`, there is currently no fallback implemented. Implement TextUI/DrawText with distance detection loop. | ⬜ Todo |
| 4.7 | **Interaction cooldowns** | Server-side per-node cooldowns (3s) and global economy cooldown (1s) prevent exploitation. Active session tracking with automatic cleanup. | ✅ Done |
| 4.8 | **Per-player progress** | Store in the database which interactions each player has completed. Enable non-repeatable or branching flows based on prior completions. | ⬜ Todo |

---

## Phase 5 — Variables & State System

> **Priority:** 🟣 Medium-Low  
> **Goal:** Enable complex, stateful interaction flows.

Currently `SET_VARIABLE` and `CONDITION` only work with local ephemeral memory that resets when the interaction ends.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 5.1 | **Persistent player variables** | Variables that survive across sessions, stored in the database per player. Examples: `quest_progress`, `reputation`, `has_met_npc`. | ⬜ Todo |
| 5.2 | **Global server variables** | Variables shared across all players. Example: global event state, world flags. | ⬜ Todo |
| 5.3 | **Compound conditions (AND/OR)** | A CONDITION node that evaluates multiple conditions combined with AND/OR logic. | ⬜ Todo |
| 5.4 | **Rich inventory conditions** | Check exact item counts (not just existence). Integrate with `ox_inventory` and other popular inventory systems. | ⬜ Todo |
| 5.5 | **Time-based conditions** | Check in-game time of day, real-world day of week, etc. Example: NPC only available at night. | ⬜ Todo |

---

## Phase 6 — Infrastructure & Quality

> **Priority:** ⚪ Low (Long-term)  
> **Goal:** Improve maintainability, scalability, and developer experience.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 6.1 | **Project versioning** | Store version history in the database for each interaction. Allow rollback to previous versions. | ⬜ Todo |
| 6.2 | **Audit logs** | Record who created/modified each interaction and when. New DB table: `rc_interaction_logs`. | ⬜ Todo |
| 6.3 | **Dashboard pagination** | The project grid doesn't scale to hundreds of flows. Add pagination or virtual scrolling. | ⬜ Todo |
| 6.4 | **Advanced sorting & filters** | Sort by date, node count, author. Filter by group, status, date range. | ⬜ Todo |
| 6.5 | **Bulk export/import** | Export all projects in a group as a single package. Import multiple projects at once. | ⬜ Todo |
| 6.6 | **Automated tests** | Unit tests for the logic engine (both Lua and TypeScript `traverseLogic`). | ✅ Done |
| 6.7 | **Additional languages** | Add French, German, Portuguese translations. Auto-detect browser language. Persist language preference. | ⬜ Todo |
| 6.8 | **Documentation with examples** | Guide with real use cases: NPC shops, quest lines, branching missions, tutorial NPCs. | ⬜ Todo |
| 6.9 | **Expanded public API** | New exports: query variable state, list active interactions, force end dialogue, get interaction metadata. | ⬜ Todo |
| 6.10 | **Rename groups** | Currently groups can only be created and deleted, not renamed. Add rename functionality. | ⬜ Todo |

---

## Phase 7 — UI/UX Visual Evolution

> **Priority:** ⚪ Low  
> **Goal:** Polish the visual design and improve accessibility.

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 7.1 | **Color themes** | Light/dark mode toggle, or customizable color themes for the editor. | ⬜ Todo |
| 7.2 | **Local background images** | The simulator depends on an external Unsplash URL. Use a local/configurable image that works offline. | ⬜ Todo |
| 7.3 | **Improved responsiveness** | The editor is optimized for wide screens. Adapt layouts for lower resolutions and smaller monitors. | ⬜ Todo |
| 7.4 | **Node hover tooltips** | Preview node content on hover without selecting it. Show text preview, variable name, etc. | ⬜ Todo |
| 7.5 | **Connection animations** | Visual feedback when creating/deleting connections. Animated flow along connection lines. | ⬜ Todo |

---

## Implementation Timeline

| Period | Focus | Phases | Status |
|--------|-------|--------|--------|
| **Weeks 1–2** | Critical bug fixes | Phase 1 (HasItem, GetMoney, HasGroup, UUIDs, i18n) | ✅ Complete |
| **Weeks 3–4** | Core missing features | Phase 4.7 (cooldowns) + Phase 3.1, 3.3, 3.7 (shortcuts, multi-select, auto-layout) | ✅ Complete |
| **Weeks 5–8** | New node types | Phase 2 (all 10 nodes) | ✅ Complete |
| **Weeks 9–10** | Editor power features | Phase 3 remaining (copy/paste, validation, minimap) | ⬜ Pending |
| **Weeks 11–14** | Runtime polish | Phase 4 remaining (skip typewriter, history, avatar, cameras) | ⬜ Pending |
| **Weeks 15–18** | Advanced state | Phase 5 (persistent variables, compound conditions) | ⬜ Pending |
| **Month 5+** | Long-term quality | Phase 6 & 7 (infrastructure, documentation, themes) | ⬜ Pending |

---

## Architecture Notes

### Adding a new node type — Checklist

When implementing any node from Phase 2, these files must be modified:

1. **`web/types.ts`** — Add the new value to the `NodeType` enum.
2. **`web/components/NodeEditor.tsx`** — Add:
   - Color scheme in the node type → color mapping.
   - Visual content rendering inside the node.
   - Property sidebar fields (inputs for configuration).
   - Port configuration (output ports).
   - Toolbar button to create the node.
3. **`web/components/GameSimulator.tsx`** — Add handling in `traverseLogic()` function.
4. **`client/runtime.lua`** — Add `elseif node.type == 'NEW_TYPE'` block in `ProcessNode()`.
5. **`web/contexts/LanguageContext.tsx`** — Add translation keys for both `en` and `es`.

### Bridge function coverage

| Function | QBCore | ESX | Standalone |
|----------|--------|-----|------------|
| `HasItem` | ✅ | ✅ Client + Server | ✅ Stub (override) |
| `HasGroup` (client) | ✅ Job/Gang | ✅ Job | ✅ ACE |
| `HasGroup` (server) | ✅ ACE-based | ✅ Admin + Job | ✅ ACE-based |
| `Notify` (server) | ✅ | ✅ | ✅ Fallback |
| `GetMoney` | ✅ Client + Server | ✅ Client + Server | ✅ Stub (override) |
| `GetJob` / `GetGang` | ❌ Not implemented | ❌ Not implemented | ❌ Not implemented |
| `AddItem` / `RemoveItem` | ✅ ox→qb-inv→legacy | ✅ | ✅ Stubs |
| `AddMoney` / `RemoveMoney` | ✅ | ✅ (cash/bank only) | ✅ Stubs |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Todo — Not started |
| 🔄 | In Progress |
| ✅ | Done |
| ❌ | Blocked / Won't do |
