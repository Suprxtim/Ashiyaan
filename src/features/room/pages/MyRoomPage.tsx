import { useQuery } from '@tanstack/react-query'
import { Phone, Layers, Users, BedDouble, Home } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { getRoomDetails, getRoommates } from '@/services/room.service'
import { getInitials, getAvatarColor } from '@/lib/utils'

const ROOM_TYPE_LABELS: Record<string, string> = {
  single:    'Single Room',
  double:    'Double Sharing',
  triple:    'Triple Sharing',
  dormitory: 'Dormitory',
}

export default function MyRoomPage() {
  const user = useAuthStore((s) => s.user)

  const hostelId   = user?.profile.hostel_id ?? ''
  const roomNumber = user?.profile.room_number ?? null
  const userId     = user?.id ?? ''

  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: ['room-details', hostelId, roomNumber],
    queryFn:  () => getRoomDetails(hostelId, roomNumber as string),
    enabled:  !!hostelId && !!roomNumber,
  })

  const { data: roommates = [], isLoading: roommatesLoading } = useQuery({
    queryKey: ['roommates', hostelId, roomNumber, userId],
    queryFn:  () => getRoommates(hostelId, roomNumber as string, userId),
    enabled:  !!hostelId && !!roomNumber,
  })

  const isLoading = roomLoading || roommatesLoading

  if (!roomNumber) {
    return (
      <div className="min-h-dvh bg-canvas pb-24">
        <TopBar title="My Room" showBack />
        <div className="pt-14">
          <EmptyState
            icon={<Home size={28} />}
            title="No Room Assigned"
            description="Contact your warden or manager to get assigned a room."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="My Room" showBack />

      <div className="pt-16 px-4 space-y-5">

        {/* ── Room Card ── */}
        {isLoading ? (
          <div className="bg-surface rounded-card shadow-card p-5 space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton lines={2} />
          </div>
        ) : (
          <div className="bg-primary rounded-card p-5 shadow-raised">
            <p className="text-white/60 text-[12px] uppercase tracking-widest font-semibold">Your Room</p>
            <p className="text-white text-[32px] font-bold mt-1 leading-tight">Room {roomNumber}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
              {room?.type && (
                <span className="flex items-center gap-1.5 text-white/80 text-[13px]">
                  <BedDouble size={14} /> {ROOM_TYPE_LABELS[room.type] ?? room.type}
                </span>
              )}
              {room?.floor != null && (
                <span className="flex items-center gap-1.5 text-white/80 text-[13px]">
                  <Layers size={14} /> Floor {room.floor}
                </span>
              )}
              {room?.capacity != null && (
                <span className="flex items-center gap-1.5 text-white/80 text-[13px]">
                  <Users size={14} /> {roommates.length + 1}/{room.capacity} occupied
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Amenities ── */}
        {!isLoading && room?.amenities && room.amenities.length > 0 && (
          <div>
            <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
              Amenities
            </p>
            <div className="flex flex-wrap gap-2">
              {room.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="bg-surface border border-border rounded-pill px-3 py-1.5 text-[12px] font-medium text-text-secondary capitalize"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Roommates ── */}
        <div>
          <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wide mb-2 px-1">
            Roommates {!isLoading && `(${roommates.length})`}
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface rounded-card shadow-card p-4 flex items-center gap-3">
                  <Skeleton circle className="w-11 h-11 flex-shrink-0" />
                  <div className="flex-1"><Skeleton lines={2} /></div>
                </div>
              ))}
            </div>
          ) : roommates.length === 0 ? (
            <div className="bg-surface rounded-card shadow-card p-6 text-center">
              <Users size={28} className="text-text-tertiary mx-auto mb-2" />
              <p className="text-[14px] font-semibold text-text-primary">No roommates yet</p>
              <p className="text-[13px] text-text-secondary mt-1">
                You're currently the only one assigned to this room
              </p>
            </div>
          ) : (
            <div className="bg-surface rounded-card shadow-card overflow-hidden">
              {roommates.map((rm, idx) => (
                <div key={rm.id}>
                  {idx > 0 && <div className="h-px bg-border mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0"
                      style={{ backgroundColor: getAvatarColor(rm.full_name) }}
                    >
                      {getInitials(rm.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text-primary truncate">{rm.full_name}</p>
                      <p className="text-[12px] text-text-tertiary capitalize">{rm.role}</p>
                    </div>
                    {rm.phone && (
                      <a
                        href={`tel:${rm.phone}`}
                        className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0"
                        aria-label={`Call ${rm.full_name}`}
                      >
                        <Phone size={16} className="text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
