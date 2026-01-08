import os
import time
import json
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv

from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

from xrpl.clients import JsonRpcClient
from xrpl.wallet import generate_faucet_wallet, Wallet
from xrpl.models.requests import ServerInfo, Ledger
from xrpl.models.requests.account_objects import AccountObjects
from xrpl.models.transactions import EscrowCreate, EscrowFinish, EscrowCancel
from xrpl.transaction import submit_and_wait
from xrpl.utils import datetime_to_ripple_time


load_dotenv(find_dotenv())

FRONTEND_URL = os.getenv("VITE_FRONTEND_URL", "http://localhost:5173") 
DATABASE_URL = os.getenv("VITE_DATABASE_URL", "sqlite:///./demo.db")

app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Database Table
class VerifiedAddresses(Base):
    __tablename__ = "verified_addresses"
    id = Column(Integer, primary_key=True, index=True, unique=True)
    address = Column(String, index=True, unique=True)

class GovEntity(Base):
    __tablename__ = "gov_entities"
    entity_key = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    classic_address = Column(String, nullable=False, unique=True, index=True)
    seed = Column(String, nullable=False)

class TranscationLog(Base):
    __tablename__ = "transaction_logs"
    id = Column(Integer, primary_key=True, index=True, unique=True)
    tx_type = Column(String, nullable=False)
    details = Column(String, nullable=False)
    timestamp = Column(Integer, nullable=False)

Base.metadata.create_all(bind=engine)

JSON_RPC_URL = "https://s.altnet.rippletest.net:51234/"
client = JsonRpcClient(JSON_RPC_URL)

SAFE_MIN_FINISH_DELTA = 30
SAFE_MIN_CANCEL_EXTRA = 30

def ledger_close_time() -> int:
    try:
        resp = client.request(Ledger(ledger_index="validated")).result
        led = resp.get("ledger", {})
        if isinstance(led, dict) and "close_time" in led:
            return int(led["close_time"])
    except Exception:
        pass

    try:
        si = client.request(ServerInfo()).result
        info = si.get("info", {})
        vl = info.get("validated_ledger", {})
        if isinstance(vl, dict) and "close_time" in vl:
            return int(vl["close_time"])
    except Exception:
        pass

    return int(datetime_to_ripple_time(datetime.now(timezone.utc)))

def escrow_exists(owner_address: str, destination: str, amount: str, retries: int = 10, delay_s: float = 1.0) -> bool:
    last = None
    for _ in range(retries):
        req = AccountObjects(account=owner_address, ledger_index="validated", type="escrow")
        resp = client.request(req).result
        last = resp
        objs = resp.get("account_objects", [])
        for obj in objs:
            if obj.get("Destination") == destination and str(obj.get("Amount")) == str(amount):
                return True
        time.sleep(delay_s)

    print("\n[escrow_exists] Ledger response (debug):")
    print(json.dumps(last, indent=2))
    return False

def generate_condition_and_fulfillment():
    preimage = os.urandom(32)
    preimage_hex = preimage.hex().upper()
    digest = hashlib.sha256(preimage).digest()
    condition = "A0258020" + digest.hex().upper() + "810120"
    fulfillment = "A0228020" + preimage_hex
    return condition, fulfillment, preimage_hex

def seed_gov_entities(db: Session, target_count: int = 10):
    existing = db.query(GovEntity).count()
    if existing >= target_count:
        return

    for i in range(existing + 1, target_count + 1):
        w = generate_faucet_wallet(client, debug=True)
        entity_key = f"gov_{i:02d}"
        name = f"Government Entity {i:02d}"
        db.merge(GovEntity(
            entity_key=entity_key,
            name=name,
            classic_address=w.classic_address,
            seed=w.seed,
        ))
    db.commit()

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_gov_entities(db, 10)
    finally:
        db.close()

class AddressRequest(BaseModel):
    address: str


class EscrowDemoRequest(BaseModel):
    destination: str
    amount_drops: str = "1000000"
    finish_seconds: int = 10
    cancel_seconds_verified: int = 5
    cancel_seconds_unverified: int = 1
    mode: str = "FINISH"

@app.get("/")
def root():
    return {"message": "Hello"}

