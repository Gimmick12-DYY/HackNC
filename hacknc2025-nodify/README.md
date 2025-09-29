This is a Next.js + TailwindCSS + MUI + OpenRouter demo for a minimal canvas that spawns nodes and expands them via AI.

## Getting Started

1) Create an `.env.local` in this folder:

```
OPENROUTER_API_KEY=your_key_here
# Optional (shows up in OpenRouter dashboard)
OPENROUTER_REFERRER=http://localhost:3000
OPENROUTER_TITLE=Nodify Canvas
# Optional model override
# OPENROUTER_MODEL=openai/gpt-4o-mini
```

2) Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and click anywhere to add a node. Type text and press Enter (or click the sparkle) to generate subnodes via OpenRouter.

- Use the settings button (top right) to adjust node count, phrase length, and temperature.
- Drag nodes to reposition; lines connect parents to children.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
