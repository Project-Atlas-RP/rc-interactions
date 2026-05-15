/**
 * Game Variable Catalog
 * =====================
 * Defines all variables available for CONDITION and SET_VARIABLE nodes.
 *
 * Variable naming convention:
 *   - `<category>:<name>`  — resolved at runtime by the Lua client
 *   - Plain string         — resolved from InteractionMemory (SET_VARIABLE)
 *
 * Categories understood by the Lua runtime:
 *   item:<itemName>     → Bridge.HasItem / item count
 *   money:<type>        → Bridge.GetMoney (cash | bank)
 *   job:<jobName>       → Bridge.HasGroup (true/false)
 *   player:<property>   → Native/framework getter (number | string | bool→"1"/"0")
 */

export interface GameVariable {
  /** The variable key used in node data, e.g. "money:cash" or "player:health" */
  value: string;
  /** i18n key for the label shown in the editor */
  labelKey: string;
  /** Category key (for grouping in the picker) */
  category: 'memory' | 'item' | 'money' | 'job' | 'player';
  /** The value type returned at runtime — helps the editor show correct operators */
  valueType: 'number' | 'string' | 'boolean';
  /** If true the user must append a dynamic suffix (item name, job name, etc.) */
  requiresSuffix?: boolean;
  /** Placeholder shown for the suffix input */
  suffixPlaceholder?: string;
  /** Hint/description i18n key */
  hintKey?: string;
}

// ── Pre-built game variables ──
// These are always available regardless of framework.

export const GAME_VARIABLES: GameVariable[] = [
  // ─── Memory (SET_VARIABLE) ───
  {
    value: '',
    labelKey: 'editor.var.custom',
    category: 'memory',
    valueType: 'string',
    requiresSuffix: true,
    suffixPlaceholder: 'my_variable',
    hintKey: 'editor.var.custom_hint',
  },

  // ─── Items ───
  {
    value: 'item:',
    labelKey: 'editor.var.has_item',
    category: 'item',
    valueType: 'number',
    requiresSuffix: true,
    suffixPlaceholder: 'bread',
    hintKey: 'editor.var.has_item_hint',
  },

  // ─── Money ───
  {
    value: 'money:cash',
    labelKey: 'editor.var.money_cash',
    category: 'money',
    valueType: 'number',
    hintKey: 'editor.var.money_cash_hint',
  },
  {
    value: 'money:bank',
    labelKey: 'editor.var.money_bank',
    category: 'money',
    valueType: 'number',
    hintKey: 'editor.var.money_bank_hint',
  },

  // ─── Job / Group ───
  {
    value: 'job:',
    labelKey: 'editor.var.has_job',
    category: 'job',
    valueType: 'boolean',
    requiresSuffix: true,
    suffixPlaceholder: 'police',
    hintKey: 'editor.var.has_job_hint',
  },

  // ─── Player properties (GTA natives) ───
  {
    value: 'player:health',
    labelKey: 'editor.var.player_health',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_health_hint',
  },
  {
    value: 'player:armor',
    labelKey: 'editor.var.player_armor',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_armor_hint',
  },
  {
    value: 'player:stamina',
    labelKey: 'editor.var.player_stamina',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_stamina_hint',
  },
  {
    value: 'player:is_dead',
    labelKey: 'editor.var.player_is_dead',
    category: 'player',
    valueType: 'boolean',
    hintKey: 'editor.var.player_is_dead_hint',
  },
  {
    value: 'player:is_wanted',
    labelKey: 'editor.var.player_is_wanted',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_is_wanted_hint',
  },
  {
    value: 'player:in_vehicle',
    labelKey: 'editor.var.player_in_vehicle',
    category: 'player',
    valueType: 'boolean',
    hintKey: 'editor.var.player_in_vehicle_hint',
  },
  {
    value: 'player:speed',
    labelKey: 'editor.var.player_speed',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_speed_hint',
  },
  {
    value: 'player:weapon',
    labelKey: 'editor.var.player_weapon',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_weapon_hint',
  },
  {
    value: 'player:is_swimming',
    labelKey: 'editor.var.player_is_swimming',
    category: 'player',
    valueType: 'boolean',
    hintKey: 'editor.var.player_is_swimming_hint',
  },
  {
    value: 'player:is_falling',
    labelKey: 'editor.var.player_is_falling',
    category: 'player',
    valueType: 'boolean',
    hintKey: 'editor.var.player_is_falling_hint',
  },
  {
    value: 'player:is_running',
    labelKey: 'editor.var.player_is_running',
    category: 'player',
    valueType: 'boolean',
    hintKey: 'editor.var.player_is_running_hint',
  },

  // ─── Player properties (framework-dependent, QBCore/ESX) ───
  {
    value: 'player:name',
    labelKey: 'editor.var.player_name',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_name_hint',
  },
  {
    value: 'player:job_name',
    labelKey: 'editor.var.player_job_name',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_job_name_hint',
  },
  {
    value: 'player:job_grade',
    labelKey: 'editor.var.player_job_grade',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_job_grade_hint',
  },
  {
    value: 'player:gang_name',
    labelKey: 'editor.var.player_gang_name',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_gang_name_hint',
  },
  {
    value: 'player:citizenid',
    labelKey: 'editor.var.player_citizenid',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_citizenid_hint',
  },
  {
    value: 'player:gender',
    labelKey: 'editor.var.player_gender',
    category: 'player',
    valueType: 'number',
    hintKey: 'editor.var.player_gender_hint',
  },
  {
    value: 'player:phone_number',
    labelKey: 'editor.var.player_phone_number',
    category: 'player',
    valueType: 'string',
    hintKey: 'editor.var.player_phone_number_hint',
  },
];

/** Group variables by category for the UI */
export const VARIABLE_CATEGORIES = ['memory', 'item', 'money', 'job', 'player'] as const;
export type VariableCategory = typeof VARIABLE_CATEGORIES[number];

export function getVariablesByCategory(category: VariableCategory): GameVariable[] {
  return GAME_VARIABLES.filter(v => v.category === category);
}

/**
 * Given a current variableName like "item:bread" or "player:health",
 * find the matching catalog entry and extract the suffix if applicable.
 */
export function parseVariableName(variableName: string): { variable: GameVariable | null; suffix: string } {
  // Exact match first (e.g. "player:health", "money:cash")
  const exact = GAME_VARIABLES.find(v => v.value === variableName && !v.requiresSuffix);
  if (exact) return { variable: exact, suffix: '' };

  // Prefix match for suffix-based variables (e.g. "item:", "job:")
  for (const v of GAME_VARIABLES) {
    if (v.requiresSuffix && v.value !== '' && variableName.startsWith(v.value)) {
      return { variable: v, suffix: variableName.slice(v.value.length) };
    }
  }

  // Plain memory variable (custom)
  const custom = GAME_VARIABLES.find(v => v.category === 'memory' && v.requiresSuffix);
  return { variable: custom || null, suffix: variableName };
}
