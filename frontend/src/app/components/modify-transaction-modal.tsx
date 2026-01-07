import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Transaction } from "./transaction-card";

interface ModifyTransactionModalProps {
  is_open: boolean;
  on_close: () => void;
  transaction: Transaction | null;
  on_modify: (id: string, new_amount: number) => void;
}

export function ModifyTransactionModal({
  is_open,
  on_close,
  transaction,
  on_modify,
}: ModifyTransactionModalProps) {
  const [new_amount, set_new_amount] = useState("");

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction || !new_amount || parseFloat(new_amount) <= 0) {
      return;
    }

    on_modify(transaction.id, parseFloat(new_amount));
    set_new_amount("");
    on_close();
  };

  if (!is_open || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Modify Transaction</h2>
          <button
            onClick={on_close}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handle_submit} className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-sm text-gray-600">Transaction to:</div>
            <div className="font-mono text-sm text-gray-900">{transaction.to_address}</div>
            <div className="text-sm text-gray-600 mt-3">Current amount:</div>
            <div className="text-2xl font-bold text-gray-900">{transaction.amount.toFixed(4)} XRP</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Amount (XRP)
            </label>
            <input
              type="number"
              step="0.0001"
              value={new_amount}
              onChange={(e) => set_new_amount(e.target.value)}
              placeholder={transaction.amount.toString()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                You can modify this transaction amount as long as it's still in escrow. 
                The 3-day escrow period will continue from the original transaction time.
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={on_close}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!new_amount || parseFloat(new_amount) <= 0}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update Amount
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}