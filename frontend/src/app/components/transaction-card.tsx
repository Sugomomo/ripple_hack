import { Clock, AlertTriangle, CheckCircle, X, Edit2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface Transaction {
  id: string;
  from_address: string;
  to_address: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  created_at: Date;
  escrow_end_time: Date;
  is_recipient_verified: boolean;
}

interface TransactionCardProps {
  transaction: Transaction;
  current_wallet: string;
  on_modify: (transaction: Transaction) => void;
  on_cancel: (id: string) => void;
  on_claim: (id: string) => void;
}

export function TransactionCard({
  transaction,
  current_wallet,
  on_modify,
  on_cancel,
  on_claim,
}: TransactionCardProps) {
  const is_sender = transaction.from_address === current_wallet;
  const time_remaining = transaction.escrow_end_time.getTime() - Date.now();
  const is_claimable = time_remaining <= 0 && transaction.status === "pending";
  const hours_remaining = Math.max(0, Math.ceil(time_remaining / (1000 * 60 * 60)));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">
              {is_sender ? "To:" : "From:"}
            </span>
            <span className="font-mono text-sm">
              {is_sender ? transaction.to_address : transaction.from_address}
            </span>
            {!transaction.is_recipient_verified && (
              <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                <AlertTriangle className="w-3 h-3" />
                Unverified
              </div>
            )}
            {transaction.is_recipient_verified && (
              <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                Verified
              </div>
            )}
          </div>
          
          <div className="text-2xl font-bold text-gray-900 mb-2">
            {transaction.amount.toFixed(4)} XRP
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            {transaction.status === "pending" && !is_claimable && (
              <span className="font-medium text-blue-600">
                {hours_remaining} hour{hours_remaining !== 1 ? "s" : ""} left in escrow
              </span>
            )}
            {transaction.status === "pending" && is_claimable && (
              <span className="text-green-600 font-medium">Ready to claim</span>
            )}
            {transaction.status === "completed" && (
              <span className="text-green-600">Completed {formatDistanceToNow(transaction.created_at)} ago</span>
            )}
            {transaction.status === "cancelled" && (
              <span className="text-red-600">Cancelled</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {transaction.status === "pending" && is_sender && !is_claimable && (
            <>
              <button
                onClick={() => on_modify(transaction)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Modify
              </button>
              <button
                onClick={() => on_cancel(transaction.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
          
          {transaction.status === "pending" && !is_sender && is_claimable && (
            <button
              onClick={() => on_claim(transaction.id)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Claim Funds
            </button>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Transaction ID: {transaction.id}
        </div>
      </div>
    </div>
  );
}