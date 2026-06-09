"use client";

import { useState, useEffect, useRef } from "react";

interface Credit {
  id: string;
  amountCents: number;
  description: string | null;
  creditDate: string;
}

interface Expense {
  id: string;
  category: string;
  amountCents: number;
  description: string | null;
  receiptImage: string | null;
  expenseDate: string;
}

interface BookkeepingData {
  totals: {
    totalCredits: number;
    totalExpenses: number;
    netProfit: number;
  };
  monthly: {
    month: string;
    credits: number;
    expenses: number;
    netProfit: number;
  }[];
  credits: Credit[];
  expenses: Expense[];
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
  const [data, setData] = useState<BookkeepingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "year" | "month" | "week" | "today">("all");

  // Credit form
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [creditDate, setCreditDate] = useState(new Date().toISOString().split("T")[0]);
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expCategory, setExpCategory] = useState("Fuel Purchased");
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Receipt viewer
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bookkeeping?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch bookkeeping data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [period]);

  // Credit handlers
  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!creditAmount || parseFloat(creditAmount) <= 0) return;
    setCreditSubmitting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(creditAmount),
          description: creditDescription.trim(),
          date: creditDate,
        }),
      });
      if (res.ok) {
        setCreditAmount("");
        setCreditDescription("");
        setCreditDate(new Date().toISOString().split("T")[0]);
        setShowCreditForm(false);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setCreditSubmitting(false);
    }
  }

  async function deleteCredit(id: string) {
    if (!confirm("Delete this credit entry?")) return;
    await fetch("/api/admin/credits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  // Expense handlers
  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
    setExpSubmitting(true);
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
      setExpSubmitting(false);
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

  const totalCredits = data?.totals.totalCredits || 0;
  const totalExpenses = data?.totals.totalExpenses || 0;
  const netProfit = data?.totals.netProfit || 0;

  // Category totals from expenses
  const categoryTotals: Record<string, number> = {};
  if (data?.expenses) {
    for (const exp of data.expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amountCents;
    }
  }

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
          <p className="mt-1 text-sm text-gray-500">Manual credits, expenses, and net profit</p>
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
                <p>Credits: <span className="font-medium text-green-700">{fmt(totalCredits)}</span></p>
                <p>Expenses: <span className="font-medium text-red-700">-{fmt(totalExpenses)}</span></p>
              </div>
            </div>
          </div>

          {/* Monthly Net Profit Bar Chart */}
          {data && data.monthly.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Monthly Net Profit</h3>
              <div className="flex items-end gap-2 h-40 overflow-x-auto">
                {data.monthly.map((row) => {
                  const maxVal = Math.max(...data.monthly.map(m => Math.abs(m.netProfit)), 1);
                  const barHeight = Math.max(Math.abs(row.netProfit) / maxVal * 100, 4);
                  return (
                    <div key={row.month} className="flex flex-col items-center flex-1 min-w-[50px]">
                      <span className="text-[10px] text-gray-500 mb-1">
                        {row.netProfit >= 0 ? "+" : "-"}{fmt(row.netProfit)}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${row.netProfit >= 0 ? "bg-green-500" : "bg-red-400"}`}
                        style={{ height: `${barHeight}%`, minHeight: "4px" }}
                      />
                      <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">
                        {row.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credits Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Credits (Income)</h2>
              <button
                onClick={() => setShowCreditForm(!showCreditForm)}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition-colors"
              >
                {showCreditForm ? "Cancel" : "+ Add Credit"}
              </button>
            </div>

            {/* Add Credit Form */}
            {showCreditForm && (
              <form onSubmit={addCredit} className="mb-4 rounded-xl bg-white p-5 shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={creditDate}
                      onChange={(e) => setCreditDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={creditDescription}
                      onChange={(e) => setCreditDescription(e.target.value)}
                      placeholder="e.g. Stripe settlement, Cash payment"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={creditSubmitting}
                      className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      {creditSubmitting ? "..." : "Add Credit"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Credits List */}
            {data && data.credits.length > 0 && (
              <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden mb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.credits.map((credit) => (
                        <tr key={credit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">
                            {new Date(credit.creditDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{credit.description || "—"}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-700">+{fmt(credit.amountCents)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteCredit(credit.id)}
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

            {data && data.credits.length === 0 && !showCreditForm && (
              <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-100 text-center text-gray-500 mb-4">
                No credits recorded yet. Click &quot;+ Add Credit&quot; to log income (e.g. when Stripe settles to your bank).
              </div>
            )}
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
                      disabled={expSubmitting}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {expSubmitting ? "..." : "Add"}
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
            {Object.keys(categoryTotals).length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-4">
                {Object.entries(categoryTotals)
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
            {data && data.expenses.length > 0 && (
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
                      {data.expenses.map((exp) => (
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

            {data && data.expenses.length === 0 && !showExpenseForm && (
              <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-100 text-center text-gray-500">
                No expenses recorded yet. Click &quot;+ Add Expense&quot; to start tracking.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
