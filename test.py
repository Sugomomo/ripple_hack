from xrpl.clients import JsonRpcClient
from xrpl.wallet import generate_faucet_wallet, Wallet
from xrpl.core import addresscodec
from xrpl.models.requests.account_info import AccountInfo
from xrpl.models.requests.account_objects import AccountObjects
from xrpl.models.transactions import EscrowCreate, EscrowFinish, EscrowCancel
from xrpl.transaction import submit_and_wait
from xrpl.models.requests import ServerInfo
from fastapi import FastAPI
import sqlite3
import os 
import hashlib

preimage = os.urandom(32)         
preimage_hex = preimage.hex() 
digest = hashlib.sha256(preimage).digest()
condition = "A0258020" + digest.hex().upper() + "810120"


from xrpl.utils import datetime_to_ripple_time
import json 
import time 
from datetime import datetime, timezone

finish_seconds = 10
cancel_seconds_verified = 5
cancel_seconds_unverified = 1

default_mode = "FINISH"
DB_PATH = "demo.db"

def db_conn():
    return sqlite3.connect(DB_PATH)

def init_db():
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS gov_entities (
            entity_key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            classic_address TEXT NOT NULL,
            seed TEXT NOT NULL
        )
        """)
        conn.commit()


def gov_count() -> int:
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM gov_entities")
        return int(cur.fetchone()[0])

def insert_gov(entity_key: str, name: str, classic_address: str, seed: str):
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
        INSERT OR REPLACE INTO gov_entities(entity_key, name, classic_address, seed)
        VALUES (?, ?, ?, ?)
        """, (entity_key, name, classic_address, seed))
        conn.commit()

def list_gov_full():
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT entity_key, name, classic_address, seed FROM gov_entities ORDER BY entity_key")
        rows = cur.fetchall()
    return [{"entity_key": r[0], "name": r[1], "classic_address": r[2], "seed": r[3]} for r in rows]


def list_gov():
    with db_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT entity_key, name, classic_address FROM gov_entities ORDER BY entity_key")
        rows = cur.fetchall()
    return [{"entity_key": r[0], "name": r[1], "classic_address": r[2]} for r in rows]

json_rpc_url = "https://s.altnet.rippletest.net:51234/"
client = JsonRpcClient(json_rpc_url) #connecting to testnet

def ripple_time_now(seconds: int) -> int:
    now = datetime_to_ripple_time(datetime.now(timezone.utc))
    return now + int(seconds)

def ledger_close_time() -> int:
    """
    Use the validated ledger header close_time (most reliable for Escrow timing).
    Returns Ripple epoch seconds.
    """
    try:
        resp = client.request(Ledger(ledger_index="validated")).result
        # Typical: {"ledger": {"close_time": 123456789, ...}}
        led = resp.get("ledger", {})
        if isinstance(led, dict) and "close_time" in led:
            return int(led["close_time"])
    except Exception:
        pass

    # Fallback: try ServerInfo (sometimes missing close_time)
    try:
        si = client.request(ServerInfo()).result
        info = si.get("info", {})
        vl = info.get("validated_ledger", {})
        if isinstance(vl, dict) and "close_time" in vl:
            return int(vl["close_time"])
    except Exception:
        pass

    # Last-resort fallback: local time converted to Ripple epoch
    return int(datetime_to_ripple_time(datetime.now(timezone.utc)))


def escrow_exists(owner_address: str, destination: str, amount: str, retries: int = 10, delay_s: float = 1.0) -> bool:
    last = None
    for attempt in range(retries):
        req = AccountObjects(account=owner_address, ledger_index="validated", type="escrow")
        resp = client.request(req).result
        last = resp
        objs = resp.get("account_objects", [])
        print(f"[escrow_exists] attempt {attempt+1}/{retries}, escrows found: {len(objs)}")
        for obj in objs:
            if obj.get("Destination") == destination and str(obj.get("Amount")) == str(amount):
                return True
        time.sleep(delay_s)

    print("\n[escrow_exists] Ledger response (debug):")
    print(json.dumps(last, indent=2))
    return False

def get_first_escrow_object(owner_address: str):
    req = AccountObjects(account=owner_address, ledger_index="validated", type="escrow")
    resp = client.request(req).result
    objs = resp.get("account_objects", [])
    return objs[0] if objs else None

init_db()

if gov_count() < 10:
    print("\nSeeding DB with 10 GOV entity wallets (testnet faucet)...")
    for i in range(1, 11):
        w = generate_faucet_wallet(client, debug=True)
        entity_key = f"gov_{i:02d}"
        name = f"Government Entity {i:02d}"
        seed = w.seed
        insert_gov(entity_key, name, w.classic_address, seed)
        print(entity_key, w.classic_address)
else:
    print("\nDB already has 10 GOV entities.")
    print(list_gov())

gov_full = list_gov_full()
gov_addresses = {g["classic_address"]: g for g in gov_full}

