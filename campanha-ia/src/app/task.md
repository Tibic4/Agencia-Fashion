# Mobile UI/UX Modernization Checklist

- [x] **1. Refactor Navigation (`layout.tsx`)**
  - [x] Implement "Floating Island" Bottom Nav on Mobile (spacing, border-radius, shadow).
  - [x] Implement pill-shaped background for active icons to hide text clutter.
  - [x] Refine Mobile Header glassmorphism shadow for dark mode.
- [x] **2. Refactor Generation Grid (`gerar/page.tsx`)**
  - [x] Change base grid to `grid-cols-2` on mobile.
  - [x] Ensure cards have `active:scale-[0.98]` feedback.
  - [x] Wrap empty filter results in a premium, dashed glassmorphism card instead of plain text.
- [x] **3. Refactor Model Grid (`modelo/page.tsx`)**
  - [x] Add `active:scale-[0.98]` sensory feedback to model cards.
  - [x] Convert plain text empty state (when user has 0 models) to premium Glass Card CTA.
- [x] **4. Review**
  - [x] Verify any flash-bang scenarios are handled. do Next.js
