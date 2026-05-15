
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectData, NodeType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface GameSimulatorProps {
  project: ProjectData;
}

type GameMemory = Record<string, string | number | boolean>;

const GameSimulator: React.FC<GameSimulatorProps> = ({ project }) => {
  const { t } = useLanguage();
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isInteractionActive, setIsInteractionActive] = useState(false);
  
  const [hasStarted, setHasStarted] = useState(false);
  const memoryRef = useRef<GameMemory>({ honor_level: 55 });

  const currentNode = project.nodes.find(n => n.id === currentNodeId);

  // --- Logic Engine ---
  
  const traverseLogic = useCallback((startNodeId: string): string | null => {
    let currentId = startNodeId;
    let safetyCounter = 0;

    while (safetyCounter < 100) {
        safetyCounter++;
        const node = project.nodes.find(n => n.id === currentId);
        if (!node) return null;

        if (node.type === NodeType.DIALOGUE || node.type === NodeType.END) {
            return node.id;
        }

        if (node.type === NodeType.SET_VARIABLE) {
            if (node.data.variableName) {
                memoryRef.current[node.data.variableName] = node.data.variableValue || "";
                console.log(`[SIM] Set ${node.data.variableName} = ${node.data.variableValue}`);
            }
            const conn = project.connections.find(c => c.fromNodeId === node.id);
            if (!conn) return null;
            currentId = conn.toNodeId;
            continue;
        }

        if (node.type === NodeType.CONDITION) {
            const valA = memoryRef.current[node.data.variableName || ""]?.toString() || "";
            const valB = node.data.variableValue || "";
            let result = false;

            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            const isNumeric = !isNaN(numA) && !isNaN(numB);

            switch(node.data.conditionOperator) {
                case '==': result = valA == valB; break;
                case '!=': result = valA != valB; break;
                case '>': result = isNumeric ? numA > numB : false; break;
                case '<': result = isNumeric ? numA < numB : false; break;
                case '>=': result = isNumeric ? numA >= numB : false; break;
                case '<=': result = isNumeric ? numA <= numB : false; break;
            }
            
            console.log(`[SIM] Condition: ${valA} ${node.data.conditionOperator} ${valB} = ${result}`);

            const conn = project.connections.find(c => c.fromNodeId === node.id && c.fromPort === (result ? 'true' : 'false'));
            if (!conn) return null;
            currentId = conn.toNodeId;
            continue;
        }

        if (node.type === NodeType.START || node.type === NodeType.EVENT) {
             const conn = project.connections.find(c => c.fromNodeId === node.id);
             if (!conn) return null;
             currentId = conn.toNodeId;
             continue;
        }

        return null;
    }
    return null;
  }, [project]);

  // --- Interaction Handlers ---

  const startSimulation = () => {
      const startNode = project.nodes.find(n => n.type === NodeType.START);
      if (!startNode) {
          alert(t('simulator.no_start_node'));
          return;
      }
      
      memoryRef.current = { honor_level: 55 };
      setHasStarted(true);
      setIsInteractionActive(true);

      const nextId = traverseLogic(startNode.id);
      if (nextId) setCurrentNodeId(nextId);
  };

  const handleChoice = useCallback((nextNodeId: string | null) => {
    if (isTyping || !nextNodeId) return;
    
    const actualNextId = traverseLogic(nextNodeId);
    
    if (actualNextId) {
        const nextNode = project.nodes.find(n => n.id === actualNextId);
        if (nextNode?.type === NodeType.END) {
            setIsInteractionActive(false);
            setHasStarted(false);
            return;
        }
        setCurrentNodeId(actualNextId);
        setHoveredIndex(null);
    } else {
        setIsInteractionActive(false);
        setHasStarted(false);
    }
  }, [isTyping, traverseLogic, project.nodes]);

  useEffect(() => {
    if (currentNode?.type === NodeType.DIALOGUE && currentNode?.data.text && isInteractionActive) {
      setIsTyping(true);
      setDisplayText('');
      let i = 0;
      const fullText = currentNode.data.text;
      
      const interval = setInterval(() => {
        setDisplayText(prev => fullText.substring(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 20);

      return () => clearInterval(interval);
    }
  }, [currentNodeId, isInteractionActive, currentNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInteractionActive) {
        if (e.key.toLowerCase() === 'e') startSimulation();
        return;
      }
      if (isTyping) return;
      const choicesCount = currentNode?.data.choices?.length || 0;

      if (e.key === 'ArrowDown') {
        setHoveredIndex(prev => prev === null ? 0 : (prev + 1) % choicesCount);
      } else if (e.key === 'ArrowUp') {
        setHoveredIndex(prev => prev === null ? choicesCount - 1 : (prev - 1 + choicesCount) % choicesCount);
      } else if (e.key === 'Enter') {
        if (hoveredIndex !== null) {
          const selectedChoice = currentNode?.data.choices?.[hoveredIndex];
          if (selectedChoice) handleChoice(selectedChoice.nextNodeId);
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx < choicesCount) {
          const choice = currentNode?.data.choices?.[idx];
          if (choice) handleChoice(choice.nextNodeId);
        }
      } else if (e.key === 'Escape') {
        setIsInteractionActive(false);
        setHasStarted(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractionActive, isTyping, currentNode, hoveredIndex, handleChoice]);

  if (!isInteractionActive) {
    return (
      <div className="w-full h-full relative bg-zinc-950 flex items-center justify-center group cursor-pointer" onClick={startSimulation}>
        <img 
          src="https://images.unsplash.com/photo-1626379616459-b2ce1d9decbb?q=80&w=1920&auto=format&fit=crop" 
          alt="Technical Scene" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 contrast-125 saturate-0 transition-opacity group-hover:opacity-30"
        />
        <div className="z-10 text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
             <div className="w-[1px] h-24 bg-zinc-800"></div>
             <div className="w-12 h-12 border-2 border-zinc-100 flex items-center justify-center animate-bounce bg-black">
                <span className="text-zinc-100 font-black text-sm">E</span>
             </div>
          </div>
          <p className="text-zinc-400 font-bold tracking-[0.5em] text-[10px] uppercase group-hover:text-zinc-100 transition-colors">{t('simulator.start')}</p>
        </div>
      </div>
    );
  }

  const ACCENT_COLOR = '#7048e8';

  return (
    <div className="w-full h-full relative bg-zinc-950 overflow-hidden flex flex-col justify-end">
       <img 
          src="https://images.unsplash.com/photo-1626379616459-b2ce1d9decbb?q=80&w=1920&auto=format&fit=crop" 
          alt="Scene" 
          className="absolute inset-0 w-full h-full object-cover opacity-10 saturate-0 scale-110"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>

        {/* Dialogue Interface */}
        <div className="relative z-20 w-full max-w-xl mx-auto px-6 flex flex-col gap-6" style={{ paddingBottom: '5rem', fontFamily: "'Poppins', sans-serif" }}>
           
           {/* NPC Name */}
           <div className="flex flex-row gap-4 items-center">
             <h1 className="text-2xl font-bold text-white drop-shadow-md" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' }}>
               {currentNode?.data.npcName || t('simulator.system')}
             </h1>
           </div>

           {/* Divider */}
           <div className="w-1/3 h-[1px] rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}></div>

           {/* Dialogue Text */}
           <div>
             <p className="text-lg font-bold text-white drop-shadow-md" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' }}>
               {displayText}
               {isTyping && <span className="w-1 h-5 bg-white ml-1 inline-block animate-pulse"></span>}
             </p>
           </div>

           {/* Choices Grid */}
           {currentNode?.data.choices && currentNode.data.choices.length > 0 && (
             <div className={`grid grid-cols-2 gap-3 transition-all duration-700 ${isTyping ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
               {currentNode.data.choices.map((choice, idx) => (
                 <button
                   key={choice.id}
                   onClick={() => handleChoice(choice.nextNodeId)}
                   onMouseEnter={() => setHoveredIndex(idx)}
                   onMouseLeave={() => setHoveredIndex(null)}
                   className="py-3 px-4 rounded-sm font-bold text-sm transition-all duration-200 shadow-sm"
                   style={{
                     backgroundColor: hoveredIndex === idx ? ACCENT_COLOR : 'white',
                     color: hoveredIndex === idx ? 'white' : 'black',
                   }}
                 >
                   {choice.text}
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Debug Memory Overlay */}
        <div className="absolute top-12 right-12 text-right">
             <div className="bg-zinc-900/80 p-4 border border-zinc-800 rounded-sm">
                 <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-2">{t('simulator.memory_debug')}</p>
                 <pre className="text-[10px] text-zinc-400 font-mono">
                     {JSON.stringify(memoryRef.current, null, 2)}
                 </pre>
             </div>
        </div>
    </div>
  );
};

export default GameSimulator;
