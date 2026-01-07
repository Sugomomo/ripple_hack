from xrpl.clients import JsonRpcClient
from xrpl.wallet import generate_faucet_wallet
from xrpl.core import addresscodec
from xrpl.models.requests.account_info import AccountInfo
import json 

json_rpc_url = "https://s.altnet.rippletest.net:51234/"
client = JsonRpcClient(json_rpc_url) #connecting to testnet


print("\nCreating a new wallet and funding it with Testnet XRP...") # Create a wallet using the Testnet faucet
test_wallet = generate_faucet_wallet(client, debug=True)
test_account = test_wallet.classic_address
print(f"Wallet: {test_account}")
print(f"Account Testnet Explorer URL: ")
print(f" https://testnet.xrpl.org/accounts/{test_account}")


print("\nGetting account info...") #account info 
acct_info = AccountInfo(
    account=test_account,
    ledger_index="validated",
    strict=True,
)

response = client.request(acct_info)
result = response.result
print("Response Status: ", response.status)
print(json.dumps(response.result, indent=4, sort_keys=True))