@app.post("/verify")
def verify_address(req: AddressRequest, db: Session = Depends(get_db)):
    gov = db.query(GovEntity).filter(GovEntity.classic_address == req.address).first()
    return {"address": req.address, "verified": gov is not None, "matched": gov.name if gov else None}


@app.get("/gov")
def list_gov(db: Session = Depends(get_db)):
    rows = db.query(GovEntity).order_by(GovEntity.entity_key).all()
    return [{"entity_key": r.entity_key, "name": r.name, "classic_address": r.classic_address} for r in rows]


@app.post("/escrow/demo")
def escrow_demo(req: EscrowDemoRequest, db: Session = Depends(get_db)):
    gov = db.query(GovEntity).filter(GovEntity.classic_address == req.destination).first()
    verified = gov is not None
    cancel_extra = req.cancel_seconds_verified if verified else req.cancel_seconds_unverified

    payer_wallet = generate_faucet_wallet(client, debug=True)
    payer_addr = payer_wallet.classic_address

    if verified:
        receiver_wallet = Wallet.from_seed(gov.seed)
    else:
        receiver_wallet = generate_faucet_wallet(client, debug=True)

    destination_addr = req.destination

    condition, fulfillment, preimage_hex = generate_condition_and_fulfillment()

    base = ledger_close_time()
    finish_after = base + max(int(req.finish_seconds), SAFE_MIN_FINISH_DELTA)
    cancel_after = finish_after + max(1, int(cancel_extra), SAFE_MIN_CANCEL_EXTRA)

    create_tx = EscrowCreate(
        account=payer_addr,
        amount=req.amount_drops,
        destination=destination_addr,
        finish_after=finish_after,
        cancel_after=cancel_after,
        condition=condition,
    )

    escrow_resp = submit_and_wait(create_tx, client, payer_wallet)
    tx_result = escrow_resp.result.get("meta", {}).get("TransactionResult")
    validated = escrow_resp.result.get("validated")

    if not validated or tx_result != "tesSUCCESS":
        raise HTTPException(status_code=400, detail={"error": "EscrowCreate failed", "result": escrow_resp.result})

    offer_sequence = int(escrow_resp.result["tx_json"]["Sequence"])
    escrow_owner = payer_addr

    if not escrow_exists(escrow_owner, destination_addr, req.amount_drops):
        raise HTTPException(status_code=500, detail="Escrow not visible on ledger after create (node lag or mismatch).")

    if req.mode.upper() == "FINISH":
        wait_s = max(0, (finish_after - ledger_close_time()) + 10)
        time.sleep(wait_s)

        last_err = None
        for _ in range(20):
            try:
                finish_tx = EscrowFinish(
                    account=receiver_wallet.classic_address,
                    owner=escrow_owner,
                    offer_sequence=offer_sequence,
                    condition=condition,
                    fulfillment=fulfillment,
                )
                finish_resp = submit_and_wait(finish_tx, client, receiver_wallet)
                return {
                    "verified_destination": verified,
                    "payer": payer_addr,
                    "receiver": receiver_wallet.classic_address,
                    "destination": destination_addr,
                    "offer_sequence": offer_sequence,
                    "condition": condition,
                    "preimage_hex": preimage_hex,
                    "create_result": escrow_resp.result,
                    "finish_result": finish_resp.result,
                }
            except Exception as e:
                last_err = str(e)
                time.sleep(4)

        raise HTTPException(status_code=500, detail=f"EscrowFinish failed after retries: {last_err}")

    if req.mode.upper() == "CANCEL":
        wait_s = max(0, (cancel_after - ledger_close_time()) + 10)
        time.sleep(wait_s)

        cancel_tx = EscrowCancel(
            account=payer_addr,
            owner=escrow_owner,
            offer_sequence=offer_sequence,
        )
        cancel_resp = submit_and_wait(cancel_tx, client, payer_wallet)
        return {
            "verified_destination": verified,
            "payer": payer_addr,
            "destination": destination_addr,
            "offer_sequence": offer_sequence,
            "condition": condition,
            "preimage_hex": preimage_hex,
            "create_result": escrow_resp.result,
            "cancel_result": cancel_resp.result,
        }

    raise HTTPException(status_code=400, detail="mode must be FINISH or CANCEL")