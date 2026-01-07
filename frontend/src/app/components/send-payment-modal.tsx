import { useState, useEffect } from "react";
import { X, AlertTriangle, Shield, Search } from "lucide-react";

interface SendPaymentModalProps {
  is_open: boolean;
  on_close: () => void;
  on_send: (to_address: string, amount: number) => void;
  verified_wallets: string[];
  current_wallet: string;
}

export function SendPaymentModal({
  is_open,
  on_close,
  on_send,
  verified_wallets,
  current_wallet,
}: SendPaymentModalProps) {
  const [to_address, set_to_address] = useState("");
  const [amount, set_amount] = useState("");
  const [show_warning, set_show_warning] = useState(false);
  const [suggested_addresses, set_suggested_addresses] = useState<string[]>([]);
  const [proceed_anyway, set_proceed_anyway] = useState(false);

  useEffect(() => {
    if (!to_address) {
      set_suggested_addresses([]);
      set_show_warning(false);
      return;
    }

    const is_verified = verified_wallets.includes(to_address);
    
    if (!is_verified && to_address.length >= 5) {
      // Find similar verified addresses using enhanced similarity algorithm
      const similar = verified_wallets.filter(wallet => {
        const similarity = calculate_similarity(to_address.toLowerCase(), wallet.toLowerCase());
        return similarity > 0.3;
      });
      
      set_suggested_addresses(similar);
      set_show_warning(true);
      set_proceed_anyway(false);
    } else {
      set_suggested_addresses([]);
      set_show_warning(false);
    }
  }, [to_address, verified_wallets]);

  const calculate_similarity = (str1: string, str2: string): number => {
    // Enhanced similarity algorithm for better matching
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Check if one contains most letters of the other (for "govsmed" vs "medgov.sg")
    let common_chars = 0;
    const s1_chars = s1.split('');
    const s2_chars = s2.split('');
    
    for (const char of s1_chars) {
      if (s2_chars.includes(char)) {
        common_chars++;
      }
    }
    
    // Calculate based on common characters and length
    const similarity = common_chars / Math.max(s1.length, s2.length);
    
    // Boost similarity if strings share significant substring
    if (s1.includes(s2.substring(0, 3)) || s2.includes(s1.substring(0, 3))) {
      return Math.min(1, similarity + 0.2);
    }
    
    return similarity;
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!to_address || !amount || parseFloat(amount) <= 0) {
      return;
    }

    const is_verified = verified_wallets.includes(to_address);
    
    if (!is_verified && !proceed_anyway && suggested_addresses.length > 0) {
      // User must acknowledge warning first
      return;
    }

    on_send(to_address, parseFloat(amount));
    set_to_address("");
    set_amount("");
    set_show_warning(false);
    set_proceed_anyway(false);
  };

  if (!is_open) return null;

  const is_verified = verified_wallets.includes(to_address);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Send Payment</h2>
          <button
            onClick={on_close}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handle_submit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Wallet Address
            </label>
            <input
              type="text"
              value={to_address}
              onChange={(e) => set_to_address(e.target.value)}
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            
            {is_verified && (
              <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                <Shield className="w-4 h-4" />
                <span>Verified government wallet</span>
              </div>
            )}
          </div>

          {show_warning && suggested_addresses.length > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-yellow-900 mb-1">
                    Warning: Unverified Wallet Address
                  </div>
                  <div className="text-sm text-yellow-800">
                    This address is not verified. You may be at risk of scams. 
                    Did you mean one of these verified addresses?
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {suggested_addresses.map((address) => (
                  <button
                    key={address}
                    type="button"
                    onClick={() => {
                      set_to_address(address);
                      set_show_warning(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors text-left"
                  >
                    <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-mono text-sm text-gray-900">{address}</span>
                    <span className="ml-auto text-xs text-green-600">Verified</span>
                  </button>
                ))}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={proceed_anyway}
                  onChange={(e) => set_proceed_anyway(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I understand the risks and want to proceed with this unverified address anyway
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (XRP)
            </label>
            <input
              type="number"
              step="0.0001"
              value={amount}
              onChange={(e) => set_amount(e.target.value)}
              placeholder="0.0000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 text-white p-2 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 mb-1">
                  Escrow Protection
                </div>
                <div className="text-sm text-blue-800">
                  Your funds will be locked in escrow for exactly 3 days. During this time, 
                  you can modify the amount or cancel the transaction completely. After 3 days, 
                  the recipient can claim the funds.
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              !to_address || 
              !amount || 
              parseFloat(amount) <= 0 || 
              (show_warning && !proceed_anyway && suggested_addresses.length > 0)
            }
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            Send Payment to Escrow
          </button>
        </form>
      </div>
    </div>
  );
}