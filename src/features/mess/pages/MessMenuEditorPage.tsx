import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, Coffee, UtensilsCrossed, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { getWeekMenu } from '@/services/mess.service'
import { TopBar } from '@/components/layout/TopBar'

const DAY_LABELS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type MealType = 'breakfast' | 'lunch' | 'dinner'
const MEALS: { key: MealType; label: string; Icon: React.ElementType; time: string }[] = [
  { key: 'breakfast', label: 'Breakfast', Icon: Coffee,          time: '8:00 – 10:00 AM' },
  { key: 'lunch',     label: 'Lunch',     Icon: UtensilsCrossed, time: '1:00 – 3:00 PM'  },
  { key: 'dinner',    label: 'Dinner',    Icon: Moon,            time: '8:00 – 10:00 PM' },
]

function getWeekDates(offsetWeeks = 0) {
  const today = new Date()
  today.setDate(today.getDate() + offsetWeeks * 7)
  const day    = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export default function MessMenuEditorPage() {
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const hostelId = user?.profile.hostel_id ?? ''

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(new Date().toISOString().split('T')[0])
  const [selectedMeal,  setSelectedMeal]  = useState<MealType>('breakfast')
  const [newItem,       setNewItem]       = useState('')

  const weekDates = getWeekDates(weekOffset)
  const startDate = weekDates[0]
  const endDate   = weekDates[6]

  const today = new Date().toISOString().split('T')[0]

  const { data: menu = [], isLoading } = useQuery({
    queryKey: ['mess-menu', hostelId, startDate],
    queryFn:  () => getWeekMenu(hostelId, startDate, endDate),
    enabled:  !!hostelId,
  })

  // Current items for selected date + meal
  const current = menu.find((m) => m.date === selectedDate && m.meal_type === selectedMeal)
  const items   = current?.items ?? []

  const { mutate: saveMenu, isPending: saving } = useMutation({
    mutationFn: async (newItems: string[]) => {
      if (current) {
        const { error } = await supabase
          .from('mess_menu')
          .update({ items: newItems })
          .eq('id', current.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('mess_menu')
          .insert({
            hostel_id:  hostelId,
            date:       selectedDate,
            meal_type:  selectedMeal,
            items:      newItems,
            created_by: user!.id,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Menu saved')
      qc.invalidateQueries({ queryKey: ['mess-menu', hostelId, startDate] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    saveMenu([...items, trimmed])
    setNewItem('')
  }

  function removeItem(item: string) {
    saveMenu(items.filter((i) => i !== item))
  }

  const firstDate  = new Date(weekDates[0])
  const lastDate   = new Date(weekDates[6])
  const weekLabel  = `${MONTH_NAMES[firstDate.getMonth()]} ${firstDate.getDate()} – ${MONTH_NAMES[lastDate.getMonth()]} ${lastDate.getDate()}`

  return (
    <div className="min-h-dvh bg-canvas pb-24">
      <TopBar title="Edit Mess Menu" showBack />

      <div className="pt-14 px-4 space-y-5">

        {/* Week navigator */}
        <div className="flex items-center justify-between">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-inner hover:bg-surface-raised">
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <p className="text-[14px] font-semibold text-text-secondary">{weekLabel}</p>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-inner hover:bg-surface-raised">
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
        </div>

        {/* Day strip */}
        <div className="flex gap-2">
          {weekDates.map((date, i) => {
            const isToday = date === today
            const isSel   = date === selectedDate
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center flex-1 py-2.5 rounded-inner transition-colors ${
                  isSel ? 'bg-primary text-white' : isToday ? 'bg-primary-light text-primary border border-primary' : 'bg-surface text-text-secondary'
                }`}
              >
                <span className="text-[10px] font-medium uppercase">{DAY_LABELS[i]}</span>
                <span className={`text-[15px] font-bold ${isSel ? 'text-white' : isToday ? 'text-primary' : 'text-text-primary'}`}>
                  {new Date(date).getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Meal tabs */}
        <div className="flex gap-2">
          {MEALS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedMeal(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-card text-[13px] font-semibold transition-colors border-2 ${
                selectedMeal === key
                  ? 'bg-primary border-primary text-white'
                  : 'bg-surface border-border text-text-secondary'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Items editor */}
        <div className="bg-surface rounded-card shadow-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            {(() => {
              const meal = MEALS.find((m) => m.key === selectedMeal)!
              return (
                <div>
                  <p className="text-[15px] font-bold text-text-primary">{meal.label}</p>
                  <p className="text-[12px] text-text-tertiary">{meal.time}</p>
                </div>
              )
            })()}
            <span className="text-[12px] text-text-tertiary">{items.length} items</span>
          </div>

          {/* Current items */}
          {isLoading ? (
            <p className="text-[13px] text-text-tertiary">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-text-tertiary italic">No items added yet</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-3 bg-surface-raised rounded-inner px-3 py-2.5">
                  <p className="flex-1 text-[14px] text-text-primary">{item}</p>
                  <button
                    onClick={() => removeItem(item)}
                    className="text-text-tertiary hover:text-danger transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add item */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Add item (e.g. Idli, Sambar)"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
              className="flex-1 h-10 bg-surface-raised border border-border rounded-input px-3 text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim() || saving}
              className="w-10 h-10 bg-primary rounded-input flex items-center justify-center disabled:opacity-40"
            >
              <Plus size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Rates reminder */}
        <div className="bg-info-light rounded-card p-3 flex items-start gap-2">
          <p className="text-[12px] text-info leading-relaxed">
            <span className="font-semibold">Tip:</span> Students see this menu when opting in/out of meals. Changes apply immediately.
          </p>
        </div>

      </div>
    </div>
  )
}
