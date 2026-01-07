import { Wallet, Shield, Clock } from "lucide-react";

interface WalletHeaderProps {
  wallet_address: string;
  is_verified: boolean;
  balance: number;
}

export function WalletHeader({ wallet_address, is_verified, balance }: WalletHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-2xl shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm opacity-90">Your Wallet</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{wallet_address}</span>
              {is_verified && (
                <div className="flex items-center gap-1 bg-green-500 px-2 py-1 rounded-full text-xs">
                  <Shield className="w-3 h-3" />
                  Verified
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="text-sm opacity-90 mb-2">Available Balance</div>
        <div className="text-4xl font-bold">{balance.toFixed(4)} XRP</div>
      </div>
    </div>
  );
}