import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowUpRight, ArrowDownLeft, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import {
  getExpenses, getBalances, getHouseholdMembers,
  createExpense, type NewExpense,
} from '@/services/expenses.service'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate, getInitials, getAvatarColor } from '@/lib/utils'

const CATEGORIES = [
  'rent', 'electricity', 'water', 'internet',
  'groceries', 'household', 'food', 'transport', 'other',
]

type SplitMode = 'equal' | 'custom' | 'percent'

export default function ExpensesPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''
  const userId   = user?.id ?? ''

  const [showAdd, setShowAdd] = useState(false)

  // ── Add expense form state ──
  const [title,      setTitle]      = useState('')
  const [amount,     setAmount]     = useState('')
  const [category,   setCategory]   = useState('other')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [paidBy,     setPaidBy]     = useState(userId)
  const [splitMode,  setSplitMode]  = useState<SplitMode>('equal')
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', hostelId],
    queryFn:  () => getExpenses(hostelId),
    enabled:  !!hostelId,
  })

  const { data: balances } = useQuery({
    queryKey: ['balances', hostelId, userId],
    queryFn:  () => getBalances(hostelId, userId),
    enabled:  !!hostelId && !!userId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', hostelId],
    queryFn:  () => getHouseholdMembers(hostelId),
    enabled:  !!hostelId,
  })

  const { mutate: addExpense, isPending: adding } = useMutation({
    mutationFn: (payload: NewExpense) => createExpense(payload),
    onSuccess: () => {
      toast.success('Expense added')
      qc.invalidateQueries({ queryKey: ['expenses', hostelId] })
      qc.invalidateQueries({ queryKey: ['balances', hostelId, userId] })
      resetForm()
      setShowAdd(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function resetForm() {
    setTitle(''); setAmount(''); setCategory('other')
    setDate(new Date().toISOString().split('T')[0])
    setPaidBy(userId); setSplitMode('equal')
    setCustomSplits({}); setSelectedMembers([])
  }

  function buildSplits(): { userId: string; amount: number }[] {
    const total    = parseFloat(amount) || 0
    const included = selectedMembers.length > 0 ? selectedMembers : members.map((m) => m.id)

    if (splitMode === 'equal') {
      const share = +(total / included.length).toFixed(2)
      return included.map((uid) => ({ userId: uid, amount: share }))
    }
    if (splitMode === 'custom') {
      return included.map((uid) => ({
        userId: uid,
        amount: parseFloat(customSplits[uid] ?? '0') || 0,
      }))
    }
    if (splitMode === 'percent') {
      return included.map((uid) => ({
        userId: uid,
        amount: +((parseFloat(customSplits[uid] ?? '0') / 100) * total).toFixed(2),
      }))
    }
    return []
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !amount || !hostelId) return
    addExpense({
      hostelId, createdBy: userId, paidBy,
      title, description: '', totalAmount: parseFloat(amount),
      category, date, splits: buildSplits(),
    })
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-dvh bg-canvas pb-28">
      <TopBar title="Expenses" showBack={false} />

      <div className="pt-14 px-4 space-y-5">

        {/* ── Balance summary ── */}
        {balances && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success-light rounded-card p-3 flex flex-col gap-1">
              <ArrowDownLeft size={16} className="text-success" />
              <p className="text-[16px] font-bold text-success">{formatCurrency(balances.iAmOwed)}</p>
              <p className="text-[11px] text-text-tertiary">you're owed</p>
            </div>
            <div className="bg-danger-light rounded-card p-3 flex flex-col gap-1">
              <ArrowUpRight size={16} className="text-danger" />
              <p className="text-[16px] font-bold text-danger">{formatCurrency(balances.iOwe)}</p>
              <p className="text-[11px] text-text-tertiary">you owe</p>
            </div>
            <div className={`rounded-card p-3 flex flex-col gap-1 ${balances.net >= 0 ? 'bg-success-light' : 'bg-danger-light'}`}>
              <Minus size={16} className={balances.net >= 0 ? 'text-success' : 'text-danger'} />
              <p className={`text-[16px] font-bold ${balances.net >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(Math.abs(balances.net))}
              </p>
              <p className="text-[11px] text-text-tertiary">net {balances.net >= 0 ? 'balance' : 'owed'}</p>
            </div>
          </div>
        )}

        {/* ── Add expense form ── */}
        {showAdd && (
          <div className="bg-surface rounded-card shadow-card p-4 space-y-4">
            <p className="text-[16px] font-bold text-text-primary">Add Expense</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <Input
                label="What was it for?"
                placeholder="e.g. Monthly groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Total amount (₹)"
                  type="number"
                  placeholder="1200"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Input
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Category */}
              <div>
                <p className="text-[13px] font-semibold text-text-secondary mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1 rounded-pill text-[12px] font-semibold capitalize transition-colors ${
                        category === cat
                          ? 'bg-primary text-white'
                          : 'bg-surface-raised text-text-secondary border border-border'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid by */}
              <div>
                <p className="text-[13px] font-semibold text-text-secondary mb-2">Paid by</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaidBy(m.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-pill text-[13px] font-semibold transition-colors ${
                        paidBy === m.id
                          ? 'bg-primary text-white'
                          : 'bg-surface-raised text-text-secondary border border-border'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(m.full_name) }}
                      >
                        {getInitials(m.full_name)}
                      </div>
                      {m.full_name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split mode */}
              <div>
                <p className="text-[13px] font-semibold text-text-secondary mb-2">Split</p>
                <div className="flex gap-2 mb-3">
                  {(['equal', 'custom', 'percent'] as SplitMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSplitMode(mode)}
                      className={`flex-1 py-1.5 rounded-pill text-[12px] font-semibold capitalize border-2 transition-colors ${
                        splitMode === mode
                          ? 'bg-primary border-primary text-white'
                          : 'border-border text-text-secondary'
                      }`}
                    >
                      {mode === 'percent' ? '%' : mode}
                    </button>
                  ))}
                </div>

                {/* Member selection + amounts */}
                <div className="space-y-2">
                  {members.map((m) => {
                    const included = selectedMembers.length === 0 || selectedMembers.includes(m.id)
                    const equalShare = amount
                      ? (parseFloat(amount) / (selectedMembers.length || members.length)).toFixed(2)
                      : '0'

                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleMember(m.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 transition-opacity ${!included ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: getAvatarColor(m.full_name) }}
                        >
                          {getInitials(m.full_name)}
                        </button>
                        <p className={`flex-1 text-[13px] font-medium ${!included ? 'text-text-tertiary' : 'text-text-primary'}`}>
                          {m.full_name.split(' ')[0]}
                          {m.id === userId ? ' (you)' : ''}
                        </p>
                        {included && splitMode !== 'equal' ? (
                          <input
                            type="number"
                            placeholder={splitMode === 'percent' ? '%' : '₹'}
                            value={customSplits[m.id] ?? ''}
                            onChange={(e) => setCustomSplits((s) => ({ ...s, [m.id]: e.target.value }))}
                            className="w-20 h-8 bg-surface-raised border border-border rounded-input px-2 text-[13px] text-right"
                          />
                        ) : included ? (
                          <p className="text-[13px] font-semibold text-primary">₹{equalShare}</p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" fullWidth type="button" onClick={() => { resetForm(); setShowAdd(false) }}>
                  Cancel
                </Button>
                <Button variant="dark" fullWidth type="submit" loading={adding}>
                  Add
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── Expense list ── */}
        <div>
          <p className="text-[17px] font-bold text-text-primary mb-3">All Expenses</p>

          {expLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-6 text-center">
              <p className="text-[14px] font-semibold text-text-primary">No expenses yet</p>
              <p className="text-[13px] text-text-secondary mt-1">Add your first shared expense</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => {
                const paidByProfile = exp.profiles
                const splits = exp.expense_splits ?? []
                const mySplit = splits.find((s) => s.user_id === userId)
                const iPayee  = exp.paid_by === userId

                return (
                  <div key={exp.id} className="bg-surface rounded-card shadow-card px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-inner bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-primary capitalize">{exp.category.slice(0,3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">{exp.title}</p>
                      <p className="text-[12px] text-text-tertiary">
                        {formatDate(exp.date, { day: '2-digit', month: 'short' })} ·{' '}
                        Paid by {iPayee ? 'you' : paidByProfile?.full_name?.split(' ')[0]}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-[15px] font-bold text-text-primary">{formatCurrency(exp.total_amount)}</p>
                      {mySplit && (
                        <p className={`text-[11px] font-semibold ${mySplit.is_paid || iPayee ? 'text-success' : 'text-danger'}`}>
                          {iPayee ? 'you paid' : mySplit.is_paid ? 'settled' : `you owe ${formatCurrency(mySplit.amount)}`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-raised active:scale-95 transition-transform z-40"
          aria-label="Add expense"
        >
          <Plus size={24} className="text-white" />
        </button>
      )}
    </div>
  )
}
