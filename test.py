from xrpl.clients import JsonRpcClient
from xrpl.wallet import generate_faucet_wallet
from xrpl.core import addresscodec
from xrpl.models.requests.account_info import AccountInfo
from xrpl.models.requests.account_objects import AccountObjects
from xrpl.models.transactions import EscrowCreate, EscrowFinish, EscrowCancel
from xrpl.transaction import submit_and_wait

from xrpl.utils import datetime_to_ripple_time
import json 
import time 
from datetime import datetime 
default_mode = "FINISH"


json_rpc_url = "https://s.altnet.rippletest.net:51234/"
client = JsonRpcClient(json_rpc_url) #connecting to testnet


print("\nCreating a new wallet (PAYER) and funding it with Testnet XRP...") # Create a wallet using the Testnet faucet
payer_test_wallet = generate_faucet_wallet(client, debug=True)
payer_test_account = payer_test_wallet.classic_address
print(f"Payer's Wallet: {payer_test_account}")
print(f"Account Testnet Explorer URL: ")
print(f" https://testnet.xrpl.org/accounts/{payer_test_account}")

print("\nCreating a new wallet (RECIEVER) and funding it with Testnet XRP...") # Create a wallet using the Testnet faucet
reciever_test_wallet = generate_faucet_wallet(client, debug=True)
reciever_test_account = reciever_test_wallet.classic_address
print(f"reciever's Wallet: {reciever_test_account}")
print(f"Account Testnet Explorer URL: ")
print(f" https://testnet.xrpl.org/accounts/{reciever_test_account}")

def show_acc_info(address: str): 
    print("\nGetting account info...") #account info 
    acct_info = AccountInfo(
        account=address,
        ledger_index="validated",
        strict=True,
    )
    response = client.request(acct_info)
    result = response.result
    print("Response Status: ", response.status)
    print(json.dumps(response.result, indent=4, sort_keys=True))

''' #for test
show_acc_info(payer_test_account)  
show_acc_info(reciever_test_account)
'''

def ripple_time_now(seconds:int) -> int:
    now = datetime_to_ripple_time(datetime.now())
    return now + int(seconds)

amount_drops = "1000000"
finish = ripple_time_now(10)
cancel = ripple_time_now(60)

new_escrow = EscrowCreate(
    account=payer_test_account,
    amount=amount_drops,
    destination=reciever_test_account,
    finish_after=finish,
    cancel_after=cancel,
)
print("\nSubmitting EscrowCreate...")
escrow_resp = submit_and_wait(new_escrow, client, payer_test_wallet)
print(json.dumps(escrow_resp.result, indent=2))


escrow_owner = payer_test_account
escrow_id = escrow_resp.result['tx_json']['Sequence']

if default_mode == 'FINISH':
    #time.sleep(12) #to fast forward, for testing purposes 
    expire_escrow = EscrowFinish(
        account=reciever_test_account,
        owner=escrow_owner,
        offer_sequence=int(escrow_id),
    )
    print("\nSubmitting EscrowFinish (GOV claims)...")
    finish_resp = submit_and_wait(expire_escrow, client, reciever_test_wallet)
    print(json.dumps(finish_resp.result, indent=2))

elif default_mode == 'CANCEL':
    #time.sleep(65) #to fast forward, for testing purpose 
    cancel_escrow = EscrowCancel(
        account=payer_test_account,
        owner=escrow_owner,
        offer_sequence=int(escrow_id),
    )

    print("\nSubmitting EscrowCancel (PAYER refunds)...")
    cancel_resp = submit_and_wait(cancel_escrow, client, payer_test_wallet)
    print(json.dumps(cancel_resp.result, indent=2))
