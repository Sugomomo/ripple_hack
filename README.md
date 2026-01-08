# ripple_hack

This repository is the final work of our team "Sugomomo" product for NUS Fintech 2026 Hackathon. All work relates to Ripple and XRPL. 

The project is built on Ripple and the XRP Ledger (XRPL) and explores how time-based escrows can be used to reduce and prevent scam cases involving impersonation of government entities.
Our core idea is to leverage XRPL’s native escrow primitives to enforce cool-off periods, verification-aware cancellation logic, and on-ledger enforcement, rather than relying on off-chain trust.


Problem Motivation
Scam cases often involve attackers impersonating trusted government entities and pressuring victims to send funds immediately.
Once funds are transferred, recovery is usually impossible.
This project demonstrates how time-locked escrows on XRPL can:
1. Prevent irreversible instant transfers
2. Introduce a mandatory delay before funds are released
3. Allow cancellation if suspicious behavior is detected
4. Differentiate behavior based on verified vs unverified recipients

## High-Level Architecture
```text
Frontend (React)
│
│  (UX simulation / demo)
│
▼
Backend (FastAPI)
│
│  (real XRPL escrow logic)
│
▼
XRPL Testnet
```
Frontend: Demonstrates the user experience of sending funds into escrow, modifying, cancelling, or claiming transactions.
Backend: Implements real XRPL escrow creation, finish, and cancel flows.
XRPL Testnet: Enforces escrow conditions and timing on-ledger.

## Repository Structure

```text
├── backend/                # Core backend logic (authoritative)
│   ├── main.py             # FastAPI app + XRPL escrow logic
│   ├── requirements.txt    # Reference only
│   ├── pyproject.toml      # Reference only
│   └── uv.lock             # Reference only
│
├── frontend/               # Frontend demo UI
│   ├── src/
│   │   └── App.tsx         # Escrow wallet demo interface
│   └── README.md           # Frontend-specific documentation
│
├── test.py                 # One-off testing / experiments (reference only)
├── mod8.py                 # Reference XRPL utilities
├── .env.example
└── README.md               # (This file)
```

Backend Overview (XRPL Logic)
The backend is a FastAPI service that:
1. Seeds verified government entities on startup (Testnet wallets)
2. Verifies whether a destination address is trusted
3. Creates XRPL escrows with:
- FinishAfter
- CancelAfter
- Hash-locked conditions
4. Handles:
- EscrowCreate
- EscrowFinish
- EscrowCancel
5. Stores escrow metadata locally in SQLite for frontend display

Frontend Overview (Demo UI)
The frontend is a React demo wallet that simulates how users would interact with escrow-protected payments.
Features include:
1. Randomized demo wallet (verified vs unverified)
2. Sending payments into escrow
3. Viewing pending, completed, and cancelled transactions
4. Modifying escrowed amounts (UX demonstration)
5. Claiming or cancelling transactions
6. Visual indicators for verified recipients
