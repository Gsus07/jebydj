'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PatcherNode } from './PatcherNode';
import { PatcherCable } from './PatcherCable';
import { Network, Plus, Trash2 } from 'lucide-react';

interface NodeData {
  id: string;
  name: string;
  type: 'generator' | 'effect' | 'output';
  x: number;
  y: number;
}

interface Connection {
  id: string;
  fromNode: string;
  toNode: string;
}

export default function Patcher() {
  const [nodes, setNodes] = useState<NodeData[]>([
    { id: 'master', name: 'To FL Studio', type: 'output', x: 400, y: 300 },
    { id: 'sytrus', name: 'Sytrus 1', type: 'generator', x: 100, y: 100 },
    { id: 'eq', name: 'Fruity PEQ 2', type: 'effect', x: 250, y: 200 },
  ]);
  
  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', fromNode: 'sytrus', toNode: 'eq' },
    { id: 'c2', fromNode: 'eq', toNode: 'master' },
  ]);

  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  
  const [connecting, setConnecting] = useState<{ id: string, port: 'in'|'out', x: number, y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (id: string, e: React.MouseEvent) => {
    setDraggingNode(id);
  };

  const handleConnectStart = (id: string, port: 'in'|'out', e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setConnecting({ id, port, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingNode) {
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: x - 50, y: y - 15 } : n));
    }
    
    if (connecting) {
      setMousePos({ x, y });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setDraggingNode(null);
    
    if (connecting) {
      // Find node under mouse
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) { setConnecting(null); return; }
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const targetNode = nodes.find(n => 
        x >= n.x && x <= n.x + 100 &&
        y >= n.y && y <= n.y + 30
      );

      if (targetNode && targetNode.id !== connecting.id) {
        // Create connection
        const from = connecting.port === 'out' ? connecting.id : targetNode.id;
        const to = connecting.port === 'out' ? targetNode.id : connecting.id;
        
        // Prevent dupes and invalid
        if (!connections.find(c => c.fromNode === from && c.toNode === to)) {
           const fromN = nodes.find(n => n.id === from);
           const toN = nodes.find(n => n.id === to);
           if (fromN && toN && fromN.type !== 'output' && toN.type !== 'generator') {
              setConnections(prev => [...prev, { id: `c_${Date.now()}`, fromNode: from, toNode: to }]);
           }
        }
      }
      setConnecting(null);
    }
  };

  const deleteNode = (id: string) => {
    if (id === 'master') return; // Cannot delete master
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.fromNode !== id && c.toNode !== id));
  };

  const getNodeCenter = (id: string, port: 'in'|'out') => {
    const node = nodes.find(n => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x + 50, // center width
      y: node.y + (port === 'in' ? -5 : 35) // top or bottom
    };
  };

  return (
    <div className="flex flex-col h-full bg-[#111] font-rajdhani text-white select-none">
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#1a1a1a]">
        <div className="text-lg font-bold tracking-widest uppercase flex items-center gap-2 text-[#00f5ff]">
          <Network size={20} /> Patcher
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1 text-xs px-2 py-1 bg-white/5 rounded hover:bg-white/10 text-white/70">
            <Plus size={14} /> Add Plugin
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a24] to-black"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Draw Connections */}
        {connections.map(c => {
           const from = getNodeCenter(c.fromNode, 'out');
           const to = getNodeCenter(c.toNode, 'in');
           return <PatcherCable key={c.id} startX={from.x} startY={from.y} endX={to.x} endY={to.y} active={true} />;
        })}

        {/* Draw active connecting cable */}
        {connecting && (
           <PatcherCable 
             startX={connecting.port === 'out' ? getNodeCenter(connecting.id, 'out').x : mousePos.x} 
             startY={connecting.port === 'out' ? getNodeCenter(connecting.id, 'out').y : mousePos.y} 
             endX={connecting.port === 'in' ? getNodeCenter(connecting.id, 'in').x : mousePos.x} 
             endY={connecting.port === 'in' ? getNodeCenter(connecting.id, 'in').y : mousePos.y} 
             active={false} 
           />
        )}

        {/* Draw Nodes */}
        {nodes.map(n => (
          <PatcherNode 
            key={n.id} 
            {...n} 
            onDragStart={handleDragStart} 
            onConnectStart={handleConnectStart} 
          />
        ))}

        {/* Delete zone / context actions could be here */}
      </div>
    </div>
  );
}
