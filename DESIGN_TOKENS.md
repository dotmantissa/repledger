# REP | Ledger - Design Variance Token Plan

Random Seed: 1790080891

## The Five Independent Design Rolls

1. Layout Archetype: Dashboard split-pane with an audit spool ledger rail
   - Left Pane: The Entity Dossier and Trust Radar. Real-time trust score, historical claims summary, and composable query simulator (test how lending or prediction market contracts query this entity).
   - Right Pane: The Consensus Adjudication Chamber. Live ledger feed of verified claims, staked bonds, validator evidence review summaries, and challenge resolution.
   - Justification: REP | Ledger is an on-chain court and institutional registry. A split-pane gives users instant comparative context: viewing an entity's complete track record while watching new claims get evaluated by validators.

2. Type Pairing: Plus Jakarta Sans + JetBrains Mono
   - Primary Headings and UI: Plus Jakarta Sans (distinct geometric tech sans with character and high legibility).
   - Cryptographic Telemetry and Code: JetBrains Mono (monospaced clarity for transaction hashes, bond amounts, validator quorum votes, and consensus payload data).
   - Justification: Combines institutional authority with cryptographic precision.

3. Motion Signature: Response-to-action motion only
   - Only triggers on user interactions (submitting a claim, expanding an evidence audit trail, challenging a verdict, switching entities, toggling light and dark mode).
   - No ambient floaty background animations, no generic bouncy hover cards.
   - Respects user preference for reduced motion (`prefers-reduced-motion: reduce`).

4. One Structural Device: The Consensus Verdict Stamp and Evidence Seal
   - Visual notary badge rendered atop verified claims.
   - Live states:
     - "RECORDED ON-CHAIN" with validator consensus score and locked bond
     - "SLASHED" with forfeiture reason and slashed stake
     - "CHALLENGED" with counter-evidence active review
     - "OVERRIDDEN" when a challenger provides decisive proof
   - Acts as the immutable proof of truth across the ledger.

5. Color Palette Tokens
   - Emerald Primary: `#1ec677`
   - Mint Whisper Light Background: `#ecf9ee`
   - Deep Obsidian Dark Forest: `#0d4029`
   - Pure Light Surface: `#ffffff`
   - Dark Obsidian Surface: `#082015`
   - Dark Slate Card: `#0e2a1e`
   - Border Subtle: `rgba(30, 198, 119, 0.2)`
   - Text Muted Light: `#4a725e`
   - Text Muted Dark: `#9ecab5`
   - Warning Under Challenge: `#eab308`
   - Danger Slashed: `#ef4444`

## Banned List Verification

- [x] No ALL-CAPS tracked eyebrow labels
- [x] No "WORD — fragment" em-dash labels
- [x] No "→" appended to every link or button
- [x] No numbered 01/02/03 markers unless genuine sequence
- [x] No SaaS card kit (no identical border-radius + soft grey shadow on every card)
- [x] No fade-and-slide-up on every section
- [x] No emojis across the entire interface (Lucide icons only)
- [x] No AI artifacts or hyphens in text except where strictly required like "on-chain"
- [x] Email authentication only (Privy email sign in and sign up)
- [x] Abstracted transactions for seamless gasless user interaction
