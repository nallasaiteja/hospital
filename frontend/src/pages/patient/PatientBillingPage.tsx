import React, { useState, useEffect } from 'react';
import { CreditCard, Search, RefreshCw, FileText, ShieldCheck, Download } from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

export const PatientBillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Gateway payment modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [gatewayOrder, setGatewayOrder] = useState<any | null>(null);

  // Receipt preview modal state
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invData, rcpData] = await Promise.all([
        billingFinanceService.getInvoices(),
        billingFinanceService.getReceipts().catch(() => [])
      ]);
      setInvoices(invData || []);
      setReceipts(rcpData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = invoices.filter((inv) => {
    return (
      (inv.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.encounter_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalOutstanding = invoices.reduce((s, i) => s + parseFloat(i.balance_amount || '0'), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.paid_amount || '0'), 0);

  const handleInitiatePayment = async (inv: any) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.balance_amount);
    setGatewayOrder(null);
    setIsPayModalOpen(true);
  };

  const handleCreateGatewayOrder = async () => {
    if (!selectedInvoice) return;
    try {
      setPayLoading(true);
      setError(null);
      const order = await billingFinanceService.createGatewayOrder({
        invoice_id: selectedInvoice.id,
        amount: payAmount
      });
      setGatewayOrder(order);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setPayLoading(false);
    }
  };

  const handleSimulateSandboxPayment = async () => {
    if (!gatewayOrder) return;
    try {
      setPayLoading(true);
      setError(null);
      await billingFinanceService.verifyGatewayPayment({
        razorpay_order_id: gatewayOrder.razorpay_order_id,
        razorpay_payment_id: `pay_sim_${Date.now()}`,
        razorpay_signature: 'sandbox_verified_signature'
      });
      setSuccessMsg(`Payment of ₹${payAmount} completed successfully via gateway.`);
      setIsPayModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-emerald-400" />
            Billing & Invoices
          </h1>
          <p className="text-sm text-slate-400">
            Itemized hospital bills, cashier payment receipts, and secure online settlement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search invoice number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Amount Paid</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <span className="text-xs text-slate-500">Cleared through cashier counter & online gateway</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Balance Due</span>
          <p className="text-2xl font-bold text-amber-400 mt-1">₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <span className="text-xs text-slate-500">Payable online via UPI / Card or at Cashier Counter</span>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
            Loading your hospital invoices...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No invoices on file</p>
            <p className="text-xs text-slate-500 mt-1">
              You do not have any pending or past hospital billing statements.
            </p>
          </div>
        ) : (
          filtered.map((inv) => (
            <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400 text-sm">{inv.invoice_number}</span>
                    <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'danger'}>
                      {inv.status}
                    </Badge>
                    <Badge variant="neutral">{inv.encounter_type}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Invoice Date: {new Date(inv.invoice_date).toLocaleDateString()} &bull; Branch: {inv.branch_name}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-xs text-slate-400 block">Total Invoiced</span>
                    <span className="font-mono font-bold text-slate-100 text-base">
                      ₹{parseFloat(inv.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {parseFloat(inv.balance_amount) > 0 && (
                    <div className="border-l border-slate-800 pl-4">
                      <span className="text-xs text-amber-400 block font-semibold">Balance Due</span>
                      <span className="font-mono font-bold text-amber-300 text-base">
                        ₹{parseFloat(inv.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {inv.items && inv.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Service / Medication</th>
                        <th className="py-2 px-3 text-center">Type</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price (₹)</th>
                        <th className="py-2 px-3 text-right">Subtotal (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {inv.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2 px-3 font-medium text-slate-200">
                            {item.description}
                            {item.is_package_covered && (
                              <span className="ml-2 text-[10px] text-cyan-400 font-semibold bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-800">
                                Package Covered
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-400">{item.item_type}</td>
                          <td className="py-2 px-3 text-center font-mono">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-100">
                            ₹{parseFloat(item.line_total || item.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs text-slate-400 flex flex-wrap gap-4">
                  {parseFloat(inv.deposit_applied_amount || '0') > 0 && (
                    <span className="text-cyan-400">Advance Applied: ₹{inv.deposit_applied_amount}</span>
                  )}
                  {parseFloat(inv.discount_amount || '0') > 0 && (
                    <span className="text-emerald-400">Discount: ₹{inv.discount_amount}</span>
                  )}
                  {parseFloat(inv.tax_amount || '0') > 0 && (
                    <span className="text-slate-400">Tax (GST): ₹{inv.tax_amount}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewInvoice(inv)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" /> View Statement
                  </button>
                  {parseFloat(inv.balance_amount) > 0 && (
                    <button
                      onClick={() => handleInitiatePayment(inv)}
                      className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Pay Online (₹{parseFloat(inv.balance_amount).toFixed(2)})
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: PAY ONLINE VIA GATEWAY */}
      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title={`Online Payment — ${selectedInvoice?.invoice_number}`}>
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-4 rounded-xl space-y-2 border border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Patient:</span>
              <span className="font-semibold text-white">{selectedInvoice?.patient_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Outstanding Balance:</span>
              <span className="font-bold text-amber-400 font-mono">₹{selectedInvoice?.balance_amount}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Amount to Pay Now (₹)</label>
            <input
              type="number"
              step="0.01"
              max={selectedInvoice?.balance_amount}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Supports full or partial balance payment.</span>
          </div>

          {!gatewayOrder ? (
            <button
              onClick={handleCreateGatewayOrder}
              disabled={payLoading || !payAmount || parseFloat(payAmount) <= 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              {payLoading ? 'Initiating Gateway Session...' : 'Proceed to Secure Checkout'}
            </button>
          ) : (
            <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Gateway Order Generated
              </div>
              <div className="text-xs text-slate-300 space-y-1 font-mono">
                <div>Order ID: <span className="text-white">{gatewayOrder.razorpay_order_id}</span></div>
                <div>Amount: <span className="text-emerald-400">₹{gatewayOrder.amount} {gatewayOrder.currency}</span></div>
                <div>Status: <span className="text-amber-400">{gatewayOrder.status}</span></div>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleSimulateSandboxPayment}
                  disabled={payLoading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition"
                >
                  {payLoading ? 'Verifying with Bank...' : 'Authorize Payment (Gateway Sandbox Verification)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: VIEW ITEMIZED STATEMENT */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Hospital Statement — ${viewInvoice?.invoice_number}`}>
        {viewInvoice && (
          <div className="space-y-4 text-xs text-slate-300">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
              <div>
                <h4 className="font-bold text-white text-base">Apollo Multi-Specialty Hospital</h4>
                <p className="text-slate-400">Central Inpatient & Outpatient Billing Department</p>
                <p className="text-slate-400 mt-1">Invoice Date: {new Date(viewInvoice.invoice_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-cyan-400 text-sm block">{viewInvoice.invoice_number}</span>
                <span className="text-slate-400">MRN: {viewInvoice.patient_mrn}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-slate-200">Patient Details:</span>
              <div className="bg-slate-800/40 p-2.5 rounded-lg grid grid-cols-2 gap-2 text-slate-300">
                <div>Name: <span className="font-semibold text-white">{viewInvoice.patient_name}</span></div>
                <div>Encounter: <span className="font-semibold text-white">{viewInvoice.encounter_type}</span></div>
                <div>Status: <span className="font-semibold text-emerald-400">{viewInvoice.status}</span></div>
                <div>Branch: <span className="text-slate-300">{viewInvoice.branch_name}</span></div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {viewInvoice.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium text-white">{item.description}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right font-mono">₹{item.unit_price}</td>
                      <td className="p-2 text-right font-mono text-white">₹{item.line_total || item.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-right font-mono pt-2 border-t border-slate-800">
              <div>Subtotal: ₹{viewInvoice.subtotal}</div>
              {parseFloat(viewInvoice.discount_amount || '0') > 0 && (
                <div className="text-emerald-400">Discount: -₹{viewInvoice.discount_amount}</div>
              )}
              {parseFloat(viewInvoice.deposit_applied_amount || '0') > 0 && (
                <div className="text-cyan-400">Advance Deposit Settled: -₹{viewInvoice.deposit_applied_amount}</div>
              )}
              <div className="text-sm font-bold text-white pt-1">Final Payable: ₹{viewInvoice.total_amount}</div>
              <div className="text-emerald-400">Amount Paid: ₹{viewInvoice.paid_amount}</div>
              <div className="text-sm font-bold text-amber-400">Outstanding Balance: ₹{viewInvoice.balance_amount}</div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
