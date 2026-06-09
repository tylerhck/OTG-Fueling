"use client";

import { useState, useEffect, useRef } from "react";

interface BookkeepingData {
  totals: {
    fuelRevenue: number;
    serviceFeeRevenue: number;
    subscriptionRevenue: number;
    totalRevenue: number;
    totalGallons: number;
    totalOrders: number;
  };
  monthly: {
    month: string;
    fuelRevenue: number;
    serviceFeeRevenue: number;
    subscriptionRevenue: number;
    totalRevenue: number;
    gallons: number;
    orders: number;
  }[];
}

interface Expense {
  id: string;
  category: string;
  amountCents: number;
  description: string | null;
  receiptImage: string | null;
  expenseDate: string;
}

interface ExpenseData {
  expenses: Expense[];
  categoryTotals: Record<string, number>;
  totalExpenses: number;
}

const CATEGORIES = [
  "Fuel Purchased",
  "Marketing",
  "Vehicle Maintenance",
  "Loan Payment",
  "Insurance",
  "Equipment",
  "Supplies",
  "Software/Subscriptions",
  "Other",
];

export default function BookkeepingPage() {
  const [revenueData, setRevenueData] = useState<BookkeepingData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "year" | "month" | "week" | "today">("all");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // Expense form
  const [expCategory, setExpCategory] = useState("Fuel Purchased");
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [revRes, expRes] = await Promise.all([
        fetch(`/api/admin/bookkeeping?period=${period}`),
        fetch(`/api/admin/expenses?period=${period}`),
      ]);
      if (revRes.ok) setRevenueData(await revRes.json());
      if (expRes.ok) setExpenseData(await expRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [period]);

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress and convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Resize to max 800px wide
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Compress to 70% quality JPEG
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setReceiptPreview(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expAmount || parseFloat(expAmount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          amount: parseFloat(expAmount),
          description: expDescription.trim(),
          date: expDate,
          receiptImage: receiptPreview || null,
        }),
      });
      if (res.ok) {
        setExpAmount("");
        setExpDescription("");
        setReceiptPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setShowExpenseForm(false);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  const fmt = (cents: number) => {
    const abs = Math.abs(cents);
    return `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalRevenue = revenueData?.totals.totalRevenue || 0;
  const totalExpenses = expenseData?.totalExpenses || 0;
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div>
      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingReceipt(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white p-2">
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute top-2 right-2 rounded-full bg-gray-900 text-white w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-gray-700 z-10"
            >
              &times;
            </button>
            <img src={viewingReceipt} alt="Receipt" className="max-h-[85vh] w-auto" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookkeeping</h1>
          <p className="mt-1 text-sm text-gray-500">Revenue, expenses, and net profit</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["today", "week", "month", "year", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p === "all" ? "All Time" : p === "year" ? "This Year" : p === "month" ? "This Month" : p === "week" ? "This Week" : "Today"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Net Profit Banner */}
          <div className={`mt-6 rounded-xl p-6 shadow-sm border ${netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Profit</p>
                <p className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {netProfit >= 0 ? "+" : "-"}{fmt(netProfit)}
                </p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Revenue: <span className="font-medium text-green-700">{fmt(totalRevenue)}</span></p>
                <p>Expenses: <span className="font-medium text-red-700">-{fmt(totalExpenses)}</span></p>
              </div>
            </div>
          </div>

          {/* Net Profit Bar Chart */}
          {revenueData && revenueData.monthly.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Monthly Net Profit</h3>
              <div className="flex items-end gap-2 h-40 overflow-x-auto">
                {revenueData.monthly.map((row) => {
                  // Calculate monthly expenses (approximate by distributing total evenly if no monthly breakdown)
                  const monthlyExpense = expenseData ? Math.round(expenseData.totalExpenses / Math.max(revenueData.monthly.length, 1)) : 0;
                  const monthNet = row.totalRevenue - monthlyExpense;
                  const maxVal = Math.max(...revenueData.monthly.map(m => Math.abs(m.totalRevenue)), 1);
                  const barHeight = Math.max(Math.abs(row.totalRevenue) / maxVal * 100, 4);
                  return (
                    <div key={row.month} className="flex flex-col items-center flex-1 min-w-[40px]">
                      <span className="text-[10px] text-gray-500 mb-1">
                        {fmt(row.totalRevenue)}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${row.totalRevenue >= 0 ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ height: `${barHeight}%`, minHeight: '4px' }}
                      />
                      <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">
                        {row.month.split(' ')[0]?.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue Cards */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue (Credits)</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{fmt(totalRevenue)}</p>
                <p className="mt-1 text-xs text-gray-400">{revenueData?.totals.totalOrders || 0} orders</p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Fuel Charged</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{fmt(revenueData?.totals.fuelRevenue || 0)}</p>
                <p className="mt-1 text-xs text-gray-400">{(revenueData?.totals.totalGallons || 0).toFixed(1)} gal</p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Service Fees</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{fmt(revenueData?.totals.serviceFeeRevenue || 0)}</p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Subscriptions</p>
                <p className="mt-2 text-xl font-bold text-gray-900">{fmt(revenueData?.totals.subscriptionRevenue || 0)}</p>
              </div>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Expenses (Debits)</h2>
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
              >
                {showExpenseForm ? "Cancel" : "+ Add Expense"}
              </button>
            </div>

            {/* Add Expense Form */}
            {showExpenseForm && (
              <form onSubmit={addExpense} className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={expDescription}
                      onChange={(e) => setExpDescription(e.target.value)}
                      placeholder="What was it for?"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {submitting ? "..." : "Add"}
                    </button>
                  </div>
                </div>
                {/* Receipt Upload */}
                <div className="mt-3 flex items-center gap-3">
                  <label className="cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-red-400 hover:text-red-600 transition-colors">
                    📷 Attach Receipt
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleReceiptSelect}
                      className="hidden"
                    />
                  </label>
                  {receiptPreview && (
                    <div className="flex items-center gap-2">
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="h-12 w-12 rounded-lg object-cover border border-gray-200 cursor-pointer"
                        onClick={() => setViewingReceipt(receiptPreview)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </form>
            )}

            {/* Category Breakdown Cards */}
            {expenseData && Object.keys(expenseData.categoryTotals).length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-4">
                {Object.entries(expenseData.categoryTotals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, cents]) => (
                    <div key={cat} className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 truncate">{cat}</p>
                      <p className="text-lg font-bold text-red-700">{fmt(cents)}</p>
                    </div>
                  ))}
                <div className="rounded-lg bg-red-50 p-3 shadow-sm border border-red-200">
                  <p className="text-xs text-red-600 font-medium">Total Expenses</p>
                  <p className="text-lg font-bold text-red-700">{fmt(totalExpenses)}</p>
                </div>
              </div>
            )}

            {/* Recent Expenses List */}
            {expenseData && expenseData.expenses.length > 0 && (
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700">Receipt</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {expenseData.expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">
                            {new Date(exp.expenseDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{exp.description || "—"}</td>
                          <td className="px-4 py-3 text-center">
                            {exp.receiptImage ? (
                              <button
                                onClick={() => setViewingReceipt(exp.receiptImage!)}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                📷 View
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-red-700">{fmt(exp.amountCents)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteExpense(exp.id)}
                              className="text-xs text-gray-400 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {expenseData && expenseData.expenses.length === 0 && !showExpenseForm && (
              <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-100 text-center text-gray-500">
                No expenses recorded yet. Click &quot;+ Add Expense&quot; to start tracking.
              </div>
            )}
          </div>

          {/* Monthly Revenue Breakdown */}
          {revenueData && revenueData.monthly.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Revenue Breakdown</h2>
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Month</th>
                        <th className="px-4 py-3 text-right font-medium text-blue-600">Fuel</th>
                        <th className="px-4 py-3 text-right font-medium text-green-600">Service Fees</th>
                        <th className="px-4 py-3 text-right font-medium text-purple-600">Subscriptions</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Total</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Gallons</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {revenueData.monthly.map((row) => (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.fuelRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.serviceFeeRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt(row.subscriptionRevenue)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(row.totalRevenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.gallons.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
