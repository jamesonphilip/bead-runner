# CLAUDE.md — Bead Runner

Bead Runner is a React Native / Expo educational welding simulator. Players drag a virtual welding torch across a metal joint, managing arc length, travel speed, and amperage to deposit a quality weld bead. The game has 5 progressive levels, real-time physics, gesture control, and a scoring/defect-detection system.

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Runtime | React Native + Expo SDK | 0.81.4 / 54 |
| Routing | expo-router (file-based) | 5 |
| State | Zustand | 5 |
| Gestures | react-native-gesture-handler | 2.28 |
| Graphics | @shopify/react-native-skia | 2.2.12 |
| Haptics | expo-haptics | 15.0.8 |
| Language | TypeScript (strict) | 5.9.2 |

---

## Project Structure

```
bead-runner/
├── app/                     # Expo Router screens (file-based routes)
│   ├── _layout.tsx          # Root layout — GestureHandlerRootView wrapper
│   ├── index.tsx            # Main menu / job board (level selection)
│   └── game/[levelId].tsx   # Game screen (dynamic route per level)
├── components/              # React Native UI components
│   ├── AmperageSlider.tsx   # +/- amperage control buttons
│   ├── BrushingCanvas.tsx   # Post-weld wire brush mini-game
│   ├── ElectrodeSelector.tsx# Electrode/wire type selection UI
│   ├── ReportCard.tsx       # Post-game score breakdown display
│   ├── TorchGesture.tsx     # Pan gesture handler for torch movement
│   └── WeldCanvas.tsx       # Main visual renderer (plates, rod, arc, bead)
├── systems/                 # Pure game logic (no React)
│   ├── beadRenderer.ts      # Bead width calculation and color mapping
│   ├── defectDetector.ts    # 6 defect type detection logic
│   ├── heatSimulation.ts    # Gaussian heat spread + cooling simulation
│   └── scoring.ts           # 5-component weighted score calculation
├── store/
│   └── gameStore.ts         # Zustand store — all game state + actions
├── data/                    # Static game configuration (no runtime mutation)
│   ├── electrodes.ts        # 6 electrode types with amperage ranges
│   ├── levels.ts            # 5 level configs with difficulty + physics params
│   └── metals.ts            # 5 metal types with thermal properties
├── assets/                  # App icons and splash screen images
├── index.ts                 # Expo entry point (registerRootComponent)
├── App.tsx                  # Placeholder root component
├── app.json                 # Expo SDK / build config
├── tsconfig.json            # TypeScript strict mode config
└── babel.config.js          # Babel preset-expo config
```

---

## Running the App

```bash
npm install
npx expo start          # Opens Expo Dev Tools — scan QR with Expo Go
npx expo start --android
npx expo start --ios
npx expo start --web
```

No backend or environment variables are required. The app is fully offline.

### No Tests

There is no test framework configured. There are no `*.test.ts` or `*.spec.ts` files and no test scripts in `package.json`. If adding tests, use Jest + React Native Testing Library.

### No CI/CD

No GitHub Actions or other CI pipeline exists. Manual testing via the Expo Go app or simulator is the only test mechanism.

---

## Architecture

### Routing

Expo Router (file-based). Two screens:
- `app/index.tsx` — job board listing all 5 levels with lock/unlock state
- `app/game/[levelId].tsx` — game screen, receives `levelId` as route param

### State Management

All mutable game state lives in the Zustand store (`store/gameStore.ts`). Components read from and write to the store via `useGameStore()`. Key state slices:

- `torchX`, `torchY` — torch position on canvas
- `arcLength` — normalized arc gap (0–1; ideal ~0.3–0.6)
- `travelSpeed` — px/s derived from gesture velocity
- `amperage` — set by player in setup phase
- `beadSegments` — array of deposited weld bead points
- `defects` — array of detected defects with type, position, severity
- `heatMap` — 2D array of heat values across the joint
- `completedLevels` — record of best scores (session-only, not persisted)

### Game Loop (Physics Tick)

The game screen runs a `setInterval` at 50ms (20 FPS) in a `useEffect`:

1. **Heat simulation** — Gaussian spread from torch, conduction, passive cooling
2. **Arc length** — Computed from visual distance between rod tip and joint
3. **Travel speed** — Derived from gesture pan velocity
4. **Bead deposition** — New segment added if moving >0.5px and arc is live
5. **Defect detection** — Rate-limited to once per 800ms, checks 6 defect types
6. **Joint progress** — Tracks coverage %; auto-completes weld at 97%

### Game Phases

```
setup → welding → brushing → report
```

- **setup**: Player adjusts amperage and selects electrode; "STRIKE ARC" button starts welding
- **welding**: Physics tick runs; player drags torch; weld deposits until joint is covered
- **brushing**: Wire brush mini-game clears slag from bead surface
- **report**: `ReportCard` displays score breakdown and defects found

