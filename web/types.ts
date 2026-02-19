
export enum NodeType {
  START = 'START',
  DIALOGUE = 'DIALOGUE',
  CONDITION = 'CONDITION',
  SET_VARIABLE = 'SET_VARIABLE',
  EVENT = 'EVENT',
  END = 'END',
  GIVE_ITEM = 'GIVE_ITEM',
  REMOVE_ITEM = 'REMOVE_ITEM',
  GIVE_MONEY = 'GIVE_MONEY',
  REMOVE_MONEY = 'REMOVE_MONEY',
  ANIMATION = 'ANIMATION',
  WAIT = 'WAIT',
  RANDOM = 'RANDOM',
  TELEPORT = 'TELEPORT',
  NPC_CHANGE = 'NPC_CHANGE',
  SOUND = 'SOUND'
}

export interface Choice {
  id: string;
  text: string;
  nextNodeId: string | null;
}

export interface RandomOutput {
  id: string;
  weight: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorldCoords {
  x: number;
  y: number;
  z: number;
  w?: number;
}

export interface DialogueNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: {
    // World Spawn Data (for START)
    coords?: WorldCoords;
    model?: string;

    // Dialogue Data
    npcName?: string;
    text?: string;
    choices?: Choice[];

    // Per-dialogue animation (user suggestion: custom anim per dialogue node)
    animDict?: string;
    animName?: string;
    
    // Logic Data
    variableName?: string;
    conditionOperator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
    variableValue?: string; // stored as string, parsed at runtime
    
    // Event Data
    eventName?: string;
    eventPayload?: string;

    // GIVE_ITEM / REMOVE_ITEM
    itemName?: string;
    itemCount?: number;

    // GIVE_MONEY / REMOVE_MONEY
    moneyType?: 'cash' | 'bank';
    moneyAmount?: number;

    // ANIMATION node
    animTarget?: 'npc' | 'player';
    animDuration?: number;

    // WAIT node
    waitDuration?: number;

    // RANDOM node
    randomOutputs?: RandomOutput[];

    // TELEPORT node
    teleportCoords?: WorldCoords;

    // NPC_CHANGE node
    newModel?: string;
    newAnimDict?: string;
    newAnimName?: string;

    // SOUND node
    soundName?: string;
    soundVolume?: number;
  };
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPort: string; // 'main', 'true', 'false', or choiceId
  toNodeId: string;
}

export interface ProjectData {
  nodes: DialogueNode[];
  connections: Connection[];
}

export interface Project {
  id: string;
  name: string;
  group: string; // Added group for categorization
  createdAt: string;
  updatedAt: string;
  data: ProjectData;
}
