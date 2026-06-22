import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Phone, GraduationCap, Heart, Home, Droplet,
  Hash, MapPin, BedDouble,
} from 'lucide-react'
import { toast } from 'sonner'
import { getStudentById, assignRoom } from '@/services/student.service'
import { getInitials, getAvatarColor } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0">
      <span className="text-text-tertiary flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">{label}</p>
        <p className={`text-[14px] mt-0.5 ${value ? 'text-text-primary' : 'text-text-tertiary italic'}`}>
          {value || 'Not filled'}
        </p>
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-canvas border-b border-border">
      <span className="text-text-secondary">{icon}</span>
      <p className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide">{title}</p>
    </div>
  )
}

export default function ManagerStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const qc = useQueryClient()

  const { data: student, isLoading } = useQuery({
    queryKey: ['manager-student', studentId],
    queryFn:  () => getStudentById(studentId!),
    enabled:  !!studentId,
  })

  const [roomInput, setRoomInput] = useState('')

  // Initialise room input once student data loads (useEffect avoids setting state during render)
  useEffect(() => {
    if (student) setRoomInput(student.room_number ?? '')
  }, [student?.room_number])

  const { mutate: doAssignRoom, isPending: assignPending } = useMutation({
    mutationFn: () => assignRoom(studentId!, roomInput),
    onSuccess: () => {
      const label = roomInput.trim() ? `Room ${roomInput.trim()} assigned` : 'Room unassigned'
      toast.success(label)
      qc.invalidateQueries({ queryKey: ['manager-student', studentId] })
      qc.invalidateQueries({ queryKey: ['manager-students'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas pb-24">
        <TopBar title="Student Details" showBack />
        <div className="pt-14 px-4 space-y-4">
          <div className="flex items-center gap-4 pt-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-48 rounded-card" />
        </div>
      </div>
    )
  }

  // 2. Not found state
  if (!student) {
    return (
      <div className="min-h-dvh bg-canvas">
        <TopBar title="Student Details" showBack />
        <div className="pt-14 flex flex-col items-center justify-center p-8 text-center gap-3">
          <p className="text-text-primary font-medium">Student not found</p>
          <p className="text-text-secondary text-sm">This student may have left the hostel.</p>
        </div>
      </div>
    )
  }

  const initials    = getInitials(student.full_name)
  const avatarColor = getAvatarColor(student.full_name)

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title={student.full_name} showBack />

      <div className="pt-14 px-4 space-y-4">

        {/* Avatar header */}
        <div className="flex items-center gap-4 pt-4 pb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0 shadow-raised"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[18px] font-bold text-text-primary">{student.full_name}</p>
            <p className="text-[13px] text-text-secondary mt-0.5">
              {[student.course, student.college_year].filter(Boolean).join(' · ') || 'Profile incomplete'}
            </p>
          </div>
        </div>

        {/* Personal */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<User size={14} />} title="Personal" />
          <DetailRow icon={<Phone size={14} />}   label="Phone"    value={student.phone} />
          <DetailRow icon={<User size={14} />}    label="DOB"      value={student.date_of_birth} />
          <DetailRow icon={<Droplet size={14} />} label="Blood Group" value={student.blood_group} />
          <DetailRow icon={<Hash size={14} />}    label="Aadhaar"  value={student.aadhaar_number} />
          <DetailRow icon={<MapPin size={14} />}  label="Hometown" value={student.hometown} />
        </div>

        {/* Academic */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<GraduationCap size={14} />} title="Academic" />
          <DetailRow icon={<GraduationCap size={14} />} label="College"    value={student.college_name} />
          <DetailRow icon={<GraduationCap size={14} />} label="Course"     value={student.course} />
          <DetailRow icon={<GraduationCap size={14} />} label="Year"       value={student.college_year} />
          <DetailRow icon={<Hash size={14} />}          label="Enrollment" value={student.student_id} />
        </div>

        {/* Emergency */}
        <div className="bg-surface rounded-card shadow-card overflow-hidden">
          <SectionTitle icon={<Heart size={14} />} title="Emergency" />
          <DetailRow icon={<User size={14} />}  label="Parent Name"  value={student.parent_name} />
          <DetailRow icon={<Phone size={14} />} label="Parent Phone" value={student.parent_phone} />
          <DetailRow icon={<Heart size={14} />} label="Allergies"    value={student.allergies} />
          <DetailRow icon={<Heart size={14} />} label="Medical Conditions" value={student.medical_conditions} />
        </div>

        {/* Room Assignment */}
        <div className="bg-surface rounded-card shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BedDouble size={16} className="text-primary" />
            <p className="text-[15px] font-bold text-text-primary">Room Assignment</p>
          </div>
          <p className="text-[13px] text-text-secondary">
            {student.room_number
              ? `Currently assigned to Room ${student.room_number}. Enter a new number to change, or clear to unassign.`
              : 'No room assigned yet. Enter a room number to assign.'}
          </p>
          <Input
            label="Room number"
            placeholder="e.g. 101"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            leftIcon={<Home size={16} />}
          />
          <Button
            variant="dark"
            fullWidth
            loading={assignPending}
            onClick={() => doAssignRoom()}
          >
            {roomInput.trim() ? 'Assign Room' : 'Unassign Room'}
          </Button>
        </div>

      </div>
    </div>
  )
}
