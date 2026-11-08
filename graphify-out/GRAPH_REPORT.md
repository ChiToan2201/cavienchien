# Graph Report - cavienchien  (2026-11-08)

## Corpus Check
- Corpus is ~30,040 words - fits in a single context window. You may not need a graph.

## Summary
- 366 nodes · 956 edges · 16 communities (11 shown, 5 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 105 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Player Entity & Chef Gestures
- Taste Theme & Food Data
- Audio Manager & WebAudio Synthesis
- Game State & Upgrades System
- State Persistence & Save Manager
- Shop Management & Modal Dialogs
- Package Dependencies & Tooling
- Game Configuration & Responsive Layout
- Economy & Cooking Systems
- Preload Scene & Sprite Processing
- TypeScript Compiler Configuration
- Customer System & Archetypes
- Day Progression & Daily Cycles
- Food Tray UI & Frying Visuals
- Vercel Deployment Settings

## God Nodes (most connected - your core abstractions)
1. `GameStateManager` - 60 edges
2. `ShopScene` - 50 edges
3. `AudioManager` - 42 edges
4. `SoundManager` - 27 edges
5. `phaser` - 19 edges
6. `ModalScene` - 19 edges
7. `DaySystem` - 18 edges
8. `CookingSystem` - 15 edges
9. `compilerOptions` - 15 edges
10. `FoodTray` - 13 edges

## Surprising Connections (you probably didn't know these)
- `ModalInitData` --references--> `ShopScene`  [EXTRACTED]
  src/game/scenes/ModalScene.ts → src/game/scenes/ShopScene.ts
- `FoodTray` --references--> `FoodDefinition`  [EXTRACTED]
  src/game/ui/FoodTray.ts → src/game/data/foods.ts
- `GameStateManager` --references--> `DailyStats`  [EXTRACTED]
  src/game/managers/GameStateManager.ts → src/game/managers/SaveManager.ts
- `MenuScene` --references--> `GameStateManager`  [EXTRACTED]
  src/game/scenes/MenuScene.ts → src/game/managers/GameStateManager.ts
- `ModalScene` --references--> `GameStateManager`  [EXTRACTED]
  src/game/scenes/ModalScene.ts → src/game/managers/GameStateManager.ts

## Import Cycles
- 2-file cycle: `src/game/scenes/ModalScene.ts -> src/game/scenes/ShopScene.ts -> src/game/scenes/ModalScene.ts`

## Communities (16 total, 5 thin omitted)

### Community 0 - "Player Entity & Chef Gestures"
Cohesion: 0.10
Nodes (3): Player, ShopScene, CookingSystem

### Community 1 - "Taste Theme & Food Data"
Cohesion: 0.10
Nodes (27): phaser, TASTE_THEME, FoodCategory, FoodDefinition, INITIAL_FOODS, AchievementDefinition, ACHIEVEMENTS, INITIAL_MISSIONS (+19 more)

### Community 3 - "Game State & Upgrades System"
Cohesion: 0.13
Nodes (4): UpgradeId, GameStateManager, SaveDataSchema, CustomerSystem

### Community 4 - "State Persistence & Save Manager"
Cohesion: 0.12
Nodes (3): SaveManager, SoundManager, MenuScene

### Community 6 - "Package Dependencies & Tooling"
Cohesion: 0.12
Nodes (16): dependencies, phaser@3.90.0, devDependencies, typescript@^5.6.3, vite@^5.4.10, name, private, scripts (+8 more)

### Community 7 - "Game Configuration & Responsive Layout"
Cohesion: 0.14
Nodes (12): detectLayoutMode(), GAME_HEIGHT, GAME_WIDTH, gameConfig, getTargetDimensions(), initialDims, LANDSCAPE_HEIGHT, LANDSCAPE_WIDTH (+4 more)

### Community 8 - "Economy & Cooking Systems"
Cohesion: 0.16
Nodes (3): EconomySystem, InventorySystem, HUD

### Community 9 - "Preload Scene & Sprite Processing"
Cohesion: 0.18
Nodes (6): PreloadScene, AnchorMode, BBox, ForgeSpriteConfig, RGB, SpriteForgeProcessor

### Community 10 - "TypeScript Compiler Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 11 - "Customer System & Archetypes"
Cohesion: 0.25
Nodes (7): CUSTOMER_ARCHETYPES, CustomerArchetype, CustomerTypeId, ActiveCustomer, CustomerMood, OrderRequirement, CustomerOrder

### Community 15 - "Vercel Deployment Settings"
Cohesion: 0.50
Nodes (3): buildCommand, framework, outputDirectory

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameStateManager` connect `Game State & Upgrades System` to `Player Entity & Chef Gestures`, `Taste Theme & Food Data`, `State Persistence & Save Manager`, `Shop Management & Modal Dialogs`, `Economy & Cooking Systems`, `Customer System & Archetypes`, `Day Progression & Daily Cycles`, `Food Tray UI & Frying Visuals`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **Should `Player Entity & Chef Gestures` be split into smaller, more focused modules?**
  _Cohesion score 0.10087719298245613 - nodes in this community are weakly interconnected._
- **Why does `AudioManager` connect `Audio Manager & WebAudio Synthesis` to `Taste Theme & Food Data`, `State Persistence & Save Manager`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Should `Taste Theme & Food Data` be split into smaller, more focused modules?**
  _Cohesion score 0.1036077705827937 - nodes in this community are weakly interconnected._
- **Why does `phaser` connect `Taste Theme & Food Data` to `Package Dependencies & Tooling`, `Game Configuration & Responsive Layout`, `Preload Scene & Sprite Processing`, `Customer System & Archetypes`, `High-DPI Camera & Display Scaling`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Should `Audio Manager & WebAudio Synthesis` be split into smaller, more focused modules?**
  _Cohesion score 0.11806543385490754 - nodes in this community are weakly interconnected._
- **Should `Game State & Upgrades System` be split into smaller, more focused modules?**
  _Cohesion score 0.1268939393939394 - nodes in this community are weakly interconnected._