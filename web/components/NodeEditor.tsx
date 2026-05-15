
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ProjectData, DialogueNode, Connection, NodeType, WorldCoords, RandomOutput } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchNui } from '../utils/fetchNui';
import { generateUUID } from '../utils/uuid';
import { GAME_VARIABLES, VARIABLE_CATEGORIES, parseVariableName, type GameVariable, type VariableCategory } from '../utils/gameVariables';

interface NodeEditorProps {
  project: ProjectData;
  setProject: React.Dispatch<React.SetStateAction<ProjectData>>;
}

interface ActiveConnection {
  fromNodeId: string;
  fromPort: string;
  mouseX: number;
  mouseY: number;
}

// ── Node category grouping for toolbar & palette ──
const NODE_CATEGORIES = [
  { key: 'flow', types: [NodeType.START, NodeType.END] },
  { key: 'dialogue', types: [NodeType.DIALOGUE] },
  { key: 'logic', types: [NodeType.CONDITION, NodeType.SET_VARIABLE, NodeType.RANDOM] },
  { key: 'economy', types: [NodeType.GIVE_ITEM, NodeType.REMOVE_ITEM, NodeType.GIVE_MONEY, NodeType.REMOVE_MONEY] },
  { key: 'effects', types: [NodeType.EVENT, NodeType.ANIMATION, NodeType.WAIT, NodeType.SOUND, NodeType.TELEPORT, NodeType.NPC_CHANGE] },
];

// ── Shared node icon renderer ──
const getNodeIcon = (type: NodeType, size = 14) => {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case NodeType.START: return <svg {...p}><polygon points="5 3 19 12 5 21 5 3"/></svg>;
    case NodeType.DIALOGUE: return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case NodeType.CONDITION: return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>;
    case NodeType.SET_VARIABLE: return <svg {...p}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
    case NodeType.EVENT: return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case NodeType.END: return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
    case NodeType.GIVE_ITEM: return <svg {...p}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case NodeType.REMOVE_ITEM: return <svg {...p}><path d="M5 12h14"/></svg>;
    case NodeType.GIVE_MONEY: return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case NodeType.REMOVE_MONEY: return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><line x1="4" y1="4" x2="20" y2="20"/></svg>;
    case NodeType.ANIMATION: return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
    case NodeType.WAIT: return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case NodeType.RANDOM: return <svg {...p}><path d="M18 4l3 3-3 3"/><path d="M18 20l3-3-3-3"/><path d="M3 7h3a5 5 0 0 1 5 5 5 5 0 0 0 5 5h5"/><path d="M21 7h-5a5 5 0 0 0-5 5 5 5 0 0 1-5 5H3"/></svg>;
    case NodeType.TELEPORT: return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case NodeType.NPC_CHANGE: return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3l2 2-2 2"/></svg>;
    case NodeType.SOUND: return <svg {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
    default: return null;
  }
};

const getNodeIconColor = (type: NodeType): string => {
  switch (type) {
    case NodeType.START: return 'text-emerald-500';
    case NodeType.DIALOGUE: return 'text-zinc-300';
    case NodeType.CONDITION: return 'text-amber-500';
    case NodeType.SET_VARIABLE: return 'text-sky-500';
    case NodeType.EVENT: return 'text-purple-500';
    case NodeType.END: return 'text-rose-500';
    case NodeType.GIVE_ITEM: return 'text-lime-500';
    case NodeType.REMOVE_ITEM: return 'text-orange-500';
    case NodeType.GIVE_MONEY: return 'text-green-500';
    case NodeType.REMOVE_MONEY: return 'text-red-500';
    case NodeType.ANIMATION: return 'text-pink-500';
    case NodeType.WAIT: return 'text-cyan-500';
    case NodeType.RANDOM: return 'text-yellow-500';
    case NodeType.TELEPORT: return 'text-indigo-500';
    case NodeType.NPC_CHANGE: return 'text-teal-500';
    case NodeType.SOUND: return 'text-fuchsia-500';
    default: return 'text-zinc-500';
  }
};

const getNodeColor = (type: NodeType) => {
  switch (type) {
    case NodeType.START: return 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10';
    case NodeType.END: return 'text-rose-400 border-rose-500/20 bg-rose-900/10';
    case NodeType.CONDITION: return 'text-amber-400 border-amber-500/20 bg-amber-900/10';
    case NodeType.SET_VARIABLE: return 'text-sky-400 border-sky-500/20 bg-sky-900/10';
    case NodeType.EVENT: return 'text-purple-400 border-purple-500/20 bg-purple-900/10';
    case NodeType.GIVE_ITEM: return 'text-lime-400 border-lime-500/20 bg-lime-900/10';
    case NodeType.REMOVE_ITEM: return 'text-orange-400 border-orange-500/20 bg-orange-900/10';
    case NodeType.GIVE_MONEY: return 'text-green-400 border-green-500/20 bg-green-900/10';
    case NodeType.REMOVE_MONEY: return 'text-red-400 border-red-500/20 bg-red-900/10';
    case NodeType.ANIMATION: return 'text-pink-400 border-pink-500/20 bg-pink-900/10';
    case NodeType.WAIT: return 'text-cyan-400 border-cyan-500/20 bg-cyan-900/10';
    case NodeType.RANDOM: return 'text-yellow-400 border-yellow-500/20 bg-yellow-900/10';
    case NodeType.TELEPORT: return 'text-indigo-400 border-indigo-500/20 bg-indigo-900/10';
    case NodeType.NPC_CHANGE: return 'text-teal-400 border-teal-500/20 bg-teal-900/10';
    case NodeType.SOUND: return 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-900/10';
    default: return 'text-zinc-500 border-zinc-800 bg-zinc-900/50';
  }
};

const GRID_SMALL = 20;
const GRID_LARGE = 100;

