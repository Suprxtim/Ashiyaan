import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Coffee, UtensilsCrossed, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { getMessSettings, upsertMessSetting } from '@/services/mess.service'
import { TopBar } from '@/components/layout/TopBar'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import type { MessSetting } from '@/types/app.types'

type MealKey = 'breakfast' | 'lunch' | 'dinner'

const MEAL_META: { key: MealKey; label: string; Icon: React.ElementType }[] = [
  { key: 'breakfast', label: 'Breakfast', Icon: Coffee },
  { key: 'lunch',     label: 'Lunch',     Icon: UtensilsCrossed },
  { key: 'dinner',    label: 'Dinner',    Icon: Moon },
]

export default function MessSettingsPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['mess-settings', hostelId],
    queryFn:  () => getMessSettings(hostelId),
    enabled:  !!hostelId,
    staleTime: Infinity,
  })

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Mess Settings" showBack />
      <div className="pt-14 px-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-card shadow-card h-28 skeleton" />
            ))}
          </div>
        ) : (
          MEAL_META.map(({ key, label, Icon }) => {
            const s = settings.find((m) => m.meal_type === key)
            if (!s) return null
            return (
              <MealSettingCard
                key={key}
                mealType={key}
                label={label}
                Icon={Icon}
                setting={s}
                hostelId={hostelId}
                onSaved={() => qc.invalidateQueries({ queryKey: ['mess-settings'] })}
              />
            )
          })
        )}
        <p className="text-[12px] text-text-tertiary text-center px-4 pb-4">
          Cutoff time is when students can no longer change their attendance for that meal.
        </p>
      </div>
    </div>
  )
}

function MealSettingCard({
  mealType, label, Icon, setting, hostelId, onSaved,
}: {
  mealType: MealKey
  label: string
  Icon: React.ElementType
  setting: MessSetting
  hostelId: string
  onSaved: () => void
}) {
  const [enabled,    setEnabled]    = useState(setting.enabled)
  const [startTime,  setStartTime]  = useState(setting.start_time.slice(0, 5))
  const [endTime,    setEndTime]    = useState(setting.end_time.slice(0, 5))
  const [cutoffTime, setCutoffTime] = useState(setting.cutoff_time.slice(0, 5))

  useEffect(() => {
    setEnabled(setting.enabled)
    setStartTime(setting.start_time.slice(0, 5))
    setEndTime(setting.end_time.slice(0, 5))
    setCutoffTime(setting.cutoff_time.slice(0, 5))
  }, [setting])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      upsertMessSetting(hostelId, mealType, {
        enabled,
        start_time:  startTime,
        end_time:    endTime,
        cutoff_time: cutoffTime,
      }),
    onSuccess: () => { toast.success(`${label} settings saved`); onSaved() },
    onError:   (e: Error) => toast.error(e.message),
  })

  return (
    <div className="bg-surface rounded-card shadow-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-inner flex items-center justify-center flex-shrink-0 ${
          enabled ? 'bg-primary-light' : 'bg-surface-raised'
        }`}>
          <Icon size={18} className={enabled ? 'text-primary' : 'text-text-tertiary'} />
        </div>
        <p className="flex-1 text-[15px] font-bold text-text-primary">{label}</p>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {([
              { fieldLabel: 'Start',  value: startTime,  set: setStartTime  },
              { fieldLabel: 'End',    value: endTime,    set: setEndTime    },
              { fieldLabel: 'Cutoff', value: cutoffTime, set: setCutoffTime },
            ] as const).map(({ fieldLabel, value, set }) => (
              <div key={fieldLabel}>
                <p className="text-[11px] font-semibold text-text-tertiary mb-1 uppercase tracking-wide">
                  {fieldLabel}
                </p>
                <input
                  type="time"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-full h-9 bg-surface-raised border border-border rounded-input px-2 text-[13px] text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="dark" size="sm" loading={saving} onClick={() => save()}>
              Save
            </Button>
          </div>
        </div>
      )}

      {!enabled && (
        <div className="flex justify-end">
          <Button variant="dark" size="sm" loading={saving} onClick={() => save()}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
