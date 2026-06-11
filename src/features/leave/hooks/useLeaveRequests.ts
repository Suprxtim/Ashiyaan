import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import {
  getLeaveRequests, createLeaveRequest, cancelLeaveRequest,
  type NewLeaveRequest,
} from '@/services/leaveRequest.service'
import type { Database } from '@/types/database.types'

type LeaveStatus = Database['public']['Enums']['leave_status']

export function useLeaveRequests() {
  const qc     = useQueryClient()
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const [filterStatus, setFilterStatus] = useState<LeaveStatus | undefined>(undefined)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leave-requests', userId, filterStatus],
    queryFn:  () => getLeaveRequests(userId, filterStatus),
    enabled:  !!userId,
  })

  const { mutateAsync: submit, isPending: submitting } = useMutation({
    mutationFn: (payload: NewLeaveRequest) => createLeaveRequest(payload),
    onSuccess: () => {
      toast.success('Leave request submitted')
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
    },
    onError: (err: Error) => {
      toast.error(`Failed to submit: ${err.message}`)
    },
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id, userId),
    onSuccess: () => {
      toast.success('Leave request cancelled')
      qc.invalidateQueries({ queryKey: ['leave-requests', userId] })
    },
    onError: () => toast.error('Failed to cancel request'),
  })

  return { requests, isLoading, filterStatus, setFilterStatus, submit, submitting, cancel, cancelling }
}