### Rendering

`WeldCanvas` uses React Native `View` and `StyleSheet` with absolute positioning — no Skia primitives at the component level despite the Skia dependency being present. Key visual elements:

- Metal plates (top/bottom) with joint gap
- Welding rod (80px, 30° lean angle)
- Arc glow (color encodes quality: green=ideal, orange=marginal, red=bad)
- Bead color heat-mapped (cool grey → orange → yellow → white-hot)
- 8-direction spark particle burst at arc tip
- Slag overlay rendered on brushing screen

### Gesture Control

`TorchGesture` wraps `WeldCanvas` in a `PanGestureHandler`. The handler:
- Maps finger position to torch (x, y) in store
- Computes arc length from visual rod-tip-to-joint distance (0–40px → 0–1)
- Computes travel speed from gesture velocity (px/s)
- Triggers `expo-haptics` every 120ms while arc is live

---

## Scoring System

Five weighted components summed to a 0–100 score:

| Component | Weight | Criteria |
|---|---|---|
| Coverage | 35% | % of joint filled (90% = full score) |
| Consistency | 20% | Bead width variance |
| Fusion | 20% | Incomplete fusion defect count |
| Defect Penalty | 15% | Total defect count × severity |
| Clean Run Bonus | 10% | No burn-through or stick events |

Pass threshold: **70 points**. Each level must be passed to unlock the next.

---

## Defect Types

| Defect | Trigger Condition |
|---|---|
| Stick | `arcLength < 0.2` |
| Porosity | `arcLength > 0.8` |
| Undercut | `amperage > maxAmperage × 1.1` |
| Incomplete Fusion | `amperage < minAmperage × 0.85` |
| Cold Lap | `travelSpeed > speedMax × 15` |
| Burn-Through | Dwell time >1.5s with `heatValue > 0.7` |

Detection is rate-limited to once per 800ms per defect type to avoid spam.

---

## Data Files

### `data/levels.ts`

Five levels, difficulty 1–5. Each level config includes:
- `process` — welding process name (SMAW, MIG, TIG, etc.)
- `metal` — reference to a metal from `data/metals.ts`
- `electrode` — reference to an electrode from `data/electrodes.ts`
- `difficulty` — integer 1–5
- Physics tolerances (`arcLengthTolerance`, `speedMin`, `speedMax`)
- Environment theme for visual styling

### `data/metals.ts`

Five metals (mild steel, stainless, aluminum, cast iron, chrome-moly). Each has:
- `thermalConductivity` — affects heat spread rate
- `meltingPoint`, `burnThroughTemp` — used in heat simulation
- `name`, `color`

### `data/electrodes.ts`

Six electrodes. Each has:
- `minAmperage`, `maxAmperage` — used for defect detection thresholds
- `name`, `type` (rod, wire, tungsten)

---

## Code Conventions

### TypeScript

- **Strict mode** is enabled — no implicit `any`, strict null checks
- All component props typed with explicit interfaces (suffix `Props`)
- Store state typed as `WeldState`, actions as `GameActions`
- Data types defined co-located with the data files

### Naming

- Components: `PascalCase` (`WeldCanvas`, `AmperageSlider`)
- Functions/variables: `camelCase` (`detectDefects`, `travelSpeed`)
- Constants: `UPPER_SNAKE_CASE` (`JOINT_LENGTH`, `SPARK_ANGLES_RAD`)
- Store actions: verb-prefixed camelCase (`setTorchPosition`, `addBeadSegment`)
- Interfaces/types: `PascalCase` (`BeadSegment`, `WeldState`)

### Component Style

- Functional components only — no class components
- `StyleSheet.create()` for all styles, co-located at the bottom of the file
- Absolute positioning for canvas-based elements
- `useRef` for imperative values that should not trigger re-renders (timers, cooldowns, last position)
- `useEffect` cleanup always cancels intervals and gesture listeners

### Systems (Pure Logic)

Files in `systems/` have no React imports. They are pure TypeScript functions that take state values and return computed results. Keep them framework-agnostic.

### Data Files

Files in `data/` are read-only configuration. Do not mutate them at runtime. All runtime state lives in the Zustand store.

---

## Key Constraints

- **No persistence** — scores and progress are lost when the app closes. `completedLevels` in the store is session-only.
- **No backend** — fully offline, no network requests.
- **No tests** — there is no test suite. Changes must be verified manually in the Expo app.
- **Single store** — all game state is in `store/gameStore.ts`. Do not create additional stores.
- **Render budget** — the physics tick runs at 20 FPS (50ms interval). Keep tick callbacks cheap; defer heavy computation.
