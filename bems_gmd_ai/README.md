# BEMS GMD Executive AI Copilot (Flutter App)

An ultra-luxurious, executive-grade AI mobile & desktop application tailored specifically for the **Group Managing Director (GMD)** of **BEMS Group**.

Inspired by ChatGPT / Claude mobile apps with an **Obsidian Void & Molten Amber** visual theme (`#050811`, `#EA580C`, `#F97316`), featuring continuous 3D kinetic molten particle orbs, expanding acoustic wave rings, dynamic word-by-word streaming typography, and live enterprise database grounding.

---

## ✦ System Architecture & Design

```
                     ┌────────────────────────────────────────┐
                     │       BEMS GMD Flutter Client          │
                     │  (Obsidian & Molten Amber Dark Theme)  │
                     └───────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      [Executive Hub]         [3D Kinetic Orb / Voice]     [Executive Chat Stream]
    - Greeting & Status      - 3D Molten Amber Sphere     - Obsidian message stream
    - 4 Glowing Feature Cards - Acoustic wave ring pulses  - Interactive Action Cards
    - Model Pill (BEMS 2.5)  - Word-by-word streaming text  (Treasury, Approvals)
    - Voice Entry Pill       - Dynamic neon trailing cursor- Multi-session history
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         │ HTTP REST (JSON)
                                         ▼
                     ┌────────────────────────────────────────┐
                     │    Next.js BEMS Enterprise Engine      │
                     │       `POST /api/ai/chat`              │
                     └───────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
      [Prisma ORM & PostgreSQL]                      [Company Bank Treasury]
    - Live Pending Approvals                        - Access Bank PLC (₦52.8M)
    - 72h Advances & Accountability                 - Zenith Bank PLC (₦31.4M)
    - Subsidiary Budget Run-Rates                   - Combined Liquidity: ₦84.2M
```

---

## ✦ Screens & Capabilities

### 1. Executive Hub (`lib/screens/executive_home_screen.dart`)
- **Executive Header**: Live greeting to the GMD with enterprise connectivity status and active session switcher.
- **Hero Title**: *"What financial insight do you need today?"* with glowing subtitle.
- **Glassmorphic Feature Cards**:
  1. **Treasury & Cash Reserves**: Real-time Access & Zenith Bank combined liquidity balances.
  2. **Pending Approvals**: Direct audit and 1-click approvals for departmental fund requests.
  3. **72h Audit & Advances**: Unretired advance tracking and accountability flags.
  4. **Morning Briefing**: Automated executive summary of group financial operations.
- **Bottom Prompt Pill**: Floating pill with active AI model badge (`BEMS 2.5`), quick voice trigger, and prompt input.

### 2. Kinetic Molten Orb Voice Mode (`lib/screens/voice_orb_screen.dart`)
- **3D Molten Sphere (`lib/widgets/kinetic_molten_orb.dart`)**:
  - Continuous non-blocking rotating focal point and internal radial plasma sweep.
  - Multi-layered glowing amber drop shadows and ambient halos.
  - Expanding concentric acoustic wave rings during listening/speaking states.
- **Dynamic Streaming Typography (`lib/widgets/dynamic_streaming_text.dart`)**:
  - Live word-by-word streaming rendering.
  - Trailing neon amber cursor blinking at 450ms.
- **Interactive Controls**: Touch to switch queries, radiant glowing concentric mic trigger.

### 3. Executive Chat & Action Desk (`lib/screens/executive_chat_screen.dart`)
- Obsidian bubble streams with assistant responses branded with mini glowing orbs.
- Interactive action cards (`lib/widgets/action_cards.dart`):
  - **Live Treasury Liquidity Card**: Shows exact accounts, balances, and reserve ratios.
  - **Pending Approvals Card**: Lists pending requests with direct 1-tap approval action.
  - **Executive Daily Scorecard**: Key performance indices across the group.

---

## ✦ How to Run the Flutter App

Ensure you have Flutter installed (or use the local installation at `/Users/henry/.local/flutter/bin/flutter`).

### 1. Run on macOS Desktop
```bash
/Users/henry/.local/flutter/bin/flutter run -d macos
```

### 2. Run on Chrome Web
```bash
/Users/henry/.local/flutter/bin/flutter run -d chrome
```

### 3. Run on Mobile (iOS Simulator / Android Emulator)
```bash
# List available emulators:
/Users/henry/.local/flutter/bin/flutter emulators

# Launch and run:
/Users/henry/.local/flutter/bin/flutter run
```

### 4. Build Production Web Bundle
```bash
/Users/henry/.local/flutter/bin/flutter build web --release
```

---

## ✦ Enterprise Integration Details

The Flutter application connects directly to the Next.js backend server:
- Default endpoint: `http://localhost:3000/api/ai/chat` (configurable in `lib/services/api_service.dart`).
- When backend is offline, built-in intelligent fallback handlers maintain executive operations with zero interruption.
