import React, { useState, useEffect, useRef } from 'react';

type RuntimeChoice = {
  id: string;
  text: string;
};

type RuntimeDialogueData = {
  projectId: string;
  nodeId: string;
  name?: string;
  text?: string;
  choices?: RuntimeChoice[];
};

type Props = {
  data: RuntimeDialogueData;
  onSelectChoice: (choiceId: string) => void;
  onCancel: () => void;
};

const ACCENT_COLOR = '#7048e8';

const RuntimeDialogue: React.FC<Props> = ({ data, onSelectChoice, onCancel }) => {
  const choices = data.choices ?? [];
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const prevNodeIdRef = useRef(data.nodeId);

  // Reset typing state synchronously when node changes to prevent flash
  if (data.nodeId !== prevNodeIdRef.current) {
    prevNodeIdRef.current = data.nodeId;
    if (!isTyping) setIsTyping(true);
  }

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullTextRef = useRef('');

  // Typing effect
  useEffect(() => {
    if (data.text) {
      setIsTyping(true);
      setDisplayText('');
      fullTextRef.current = data.text;
      let i = 0;
      const fullText = data.text;
      
      const interval = setInterval(() => {
        setDisplayText(prev => fullText.substring(0, i + 1));
        i++;
        if (i >= fullText.length) {
          clearInterval(interval);
          intervalRef.current = null;
          setIsTyping(false);
        }
      }, 30);

      intervalRef.current = interval;
      return () => { clearInterval(interval); intervalRef.current = null; };
    }
  }, [data.text, data.nodeId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space skips typing animation
      if (e.key === ' ' && isTyping) {
        e.preventDefault();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setDisplayText(fullTextRef.current);
        setIsTyping(false);
        return;
      }

      if (isTyping) return;
      
      const choicesCount = choices.length;
      if (choicesCount === 0) return;

      if (e.key === 'ArrowDown') {
        setHoveredIndex(prev => prev === null ? 0 : (prev + 1) % choicesCount);
      } else if (e.key === 'ArrowUp') {
        setHoveredIndex(prev => prev === null ? choicesCount - 1 : (prev - 1 + choicesCount) % choicesCount);
      } else if (e.key === 'Enter') {
        if (hoveredIndex !== null) {
          const selectedChoice = choices[hoveredIndex];
          if (selectedChoice) onSelectChoice(selectedChoice.id);
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (idx < choicesCount) {
          const choice = choices[idx];
          if (choice) onSelectChoice(choice.id);
        }
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTyping, choices, hoveredIndex, onSelectChoice, onCancel]);

  return (
    <div className="fixed inset-0 z-[999] flex flex-col justify-end items-center pointer-events-none" style={{ paddingBottom: '5rem', userSelect: 'none' }}>

      <div className="w-full flex flex-col gap-6 pointer-events-auto" style={{ maxWidth: '540px', padding: '0 1.5rem', fontFamily: "'Poppins', sans-serif" }}>

        {/* NPC Name */}
        <div className="flex flex-row gap-4 items-center">
          <h1 className="text-2xl font-bold text-white drop-shadow-md" style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)' }}>
            {data.name || 'NPC'}
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
        {choices.length > 0 && (
          <div
            key={data.nodeId}
            className="grid grid-cols-2 gap-3"
            style={isTyping
              ? { opacity: 0, transform: 'translateY(1rem)', visibility: 'hidden' }
              : { opacity: 1, transform: 'translateY(0)', transition: 'opacity 0.7s, transform 0.7s' }
            }
          >
            {choices.map((choice, idx) => (
              <button
                key={choice.id}
                onClick={() => onSelectChoice(choice.id)}
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
    </div>
  );
};

export default RuntimeDialogue;
