import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";
import { WalletHeader } from "./components/wallet-header";
import {
  TransactionCard,
  Transaction,
} from "./components/transaction-card";
import { SendPaymentModal } from "./components/send-payment-modal";
import { ModifyTransactionModal } from "./components/modify-transaction-modal";
import { toast } from "sonner";
import { Toaster } from "sonner";

// Demo wallet addresses - one verified, one unverified
const VERIFIED_WALLETS = [
  "medgov.sg", // Singapore Medical Government Wallet (Verified)
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // US Treasury
  "0x8f3Cf7ad21Ca3F2C88A8D0C21c21e9D4b5F7D3E", // Federal Reserve
  "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0", // Department of Commerce
];

const UNVERIFIED_WALLET = "govsmed"; // Common scam address mimicking medgov.sg

type TabType = "pending" | "completed";

function App() {
  // User's wallet (randomly verified or unverified for demo)
  const [user_wallet] = useState(() =>
    Math.random() > 0.5
      ? VERIFIED_WALLETS[0]
      : UNVERIFIED_WALLET,
  );
  const [user_balance, set_user_balance] = useState(10.5847);
  const [is_send_modal_open, set_is_send_modal_open] =
    useState(false);
  const [is_modify_modal_open, set_is_modify_modal_open] =
    useState(false);
  const [selected_transaction, set_selected_transaction] =
    useState<Transaction | null>(null);
  const [active_tab, set_active_tab] =
    useState<TabType>("pending");

  const [transactions, set_transactions] = useState<
    Transaction[]
  >([
    {
      id: "tx_001",
      from_address: user_wallet,
      to_address: "medgov.sg", // User selected the verified address from suggestion
      amount: 0.5,
      status: "pending",
      created_at: new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      ), // 2 days ago
      escrow_end_time: new Date(
        Date.now() + 1 * 24 * 60 * 60 * 1000,
      ), // 1 day remaining
      is_recipient_verified: true,
    },
    {
      id: "tx_002",
      from_address: user_wallet,
      to_address: "govsmed", // User proceeded with unverified address despite warning
      amount: 0.75,
      status: "pending",
      created_at: new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ), // 1 day ago
      escrow_end_time: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000,
      ), // 2 days remaining
      is_recipient_verified: false,
    },
    {
      id: "tx_003",
      from_address: VERIFIED_WALLETS[2],
      to_address: user_wallet,
      amount: 1.25,
      status: "pending",
      created_at: new Date(
        Date.now() - 4 * 24 * 60 * 60 * 1000,
      ), // 4 days ago
      escrow_end_time: new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ), // can claim now
      is_recipient_verified:
        VERIFIED_WALLETS.includes(user_wallet),
    },
    {
      id: "tx_004",
      from_address: user_wallet,
      to_address: VERIFIED_WALLETS[1],
      amount: 0.25,
      status: "completed",
      created_at: new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ),
      escrow_end_time: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ),
      is_recipient_verified: true,
    },
  ]);

  const handle_send_payment = (
    to_address: string,
    amount: number,
  ) => {
    const new_transaction: Transaction = {
      id: `tx_${Date.now()}`,
      from_address: user_wallet,
      to_address,
      amount,
      status: "pending",
      created_at: new Date(),
      escrow_end_time: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000,
      ), // 3 days
      is_recipient_verified:
        VERIFIED_WALLETS.includes(to_address),
    };

    set_transactions([new_transaction, ...transactions]);
    set_user_balance(user_balance - amount);
    set_is_send_modal_open(false);

    toast.success("Payment sent to escrow", {
      description: `${amount.toFixed(4)} XRP will be held for 3 days`,
    });
  };

  const handle_modify_transaction = (
    id: string,
    new_amount: number,
  ) => {
    set_transactions(
      transactions.map((tx) => {
        if (tx.id === id) {
          const amount_diff = new_amount - tx.amount;
          set_user_balance(user_balance - amount_diff);

          toast.success("Transaction updated", {
            description: `Amount changed to ${new_amount.toFixed(4)} XRP`,
          });

          return { ...tx, amount: new_amount };
        }
        return tx;
      }),
    );
  };

  const handle_cancel_transaction = (id: string) => {
    const transaction = transactions.find((tx) => tx.id === id);
    if (transaction) {
      set_transactions(
        transactions.map((tx) =>
          tx.id === id
            ? { ...tx, status: "cancelled" as const }
            : tx,
        ),
      );
      set_user_balance(user_balance + transaction.amount);

      toast.success("Transaction cancelled", {
        description: `${transaction.amount.toFixed(4)} XRP returned to your wallet`,
      });
    }
  };

  const handle_claim_transaction = (id: string) => {
    const transaction = transactions.find((tx) => tx.id === id);
    if (transaction) {
      set_transactions(
        transactions.map((tx) =>
          tx.id === id
            ? { ...tx, status: "completed" as const }
            : tx,
        ),
      );
      set_user_balance(user_balance + transaction.amount);

      toast.success("Funds claimed successfully", {
        description: `${transaction.amount.toFixed(4)} XRP added to your wallet`,
      });
    }
  };

  const open_modify_modal = (transaction: Transaction) => {
    set_selected_transaction(transaction);
    set_is_modify_modal_open(true);
  };

  const pending_transactions = transactions.filter(
    (tx) => tx.status === "pending",
  );
  const completed_transactions = transactions.filter(
    (tx) =>
      tx.status === "completed" || tx.status === "cancelled",
  );

  const pending_sent = pending_transactions.filter(
    (tx) => tx.from_address === user_wallet,
  );

  const pending_received = pending_transactions.filter(
    (tx) => tx.to_address === user_wallet,
  );

  const completed = completed_transactions;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster position="top-right" richColors />

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Crypto Escrow Wallet
            </h1>
            <p className="text-gray-600">
              Secure payments with 3-day escrow protection
            </p>
          </div>

          <button
            onClick={() => set_is_send_modal_open(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Send Payment
          </button>
        </div>

        {/* Wallet Info */}
        <WalletHeader
          wallet_address={user_wallet}
          is_verified={VERIFIED_WALLETS.includes(user_wallet)}
          balance={user_balance}
        />

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-100 p-2 rounded-lg">
                <ArrowUpRight className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm text-gray-600">
                In Escrow (Sent)
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {pending_sent
                .reduce((sum, tx) => sum + tx.amount, 0)
                .toFixed(4)}{" "}
              XRP
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-lg">
                <ArrowDownRight className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-600">
                Pending (Received)
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {pending_received
                .reduce((sum, tx) => sum + tx.amount, 0)
                .toFixed(4)}{" "}
              XRP
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-600">
                Total Transactions
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {transactions.length}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="space-y-6">
          {pending_sent.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-orange-600" />
                Sent Transactions (In Escrow)
              </h2>
              <div className="space-y-4">
                {pending_sent.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    current_wallet={user_wallet}
                    on_modify={open_modify_modal}
                    on_cancel={handle_cancel_transaction}
                    on_claim={handle_claim_transaction}
                  />
                ))}
              </div>
            </div>
          )}

          {pending_received.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-green-600" />
                Received Transactions
              </h2>
              <div className="space-y-4">
                {pending_received.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    current_wallet={user_wallet}
                    on_modify={open_modify_modal}
                    on_cancel={handle_cancel_transaction}
                    on_claim={handle_claim_transaction}
                  />
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Transaction History
              </h2>
              <div className="space-y-4">
                {completed.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    current_wallet={user_wallet}
                    on_modify={open_modify_modal}
                    on_cancel={handle_cancel_transaction}
                    on_claim={handle_claim_transaction}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SendPaymentModal
        is_open={is_send_modal_open}
        on_close={() => set_is_send_modal_open(false)}
        on_send={handle_send_payment}
        verified_wallets={VERIFIED_WALLETS}
        current_wallet={user_wallet}
      />

      <ModifyTransactionModal
        is_open={is_modify_modal_open}
        on_close={() => set_is_modify_modal_open(false)}
        transaction={selected_transaction}
        on_modify={handle_modify_transaction}
      />
    </div>
  );
}

export default App;