print("\nCreating a new wallet (PAYER) and funding it with Testnet XRP...") # Create a wallet using the Testnet faucet
payer_wallet = generate_faucet_wallet(client, debug=True)
payer_addr = payer_wallet.classic_address
print(f"Payer's Wallet: {payer_addr}")
print(f"Account Testnet Explorer URL: ")
print(f" https://testnet.xrpl.org/accounts/{payer_addr}")

scam_wallet = generate_faucet_wallet(client, debug=True)
scam_address = scam_wallet.classic_address
print("\nSCAM address (simulated email address):", scam_address)
print(f" https://testnet.xrpl.org/accounts/{scam_address}")

pasted_destination = scam_address  

verified = pasted_destination in gov_addresses

if verified:
    matched_gov = gov_addresses[pasted_destination]
    print("\n✅ VERIFIED destination address.")
    print("Matched entity:", matched_gov["entity_key"], "-", matched_gov["name"])
    cancel_extra = cancel_seconds_verified

else:
    print("\n⚠️ WARNING: destination address is NOT verified (not in gov allowlist).")
    print("Pasted:", pasted_destination)
    print("Proceeding anyway (warning only).")
    cancel_extra = cancel_seconds_unverified


base = ledger_close_time()
SAFE_MIN_FINISH_DELTA = 30  
SAFE_MIN_CANCEL_EXTRA = 30
finish_after = base + max(int(finish_seconds), SAFE_MIN_FINISH_DELTA)
cancel_after = finish_after + max(1, int(cancel_extra), SAFE_MIN_CANCEL_EXTRA)


print("\nDEBUG ledger base close_time:", base)
print("DEBUG finish_after:", finish_after, f"(+{finish_after - base}s)")
print("DEBUG cancel_after:", cancel_after, f"(finish + {cancel_after - finish_after}s)")


amount_drops = "1000000"  # 1 XRP

new_escrow = EscrowCreate(
    account=payer_addr,
    amount=amount_drops,
    destination=pasted_destination,  
    finish_after=finish_after,
    cancel_after=cancel_after,
    condition=condition,
)


print("\nSubmitting EscrowCreate...")
escrow_resp = submit_and_wait(new_escrow, client, payer_wallet)
print(json.dumps(escrow_resp.result, indent=2))

escrow_owner = payer_addr

tx_result = escrow_resp.result.get("meta", {}).get("TransactionResult")
validated = escrow_resp.result.get("validated")
print("EscrowCreate validated:", validated, "result:", tx_result)
if not validated or tx_result != "tesSUCCESS":
    raise RuntimeError("EscrowCreate failed; cannot continue.")

offer_sequence = int(escrow_resp.result["tx_json"]["Sequence"])
escrow_owner = payer_addr
print("Using offer_sequence:", offer_sequence)


if not escrow_exists(escrow_owner, pasted_destination, amount_drops):
    raise RuntimeError("Escrow not visible on ledger after create (node lag or mismatch).")

esc_obj = get_first_escrow_object(escrow_owner)
print("\nDEBUG Escrow object (first):")
print(json.dumps(esc_obj, indent=2))



if verified:
    # receiver is one of the gov wallets -> load the matching gov seed
    receiver_wallet = Wallet.from_seed(gov_addresses[pasted_destination]["seed"])
else:
    # for simulation only, we have the scam wallet seed too
    receiver_wallet = scam_wallet 

if default_mode == "FINISH":
    wait_s = max(0, (finish_after - ledger_close_time()) + 10)
    print(f"\nWaiting ~{wait_s}s before trying EscrowFinish...")
    time.sleep(wait_s)

    fulfillment = "A0228020" + preimage_hex.upper()

    print("\nSubmitting EscrowFinish (receiver claims with fulfillment)...")
    last_err = None

    for i in range(20):
        try:
            # IMPORTANT: recreate tx each retry so LastLedgerSequence is fresh
            finish_tx = EscrowFinish(
                account=pasted_destination,   # ✅ receiver submits finish
                owner=escrow_owner,
                offer_sequence=offer_sequence,
                condition=condition,
                fulfillment=fulfillment,      # ✅ must satisfy condition
            )

            # IMPORTANT: must sign with the receiver's wallet
            finish_resp = submit_and_wait(finish_tx, client, receiver_wallet)
            print(json.dumps(finish_resp.result, indent=2))
            break

        except Exception as e:
            last_err = e
            ct = ledger_close_time()
            print(f"[Retry {i+1}/20] Finish failed ({e}). Ledger close_time={ct}")
            time.sleep(4)
    else:
        raise last_err

elif default_mode == "CANCEL":
    wait_s = finish_seconds + cancel_extra + 5
    print(f"\nWaiting ~{wait_s}s before trying EscrowCancel...")
    time.sleep(wait_s)

    cancel_tx = EscrowCancel(
        account=payer_addr,          # owner submits cancel
        owner=escrow_owner,
        offer_sequence=offer_sequence,
    )

    print("\nSubmitting EscrowCancel (payer refunds)...")
    cancel_resp = submit_and_wait(cancel_tx, client, payer_wallet)
    print(json.dumps(cancel_resp.result, indent=2))

else:
    raise ValueError("Default must be 'FINISH'  or 'CANCEL'")