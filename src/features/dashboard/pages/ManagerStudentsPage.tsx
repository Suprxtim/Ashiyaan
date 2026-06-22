import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronRight, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getStudents } from '@/services/student.service'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ManagerStudentsPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const hostelId  = user?.profile.hostel_id ?? ''

  const [q, setQ] = useState('')

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['manager-students', hostelId],
    queryFn:  () => getStudents(hostelId),
    enabled:  !!hostelId,
  })

  const filtered = useMemo(() => {
    if (!q.trim()) return students
    const lower = q.toLowerCase()
    return students.filter((s) =>
      s.full_name.toLowerCase().includes(lower)
    )
  }, [students, q])

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Students" />

      <div className="pt-14 px-4 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-surface rounded-inner border border-border pl-9 pr-4 py-2.5 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 bg-surface-raised rounded-full flex items-center justify-center">
              <Users size={24} className="text-text-tertiary" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-text-primary">
                {q ? 'No students found' : 'No students yet'}
              </p>
              <p className="text-[13px] text-text-secondary mt-0.5">
                {q ? 'Try a different name' : 'Approved students will appear here'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-card shadow-card overflow-hidden">
            {filtered.map((s, i) => {
              const initials    = getInitials(s.full_name)
              const avatarColor = getAvatarColor(s.full_name)
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/manager/students/${s.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-canvas transition-colors ${i < filtered.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary truncate">{s.full_name}</p>
                    <p className="text-[12px] text-text-secondary truncate">
                      {[s.course, s.college_year].filter(Boolean).join(' · ') || 'Profile incomplete'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.room_number ? (
                      <span className="px-2 py-0.5 bg-primary-light rounded-pill text-[11px] font-semibold text-primary">
                        Room {s.room_number}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-surface-raised rounded-pill text-[11px] font-medium text-text-tertiary">
                        No room
                      </span>
                    )}
                    <ChevronRight size={14} className="text-text-tertiary" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!isLoading && students.length > 0 && (
          <p className="text-[12px] text-text-tertiary text-center">
            {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
          </p>
        )}

      </div>
    </div>
  )
}
