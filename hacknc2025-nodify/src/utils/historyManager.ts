/**
 * 历史记录管理器
 * 用于实现撤销（Undo）和重做（Redo）功能
 */

import { NodeItem } from "@/components/types";

// 历史记录操作类型
export type HistoryAction =
  | {
      type: "CREATE_NODE";
      nodeId: string;
      nodeData: NodeItem;
    }
  | {
      type: "DELETE_NODE";
      nodeId: string;
      nodeData: NodeItem;
      connectedEdges: Array<[string, string]>; // 被删除节点相关的所有边
    }
  | {
      type: "MOVE_NODE";
      nodeId: string;
      oldX: number;
      oldY: number;
      newX: number;
      newY: number;
    }
  | {
      type: "CONNECT_NODES";
      parentId: string;
      childId: string;
    }
  | {
      type: "DISCONNECT_NODES";
      parentId: string;
      childId: string;
    }
  | {
      type: "EXPAND_NODE";
      parentId: string;
      newNodes: Array<{ id: string; data: NodeItem }>;
      newEdges: Array<[string, string]>;
    }
  | {
      type: "UPDATE_NODE_TEXT";
      nodeId: string;
      oldText: string;
      newText: string;
      oldFull?: string;
      newFull?: string;
    }
  | {
      type: "BATCH";
      actions: HistoryAction[];
      description?: string;
    }
  | {
      type: "DELETE_MULTIPLE_NODES";
      deletedNodes: Array<{ id: string; data: NodeItem }>;
      deletedEdges: Array<[string, string]>;
    };

export interface HistoryManager {
  past: HistoryAction[];
  future: HistoryAction[];
  maxHistorySize: number;
}

/**
 * 创建新的历史记录管理器
 */
export function createHistoryManager(maxHistorySize: number = 50): HistoryManager {
  return {
    past: [],
    future: [],
    maxHistorySize,
  };
}

/**
 * 记录一个新操作
 */
export function recordAction(
  manager: HistoryManager,
  action: HistoryAction
): HistoryManager {
  const newPast = [...manager.past, action];
  
  // 限制历史记录大小
  if (newPast.length > manager.maxHistorySize) {
    newPast.shift();
  }

  return {
    ...manager,
    past: newPast,
    future: [], // 新操作会清空重做栈
  };
}

/**
 * 撤销操作
 */
export function undo(manager: HistoryManager): {
  manager: HistoryManager;
  action: HistoryAction | null;
} {
  if (manager.past.length === 0) {
    return { manager, action: null };
  }

  const action = manager.past[manager.past.length - 1];
  const newPast = manager.past.slice(0, -1);
  const newFuture = [...manager.future, action];

  return {
    manager: {
      ...manager,
      past: newPast,
      future: newFuture,
    },
    action,
  };
}

/**
 * 重做操作
 */
export function redo(manager: HistoryManager): {
  manager: HistoryManager;
  action: HistoryAction | null;
} {
  if (manager.future.length === 0) {
    return { manager, action: null };
  }

  const action = manager.future[manager.future.length - 1];
  const newFuture = manager.future.slice(0, -1);
  const newPast = [...manager.past, action];

  return {
    manager: {
      ...manager,
      past: newPast,
      future: newFuture,
    },
    action,
  };
}

/**
 * 清空历史记录
 */
export function clearHistory(manager: HistoryManager): HistoryManager {
  return {
    ...manager,
    past: [],
    future: [],
  };
}

/**
 * 获取反向操作（用于撤销）
 */
export function getInverseAction(action: HistoryAction): HistoryAction | HistoryAction[] {
  switch (action.type) {
    case "CREATE_NODE":
      return {
        type: "DELETE_NODE",
        nodeId: action.nodeId,
        nodeData: action.nodeData,
        connectedEdges: [],
      };

    case "DELETE_NODE":
      // 删除节点的反向操作：先创建节点，再恢复所有连接的边
      if (action.connectedEdges.length === 0) {
        return {
          type: "CREATE_NODE",
          nodeId: action.nodeId,
          nodeData: action.nodeData,
        };
      }
      return {
        type: "BATCH",
        actions: [
          {
            type: "CREATE_NODE",
            nodeId: action.nodeId,
            nodeData: action.nodeData,
          },
          ...action.connectedEdges.map(
            ([parent, child]): HistoryAction => ({
              type: "CONNECT_NODES",
              parentId: parent,
              childId: child,
            })
          ),
        ],
      };

    case "MOVE_NODE":
      return {
        type: "MOVE_NODE",
        nodeId: action.nodeId,
        oldX: action.newX,
        oldY: action.newY,
        newX: action.oldX,
        newY: action.oldY,
      };

    case "CONNECT_NODES":
      return {
        type: "DISCONNECT_NODES",
        parentId: action.parentId,
        childId: action.childId,
      };

    case "DISCONNECT_NODES":
      return {
        type: "CONNECT_NODES",
        parentId: action.parentId,
        childId: action.childId,
      };

    case "EXPAND_NODE":
      // 扩展的反向操作是删除所有新创建的节点
      return {
        type: "DELETE_MULTIPLE_NODES",
        deletedNodes: action.newNodes,
        deletedEdges: action.newEdges,
      };

    case "UPDATE_NODE_TEXT":
      return {
        type: "UPDATE_NODE_TEXT",
        nodeId: action.nodeId,
        oldText: action.newText,
        newText: action.oldText,
        oldFull: action.newFull,
        newFull: action.oldFull,
      };

    case "BATCH":
      // 批量操作的反向是反向所有子操作并倒序执行
      return {
        type: "BATCH",
        actions: action.actions
          .map(getInverseAction)
          .flat()
          .reverse(),
        description: action.description,
      };

    case "DELETE_MULTIPLE_NODES":
      // 删除多个节点的反向是创建这些节点
      return {
        type: "BATCH",
        actions: [
          ...action.deletedNodes.map(
            (node): HistoryAction => ({
              type: "CREATE_NODE",
              nodeId: node.id,
              nodeData: node.data,
            })
          ),
          ...action.deletedEdges.map(
            ([parent, child]): HistoryAction => ({
              type: "CONNECT_NODES",
              parentId: parent,
              childId: child,
            })
          ),
        ],
      };

    default:
      return action;
  }
}

/**
 * 检查是否可以撤销
 */
export function canUndo(manager: HistoryManager): boolean {
  return manager.past.length > 0;
}

/**
 * 检查是否可以重做
 */
export function canRedo(manager: HistoryManager): boolean {
  return manager.future.length > 0;
}

/**
 * 获取历史记录统计信息
 */
export function getHistoryStats(manager: HistoryManager) {
  return {
    pastCount: manager.past.length,
    futureCount: manager.future.length,
    canUndo: canUndo(manager),
    canRedo: canRedo(manager),
  };
}
