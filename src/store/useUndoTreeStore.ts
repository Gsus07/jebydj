import { create } from 'zustand';

export interface UndoNode {
  id: string;
  parentId: string | null;
  message: string;
  stateSnapshot: string; // Serialized state of the DAW
  timestamp: number;
  children: string[]; // IDs of child nodes (branches)
}

interface UndoTreeState {
  nodes: Record<string, UndoNode>;
  currentNodeId: string | null;
  rootNodeId: string | null;
  
  // Actions
  addState: (message: string, snapshot: string) => void;
  undo: () => string | null; // Returns snapshot to restore
  redo: (childId?: string) => string | null; // Defaults to last added child branch
  jumpTo: (nodeId: string) => string | null;
}

export const useUndoTreeStore = create<UndoTreeState>((set, get) => ({
  nodes: {},
  currentNodeId: null,
  rootNodeId: null,

  addState: (message: string, snapshot: string) => {
    const { nodes, currentNodeId } = get();
    const id = `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNode: UndoNode = {
      id,
      parentId: currentNodeId,
      message,
      stateSnapshot: snapshot,
      timestamp: Date.now(),
      children: [],
    };

    const newNodes = { ...nodes, [id]: newNode };
    
    if (currentNodeId) {
      newNodes[currentNodeId] = {
        ...newNodes[currentNodeId],
        children: [...newNodes[currentNodeId].children, id],
      };
    }

    set({
      nodes: newNodes,
      currentNodeId: id,
      rootNodeId: get().rootNodeId || id,
    });
  },

  undo: () => {
    const { nodes, currentNodeId } = get();
    if (!currentNodeId) return null;
    
    const current = nodes[currentNodeId];
    if (!current.parentId) return null; // Can't undo past root
    
    set({ currentNodeId: current.parentId });
    return nodes[current.parentId].stateSnapshot;
  },

  redo: (childId?: string) => {
    const { nodes, currentNodeId } = get();
    if (!currentNodeId) return null;
    
    const current = nodes[currentNodeId];
    if (current.children.length === 0) return null; // Nothing to redo
    
    // Pick specific branch or latest branch
    const targetId = childId || current.children[current.children.length - 1];
    
    set({ currentNodeId: targetId });
    return nodes[targetId].stateSnapshot;
  },

  jumpTo: (nodeId: string) => {
    const { nodes } = get();
    if (!nodes[nodeId]) return null;
    
    set({ currentNodeId: nodeId });
    return nodes[nodeId].stateSnapshot;
  }
}));
