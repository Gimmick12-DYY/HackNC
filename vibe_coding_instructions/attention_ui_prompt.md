## 🧭 Prompt for Codex: Attention-based Node Scaling and UI Layer

You are a senior front-end developer working on a Next.js + Tailwind + MUI + React Flow–style app called **"Nodify"**.  
Currently, nodes dynamically size based on their level distance (depth) from a focused node, but we will now upgrade the UI interaction and introduce an **Attention System**.

---

### 🔧 GOAL
Implement a new *attention-based visualization system* that smoothly adjusts node size, text content, and color according to how far each node is from the currently focused node.  
When the user clicks or hovers on a node, that node becomes the focus, and all other nodes will rerender and animate in real-time according to this rule.

---

### 🧩 FEATURE SPECIFICATION

#### 1. Create a new file: `/components/Attention.tsx`
Handles:
- Tracking the *focused node ID*
- Computing *distance from focus node* for every node
- Managing smooth animated transitions for size & text level
- Exporting hooks or context so Node components can subscribe and update

Use a shared state (React Context or Zustand) to store:

```ts
interface AttentionState {
  focusedNodeId: string | null;
  distances: Record<string, number>; // nodeId -> distance
  setFocusedNode: (id: string | null) => void;
  recomputeDistances: (graph: NodeGraph, focusId: string) => void;
}
```

Distance can be computed from the adjacency list of the current graph.

---

#### 2. Modify `/components/Node.tsx`
- Add a new prop: `distance?: number` (default = Infinity)
- Use distance to compute:
  - **size (radius, font, border)** based on config
  - **displayed text content** (full → phrase → word → emoji → none)
  - **color** based on category from color profile

Each node should smoothly transition its radius and text using Framer Motion or CSS transitions:

```jsx
<motion.div
  animate={{ scale: computedScale(distance) }}
  transition={{ duration: 0.25, ease: "easeOut" }}
>
```

When a node is clicked or hovered, it calls:

```ts
setFocusedNode(node.id);
```

---

#### 3. Add a global config file: `/config/nodeVisualConfig.ts`

```ts
export const NodeVisualConfig = {
  SIZE_LEVELS: {
    0: 80,    // focused node size
    1: 55,    // 1st level away
    2: 35,    // 2nd level away
    3: 20,    // 3rd level away
    SMALLEST_SIZE: 5,  // beyond level 3
  },
  CONTENT_LEVELS: {
    0: "full",      // full content
    1: "phrase",    // 2-3 phrase summary
    2: "short",     // one word or emoji
    3: "emoji",
    default: "none",
  },
  COLOR_PROFILES: {
    idea: "#6C63FF",
    argument: "#FF6584",
    counter: "#00BFA6",
    reference: "#FDCB6E",
    analogy: "#E17055",
  },
  TRANSITION: {
    duration: 0.25,
    ease: "easeInOut",
  },
};
```

---

#### 4. Modify color and content parsing
Each node has a `type` field (idea, argument, reference, etc.).  
Create helpers:

```ts
import { NodeVisualConfig } from "@/config/nodeVisualConfig";

export const getNodeColor = (type: string) =>
  NodeVisualConfig.COLOR_PROFILES[type] || "#CCCCCC";
```

and

```ts
export const getDisplayContent = (node, distance) => {
  const level = NodeVisualConfig.CONTENT_LEVELS[distance] ?? "none";
  return node[level] ?? "";
};
```

---

#### 5. Update LLM generation logic
When generating node data from the LLM, the API now returns multi-level summaries:

```json
{
  "full": "Dogs are loyal and emotionally intuitive animals.",
  "phrase": "Loyal companions, strong empathy",
  "short": "Loyal 🐶",
  "emoji": "🐕",
  "type": "idea"
}
```

Store these in the node object:

```ts
interface NodeData {
  id: string;
  level: number;
  type: string;
  full: string;
  phrase?: string;
  short?: string;
  emoji?: string;
}
```

When rendering, use `getDisplayContent(node, distance)` to select what to show.

---

### ✨ INTERACTION LOGIC

1. When user **clicks or hovers** a node:
   - Update global `focusedNodeId`.
   - Recompute distance for all nodes.
   - Animate transitions for all nodes (size, text, color).

2. Animation must be **smooth**, real-time (<250 ms).

3. All parameters (sizes, durations, colors) are easily tunable in `/config/nodeVisualConfig.ts`.

---

### ⚙️ DELIVERY CHECKLIST

✅ `/components/Attention.tsx` — attention and distance logic  
✅ `/components/Node.tsx` — supports distance-based rendering  
✅ `/config/nodeVisualConfig.ts` — centralized visual configuration  
✅ `/utils/getNodeColor.ts` & `/utils/getDisplayContent.ts` — rendering helpers  
✅ Update LLM response format to include multi-level text fields

---

### 💡 EXTRA NOTES
- Use GPU-friendly transitions (`transform: scale`, `opacity`).
- Sync color and text transitions with size.
- Handle rapid focus shifts gracefully.

---

### 🧱 NEXT ITERATION (Edge Cases)
In the next version, Codex should:
1. Handle multiple simultaneous hovers (prioritize most recent focus).
2. Add fallback if some LLM summaries are missing.
3. Support light/dark color profiles.
4. Maintain transition stability when zooming or dragging the canvas.

---

Now write the **full working implementation** for all affected files in React + TypeScript, following this specification exactly.