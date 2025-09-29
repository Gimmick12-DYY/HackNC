You are a coding assistant helping me build a Next.js + TailwindCSS + MUI + OpenRouter project.  
Goal: A blank canvas page where clicking inside the container spawns a new "node" (like Obsidian).  
- Each node can contain text input.  
- When a node is created, immediately call an LLM (via OpenRouter API) with a prompt based on the node’s content.  
- The LLM generates N subnodes (parameters: number of nodes, length of phrases, temperature) connected to the parent.  
- Subnodes appear visually as linked smaller nodes around the parent.  
- User can further click any node to expand again in the same way.  
- Provide a retractable dashboard to control parameters: phrase length, node count, temperature.  

Please scaffold:  
1. React components for Canvas, Node, SubNode, Dashboard.  
2. State management for nodes (id, text, parentId, children[]).  
3. Integration with OpenRouter (fetch call).  
4. Tailwind + MUI styling together cleanly (no conflicts).  
5. Initial minimal working example.  
6. Be elegant and do not use ugly colors. Try to be matched up with state-of-art industrailized products.

Do not overcomplicate — just make the base working.  
