import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { getPayments, getPaymentSummary } from '@/services/payments.service'

export function usePayments() {
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', userId],
    queryFn:  () => getPayments(userId),
    enabled:  !!userId,
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['payment-summary', userId],
    queryFn:  () => getPaymentSummary(userId),
    enabled:  !!userId,
  })

  const pending  = payments.filter((p) => p.status === 'pending' || p.status === 'overdue')
  const paid     = payments.filter((p) => p.status === 'paid')

  // Group pending by current month
  const now          = new Date()
  const currentMonth = payments.filter((p) => {
    const d = new Date(p.due_date ?? p.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  return {
    payments, paymentsLoading,
    summary, summaryLoading,
    pending, paid, currentMonth,
    userId, hostelId,
  }
}
