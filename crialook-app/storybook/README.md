# Storybook (web)

Web preview of the same `Button`, `Input`, `Card`, `Skeleton` components used in the app, plus brand color tokens. Renders the React Native components through `react-native-web`.

## Why both this and `/__catalog`?
- **`/__catalog` (in-app)** — fastest dev loop while building. Open the dev menu, navigate to it, see the components on the actual device.
- **Storybook (this folder)** — designer review without a device. Build to static HTML and host on Vercel/Netlify/S3 so the design team can scrub through every state in a browser.

Both reference the **same component source files** under `components/ui/`. There's no fork.

## Run
```bash
cd crialook-app
npm run storybook         # http://localhost:6006
npm run storybook:build   # writes storybook-static/
```

## How the web shims work
React Native modules used by our UI primitives that don't have a web equivalent are aliased to local shims at `storybook/shims/*`:

- `expo-haptics` → no-ops (haptics aren't a thing in browsers)
- `expo-linear-gradient` → CSS `linear-gradient` div
- `expo-blur` → CSS `backdrop-filter`
- `expo-image` → plain `<img>`
- `react-native-reanimated` → strips `entering`/`exiting` props, returns plain RN components

Aliases live in `.storybook/main.ts` under `viteFinal`. If you add a new component that imports a native module not yet shimmed, add an alias and a tiny shim file there.

## Adding a story
Drop a `*.stories.tsx` in `storybook/stories/`. Use the CSF format:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../components/ui/Button';

const meta: Meta<typeof Button> = { title: 'UI/Button', component: Button };
export default meta;

type Story = StoryObj<typeof Button>;
export const Primary: Story = { args: { title: 'Click me', onPress: () => {} } };
```

## Limits
- Stories that need real native APIs (camera, secure store, push) won't work here — keep those in `/__catalog`.
- The Inter font isn't bundled; Storybook falls back to system Inter or sans-serif. That's intentional — designers reviewing layout don't need the exact font load.
