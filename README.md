# Nodify – Visual Knowledge Graph with AI Generation

Nodify is a Next.js application for exploring ideas and preparing debate topics as a spatial knowledge graph. Create nodes on a canvas, connect and drag them with physics, expand ideas using an AI generator, and collect arguments/counter-arguments/scripts in a right-side panel designed for creative reasoning.

<img width="3230" height="1763" alt="image" src="https://github.com/user-attachments/assets/2ce0481c-f987-4066-9594-d11a554048e3" />
<img width="3231" height="1765" alt="image" src="https://github.com/user-attachments/assets/a87f166a-6f8d-49b8-b8b9-f2f88c025ce2" />

## Features

- Visual canvas with draggable, scalable nodes and spring/repulsion physics
- Hover focus and smooth transitions; nodes shrink when not hovered
- Context menu (right-click) tools per node: expand with AI, minimize/restore, delete
- Arrowed edges that connect precisely to node rims and point child → parent
- Collector panel (same style as Info panel) with three sections:
  - Argument: main point + evidence chips (drag-and-drop)
  - Anti-Argument: main point + evidence chips (drag-and-drop)
  - Script: ordered outline chips for narrative/script generation
- Chips are solid and fully draggable; drop order determines arrangement
- Replace a main point by dropping a new chip; the old main automatically returns to the pool
- Drag outside the panel to delete: main page darkens and a trash icon appears; drop to delete
- Generate outputs using the existing API:
  - Argument (support the main with evidences)
  - Counter-argument (dispute a target claim with evidences)
  - Script (compose 2–3 paragraphs following the outline)
  - Debate (multi-side structure; optional)

## Tech Stack

- Next.js (App Router), TypeScript, React
- Tailwind CSS + custom theme utilities
- framer-motion for motion/line animations
- MUI icons and styles where helpful


## Usage Overview

### Canvas

- Click and drag nodes to move; connected nodes respond with forces
- Hover a node to enlarge; move away to shrink after a short delay
- Right-click canvas to create a new node; right-click a node for tools

### Collector Panel

- Click the “Generate” floating button to open the Collector (shares the same slot as Info)
- Pool: new selections appear as chips; drag chips into sections
- Argument / Anti-Argument: drop a chip on “Main Point” to set/replace main; drop into Evidences to add
- Script: drop chips to build an ordered outline
- Reorder by dragging within each list; drag a chip out of the panel to delete
- Old main returns to the pool when replaced

### Generation

- In each section, click Generate to call the existing `/api/generate` endpoint with a tailored prompt
  - Argument: backs main with evidences
  - Anti-Argument: rebuts and lists evidences
  - Script: follows the outline in order
- Outputs appear in the panel’s Output area; click an entry to focus

## Key Files

- `src/components/Canvas.tsx` – canvas, node physics, lines with arrowheads, hover/focus rules
- `src/components/Node.tsx` – individual node visuals/interaction
- `src/components/CompareSection.tsx` – Info panel
- `src/components/CollectorPanel.tsx` – argument/counter/script/debate chips, drag-and-drop, generation, delete overlay
- `src/app/page.tsx` – page composition, floating buttons, panel switching

## Customization

- Theme: `src/components/Themes.ts` (colors, shadows, sidebar)
- Visual sizing: `src/config/nodeVisualConfig.ts`
- Arrow markers and line width scaling handled in `Canvas.tsx`

## Accessibility & UX Notes

- Drag-and-drop uses pointer events; chips remain fully opaque during drag
- Drop indicators show insertion lines and target highlights
- Deleting via “drag-outside” shows an unmistakable full-screen trash affordance

## Development Notes

- Type-safe components; avoid `any`
- Lints must pass before commit
- Prefer early returns and small helpers for clarity

## License

MIT

---

### Prompts (Optional, for vibe coding sessions)

These are optional helper prompts used during early iterative development.

1) Starter Prompt

```
You are an expert front-end engineer. Build a Next.js/TypeScript canvas app with draggable, focusable nodes and a right-side panel. Nodes animate with framer-motion, show edges with arrowheads, and a collector panel supports drag-and-drop chips for argument/counter/script. Keep code readable, accessible, and lint-clean.
```

2) Iteration Prompt

```
Continue from the current codebase goals:
1) Keep canvas physics stable and responsive
2) Ensure edges connect to node rims and point child → parent
3) Collector supports drag-and-drop, replace main returns old main to pool, drag-outside deletes
4) Generation prompts call /api/generate; render outputs
Preserve existing styling and props. Do not regress lints.
```

3) Rules Prompt

```
- Do not run project-wide shell commands except npm install when needed
- Look up latest package APIs when unsure
- Do not use git operations; focus on code edits
- Always fix lint errors before finishing
```
