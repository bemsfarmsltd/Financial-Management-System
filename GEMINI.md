# Workspace Rules: Fund Request & Accountability System

## Mandatory Implementation Planning
- **ALWAYS draft a detailed implementation plan** before beginning any new feature work, creating project files, or editing existing code.
- Explicitly detail the architectural breakdown, database models, phase sequencing, and validation steps.
- Seek user confirmation or feedback on the plan before proceeding to code execution.

## System Boundaries & Modules
- Exclude AI OCR / Receipt scanning (item 2).
- Exclude Virtual Cards / Fintech direct disbursement APIs (item 3).
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

