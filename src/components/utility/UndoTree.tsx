'use client';

import React, { useEffect } from 'react';
import { useUndoTreeStore } from '@/src/store/useUndoTreeStore';
import { useDAWStore } from '@/src/store/useDAWStore';
import { FloatingWindow } from './FloatingWindow';
import { History, Undo2, Redo2 } from 'lucide-react';

export function UndoTree({ onClose }: { onClose: () => void }) {
  const { nodes, currentNodeId, rootNodeId, jumpTo, undo, redo } = useUndoTreeStore();
  const dawStore = useDAWStore();

  const handleJump = (id: string) => {
    const state = jumpTo(id);
    if (state) {
       // Deep merge state to restore DAW (very complex in reality, simple JSON parse here)
       try {
         const parsed = JSON.parse(state);
         useDAWStore.setState(parsed);
       } catch (e) {
         console.error('Failed to restore state', e);
       }
    }
  };

  const renderNode = (id: string, depth = 0) => {
    const node = nodes[id];
    if (!node) return null;
    
    const isCurrent = id === currentNodeId;
    
    return (
      <div key={id} className="flex flex-col">
        <div 
          className={`flex items-center gap-2 py-1 px-2 cursor-pointer transition-colors text-xs font-rajdhani rounded ${isCurrent ? 'bg-white/20 font-bold text-white' : 'hover:bg-white/5 text-white/70'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleJump(id)}
        >
          <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-[#00f5ff] shadow-[0_0_5px_#00f5ff]' : 'bg-white/30'}`} />
          {node.message} <span className="text-[9px] text-white/30 ml-auto">{new Date(node.timestamp).toLocaleTimeString()}</span>
        </div>
        {node.children.map(childId => renderNode(childId, depth + 1))}
      </div>
    );
  };

  return (
    <FloatingWindow title="History" icon={<History size={14} />} onClose={onClose} initialW={250} initialH={350} initialX={20} initialY={40}>
       <div className="flex flex-col h-full bg-[#111]">
         
         <div className="flex gap-1 p-2 border-b border-white/10 bg-[#1a1a1a]">
           <button 
             className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded flex justify-center items-center text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
             onClick={() => {
                const s = undo();
                if (s) useDAWStore.setState(JSON.parse(s));
             }}
             disabled={!currentNodeId || !nodes[currentNodeId]?.parentId}
           >
             <Undo2 size={14} />
           </button>
           <button 
             className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded flex justify-center items-center text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
             onClick={() => {
                const s = redo();
                if (s) useDAWStore.setState(JSON.parse(s));
             }}
             disabled={!currentNodeId || nodes[currentNodeId]?.children.length === 0}
           >
             <Redo2 size={14} />
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-2">
           {rootNodeId ? renderNode(rootNodeId) : <div className="text-xs text-white/40 p-4 text-center">No history yet</div>}
         </div>

       </div>
    </FloatingWindow>
  );
}
