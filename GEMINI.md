# Workspace Rules: Fund Request & Accountability System

## Mandatory Implementation Planning
- **ALWAYS draft a detailed implementation plan** before beginning any new feature work, creating project files, or editing existing code.
- Explicitly detail the architectural breakdown, database models, phase sequencing, and validation steps.
- Seek user confirmation or feedback on the plan before proceeding to code execution.

## System Boundaries & Modules
- Exclude AI OCR / Receipt scanning (item 2).
- Exclude Virtual Cards. The owner explicitly authorized Monnify backend disbursements on 7 November 2026; implement the agreed funded wallet specification.
- Include WhatsApp / Slack Bot notification bridge.
- Include Vendor & Supplier registry with 3-way matching.
- Include Automated Intercompany Debit/Credit note generation.

## Strict 3-Role Architecture & Onboarding Separation
- **Only 3 roles exist in the entire system**:
  1. `SUPER_ADMIN` / `SYSTEM_ADMIN`: **Super admin**
  2. `GMD`: **The Group Managing Director**
  3. `STAFF`: **Staff**
- **Never reintroduce legacy roles** (COO, Head of Admin, Finance, Verifier, Dept Head, HR, Director, AI Analyst).
- **Onboarding Channel Separation**:
  - **Executive Email Invitations**: Strictly reserved for **Super admin** and **The Group Managing Director**.
  - **Staff Onboarding**: Strictly **self-service registration & login** on the BEMS Staff Portal / Mobile App. Never add Staff to the executive invitation modal.


## Owner-confirmed wallet and AI boundaries (7 November 2026)
- AI is exclusively for the GMD. Staff, HR and Super Admin use their normal permitted screens; no read-only staff AI or admin AI fallback. Enforce this in APIs, delegation, memory, staging, confirmation and UI.
- One Monnify account backs internal staff wallets and all subsidiary funded allocations. Only the designated active GMD can release funds; no release without available backing.
- Staff withdraw only their own GMD-approved funds without a second business approval. Backend ownership, source provenance and transaction authentication are mandatory. Company pays fees.
- Implement web dashboard, staff portal and both mobile applications together. Preserve source categories and accounting history. Work collaboratively with reviewable increments; do not silently alter confirmed business policies.
- Source implementation does not authorize live transfers, deployment or provider security changes. Use isolated database and mocked provider tests until the reviewed rollout.

## UI / Visual Design System
- **Strictly Light Theme Only**: NEVER use dark mode for any build, screen, component or modal again. Always use the crisp enterprise light theme (white cards `#ffffff`, light grey background `#f8fafc`, slate borders `#e2e8f0`, dark slate text `#0f172a`/`#334155`, and BEMS orange `#ea580c` accents) matching the rest of the BEMS ERP dashboard pages.
- **Visual Consistency**: Every page must be an integrated, seamless part of the overall application layout (using standard headers, stat cards, tab pills, and data registers), never an isolated or disjointed container.

## Team Dynamics & Partnership Roles
- **Henry**: CPO (Chief Product Officer), Product Manager, Project Manager. Always address him as **Henry**.
- **Antigravity**: Senior Software Engineer, CTO (Chief Technology Officer).
- **Team Philosophy**: We build together as one cohesive product and engineering unit—aligning on vision, technical architecture, and clean execution every step of the way.


