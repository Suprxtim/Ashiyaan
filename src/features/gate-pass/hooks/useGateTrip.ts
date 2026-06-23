import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import {
  getActiveTripForStudent,
  getMyTrips,
  createTrip,
  cancelTrip,
} from '@/services/gateTrip.service'

export function useGateTrip() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? ''
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: activeTrip, isLoading: tripLoading } = useQuery({
    queryKey: ['active-trip', userId],
    queryFn:  () => getActiveTripForStudent(userId),
    enabled:  !!userId,
    refetchInterval: 30_000,
  })

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['my-trips', userId],
    queryFn:  () => getMyTrips(userId),
    enabled:  !!userId,
  })

  const { mutate: submitTrip, isPending: submitting } = useMutation({
    mutationFn: (params: { destination: string; purpose?: string; expectedReturnAt: string }) =>
      createTrip({ userId, hostelId, ...params }),
    onSuccess: () => {
      toast.success('Trip request submitted — show your QR at the gate')
      qc.invalidateQueries({ queryKey: ['active-trip', userId] })
      qc.invalidateQueries({ queryKey: ['my-trips', userId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: (tripId: string) => cancelTrip(tripId),
    onSuccess: () => {
      toast.success('Trip request cancelled')
      qc.invalidateQueries({ queryKey: ['active-trip', userId] })
      qc.invalidateQueries({ queryKey: ['my-trips', userId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return {
    activeTrip,
    tripLoading,
    trips,
    tripsLoading,
    submitting,
    cancelling,
    submitTrip,
    cancel,
    hostelLinked: !!hostelId,
    qrToken: user?.profile.qr_identity_token ?? '',
  }
}
