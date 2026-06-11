import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getFeedbackForDate, upsertMessFeedback, type MessFeedbackInput } from '@/services/messFeedback.service'

export function useMessFeedback(date: string) {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: feedback = [] } = useQuery({
    queryKey: ['mess-feedback', userId, date],
    queryFn:  () => getFeedbackForDate(userId, date),
    enabled:  !!userId,
  })

  const { mutate: rate, isPending: rating } = useMutation({
    mutationFn: (payload: Omit<MessFeedbackInput, 'userId' | 'hostelId'>) =>
      upsertMessFeedback({ ...payload, userId, hostelId }),
    onSuccess: () => {
      toast.success('Thanks for your feedback!')
      qc.invalidateQueries({ queryKey: ['mess-feedback', userId, date] })
    },
    onError: () => toast.error('Failed to submit feedback'),
  })

  return { feedback, rate, rating }
}
