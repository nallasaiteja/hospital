import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  FileCheck,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

interface BankTx {
  id: string;
  transaction_date: string;
  reference_number: string;
  description: string;
  transaction_type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: string;
  is_reconciled: boolean;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  ifsc_code: string;
  current_balance: string;
  is_active: boolean;
  transactions: BankTx[];
}

export const BankingPage: React.FC = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await billingFinanceService.getBankAccounts();
      setBankAccounts(data || []);
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0]);
      } else if (selectedAccount) {
        const updated = data.find((a: any) => a.id === selectedAccount.id);
        if (updated) setSelectedAccount(updated);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReconcile = async (txId: string) => {
    try {
      setError(null);
      await billingFinanceService.reconcileBankTransaction(txId);
      setSuccessMsg('Bank transaction matched and reconciled.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const totalLiquidity = bankAccounts.reduce((s, a) => s + parseFloat(a.current_balance || '0'), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-sky-400" />
            Banking & Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-400">
            Real bank account registers, statement import verification, and automated transaction matching.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Banking Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {bankAccounts.map((acc) => (
          <div
            key={acc.id}
            onClick={() => setSelectedAccount(acc)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedAccount?.id === acc.id
                ? 'bg-slate-900 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200">{acc.bank_name}</span>
              <Badge variant="info">{acc.account_type}</Badge>
            </div>
            <p className="text-xs font-mono text-slate-400">Acc: {acc.account_number}</p>
            <p className="text-xs font-mono text-slate-500 mb-3">IFSC: {acc.ifsc_code}</p>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-400">Ledger Balance:</span>
              <span className="font-mono font-bold text-sky-400 text-lg">
                ₹{parseFloat(acc.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Statement Reconciliation Area */}
      {selectedAccount && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h2 className="font-bold text-slate-100 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-sky-400" />
                Bank Statement & Reconciliation Feed — {selectedAccount.bank_name}
              </h2>
              <p className="text-xs text-slate-400">
                Match internal financial vouchers against actual bank statement entries.
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Unreconciled Entries:{' '}
              <span className="text-amber-400 font-bold">
                {selectedAccount.transactions?.filter((t) => !t.is_reconciled).length || 0}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Txn Date</th>
                  <th className="px-4 py-3">Bank Reference</th>
                  <th className="px-4 py-3">Transaction Narration</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {selectedAccount.transactions?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No statement transactions imported for this bank account.
                    </td>
                  </tr>
                ) : (
                  selectedAccount.transactions?.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-sky-400">
                        {tx.reference_number}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{tx.description}</td>
                      <td className="px-4 py-3">
                        {tx.transaction_type === 'DEPOSIT' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Withdrawal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
                        ₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tx.is_reconciled ? (
                          <Badge variant="success">Reconciled</Badge>
                        ) : (
                          <Badge variant="warning">Unmatched</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!tx.is_reconciled && (
                          <button
                            onClick={() => handleReconcile(tx.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-medium transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Match & Reconcile
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
