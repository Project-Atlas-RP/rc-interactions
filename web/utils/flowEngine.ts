/**
 * RC-Interactions — Flow Engine (Pure Logic)
 *
 * This module contains the traversal / evaluation logic extracted from
 * GameSimulator.tsx so it can be unit-tested without React.
 */

import { DialogueNode, Connection, NodeType } from '../types';

export type GameMemory = Record<string, string | number | boolean>;

export interface FlowGraph {
  nodes: DialogueNode[];
  connections: Connection[];
}

/**
 * Find the next node connected from `fromNodeId` via `fromPort`.
 * Returns the target node or null.
 */
export function findNextNode(
  graph: FlowGraph,
  fromNodeId: string,
  fromPort?: string,
): DialogueNode | null {
  const conn = graph.connections.find(
    (c) =>
      c.fromNodeId === fromNodeId &&
      (fromPort ? c.fromPort === fromPort : true),
  );
  if (!conn) return null;
  return graph.nodes.find((n) => n.id === conn.toNodeId) ?? null;
}

/**
 * Evaluate a CONDITION node against the current memory.
 * Returns true/false.
 */
export function evaluateCondition(
  variableName: string | undefined,
  operator: string | undefined,
  targetValue: string | undefined,
  memory: GameMemory,
): boolean {
  const valA = memory[variableName || '']?.toString() || '';
  const valB = targetValue || '';
  const op = operator || '==';

  const numA = parseFloat(valA);
  const numB = parseFloat(valB);
  const isNumeric = !isNaN(numA) && !isNaN(numB);

  switch (op) {
    case '==':
      return valA === valB;
    case '!=':
      return valA !== valB;
    case '>':
      return isNumeric ? numA > numB : false;
    case '<':
      return isNumeric ? numA < numB : false;
    case '>=':
      return isNumeric ? numA >= numB : false;
    case '<=':
      return isNumeric ? numA <= numB : false;
    default:
      return false;
  }
}

/**
 * Traverse the graph starting from `startNodeId`, executing logic nodes
 * (SET_VARIABLE, CONDITION, START, EVENT) immediately and stopping at
 * DIALOGUE or END nodes.
 *
 * Returns the id of the DIALOGUE/END node reached, or null if the flow
 * is broken (missing connection, missing node, infinite loop).
 *
 * Side-effect: mutates `memory` for SET_VARIABLE nodes.
 */
export function traverseLogic(
  graph: FlowGraph,
  startNodeId: string,
  memory: GameMemory,
  maxIterations: number = 100,
): string | null {
  let currentId: string | null = startNodeId;
  let safety = 0;

  while (currentId && safety < maxIterations) {
    safety++;
    const node = graph.nodes.find((n) => n.id === currentId);
    if (!node) return null;

    // Terminal nodes — stop and return
    if (node.type === NodeType.DIALOGUE || node.type === NodeType.END) {
      return node.id;
    }

    // SET_VARIABLE — store and continue
    if (node.type === NodeType.SET_VARIABLE) {
      if (node.data.variableName) {
        memory[node.data.variableName] = node.data.variableValue || '';
      }
      const next = findNextNode(graph, node.id);
      currentId = next?.id ?? null;
      continue;
    }

    // CONDITION — evaluate and branch
    if (node.type === NodeType.CONDITION) {
      const result = evaluateCondition(
        node.data.variableName,
        node.data.conditionOperator,
        node.data.variableValue,
        memory,
      );
      const port = result ? 'true' : 'false';
      const next = findNextNode(graph, node.id, port);
      currentId = next?.id ?? null;
      continue;
    }

    // START, EVENT — pass through
    if (
      node.type === NodeType.START ||
      node.type === NodeType.EVENT
    ) {
      const next = findNextNode(graph, node.id);
      currentId = next?.id ?? null;
      continue;
    }

    // Phase 2 pass-through nodes: GIVE_ITEM, REMOVE_ITEM, GIVE_MONEY, REMOVE_MONEY,
    // ANIMATION, WAIT, TELEPORT, NPC_CHANGE, SOUND
    if (
      node.type === NodeType.GIVE_ITEM ||
      node.type === NodeType.REMOVE_ITEM ||
      node.type === NodeType.GIVE_MONEY ||
      node.type === NodeType.REMOVE_MONEY ||
      node.type === NodeType.ANIMATION ||
      node.type === NodeType.WAIT ||
      node.type === NodeType.TELEPORT ||
      node.type === NodeType.NPC_CHANGE ||
      node.type === NodeType.SOUND
    ) {
      const next = findNextNode(graph, node.id);
      currentId = next?.id ?? null;
      continue;
    }

    // RANDOM — weighted random branch
    if (node.type === NodeType.RANDOM) {
      const outputs = node.data.randomOutputs || [];
      if (outputs.length === 0) return null;
      const totalWeight = outputs.reduce((sum, o) => sum + (o.weight || 0), 0);
      if (totalWeight <= 0) return null;
      let roll = Math.random() * totalWeight;
      let selectedId = outputs[0].id;
      for (const output of outputs) {
        roll -= (output.weight || 0);
        if (roll <= 0) { selectedId = output.id; break; }
      }
      const next = findNextNode(graph, node.id, selectedId);
      currentId = next?.id ?? null;
      continue;
    }

    // Unknown type
    return null;
  }

  // Max iterations reached (infinite loop protection)
  return null;
}