// ═══════════════════════════════════════════════
// ──  NodeEditor Component  ────────────────────
// ═══════════════════════════════════════════════
const NodeEditor: React.FC<NodeEditorProps> = ({ project, setProject }) => {
  const { t } = useLanguage();

  // ── Node label helper (translated) ──
  const NODE_LABEL_KEYS: Record<string, string> = {
    [NodeType.START]: 'editor.node.start',
    [NodeType.END]: 'editor.node.end',
    [NodeType.DIALOGUE]: 'editor.node.dialogue',
    [NodeType.CONDITION]: 'editor.node.condition',
    [NodeType.SET_VARIABLE]: 'editor.node.set_variable',
    [NodeType.EVENT]: 'editor.node.event',
    [NodeType.GIVE_ITEM]: 'editor.node.give_item',
    [NodeType.REMOVE_ITEM]: 'editor.node.remove_item',
    [NodeType.GIVE_MONEY]: 'editor.node.give_money',
    [NodeType.REMOVE_MONEY]: 'editor.node.remove_money',
    [NodeType.ANIMATION]: 'editor.node.animation',
    [NodeType.WAIT]: 'editor.node.wait',
    [NodeType.RANDOM]: 'editor.node.random',
    [NodeType.TELEPORT]: 'editor.node.teleport',
    [NodeType.NPC_CHANGE]: 'editor.node.npc_change',
    [NodeType.SOUND]: 'editor.node.sound',
  };
  const getNodeLabel = (type: NodeType): string => t(NODE_LABEL_KEYS[type] || type);

  // ── State ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeConn, setActiveConn] = useState<ActiveConnection | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  // Marquee (box) selection
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const marqueeStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  // History
  const [history, setHistory] = useState<ProjectData[]>([]);
  const [future, setFuture] = useState<ProjectData[]>([]);
  const dragStartProjectState = useRef<ProjectData | null>(null);
  const lastPropertySnapshot = useRef<ProjectData | null>(null);
  const propertyEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // ── History helpers ──
  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, project]);
    setFuture([]);
  }, [project]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture(f => [project, ...f]);
      setProject(previous);
      return prev.slice(0, -1);
    });
  }, [project, setProject]);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setHistory(h => [...h, project]);
      setProject(next);
      return prev.slice(1);
    });
  }, [project, setProject]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Space → pan mode
      if (e.code === 'Space' && !isInput) { e.preventDefault(); setSpaceHeld(true); }

      // Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      // Ctrl+Y / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // Delete / Backspace selected node(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedNodeIds.size > 0) { e.preventDefault(); deleteSelectedNodes(); return; }
        if (selectedNodeId) { e.preventDefault(); deleteNode(selectedNodeId); return; }
      }

      // Ctrl+D duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isInput) { e.preventDefault(); duplicateSelected(); return; }

      // Ctrl+L → auto-layout
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && !isInput) { e.preventDefault(); autoLayout(); return; }

      // Tab or Ctrl+K → palette
      if (e.key === 'Tab' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault();
        setShowPalette(p => !p);
        setPaletteSearch('');
        return;
      }

      // Escape → close overlays
      if (e.key === 'Escape') {
        if (showPalette) { setShowPalette(false); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (selectedNodeIds.size > 0) { setSelectedNodeIds(new Set()); return; }
        if (selectedNodeId) { setSelectedNodeId(null); return; }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [selectedNodeId, selectedNodeIds, showPalette, contextMenu, undo, redo]);

  // Auto-focus palette input
  useEffect(() => { if (showPalette && paletteInputRef.current) paletteInputRef.current.focus(); }, [showPalette]);

  // ── Coordinate helpers ──
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  // ── Port positioning ──
  const getNodePortPosition = (nodeId: string, portId: string, type: 'input' | 'output') => {
    const node = project.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const width = 280;

    if (type === 'input') return { x: node.position.x, y: node.position.y + 20 };

    // single-output nodes
    if ([NodeType.START, NodeType.SET_VARIABLE, NodeType.EVENT, NodeType.END,
         NodeType.GIVE_ITEM, NodeType.REMOVE_ITEM, NodeType.GIVE_MONEY, NodeType.REMOVE_MONEY,
         NodeType.ANIMATION, NodeType.WAIT, NodeType.TELEPORT, NodeType.NPC_CHANGE, NodeType.SOUND
    ].includes(node.type)) {
      return { x: node.position.x + width, y: node.position.y + 20 };
    }

    if (node.type === NodeType.RANDOM) {
      const idx = node.data.randomOutputs?.findIndex(o => o.id === portId) ?? -1;
      if (idx >= 0) return { x: node.position.x + width, y: node.position.y + 80 + idx * 44 + 18 };
      return { x: node.position.x + width, y: node.position.y + 20 };
    }

    if (node.type === NodeType.CONDITION) {
      if (portId === 'true') return { x: node.position.x + width, y: node.position.y + 120 };
      if (portId === 'false') return { x: node.position.x + width, y: node.position.y + 164 };
      return { x: node.position.x + width, y: node.position.y + 20 };
    }

    if (node.type === NodeType.DIALOGUE) {
      const idx = node.data.choices?.findIndex(c => c.id === portId) ?? -1;
      if (idx >= 0) return { x: node.position.x + width, y: node.position.y + 136 + idx * 44 + 18 };
      return { x: node.position.x + width, y: node.position.y + 20 };
    }

    return { x: node.position.x + width, y: node.position.y + 20 };
  };

  // ═══════════════════════════════════════════
  // ──  Mouse handlers (FIXED)  ──────────────
  // ═══════════════════════════════════════════

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse or Space+Left → PAN
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      setIsPanning(true);
      e.preventDefault();
      return;
    }
    // Left click on empty canvas → start marquee selection
    if (e.button === 0) {
      if (selectedNodeId) setSelectedNodeId(null);
      if (contextMenu) setContextMenu(null);
      // Begin marquee
      marqueeStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (!e.shiftKey) setSelectedNodeIds(new Set());
    }
  };

  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button === 0) {
      // Ctrl/Meta+click → toggle individual node in multi-select
      if (e.ctrlKey || e.metaKey) {
        setSelectedNodeIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
        return;
      }
      // If clicking on a node already in multi-selection → drag the group
      if (selectedNodeIds.has(id)) {
        setDragNodeId(id);
        dragStartProjectState.current = project;
        return;
      }
      // Normal click → single-select, clear multi-select
      setSelectedNodeIds(new Set());
      setSelectedNodeId(id);
      setDragNodeId(id);
      dragStartProjectState.current = project;
    }
  };

  const handlePortMouseDown = (id: string, port: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = toCanvasCoords(e.clientX, e.clientY);
    setActiveConn({ fromNodeId: id, fromPort: port, mouseX: pos.x, mouseY: pos.y });
  };

  const handlePortMouseUp = (targetNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeConn) return;
    if (activeConn.fromNodeId === targetNodeId) { setActiveConn(null); return; }

    const filteredConnections = project.connections.filter(
      c => !(c.fromNodeId === activeConn.fromNodeId && c.fromPort === activeConn.fromPort)
    );
    const newConn: Connection = {
      id: `conn-${generateUUID()}`,
      fromNodeId: activeConn.fromNodeId,
      fromPort: activeConn.fromPort,
      toNodeId: targetNodeId,
    };
    const updatedNodes = project.nodes.map(node => {
      if (node.id === activeConn.fromNodeId && node.type === NodeType.DIALOGUE) {
        const updatedChoices = node.data.choices?.map(choice =>
          choice.id === activeConn.fromPort ? { ...choice, nextNodeId: targetNodeId } : choice
        );
        return { ...node, data: { ...node.data, choices: updatedChoices } };
      }
      return node;
    });

    saveToHistory();
    setProject({ nodes: updatedNodes, connections: [...filteredConnections, newConn] });
    setActiveConn(null);
  };

  const handleMouseUp = () => {
    // Finalize multi-node drag history
    if (dragNodeId && selectedNodeIds.has(dragNodeId) && dragStartProjectState.current) {
      const startNodes = dragStartProjectState.current.nodes;
      const changed = selectedNodeIds.size > 0 && [...selectedNodeIds].some(nid => {
        const sn = startNodes.find(n => n.id === nid);
        const cn = project.nodes.find(n => n.id === nid);
        return sn && cn && (sn.position.x !== cn.position.x || sn.position.y !== cn.position.y);
      });
      if (changed) { setHistory(prev => [...prev, dragStartProjectState.current!]); setFuture([]); }
    }
    // Finalize single-node drag history
    else if (dragNodeId && dragStartProjectState.current) {
      const startN = dragStartProjectState.current.nodes.find(n => n.id === dragNodeId);
      const curN = project.nodes.find(n => n.id === dragNodeId);
      if (startN && curN && (startN.position.x !== curN.position.x || startN.position.y !== curN.position.y)) {
        setHistory(prev => [...prev, dragStartProjectState.current!]);
        setFuture([]);
      }
    }
    // End marquee selection
    if (marquee) setMarquee(null);
    marqueeStartRef.current = null;

    setIsPanning(false);
    setDragNodeId(null);
    setActiveConn(null);
    dragStartProjectState.current = null;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
      return;
    }
    // Multi-node or single-node drag
    if (dragNodeId) {
      const dx = e.movementX / transform.scale;
      const dy = e.movementY / transform.scale;
      // If dragging a node that's part of multi-select → move all selected
      if (selectedNodeIds.has(dragNodeId)) {
        setProject(prev => ({
          ...prev,
          nodes: prev.nodes.map(node =>
            selectedNodeIds.has(node.id)
              ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
              : node
          ),
        }));
      } else {
        setProject(prev => ({
          ...prev,
          nodes: prev.nodes.map(node =>
            node.id === dragNodeId
              ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
              : node
          ),
        }));
      }
      return;
    }
    // Marquee box selection
    if (marqueeStartRef.current && !activeConn) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startCanvas = {
        x: (marqueeStartRef.current.clientX - rect.left - transform.x) / transform.scale,
        y: (marqueeStartRef.current.clientY - rect.top - transform.y) / transform.scale,
      };
      const endCanvas = {
        x: (e.clientX - rect.left - transform.x) / transform.scale,
        y: (e.clientY - rect.top - transform.y) / transform.scale,
      };
      setMarquee({ startX: startCanvas.x, startY: startCanvas.y, endX: endCanvas.x, endY: endCanvas.y });
      // Determine which nodes overlap the marquee
      const minX = Math.min(startCanvas.x, endCanvas.x);
      const minY = Math.min(startCanvas.y, endCanvas.y);
      const maxX = Math.max(startCanvas.x, endCanvas.x);
      const maxY = Math.max(startCanvas.y, endCanvas.y);
      const NODE_WIDTH = 280;
      const NODE_HEIGHT = 60; // approximate header height
      const hit = new Set<string>();
      for (const node of project.nodes) {
        const nx = node.position.x, ny = node.position.y;
        // Node overlaps if their rectangles intersect
        if (nx + NODE_WIDTH > minX && nx < maxX && ny + NODE_HEIGHT > minY && ny < maxY) {
          hit.add(node.id);
        }
      }
      setSelectedNodeIds(hit);
      return;
    }
    if (activeConn) {
      const pos = toCanvasCoords(e.clientX, e.clientY);
      setActiveConn(prev => prev ? { ...prev, mouseX: pos.x, mouseY: pos.y } : null);
    }
  }, [dragNodeId, isPanning, activeConn, transform, toCanvasCoords, setProject, selectedNodeIds, project.nodes]);

  // ── Zoom centered on cursor ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.min(Math.max(transform.scale * delta, 0.15), 3);
    if (!containerRef.current) { setTransform(prev => ({ ...prev, scale: newScale })); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = newScale / transform.scale;
    setTransform(prev => ({
      x: mx - (mx - prev.x) * ratio,
      y: my - (my - prev.y) * ratio,
      scale: newScale,
    }));
  }, [transform]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ═══════════════════════════════════════════
  // ──  Actions  ─────────────────────────────
  // ═══════════════════════════════════════════

  const addNode = (type: NodeType) => {
    let pos;
    if (contextMenu) {
      pos = toCanvasCoords(contextMenu.x, contextMenu.y);
    } else {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const center = toCanvasCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
      pos = { x: center.x - 140, y: center.y - 100 };
    }

    const newNode: DialogueNode = {
      id: `${type.toLowerCase()}-${generateUUID()}`,
      type,
      position: pos,
      data: {
        model: type === NodeType.START ? 'a_m_y_business_01' : undefined,
        npcName: 'Entity',
        text: type === NodeType.DIALOGUE ? t('editor.type_text') : undefined,
        choices: type === NodeType.DIALOGUE ? [{ id: `c-${generateUUID()}`, text: t('editor.type_next'), nextNodeId: null }] : [],
        variableName: 'var',
        conditionOperator: '==',
        variableValue: 'true',
        itemName: (type === NodeType.GIVE_ITEM || type === NodeType.REMOVE_ITEM) ? 'bread' : undefined,
        itemCount: (type === NodeType.GIVE_ITEM || type === NodeType.REMOVE_ITEM) ? 1 : undefined,
        moneyType: (type === NodeType.GIVE_MONEY || type === NodeType.REMOVE_MONEY) ? 'cash' : undefined,
        moneyAmount: (type === NodeType.GIVE_MONEY || type === NodeType.REMOVE_MONEY) ? 100 : undefined,
        animDict: type === NodeType.ANIMATION ? 'anim@mp_player_intcelebrationmale@wave' : undefined,
        animName: type === NodeType.ANIMATION ? 'wave' : undefined,
        animTarget: type === NodeType.ANIMATION ? 'npc' : undefined,
        animDuration: type === NodeType.ANIMATION ? 3000 : undefined,
        waitDuration: type === NodeType.WAIT ? 2000 : undefined,
        randomOutputs: type === NodeType.RANDOM ? [
          { id: `ro-${generateUUID()}`, weight: 50 },
          { id: `ro-${generateUUID()}`, weight: 50 },
        ] : undefined,
        teleportCoords: type === NodeType.TELEPORT ? { x: 0, y: 0, z: 0, w: 0 } : undefined,
        newModel: type === NodeType.NPC_CHANGE ? 'a_m_y_business_01' : undefined,
        soundName: type === NodeType.SOUND ? '' : undefined,
        soundVolume: type === NodeType.SOUND ? 50 : undefined,
      },
    };
    saveToHistory();
    setProject(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setContextMenu(null);
  };

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  const fitToView = useCallback(() => {
    if (project.nodes.length === 0) { setTransform({ x: 0, y: 0, scale: 1 }); return; }
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pad = 120;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of project.nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 280);
      maxY = Math.max(maxY, n.position.y + 200);
    }
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const scale = Math.min(rect.width / w, rect.height / h, 1.5);
    setTransform({
      x: rect.width / 2 - ((minX + maxX) / 2) * scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * scale,
      scale: Math.max(0.2, Math.min(scale, 1.5)),
    });
  }, [project.nodes]);

  const deleteNode = useCallback((id: string) => {
    saveToHistory();
    setProject(prev => ({
      nodes: prev.nodes.filter(n => n.id !== id),
      connections: prev.connections.filter(c => c.fromNodeId !== id && c.toNodeId !== id),
    }));
    setSelectedNodeId(null);
  }, [saveToHistory, setProject]);

  const duplicateNode = useCallback(() => {
    if (!selectedNodeId) return;
    const node = project.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    saveToHistory();
    const newNode: DialogueNode = {
      ...node,
      id: `${node.type.toLowerCase()}-${generateUUID()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: {
        ...node.data,
        choices: node.data.choices?.map(c => ({ ...c, id: `c-${generateUUID()}`, nextNodeId: null })),
        randomOutputs: node.data.randomOutputs?.map(o => ({ ...o, id: `ro-${generateUUID()}` })),
      },
    };
    setProject(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
  }, [selectedNodeId, project, saveToHistory, setProject]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    saveToHistory();
    setProject(prev => ({
      nodes: prev.nodes.filter(n => !selectedNodeIds.has(n.id)),
      connections: prev.connections.filter(c => !selectedNodeIds.has(c.fromNodeId) && !selectedNodeIds.has(c.toNodeId)),
    }));
    setSelectedNodeIds(new Set());
    setSelectedNodeId(null);
  }, [selectedNodeIds, saveToHistory, setProject]);

  const duplicateSelected = useCallback(() => {
    // Multi-duplicate
    if (selectedNodeIds.size > 0) {
      const nodesToDup = project.nodes.filter(n => selectedNodeIds.has(n.id));
      if (nodesToDup.length === 0) return;
      saveToHistory();
      const newIds = new Set<string>();
      const newNodes = nodesToDup.map(node => {
        const newId = `${node.type.toLowerCase()}-${generateUUID()}`;
        newIds.add(newId);
        return {
          ...node,
          id: newId,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: {
            ...node.data,
            choices: node.data.choices?.map(c => ({ ...c, id: `c-${generateUUID()}`, nextNodeId: null })),
            randomOutputs: node.data.randomOutputs?.map(o => ({ ...o, id: `ro-${generateUUID()}` })),
          },
        } as DialogueNode;
      });
      setProject(prev => ({ ...prev, nodes: [...prev.nodes, ...newNodes] }));
      setSelectedNodeIds(newIds);
      return;
    }
    // Single duplicate fallback
    duplicateNode();
  }, [selectedNodeIds, project, saveToHistory, setProject, duplicateNode]);

  // Ref
  const fitToViewRef = useRef(fitToView);
  fitToViewRef.current = fitToView;
  const [pendingFitToView, setPendingFitToView] = useState(false);
  useEffect(() => { if (pendingFitToView) { fitToViewRef.current(); setPendingFitToView(false); } }, [pendingFitToView, project.nodes]);

  // ── Auto-layout (hierarchical / Sugiyama-lite) ──
  const autoLayout = useCallback(() => {
    if (project.nodes.length === 0) return;
    saveToHistory();

    const NODE_W = 280;
    const NODE_H_BASE = 100;
    const GAP_X = 120;
    const GAP_Y = 50;

    // Estimate node height based on type & data
    const estimateHeight = (node: DialogueNode): number => {
      if (node.type === NodeType.DIALOGUE) return 136 + (node.data.choices?.length || 0) * 44;
      if (node.type === NodeType.CONDITION) return 180;
      if (node.type === NodeType.RANDOM) return 80 + (node.data.randomOutputs?.length || 0) * 44;
      return NODE_H_BASE;
    };

    // Build adjacency: nodeId → [childNodeIds]
    const children = new Map<string, string[]>();
    const parentCount = new Map<string, number>();
    for (const n of project.nodes) { children.set(n.id, []); parentCount.set(n.id, 0); }
    for (const c of project.connections) {
      children.get(c.fromNodeId)?.push(c.toNodeId);
      parentCount.set(c.toNodeId, (parentCount.get(c.toNodeId) || 0) + 1);
    }

    // BFS to assign layers (longest path from roots)
    const layer = new Map<string, number>();
    const startNodes = project.nodes.filter(n => n.type === NodeType.START);
    const roots = startNodes.length > 0
      ? startNodes
      : project.nodes.filter(n => (parentCount.get(n.id) || 0) === 0);

    // Longest-path layering via BFS (with cycle protection)
    const queue: string[] = [];
    const visitCount = new Map<string, number>();
    const MAX_VISITS = project.nodes.length * 2; // safety limit
    for (const r of roots) { layer.set(r.id, 0); queue.push(r.id); }
    // If no roots found, seed the first node
    if (queue.length === 0 && project.nodes.length > 0) {
      layer.set(project.nodes[0].id, 0);
      queue.push(project.nodes[0].id);
    }
    let head = 0;
    while (head < queue.length) {
      const nid = queue[head++];
      const curLayer = layer.get(nid) || 0;
      for (const childId of (children.get(nid) || [])) {
        const prev = layer.get(childId);
        const vc = (visitCount.get(childId) || 0) + 1;
        visitCount.set(childId, vc);
        if (vc > MAX_VISITS) continue; // cycle detected, skip
        if (prev === undefined || curLayer + 1 > prev) {
          layer.set(childId, curLayer + 1);
          queue.push(childId);
        }
      }
    }

    // Assign orphans (disconnected nodes) to a final layer
    let maxLayer = 0;
    for (const v of layer.values()) if (v > maxLayer) maxLayer = v;
    for (const n of project.nodes) {
      if (!layer.has(n.id)) {
        layer.set(n.id, maxLayer + 1);
      }
    }
    // Recalc max
    maxLayer = 0;
    for (const v of layer.values()) if (v > maxLayer) maxLayer = v;

    // Group nodes by layer
    const layers: string[][] = [];
    for (let i = 0; i <= maxLayer; i++) layers.push([]);
    for (const n of project.nodes) layers[layer.get(n.id) || 0].push(n.id);

    // Sort nodes within each layer to minimize edge crossings (simple median heuristic)
    for (let li = 1; li < layers.length; li++) {
      const medianPos = new Map<string, number>();
      for (const nid of layers[li]) {
        // Find parents in previous layer
        const parentPositions: number[] = [];
        for (const c of project.connections) {
          if (c.toNodeId === nid && layers[li - 1].includes(c.fromNodeId)) {
            parentPositions.push(layers[li - 1].indexOf(c.fromNodeId));
          }
        }
        if (parentPositions.length > 0) {
          parentPositions.sort((a, b) => a - b);
          medianPos.set(nid, parentPositions[Math.floor(parentPositions.length / 2)]);
        } else {
          medianPos.set(nid, Infinity);
        }
      }
      layers[li].sort((a, b) => (medianPos.get(a) || 0) - (medianPos.get(b) || 0));
    }

    // Compute positions
    const nodeMap = new Map(project.nodes.map(n => [n.id, n]));
    const newPositions = new Map<string, { x: number; y: number }>();
    let xOffset = 0;

    for (let li = 0; li < layers.length; li++) {
      // Calculate max column width (for centering)
      let totalHeight = 0;
      const heights: number[] = [];
      for (const nid of layers[li]) {
        const h = estimateHeight(nodeMap.get(nid)!);
        heights.push(h);
        totalHeight += h;
      }
      totalHeight += (layers[li].length - 1) * GAP_Y;

      let yOffset = -totalHeight / 2;
      for (let ni = 0; ni < layers[li].length; ni++) {
        newPositions.set(layers[li][ni], { x: xOffset, y: yOffset });
        yOffset += heights[ni] + GAP_Y;
      }
      xOffset += NODE_W + GAP_X;
    }

    setProject(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => ({
        ...n,
        position: newPositions.get(n.id) || n.position,
      })),
    }));

    // Fit to view after layout
    setPendingFitToView(true);
  }, [project, saveToHistory, setProject]);

  const deleteConnection = (connId: string) => {
    const conn = project.connections.find(c => c.id === connId);
    if (!conn) return;
    saveToHistory();
    const remaining = project.connections.filter(c => c.id !== connId);
    const updatedNodes = project.nodes.map(node => {
      if (node.id === conn.fromNodeId && node.type === NodeType.DIALOGUE) {
        return { ...node, data: { ...node.data, choices: node.data.choices?.map(c => c.id === conn.fromPort ? { ...c, nextNodeId: null } : c) } };
      }
      return node;
    });
    setProject({ nodes: updatedNodes, connections: remaining });
  };

  const addChoice = (nodeId: string) => {
    saveToHistory();
    setProject(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.id === nodeId) {
          const newChoice = { id: `c-${generateUUID()}`, text: t('editor.type_option'), nextNodeId: null };
          return { ...node, data: { ...node.data, choices: [...(node.data.choices || []), newChoice] } };
        }
        return node;
      }),
    }));
  };

  const removeChoice = (nodeId: string, choiceId: string) => {
    saveToHistory();
    setProject(prev => {
      const newConnections = prev.connections.filter(c => !(c.fromNodeId === nodeId && c.fromPort === choiceId));
      const newNodes = prev.nodes.map(node => {
        if (node.id === nodeId) return { ...node, data: { ...node.data, choices: node.data.choices?.filter(c => c.id !== choiceId) } };
        return node;
      });
      return { nodes: newNodes, connections: newConnections };
    });
  };

  // ── Search palette filter ──
  const filteredCategories = paletteSearch.trim() === ''
    ? NODE_CATEGORIES
    : NODE_CATEGORIES.map(cat => ({
        ...cat,
        types: cat.types.filter(tp => {
          const q = paletteSearch.toLowerCase();
          return tp.toLowerCase().includes(q) || getNodeLabel(tp).toLowerCase().includes(q);
        }),
      })).filter(cat => cat.types.length > 0);

  // ═══════════════════════════════════════════
  // ──  Render  ──────────────────────────────
  // ═══════════════════════════════════════════

  const cursorClass = spaceHeld || isPanning ? 'cursor-grab active:cursor-grabbing' : (dragNodeId ? 'cursor-grabbing' : 'cursor-default');

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden node-canvas bg-[#09090b] select-none ${cursorClass}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      {/* ── Grid Background ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ transform: `translate(${transform.x % (GRID_LARGE * transform.scale)}px, ${transform.y % (GRID_LARGE * transform.scale)}px)` }}>
        <defs>
          <pattern id="grid-sm" width={GRID_SMALL * transform.scale} height={GRID_SMALL * transform.scale} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_SMALL * transform.scale} 0 L 0 0 0 ${GRID_SMALL * transform.scale}`} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-lg" width={GRID_LARGE * transform.scale} height={GRID_LARGE * transform.scale} patternUnits="userSpaceOnUse">
            <rect width={GRID_LARGE * transform.scale} height={GRID_LARGE * transform.scale} fill="url(#grid-sm)" />
            <path d={`M ${GRID_LARGE * transform.scale} 0 L 0 0 0 ${GRID_LARGE * transform.scale}`} fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-100%" y="-100%" width="300%" height="300%" fill="url(#grid-lg)" />
      </svg>

      {/* ── Canvas layer (transformed) ── */}
      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* ── Connections SVG ── */}
        <svg className="absolute inset-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible">
          {project.connections.map(conn => {
            const start = getNodePortPosition(conn.fromNodeId, conn.fromPort, 'output');
            const nodeTo = project.nodes.find(n => n.id === conn.toNodeId);
            const end = nodeTo ? { x: nodeTo.position.x, y: nodeTo.position.y + 20 } : { x: 0, y: 0 };
            const dist = Math.abs(end.x - start.x);
            const cpDist = Math.max(dist * 0.5, 80);
            const cp1 = { x: start.x + cpDist, y: start.y };
            const cp2 = { x: end.x - cpDist, y: end.y };
            let strokeColor = '#52525b';
            if (conn.fromPort === 'true') strokeColor = '#10b981';
            if (conn.fromPort === 'false') strokeColor = '#f43f5e';
            const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

            return (
              <g key={conn.id} className="cursor-pointer group pointer-events-auto" onClick={e => { e.stopPropagation(); deleteConnection(conn.id); }}>
                <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                <path d={path} stroke={strokeColor} strokeWidth="2" fill="none" className="group-hover:stroke-white transition-colors" strokeDasharray={undefined} />
                <circle cx={end.x} cy={end.y} r="3" fill={strokeColor} className="group-hover:fill-white transition-colors" />
              </g>
            );
          })}
          {/* Active dragging connection */}
          {activeConn && (() => {
            const from = getNodePortPosition(activeConn.fromNodeId, activeConn.fromPort, 'output');
            return <path d={`M ${from.x} ${from.y} C ${(from.x + activeConn.mouseX) / 2} ${from.y}, ${(from.x + activeConn.mouseX) / 2} ${activeConn.mouseY}, ${activeConn.mouseX} ${activeConn.mouseY}`} stroke="#a1a1aa" strokeWidth="2" fill="none" strokeDasharray="6,4">
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
            </path>;
          })()}
        </svg>

        {/* ── Nodes ── */}
        {project.nodes.map(node => {
          const isMultiSelected = selectedNodeIds.has(node.id);
          const isSingleSelected = selectedNodeId === node.id;
          return (
          <div
            key={node.id}
            onMouseDown={e => handleNodeMouseDown(node.id, e)}
            className={`
              absolute w-[280px] rounded-md pointer-events-auto flex flex-col transition-shadow border
              ${isSingleSelected ? 'ring-1 ring-zinc-100/80 shadow-2xl shadow-white/5 z-20 border-zinc-600'
                : isMultiSelected ? 'ring-1 ring-sky-400/60 shadow-2xl shadow-sky-500/10 z-20 border-sky-500/50'
                : 'shadow-xl z-10 border-zinc-800/80 hover:border-zinc-700'}
            `}
            style={{ left: node.position.x, top: node.position.y, backgroundColor: '#0a0a0b' }}
          >
            {/* Header */}
            <div className={`h-10 px-4 flex items-center justify-between border-b rounded-t-md ${getNodeColor(node.type)}`}>
              <div className="flex items-center gap-2">
                <span className="opacity-70">{getNodeIcon(node.type, 12)}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{getNodeLabel(node.type)}</span>
              </div>

              {/* Input port (left) */}
              {node.type !== NodeType.START && (
                <div
                  onMouseUp={e => handlePortMouseUp(node.id, e)}
                  className={`w-3.5 h-3.5 absolute -left-[7px] top-[13px] bg-zinc-950 border-2 border-zinc-600 hover:border-white hover:bg-zinc-800 hover:scale-150 transition-all rotate-45 cursor-crosshair z-30 ${activeConn ? 'animate-pulse border-zinc-400 scale-125' : ''}`}
                />
              )}

              {/* Output port (right) - single port nodes */}
              {[NodeType.START, NodeType.SET_VARIABLE, NodeType.EVENT,
                NodeType.GIVE_ITEM, NodeType.REMOVE_ITEM, NodeType.GIVE_MONEY, NodeType.REMOVE_MONEY,
                NodeType.ANIMATION, NodeType.WAIT, NodeType.TELEPORT, NodeType.NPC_CHANGE, NodeType.SOUND
              ].includes(node.type) && (
                <div
                  onMouseDown={e => handlePortMouseDown(node.id, 'main', e)}
                  className="w-3.5 h-3.5 absolute -right-[7px] top-[13px] bg-zinc-100 border-2 border-zinc-100 hover:scale-150 transition-all rotate-45 cursor-crosshair z-30"
                />
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">

              {/* DIALOGUE */}
              {node.type === NodeType.DIALOGUE && (
                <>
                  <div className="bg-zinc-900/50 p-3 rounded-sm border border-zinc-800/50 h-[64px] overflow-hidden">
                    <p className="text-[10px] text-zinc-400 font-mono leading-relaxed line-clamp-3 pointer-events-none select-none">
                      "{node.data.text || '...'}"
                    </p>
                  </div>
                  <div className="space-y-2">
                    {node.data.choices?.map((choice, i) => (
                      <div key={choice.id} className="relative flex items-center h-[36px] bg-zinc-900 border border-zinc-800 px-3 rounded-sm group">
                        <span className="text-[9px] text-zinc-500 font-bold mr-2">0{i + 1}</span>
                        <span className="text-[10px] text-zinc-300 truncate font-medium">{choice.text}</span>
                        <div onMouseDown={e => handlePortMouseDown(node.id, choice.id, e)} className="absolute -right-[6px] w-3 h-3 bg-zinc-800 border-2 border-zinc-500 hover:bg-zinc-100 hover:border-zinc-100 hover:scale-150 transition-all rotate-45 cursor-crosshair z-30" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* CONDITION */}
              {node.type === NodeType.CONDITION && (
                <div className="space-y-3">
                  <div className="bg-amber-900/10 border border-amber-900/30 p-2 rounded-sm text-center h-[36px] flex items-center justify-center">
                    <p className="text-[10px] font-mono text-amber-500 truncate px-2">
                      {t('editor.node.if')} {node.data.variableName} {node.data.conditionOperator} {node.data.variableValue}
                    </p>
                  </div>
                  <div className="relative h-8 flex items-center justify-end">
                    <span className="text-[9px] font-bold text-emerald-500 mr-4">{t('editor.node.true')}</span>
                    <div onMouseDown={e => handlePortMouseDown(node.id, 'true', e)} className="absolute -right-[6px] top-2.5 w-3 h-3 bg-emerald-900 border-2 border-emerald-500 hover:bg-emerald-400 transition-all rotate-45 cursor-crosshair z-30" />
                  </div>
                  <div className="relative h-8 flex items-center justify-end border-t border-zinc-800/50 pt-3">
                    <span className="text-[9px] font-bold text-rose-500 mr-4">{t('editor.node.false')}</span>
                    <div onMouseDown={e => handlePortMouseDown(node.id, 'false', e)} className="absolute -right-[6px] top-[14px] w-3 h-3 bg-rose-900 border-2 border-rose-500 hover:bg-rose-400 transition-all rotate-45 cursor-crosshair z-30" />
                  </div>
                </div>
              )}

              {/* SET VARIABLE */}
              {node.type === NodeType.SET_VARIABLE && (
                <div className="bg-sky-900/10 border border-sky-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-sky-500">{t('editor.node.set_variable')} <span className="text-zinc-200">{node.data.variableName}</span> = <span className="text-zinc-200">{node.data.variableValue}</span></p>
                </div>
              )}

              {/* EVENT */}
              {node.type === NodeType.EVENT && (
                <div className="bg-purple-900/10 border border-purple-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-purple-500">{t('editor.node.trigger')} <span className="text-zinc-200">{node.data.eventName || 'EVENT'}</span></p>
                </div>
              )}

              {/* END */}
              {node.type === NodeType.END && (
                <div className="text-center py-2"><p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t('editor.node.end')}</p></div>
              )}

              {/* START */}
              {node.type === NodeType.START && (
                <div className="space-y-2">
                  <div className="text-center py-1"><p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{t('editor.node.start')}</p></div>
                  {node.data.animDict && node.data.animName && (
                    <div className="bg-emerald-900/10 border border-emerald-900/30 p-2 rounded-sm">
                      <p className="text-[9px] font-mono text-emerald-400 truncate">🎭 {node.data.animDict}/{node.data.animName}</p>
                    </div>
                  )}
                </div>
              )}

              {/* GIVE_ITEM */}
              {node.type === NodeType.GIVE_ITEM && (
                <div className="bg-lime-900/10 border border-lime-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-lime-500">+ <span className="text-zinc-200">{node.data.itemCount || 1}x {node.data.itemName || 'item'}</span></p>
                </div>
              )}

              {/* REMOVE_ITEM */}
              {node.type === NodeType.REMOVE_ITEM && (
                <div className="bg-orange-900/10 border border-orange-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-orange-500">- <span className="text-zinc-200">{node.data.itemCount || 1}x {node.data.itemName || 'item'}</span></p>
                </div>
              )}

              {/* GIVE_MONEY */}
              {node.type === NodeType.GIVE_MONEY && (
                <div className="bg-green-900/10 border border-green-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-green-500">+ $<span className="text-zinc-200">{node.data.moneyAmount || 0}</span> <span className="text-zinc-500">({node.data.moneyType || 'cash'})</span></p>
                </div>
              )}

              {/* REMOVE_MONEY */}
              {node.type === NodeType.REMOVE_MONEY && (
                <div className="bg-red-900/10 border border-red-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-red-500">- $<span className="text-zinc-200">{node.data.moneyAmount || 0}</span> <span className="text-zinc-500">({node.data.moneyType || 'cash'})</span></p>
                </div>
              )}

              {/* ANIMATION */}
              {node.type === NodeType.ANIMATION && (
                <div className="bg-pink-900/10 border border-pink-900/30 p-2 rounded-sm space-y-1">
                  <p className="text-[10px] font-mono text-pink-500"><span className="text-zinc-500">{node.data.animTarget || 'npc'}:</span> <span className="text-zinc-200">{node.data.animDict || '...'}</span></p>
                  <p className="text-[10px] font-mono text-zinc-400">{node.data.animName || '...'} <span className="text-zinc-600">({node.data.animDuration || 0}ms)</span></p>
                </div>
              )}

              {/* WAIT */}
              {node.type === NodeType.WAIT && (
                <div className="bg-cyan-900/10 border border-cyan-900/30 p-2 rounded-sm text-center">
                  <p className="text-[10px] font-mono text-cyan-500">⏱ <span className="text-zinc-200">{node.data.waitDuration || 0}ms</span></p>
                </div>
              )}

              {/* RANDOM */}
              {node.type === NodeType.RANDOM && (
                <div className="space-y-2">
                  {node.data.randomOutputs?.map((output, i) => (
                    <div key={output.id} className="relative flex items-center h-[36px] bg-zinc-900 border border-zinc-800 px-3 rounded-sm group">
                      <span className="text-[9px] text-zinc-500 font-bold mr-2">0{i + 1}</span>
                      <span className="text-[10px] text-yellow-400 font-mono">{output.weight}%</span>
                      <div onMouseDown={e => handlePortMouseDown(node.id, output.id, e)} className="absolute -right-[6px] w-3 h-3 bg-zinc-800 border-2 border-yellow-500 hover:bg-yellow-400 hover:border-yellow-400 hover:scale-150 transition-all rotate-45 cursor-crosshair z-30" />
                    </div>
                  ))}
                </div>
              )}

              {/* TELEPORT */}
              {node.type === NodeType.TELEPORT && (
                <div className="bg-indigo-900/10 border border-indigo-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-indigo-500">📍 <span className="text-zinc-200">{node.data.teleportCoords?.x?.toFixed(1) || '0'}, {node.data.teleportCoords?.y?.toFixed(1) || '0'}, {node.data.teleportCoords?.z?.toFixed(1) || '0'}</span></p>
                </div>
              )}

              {/* NPC_CHANGE */}
              {node.type === NodeType.NPC_CHANGE && (
                <div className="bg-teal-900/10 border border-teal-900/30 p-2 rounded-sm space-y-1">
                  <p className="text-[10px] font-mono text-teal-500">→ <span className="text-zinc-200">{node.data.newModel || '...'}</span></p>
                  {node.data.newAnimDict && <p className="text-[10px] font-mono text-zinc-400">{node.data.newAnimDict}/{node.data.newAnimName}</p>}
                </div>
              )}

              {/* SOUND */}
              {node.type === NodeType.SOUND && (
                <div className="bg-fuchsia-900/10 border border-fuchsia-900/30 p-2 rounded-sm">
                  <p className="text-[10px] font-mono text-fuchsia-500">🔊 <span className="text-zinc-200">{node.data.soundName || '...'}</span> <span className="text-zinc-600">vol:{node.data.soundVolume || 50}</span></p>
                </div>
              )}
            </div>
          </div>
          );
        })}

        {/* ── Marquee selection rectangle ── */}
        {marquee && (
          <div
            className="absolute border border-sky-400/60 bg-sky-400/10 pointer-events-none z-50"
            style={{
              left: Math.min(marquee.startX, marquee.endX),
              top: Math.min(marquee.startY, marquee.endY),
              width: Math.abs(marquee.endX - marquee.startX),
              height: Math.abs(marquee.endY - marquee.startY),
            }}
          />
        )}
      </div>

      {/* ═══════════ BOTTOM TOOLBAR ═══════════ */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-800 p-1 rounded-2xl shadow-2xl flex items-center gap-0.5 z-50 backdrop-blur-md" onMouseDown={e => e.stopPropagation()}>
        {NODE_CATEGORIES.map((cat, ci) => (
          <React.Fragment key={cat.key}>
            {cat.types.map(type => (
              <div key={type} className="relative group">
                <button
                  onClick={() => addNode(type)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
                >
                  <span className={getNodeIconColor(type)}>{getNodeIcon(type, 14)}</span>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-300 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
                  {getNodeLabel(type)}
                </div>
              </div>
            ))}
            {ci < NODE_CATEGORIES.length - 1 && <div className="w-px h-5 bg-zinc-800 mx-0.5" />}
          </React.Fragment>
        ))}

        <div className="w-px h-5 bg-zinc-800 mx-0.5" />

        {/* Search Palette trigger */}
        <div className="relative group">
          <button onClick={() => { setShowPalette(true); setPaletteSearch(''); }} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.search_nodes')} <kbd className="ml-1 px-1 py-0.5 bg-zinc-800 rounded text-[8px] text-zinc-500">Tab</kbd>
          </div>
        </div>

        <div className="w-px h-5 bg-zinc-800 mx-0.5" />

<<<<<<< HEAD
                const useMyPosition = async () => {
                  const resp = await fetchNui('getPlayerCoords');
                  if (resp && resp.coords) {
                    updateData('coords', resp.coords);
                  }
                };
                if (node.type === NodeType.DIALOGUE) return (
                    <>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.npc_id')}</label>
                            <input type="text" value={node.data.npcName || ''} onChange={(e) => updateData('npcName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.text_buffer')}</label>
                            <textarea rows={5} value={node.data.text || ''} onChange={(e) => updateData('text', e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-900 p-4 text-[11px] font-medium text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none rounded-sm" />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-zinc-900">
                             <div className="flex justify-between"><label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.responses')}</label><button onClick={() => addChoice(selectedNodeId)} className="text-[9px] font-bold text-zinc-400 hover:text-white">{t('editor.add')}</button></div>
                             {node.data.choices?.map((c, i) => (
                                 <div key={c.id} className="flex gap-2">
                                     <input type="text" value={c.text} onChange={(e) => {
                                         const newChoices = node.data.choices?.map(choice => choice.id === c.id ? { ...choice, text: e.target.value } : choice);
                                         updateData('choices', newChoices);
                                     }} className="flex-1 bg-zinc-900 border-b border-zinc-800 text-[10px] py-1 text-zinc-300 focus:outline-none" />
                                     <button onClick={() => removeChoice(selectedNodeId, c.id)} className="text-zinc-600 hover:text-rose-500">×</button>
                                 </div>
                             ))}
                        </div>
                    </>
                );
                if (node.type === NodeType.CONDITION || node.type === NodeType.SET_VARIABLE) return (
                    <>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.variable_key')}</label>
                            <input type="text" value={node.data.variableName || ''} onChange={(e) => updateData('variableName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                        </div>
                        {node.type === NodeType.CONDITION && (
                             <div className="space-y-3">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.operator')}</label>
                                <select value={node.data.conditionOperator} onChange={(e) => updateData('conditionOperator', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none">
                                    <option value="==">== Equals</option>
                                    <option value="!=">!= Not Equals</option>
                                    <option value=">">&gt; Greater Than</option>
                                    <option value="<">&lt; Less Than</option>
                                    <option value=">=">&gt;= Greater/Eq</option>
                                    <option value="<=">&lt;= Less/Eq</option>
                                </select>
                             </div>
                        )}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{node.type === NodeType.SET_VARIABLE ? t('editor.value_set') : t('editor.value_check')}</label>
                            <input type="text" value={node.data.variableValue || ''} onChange={(e) => updateData('variableValue', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                        </div>
                    </>
                );
                if (node.type === NodeType.EVENT) return (
                  <>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.event_name')}</label>
                        <input type="text" value={node.data.eventName || ''} onChange={(e) => updateData('eventName', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.event_payload')}</label>
                        <input type="text" value={node.data.eventPayload || ''} onChange={(e) => updateData('eventPayload', e.target.value)} className="w-full bg-zinc-900 border-b border-zinc-800 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-400" placeholder="{key: 'value'}" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" id="isServer" checked={node.data.isServer || false} onChange={(e) => updateData('isServer', e.target.checked)} className="bg-zinc-900 border border-zinc-800 rounded" />
                        <label htmlFor="isServer" className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.is_server_event')}</label>
                    </div>
                  </>
                );
=======
        {/* Undo */}
        <div className="relative group">
          <button onClick={undo} disabled={history.length === 0} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${history.length === 0 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.undo')} <kbd className="ml-1 px-1 py-0.5 bg-zinc-800 rounded text-[8px] text-zinc-500">Ctrl+Z</kbd>
          </div>
        </div>
>>>>>>> xbymarcos/master

        {/* Redo */}
        <div className="relative group">
          <button onClick={redo} disabled={future.length === 0} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${future.length === 0 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7"/></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.redo')} <kbd className="ml-1 px-1 py-0.5 bg-zinc-800 rounded text-[8px] text-zinc-500">Ctrl+Y</kbd>
          </div>
        </div>

        <div className="w-px h-5 bg-zinc-800 mx-0.5" />

        {/* Fit to View */}
        <div className="relative group">
          <button onClick={fitToView} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.fit_view')}
          </div>
        </div>

        {/* Auto Layout */}
        <div className="relative group">
          <button onClick={autoLayout} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M10 7h4"/><path d="M10 17h4"/><path d="M7 10v4"/><path d="M17 10v4"/></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.auto_layout')} <kbd className="ml-1 px-1 py-0.5 bg-zinc-800 rounded text-[8px] text-zinc-500">Ctrl+L</kbd>
          </div>
        </div>

        {/* Reset View */}
        <div className="relative group">
          <button onClick={resetView} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-[9px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[60]">
            {t('editor.reset_view')}
          </div>
        </div>
      </div>

      {/* ═══════════ ZOOM INDICATOR ═══════════ */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-2 py-1 z-50 backdrop-blur-sm" onMouseDown={e => e.stopPropagation()}>
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.15, p.scale * 0.8) }))} className="text-zinc-500 hover:text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-800 transition-colors">−</button>
        <button onClick={() => setTransform(p => ({ ...p, scale: 1 }))} className="text-[10px] font-mono text-zinc-400 hover:text-white w-12 text-center rounded-md hover:bg-zinc-800 py-1 transition-colors cursor-pointer">{Math.round(transform.scale * 100)}%</button>
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.25) }))} className="text-zinc-500 hover:text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-800 transition-colors">+</button>
      </div>

      {/* ═══════════ KEYBOARD HINTS (top-left) ═══════════ */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-1 pointer-events-none opacity-40">
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-mono">Space</kbd>
          <span>{t('editor.hint_pan')}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-mono">Tab</kbd>
          <span>{t('editor.hint_search')}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-mono">Del</kbd>
          <span>{t('editor.hint_delete')}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-mono">Ctrl+D</kbd>
          <span>{t('editor.hint_duplicate')}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-zinc-500">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 font-mono">Ctrl+L</kbd>
          <span>{t('editor.hint_auto_layout')}</span>
        </div>
      </div>

      {/* ═══════════ NODE COUNT (top-right) ═══════════ */}
      <div className="absolute top-4 right-4 z-40 pointer-events-none">
        <span className="text-[10px] font-mono text-zinc-600">{project.nodes.length} {t('editor.node_count')} · {project.connections.length} {t('editor.conn_count')}</span>
      </div>

      {/* ═══════════ SEARCH PALETTE (Command+K style) ═══════════ */}
      {showPalette && (
        <div className="absolute inset-0 z-[200] flex items-start justify-center pt-[12%] bg-black/40 backdrop-blur-sm" onClick={() => setShowPalette(false)} onMouseDown={e => e.stopPropagation()}>
          <div className="w-[380px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input
                ref={paletteInputRef}
                value={paletteSearch}
                onChange={e => setPaletteSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setShowPalette(false); }}
                className="flex-1 bg-transparent text-sm text-zinc-200 py-3.5 focus:outline-none placeholder:text-zinc-600"
                placeholder={t('editor.palette_placeholder')}
              />
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto p-1.5 custom-scrollbar">
              {filteredCategories.length === 0 && (
                <div className="text-center py-6 text-[11px] text-zinc-600">{t('editor.palette_empty')}</div>
              )}
              {filteredCategories.map(cat => (
                <div key={cat.key}>
                  <div className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-[0.25em]">{t('editor.cat_' + cat.key)}</div>
                  {cat.types.map(type => (
                    <button
                      key={type}
                      onClick={() => { addNode(type); setShowPalette(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors group"
                    >
                      <span className={`${getNodeIconColor(type)} opacity-70 group-hover:opacity-100 transition-opacity`}>{getNodeIcon(type, 16)}</span>
                      <span className="text-[11px] font-medium tracking-wide">{getNodeLabel(type)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer hints */}
            <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-5">
              <span className="text-[9px] text-zinc-600 flex items-center gap-1"><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500 font-mono text-[8px]">↵</kbd> {t('editor.palette_add')}</span>
              <span className="text-[9px] text-zinc-600 flex items-center gap-1"><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500 font-mono text-[8px]">Esc</kbd> {t('editor.palette_close')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PROPERTY SIDEBAR ═══════════ */}
      {selectedNodeId && (
        <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-zinc-950/95 border-l border-zinc-900 shadow-2xl z-[60] flex flex-col backdrop-blur-md" onMouseDown={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={getNodeIconColor(project.nodes.find(n => n.id === selectedNodeId)?.type || NodeType.START)}>
                {getNodeIcon(project.nodes.find(n => n.id === selectedNodeId)?.type || NodeType.START, 16)}
              </span>
              <div>
                <h3 className="text-[11px] font-black tracking-[0.2em] text-zinc-100 uppercase">{t('editor.properties')}</h3>
                <p className="text-[9px] text-zinc-500 font-medium uppercase mt-0.5">{getNodeLabel(project.nodes.find(n => n.id === selectedNodeId)?.type as NodeType)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Duplicate btn */}
              <button onClick={duplicateNode} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-900 transition-colors rounded-md text-zinc-600 hover:text-zinc-300" title={t('editor.duplicate')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              {/* Close btn */}
              <button onClick={() => setSelectedNodeId(null)} className="w-7 h-7 flex items-center justify-center hover:bg-zinc-900 transition-colors rounded-md text-zinc-600 hover:text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Properties body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            {(() => {
              const node = project.nodes.find(n => n.id === selectedNodeId);
              if (!node) return null;

              // updateData with history snapshot (debounced per "edit session")
              const updateData = (key: string, value: any) => {
                if (!lastPropertySnapshot.current) {
                  lastPropertySnapshot.current = project;
                  setHistory(prev => [...prev, project]);
                  setFuture([]);
                }
                // Clear previous timer and set a new one
                if (propertyEditTimer.current) clearTimeout(propertyEditTimer.current);
                propertyEditTimer.current = setTimeout(() => { lastPropertySnapshot.current = null; }, 800);

                setProject(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === selectedNodeId ? { ...n, data: { ...n.data, [key]: value } } : n),
                }));
              };

              const updateCoords = (partial: Partial<WorldCoords>) => {
                const current = (node.data.coords || {}) as WorldCoords;
                updateData('coords', { ...current, ...partial });
              };

              const useMyPosition = async () => {
                const resp = await fetchNui('getPlayerCoords');
                if (resp && resp.coords) updateData('coords', resp.coords);
              };

              // ── Per node-type property panels ──

              if (node.type === NodeType.DIALOGUE) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.npc_id')}</label>
                    <input type="text" value={node.data.npcName || ''} onChange={e => updateData('npcName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.text_buffer')}</label>
                    <textarea rows={5} value={node.data.text || ''} onChange={e => updateData('text', e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md p-3 text-[11px] font-medium text-zinc-300 focus:outline-none focus:border-zinc-600 resize-none transition-colors" />
                  </div>
                  <div className="space-y-3 pt-3 border-t border-zinc-900">
                    <div className="flex justify-between"><label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.responses')}</label><button onClick={() => addChoice(selectedNodeId)} className="text-[9px] font-bold text-zinc-400 hover:text-white transition-colors">{t('editor.add')}</button></div>
                    {node.data.choices?.map((c, i) => (
                      <div key={c.id} className="flex gap-2 items-center">
                        <span className="text-[9px] text-zinc-600 font-bold w-5">{String(i + 1).padStart(2, '0')}</span>
                        <input type="text" value={c.text} onChange={e => {
                          const newChoices = node.data.choices?.map(ch => ch.id === c.id ? { ...ch, text: e.target.value } : ch);
                          updateData('choices', newChoices);
                        }} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                        <button onClick={() => removeChoice(selectedNodeId, c.id)} className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-3 border-t border-zinc-900">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.dialogue_anim')}</label>
                    <input type="text" value={node.data.animDict || ''} onChange={e => updateData('animDict', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.anim_dict')} />
                    <input type="text" value={node.data.animName || ''} onChange={e => updateData('animName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.anim_name')} />
                  </div>
                </>
              );

              if (node.type === NodeType.CONDITION || node.type === NodeType.SET_VARIABLE) {
                const parsed = parseVariableName(node.data.variableName || '');
                const isValueRef = node.type === NodeType.CONDITION && (node.data.variableValue || '').startsWith('$');
                const valueRefRaw = isValueRef ? (node.data.variableValue || '').slice(1) : '';
                const valueRefParsed = isValueRef ? parseVariableName(valueRefRaw) : null;

                // Helper: build the grouped <select> for picking a game variable
                const VariableSelect = ({ currentParsed, onChangeVar }: { currentParsed: ReturnType<typeof parseVariableName>; onChangeVar: (fullKey: string) => void }) => (
                  <>
                    <select
                      value={currentParsed.variable?.value ?? ''}
                      onChange={e => {
                        const sel = GAME_VARIABLES.find(v => v.value === e.target.value);
                        if (sel) onChangeVar(sel.requiresSuffix ? sel.value + (currentParsed.suffix || '') : sel.value);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
                    >
                      {VARIABLE_CATEGORIES.map(cat => (
                        <optgroup key={cat} label={t('editor.var.cat_' + cat)}>
                          {GAME_VARIABLES.filter(v => v.category === cat).map(v => (
                            <option key={v.value + v.labelKey} value={v.value}>{t(v.labelKey)}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {currentParsed.variable?.requiresSuffix && (
                      <input
                        type="text"
                        value={currentParsed.suffix}
                        onChange={e => onChangeVar((currentParsed.variable?.value || '') + e.target.value)}
                        placeholder={currentParsed.variable.suffixPlaceholder}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
                      />
                    )}
                    {currentParsed.variable?.hintKey && (
                      <p className="text-[9px] text-zinc-600 leading-relaxed">{t(currentParsed.variable.hintKey)}</p>
                    )}
                  </>
                );

                return (
                <>
                  {/* ── Variable Key ── */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.variable_key')}</label>
                    {node.type === NodeType.CONDITION ? (
                      <VariableSelect currentParsed={parsed} onChangeVar={v => updateData('variableName', v)} />
                    ) : (
                      <input type="text" value={node.data.variableName || ''} onChange={e => updateData('variableName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                    )}
                  </div>

                  {/* ── Operator (CONDITION only) ── */}
                  {node.type === NodeType.CONDITION && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.operator')}</label>
                      <select value={node.data.conditionOperator} onChange={e => updateData('conditionOperator', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none">
                        <option value="==">{t('editor.op_equals')}</option>
                        <option value="!=">{t('editor.op_not_equals')}</option>
                        <option value=">">{t('editor.op_greater')}</option>
                        <option value="<">{t('editor.op_less')}</option>
                        <option value=">=">{t('editor.op_greater_eq')}</option>
                        <option value="<=">{t('editor.op_less_eq')}</option>
                      </select>
                    </div>
                  )}

                  {/* ── Value ── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{node.type === NodeType.SET_VARIABLE ? t('editor.value_set') : t('editor.value_check')}</label>
                      {node.type === NodeType.CONDITION && (
                        <div className="flex bg-zinc-900 rounded-md overflow-hidden border border-zinc-800">
                          <button
                            onClick={() => { if (isValueRef) updateData('variableValue', ''); }}
                            className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider transition-colors ${!isValueRef ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}
                            title={t('editor.value_mode_fixed')}
                          >Aa</button>
                          <button
                            onClick={() => { if (!isValueRef) updateData('variableValue', '$'); }}
                            className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider transition-colors ${isValueRef ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}
                            title={t('editor.value_mode_var')}
                          >$</button>
                        </div>
                      )}
                    </div>
                    {isValueRef ? (
                      <VariableSelect currentParsed={valueRefParsed!} onChangeVar={v => updateData('variableValue', '$' + v)} />
                    ) : (
                      <input type="text" value={node.data.variableValue || ''} onChange={e => updateData('variableValue', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                    )}
                  </div>
                </>
              );
              }

              if (node.type === NodeType.EVENT) return (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.event_name')}</label>
                  <input type="text" value={node.data.eventName || ''} onChange={e => updateData('eventName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                </div>
              );

              if (node.type === NodeType.START) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.npc_model')}</label>
                    <input type="text" value={node.data.model || ''} onChange={e => updateData('model', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="a_m_y_business_01" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.coords')}</label>
                      <button onClick={useMyPosition} className="text-[9px] font-bold text-zinc-400 hover:text-white transition-colors">{t('editor.use_my_position')}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={node.data.coords?.x ?? ''} onChange={e => updateCoords({ x: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="X" />
                      <input type="number" value={node.data.coords?.y ?? ''} onChange={e => updateCoords({ y: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="Y" />
                      <input type="number" value={node.data.coords?.z ?? ''} onChange={e => updateCoords({ z: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="Z" />
                      <input type="number" value={node.data.coords?.w ?? ''} onChange={e => updateCoords({ w: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.coord_w_heading')} />
                    </div>
                  </div>
                  <div className="border-t border-zinc-800/50 pt-3 space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.idle_animation')}</label>
                    <input type="text" value={node.data.animDict || ''} onChange={e => updateData('animDict', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.anim_dict_placeholder')} />
                    <input type="text" value={node.data.animName || ''} onChange={e => updateData('animName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.anim_name_placeholder')} />
                    <p className="text-[9px] text-zinc-600 italic">{t('editor.idle_animation_hint')}</p>
                  </div>
                </>
              );

              if (node.type === NodeType.GIVE_ITEM || node.type === NodeType.REMOVE_ITEM) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.item_name')}</label>
                    <input type="text" value={node.data.itemName || ''} onChange={e => updateData('itemName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="bread" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.item_count')}</label>
                    <input type="number" min={1} value={node.data.itemCount ?? 1} onChange={e => updateData('itemCount', Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                </>
              );

              if (node.type === NodeType.GIVE_MONEY || node.type === NodeType.REMOVE_MONEY) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.money_type')}</label>
                    <select value={node.data.moneyType || 'cash'} onChange={e => updateData('moneyType', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.money_amount')}</label>
                    <input type="number" min={0} value={node.data.moneyAmount ?? 0} onChange={e => updateData('moneyAmount', Math.max(0, parseInt(e.target.value) || 0))} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                </>
              );

              if (node.type === NodeType.ANIMATION) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.anim_dict')}</label>
                    <input type="text" value={node.data.animDict || ''} onChange={e => updateData('animDict', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.anim_name')}</label>
                    <input type="text" value={node.data.animName || ''} onChange={e => updateData('animName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.anim_target')}</label>
                    <select value={node.data.animTarget || 'npc'} onChange={e => updateData('animTarget', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none">
                      <option value="npc">{t('editor.anim_target_npc')}</option>
                      <option value="player">{t('editor.anim_target_player')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.anim_duration')}</label>
                    <input type="number" min={0} value={node.data.animDuration ?? 3000} onChange={e => updateData('animDuration', Math.max(0, parseInt(e.target.value) || 0))} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                </>
              );

              if (node.type === NodeType.WAIT) return (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.wait_duration')}</label>
                  <input type="number" min={0} value={node.data.waitDuration ?? 2000} onChange={e => updateData('waitDuration', Math.max(0, parseInt(e.target.value) || 0))} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                </div>
              );

              if (node.type === NodeType.RANDOM) return (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.random_outputs')}</label>
                    <button onClick={() => {
                      const outputs = [...(node.data.randomOutputs || []), { id: `ro-${generateUUID()}`, weight: 50 }];
                      updateData('randomOutputs', outputs);
                    }} className="text-[9px] font-bold text-zinc-400 hover:text-white transition-colors">{t('editor.add')}</button>
                  </div>
                  {node.data.randomOutputs?.map((output, i) => (
                    <div key={output.id} className="flex gap-2 items-center">
                      <span className="text-[9px] text-zinc-600 font-bold w-5">{String(i + 1).padStart(2, '0')}</span>
                      <input type="number" min={0} max={100} value={output.weight} onChange={e => {
                        const outputs = node.data.randomOutputs?.map(o => o.id === output.id ? { ...o, weight: Math.max(0, parseInt(e.target.value) || 0) } : o);
                        updateData('randomOutputs', outputs);
                      }} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                      <span className="text-[9px] text-zinc-500">%</span>
                      <button onClick={() => {
                        saveToHistory();
                        const outputs = node.data.randomOutputs?.filter(o => o.id !== output.id);
                        const newConns = project.connections.filter(c => !(c.fromNodeId === node.id && c.fromPort === output.id));
                        setProject(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, randomOutputs: outputs } } : n), connections: newConns }));
                      }} className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors">×</button>
                    </div>
                  ))}
                </div>
              );

              if (node.type === NodeType.TELEPORT) return (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.teleport_coords')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={node.data.teleportCoords?.x ?? ''} onChange={e => updateData('teleportCoords', { ...node.data.teleportCoords, x: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="X" />
                    <input type="number" value={node.data.teleportCoords?.y ?? ''} onChange={e => updateData('teleportCoords', { ...node.data.teleportCoords, y: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="Y" />
                    <input type="number" value={node.data.teleportCoords?.z ?? ''} onChange={e => updateData('teleportCoords', { ...node.data.teleportCoords, z: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="Z" />
                    <input type="number" value={node.data.teleportCoords?.w ?? ''} onChange={e => updateData('teleportCoords', { ...node.data.teleportCoords, w: Number(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder={t('editor.coord_w_heading')} />
                  </div>
                </div>
              );

              if (node.type === NodeType.NPC_CHANGE) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.new_model')}</label>
                    <input type="text" value={node.data.newModel || ''} onChange={e => updateData('newModel', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" placeholder="a_m_y_business_01" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.new_anim_dict')}</label>
                    <input type="text" value={node.data.newAnimDict || ''} onChange={e => updateData('newAnimDict', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.new_anim_name')}</label>
                    <input type="text" value={node.data.newAnimName || ''} onChange={e => updateData('newAnimName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                </>
              );

              if (node.type === NodeType.SOUND) return (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.sound_name')}</label>
                    <input type="text" value={node.data.soundName || ''} onChange={e => updateData('soundName', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t('editor.sound_volume')}</label>
                    <input type="number" min={0} max={100} value={node.data.soundVolume ?? 50} onChange={e => updateData('soundVolume', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors" />
                  </div>
                </>
              );

              return <div className="text-[10px] text-zinc-600 italic">{t('editor.no_props')}</div>;
            })()}

            {/* Delete button */}
            <div className="pt-6 mt-2 border-t border-zinc-900">
              <button onClick={() => deleteNode(selectedNodeId)} className="w-full py-2.5 border border-zinc-800 text-zinc-600 hover:text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-md flex items-center justify-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                {t('editor.destroy_node')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CONTEXT MENU (categorized) ═══════════ */}
      {contextMenu && (
        <div
          className="fixed bg-zinc-900/95 border border-zinc-700 rounded-xl p-1.5 w-52 shadow-2xl shadow-black/50 z-[100] backdrop-blur-md overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          {NODE_CATEGORIES.map((cat, ci) => (
            <div key={cat.key}>
              <div className="px-3 py-1.5 text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">{t('editor.cat_' + cat.key)}</div>
              {cat.types.map(type => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 rounded-md transition-colors flex items-center gap-2.5 group"
                >
                  <span className={`${getNodeIconColor(type)} opacity-60 group-hover:opacity-100 transition-opacity`}>{getNodeIcon(type, 13)}</span>
                  <span className="font-medium tracking-wide">{getNodeLabel(type)}</span>
                </button>
              ))}
              {ci < NODE_CATEGORIES.length - 1 && <div className="h-px bg-zinc-800 my-1 mx-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NodeEditor;
