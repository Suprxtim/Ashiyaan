import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { getComplaints, getComplaintById, createComplaint, type NewComplaint } from '@/services/complaints.service'
import type { Database } from '@/types/database.types'

type ComplaintStatus = Database['public']['Enums']['complaint_status']

export function useComplaints() {
  const qc     = useQueryClient()
  const user   = useAuthStore((s) => s.user)
  const userId = user?.id ?? ''

  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | undefined>(undefined)

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints', userId, filterStatus],
    queryFn:  () => getComplaints(userId, filterStatus),
    enabled:  !!userId,
  })

  const { mutateAsync: submit, isPending: submitting } = useMutation({
    mutationFn: (payload: NewComplaint) => createComplaint(payload),
    onSuccess: () => {
      toast.success('Complaint submitted successfully')
      qc.invalidateQueries({ queryKey: ['complaints', userId] })
    },
    onError: (err: Error) => {
      toast.error(`Failed to submit: ${err.message}`)
    },
  })

  return { complaints, isLoading, filterStatus, setFilterStatus, submit, submitting }
}

export function useComplaintDetail(id: string) {
  return useQuery({
    queryKey: ['complaint', id],
    queryFn:  () => getComplaintById(id),
    enabled:  !!id,
  })
}
