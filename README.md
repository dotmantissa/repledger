# REP Ledger

Reputation on blockchains is broken. Most existing systems fall into one of two traps. Either a centralized committee decides who gets a gold star, or rich whales buy up tokens to game governance badges. Neither reflects reality.

REP Ledger is a write once, append only record of verified claims about wallets, protocols, autonomous agents, and smart contracts. Anyone can submit a claim backed by bonded stake and public evidence links. GenLayer validators independently fetch the evidence, evaluate the claim, and vote on whether the sources actually substantiate the claim. 

Accepted claims are written permanently to the entity record on-chain. Bogus claims slash the claimant stake. And if someone challenges an accepted claim with definitive counter evidence, the challenge overturns the record and hands the original bond to the challenger.

Over time, this creates immutable institutional memory on-chain that prediction markets, lending vaults, and agent swarms can query before making decisions.

## Live Deployment on GenLayer Studio Network

The intelligent contract is deployed and verified on the GenLayer Studio Network:

- Contract Address: `0x6Bf2142a7AbA111e5BcD41Ad70Ebb4fC501660Ee`
- Deployment Transaction: `0xa686e0e56ac860627e49a12f7f8ccf800142b09147e66478b06c48a52ccab92c`
- Network: GenLayer Studio Network (studionet)
- Chain ID: `61999`
- Consensus Result: `MAJORITY_AGREE` (100% agreement across validators)

## How It Works

### 1. Submitting a Claim with Staked Bond
A claimant submits a factual assertion about any entity:
- A protocol exploit (for example, flash loan drained reserves)
- Malicious wallet behavior (such as confirmed rug pulls)
- Positive agent performance (verified deliveries and clean audits)

The claimant stakes a bond in GEN tokens and provides public evidence URLs (such as block explorer transactions, GitHub commits, or official security post mortems).

### 2. Validator Evidence Consensus
GenLayer validators read the URLs, extract the evidence, and adjudicate the claim. If the evidence substantiates the assertion, the claim is accepted and permanently recorded. If the evidence is missing, fabricated, or refutes the claim, the claim is rejected and the claimant bond is slashed.

### 3. Challenges and Bond Transfers
Accepted claims can never be quietly deleted. But if new counter evidence proves a claim was wrong (for example, proving that a paused bridge was a scheduled upgrade rather than an exploit), anyone can mount a challenge by staking a counter bond. 

If validators agree with the rebuttal, the status updates to OVERRIDDEN and the original claimant bond is transferred directly to the challenger. If the challenge fails, the challenger counter bond is slashed.

### 4. Composable Queries
Any external smart contract can query REP Ledger:
- Lending Protocols: check if a borrower or protocol is flagged for exploits or insolvency before setting collateral factors
- Prediction Markets: verify whether an exploit actually occurred before resolving a hack market
- Agent Swarms: route high value tasks only to agents with verified clean track records

## Architecture

- Intelligent Contract: `contracts/repledger.py` running in the GenVM Python environment with equivalence principle consensus
- Transaction Relayer: `backend/src/genlayerRelayer.js` abstracts gas and signs transactions on behalf of users so no token management is required
- Identity: Privy email authentication only (no wallet popups or seed phrases required)
- Database: Neon PostgreSQL for query caching and entity dossiers
- Frontend: React with Vite, Tailwind CSS, Lucide icons, and light and dark mode

## Testing

Run contract tests:

```bash
pytest tests/test_repledger.py -v
```

Lint contract for GenVM safety:

```bash
uv run --python 3.12 --with genvm-linter genvm-lint check contracts/repledger.py
```

## Running Locally

1. Install root and frontend dependencies:

```bash
npm install
npm --prefix frontend install
```

2. Configure environment variables in `.env` (refer to `.env.example`).

3. Start backend and frontend concurrently:

```bash
npm run dev
```

The dapp will be accessible at `http://localhost:5173` with API proxying to `http://localhost:3001`.
