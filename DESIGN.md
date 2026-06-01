# ASHIYAAN — DESIGN SYSTEM

Inspired by: MyGate UI language — warm neutral base, bold circular action buttons,
card-first layouts, professional yet approachable mobile-first feel.

---

## 1. DESIGN PRINCIPLES

| Principle | What it means for Ashiyaan |
|---|---|
| **Card-first** | Every piece of content lives in a rounded white card on a warm beige canvas |
| **Action-forward** | Critical actions (Gate Pass, SOS, Pay) are always 1 tap away with bold CTAs |
| **Scan-friendly** | Users are rushing — labels, badges, and status colors communicate at a glance |
| **Warm, not sterile** | Beige background + yellow accents feel residential, not clinical |
| **Trust through clarity** | Numbers, statuses, and timestamps are always visible, never hidden |

---

## 2. COLOR PALETTE

### Base
```
Background (canvas)     #F5F0EB   Warm off-white / light beige — page background
Surface (card)          #FFFFFF   Pure white — all cards, modals, bottom sheets
Surface Raised          #F9F6F2   Slightly warm white — input fields, inner sections
Border                  #E8E2DA   Subtle warm border
```

### Brand
```
Primary (Teal)          #1A3D3D   Deep teal — top nav bg, warden/security avatars, primary badges
Primary Light           #E8F4F4   Teal tint — icon container backgrounds
Primary Mid             #2D6B6B   Medium teal — hover/active states
```

### Accent
```
Accent Yellow           #F5C518   Golden yellow — primary CTA buttons ("Pay All", "Generate Pass")
Accent Yellow Dark      #D4A800   Yellow hover/pressed state
Accent Yellow Light     #FEF7DC   Yellow tint — warning banners, pending states
```

### Semantic
```
Danger (SOS/Alert)      #E53935   Bright red — SOS button, overdue badges, destructive actions
Danger Light            #FDECEA   Red tint — overdue card backgrounds
Success                 #2E7D32   Forest green — resolved, paid, entry confirmed
Success Light           #E8F5E9   Green tint — success backgrounds
Warning                 #F57C00   Amber — pending, in-progress, medium priority
Warning Light           #FFF3E0   Amber tint — pending card backgrounds
Info                    #1565C0   Deep blue — informational, links, "View All"
Info Light              #E3F2FD   Blue tint
```

### Text
```
Text Primary            #1A1A1A   Near black — headings, card titles
Text Secondary          #5C5C5C   Medium gray — subtitles, meta info
Text Tertiary           #9E9E9E   Light gray — placeholder, timestamps
Text On Dark            #FFFFFF   White text on dark backgrounds
Text On Yellow          #1A1A1A   Dark text on yellow buttons
```

### Avatar Colors (for initials)
```
Slot 1    #1A3D3D   Teal
Slot 2    #5C4A8A   Purple
Slot 3    #2E6B3E   Green
Slot 4    #A0522D   Brown
Slot 5    #1565C0   Blue
Slot 6    #B85C00   Orange
Slot 7    #6B2D6B   Violet
Slot 8    #2D5F6B   Cyan teal
```
Assign deterministically: `colorIndex = sum of charCodes % 8`

---

## 3. TYPOGRAPHY

**Font:** `Inter` (Google Fonts) — clean, highly legible, available everywhere.

```
Display      32px  700 (Bold)    — Hero numbers (₹495, 98 Inside)
H1           24px  700           — Page titles (rarely used on mobile)
H2           20px  700           — Section headers ("Security", "Announcements")
H3           17px  600 (Semibold)— Card titles, modal headings
Body Large   15px  400           — Card descriptions, announcement text
Body         14px  400           — Default body text, list items
Body Small   13px  400           — Meta info (timestamps, room numbers)
Caption      12px  400           — Badges text, labels, sub-labels
Label        12px  600           — Button text (small), tab labels, stat labels
```

**Line heights:** 1.4 for body, 1.2 for headings.
**Letter spacing:** -0.2px on headings only for a tighter, polished feel.

---

## 4. SPACING & LAYOUT

### Grid
- Mobile-first; max-width container: `480px` centered on desktop
- Page horizontal padding: `16px`
- Card internal padding: `16px`
- Section gap (between cards): `12px`
- Section header margin-bottom: `10px`

### Spacing Scale (Tailwind-mapped)
```
2px   → spacing-0.5   micro gap (between icon and label)
4px   → spacing-1
8px   → spacing-2
12px  → spacing-3
16px  → spacing-4     card padding, section padding
20px  → spacing-5
24px  → spacing-6     vertical gap between major sections
32px  → spacing-8
48px  → spacing-12
```

### Safe Areas
- Top: system status bar + TopBar height (56px)
- Bottom: BottomNav height (64px) + home indicator (env safe-area-inset-bottom)
- All page content uses `pb-20` to clear the BottomNav

---

## 5. BORDER RADIUS

```
Full circle    9999px   — Avatar circles, circular action buttons (SOS, Generate Pass)
Pill           24px     — Badges, notification banners, small chips
Card           16px     — All cards
Button         12px     — Standard buttons
Input          10px     — Form inputs, textareas
Icon container 14px     — Squircle icon boxes in Quick Actions
Inner card     12px     — Stats row cells, meal toggle cells
Small          8px      — Thumbnails, small image previews
```

---

## 6. ELEVATION / SHADOW

```
Level 0 (flat)     no shadow           — page background
Level 1 (card)     0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)
Level 2 (raised)   0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)
Level 3 (modal)    0 16px 48px rgba(0,0,0,0.18)
```
All cards use Level 1. Modals and bottom sheets use Level 3. Avoid heavy shadows.

---

## 7. COMPONENT SPECS

### 7.1 TopBar
```
Height: 56px
Background: #1A3D3D (Teal) on main dashboard; #FFFFFF on sub-pages
Left: Back arrow (sub-pages) OR hostel name + room dropdown (home)
Center: Page title (sub-pages only)
Right: Search icon + Chat/Notification bell icon + Avatar circle
Avatar: 36px circle, user initials, teal background
Font: White on teal, dark on white
```

### 7.2 Bottom Navigation
```
Height: 64px + safe area
Background: #FFFFFF
Border top: 1px solid #E8E2DA
5 tabs: Home | Gate | Mess | Complaints | Profile
Active tab: Icon filled teal (#1A3D3D) + label teal, label font-weight 600
Inactive tab: Icon outline gray (#9E9E9E) + label gray
Tab label: 11px, capitalize
Icon size: 24px
Red dot badge (unread): 8px circle top-right of icon, no number unless >1
Number badge: 18px circle, red (#E53935), white text 10px bold
```

### 7.3 Cards
```
Background: #FFFFFF
Border radius: 16px
Shadow: Level 1
Padding: 16px
Margin between cards: 12px
Horizontal padding on page: 16px
```

**Variants:**
- `Card Default` — white, Level 1 shadow
- `Card Alert` — left border 4px red + Danger Light background (overdue, urgent)
- `Card Warning` — left border 4px amber + Warning Light background (pending)
- `Card Success` — left border 4px green + Success Light background (resolved, paid)
- `Card Stat` — compact, no shadow, surface-raised background, used inside stats rows

### 7.4 Quick Action Grid (Dashboard)
```
Layout: 4-per-row grid on mobile (2 rows = 8 actions)
Each cell:
  - 64px × 64px rounded square (border-radius: 14px)
  - Background: #F9F6F2 (Surface Raised) with 1px #E8E2DA border
  - Icon: 28px, outline style, #1A3D3D
  - Label: 11px, Text Secondary, below icon, 2-line max
  - Badge (notification dot): top-right, red circle
  - Active/special cell: Yellow background (#F5C518), dark icon
  - Gap between cells: 10px
```

### 7.5 Circular Action Buttons (Security Row)
Inspired by MyGate's Raise Alarm + guards row.
```
Large circle (SOS / Raise Alarm):
  - 72px diameter
  - Background: #E53935 (Red)
  - Icon: white alarm/SOS icon, 32px
  - Subtle pulsing ring animation (1.5s loop)

Medium circle (Message/Action):
  - 64px diameter
  - Background: #1A3D3D (Teal)
  - Icon: white, 26px

Avatar circle (Warden / Guard):
  - 56px diameter
  - Background: initials color (slot system)
  - Initials: white, 16px semibold
  - Phone badge: 18px green circle bottom-right, phone icon 10px white
  - Name: 12px below, bold truncated
  - Role: 11px gray below name
```

### 7.6 Stat Row
Horizontal row inside a card, separated by vertical dividers.
```
Background: Surface Raised (#F9F6F2) rounded card inside main card
Each stat cell:
  - Flex column, center aligned
  - Number: 22px bold, Text Primary
  - Label: 11px, Text Tertiary, uppercase tracking-wide
Divider: 1px #E8E2DA vertical line
Cells: 2–3 per row, equal width flex
```

**Example:**
```
[ 98 Inside ]  |  [ 190 Total ]  |  [ 5 Alerts ]
```

### 7.7 Section Header
```
Font: H2 (20px 700), Text Primary
Trailing: ">" chevron with "View All" in Info Blue (#1565C0), 13px
Margin bottom: 10px
```

### 7.8 Buttons

**Primary (Yellow CTA):**
```
Background: #F5C518
Text: #1A1A1A, 15px, 600
Border radius: 12px
Padding: 14px 24px
Height: 48px
Shadow: none
Active: scale(0.97), background darkens to #D4A800
```

**Primary Dark (Teal):**
```
Background: #1A3D3D
Text: #FFFFFF, 15px, 600
Border radius: 12px
Padding: 14px 24px
Height: 48px
```

**Danger:**
```
Background: #E53935
Text: #FFFFFF
Same shape as Primary
```

**Secondary / Ghost:**
```
Background: transparent
Border: 1.5px solid #1A3D3D
Text: #1A3D3D, 15px, 600
Border radius: 12px
Height: 48px
```

**Icon Button (small):**
```
Width/Height: 40px
Border radius: 10px
Background: Surface Raised
Icon: 20px, Text Secondary
```

**Loading state:** All buttons show a 16px white spinner centered; text hidden.

### 7.9 Badges / Status Chips
```
Border radius: 9999px (pill)
Padding: 3px 10px
Font: 12px 600 uppercase
Height: 22px

submitted    Background: #E3F2FD   Text: #1565C0
in_progress  Background: #FFF3E0   Text: #F57C00
resolved     Background: #E8F5E9   Text: #2E7D32
closed       Background: #F5F0EB   Text: #5C5C5C
urgent       Background: #FDECEA   Text: #E53935
paid         Background: #E8F5E9   Text: #2E7D32
pending      Background: #FFF3E0   Text: #F57C00
overdue      Background: #FDECEA   Text: #E53935
active       Background: #E8F4F4   Text: #1A3D3D
expired      Background: #F5F0EB   Text: #9E9E9E
```

### 7.10 Avatar
```
Full circle, no border
Sizes: sm=32px, md=40px, lg=56px, xl=72px
Photo: object-cover circle
Initials fallback: colored bg (slot system), white text, semibold
  sm → 12px, md → 15px, lg → 18px, xl → 24px
Online dot: 8px green circle bottom-right (border: 2px white)
```

### 7.11 Input Fields
```
Background: #F9F6F2 (Surface Raised)
Border: 1.5px solid #E8E2DA
Border radius: 10px
Padding: 14px 16px
Font: 14px, Text Primary
Placeholder: Text Tertiary
Focus border: 1.5px solid #1A3D3D
Error border: 1.5px solid #E53935
Error message: 12px #E53935 below field
Height: 48px (single line), auto (textarea)
Icon left/right: 20px, Text Tertiary, centered vertically
```

### 7.12 Toggle (Meal Opt-out)
```
Width: 48px, Height: 26px
Track active: #1A3D3D
Track inactive: #E8E2DA
Thumb: white circle, 22px, 2px inset
Transition: 200ms ease
Label: 13px Text Secondary, left of toggle
Disabled: 60% opacity
```

### 7.13 QR Code Display
```
Container: white card, 16px border radius, centered
QR canvas: 220×220px
Below QR: countdown timer (large mono font, red when <60s)
Countdown style: 32px, font-variant-numeric tabular-nums, Text Primary → #E53935 below 60s
Expiry ring: thin circular progress ring around QR (teal to red as time runs out)
Pass type badge: "ENTRY" or "EXIT" pill badge above QR
```

### 7.14 SOS Button
```
Diameter: 96px (large enough for panic tap)
Background: #E53935
Icon: alarm/SOS outline 40px white
Outer ring: 2px #E53935 pulsing ring, animation radius 56px→72px, 1.5s infinite
Text below: "RAISE ALARM" 11px bold red uppercase
Tap: hold 1.5 seconds to fire (prevent accidental) — circular fill animation during hold
```

### 7.15 Meal Calendar Row
```
7 columns (Mon–Sun), horizontal scroll if needed
Each day cell:
  Width: 44px, Border radius: 12px
  Today: Background #1A3D3D, text white
  Other days: Background white, border 1px #E8E2DA
  Day name: 11px uppercase gray
  Date: 16px bold
Below calendar: 3 toggle rows (Breakfast / Lunch / Dinner)
Each toggle row:
  Icon (16px) + Meal name (14px) + time (12px gray) + Toggle (right aligned)
  Separator: 1px #E8E2DA between rows
  Opted-out row: background #FDECEA, icon red, text red
```

### 7.16 Complaint Status Timeline
```
Vertical list, left-aligned
Each step:
  - Circle indicator: 12px, filled for completed, hollow for pending
  - Vertical line connecting steps: 2px #E8E2DA
  - Status label: 14px semibold Text Primary
  - Timestamp: 12px Text Tertiary
  - Note (optional): 13px Text Secondary in Surface Raised rounded box
Active step: teal circle + teal line below
```

### 7.17 Emergency Contact Card
```
2-column grid layout
Each card:
  White card, border radius 12px, padding 16px
  Name: 14px semibold
  Number: 13px Text Secondary
  Phone icon: 24px green circle button (right side), tappable → tel: link
  Background on press: slight green tint
```

### 7.18 Bottom Sheet / Modal
```
Background overlay: rgba(0,0,0,0.5) blur(2px)
Sheet: white, border-radius 20px 20px 0 0, Level 3 shadow
Drag handle: 4px × 40px #E8E2DA pill, centered, 12px from top
Content padding: 24px 16px
Snap: 50% height (half-sheet), 90% height (full)
Transition: 300ms cubic-bezier(0.32, 0.72, 0, 1)
```

### 7.19 Notification Bell
```
Icon: 24px outline bell
Badge: red circle, positioned top-right
  No unread: no badge
  1–9: show number, 18px circle
  10+: show "9+" in 16px circle
```

### 7.20 Announcement / Notice Card
```
White card, 16px radius
Left: vertical color bar (4px wide, full height) — color by category
  emergency → red, event → teal, rule → amber, general → gray
Title: 15px semibold
Content preview: 13px Text Secondary, 2-line clamp
Footer: avatar circle (24px) + author name + "· time ago"
Attachment indicator: paperclip icon + count (like screenshot shows "1")
Pinned: pin icon top-right, background slightly tinted yellow
```

---

## 8. ICONOGRAPHY

**Style:** Lucide React — consistent 2px stroke, outline style.
**Size:** 24px default in UI, 20px in compact contexts, 16px in badges/chips.
**Color:** Match context — white on dark backgrounds, #1A3D3D on light, #9E9E9E for inactive.

**Key icon mappings:**
```
Home / Dashboard     → LayoutDashboard
Gate Pass            → QrCode
Mess / Meals         → UtensilsCrossed
Complaints           → Wrench
Payments             → CreditCard
Profile              → User
Security / SOS       → ShieldAlert
Emergency            → Siren
Notification         → Bell
Warden / Manager     → UserCheck
Visitor              → UserPlus
Lost & Found         → Search
Marketplace          → ShoppingBag
Noticeboard          → Megaphone
Room                 → DoorOpen
Entry                → LogIn
Exit                 → LogOut
Phone                → Phone
Scan QR              → ScanLine
Calendar             → CalendarDays
Clock                → Clock
Rupee / Payment      → IndianRupee
Rating               → Star
Resolved             → CheckCircle2
Pending              → Clock4
Overdue              → AlertCircle
High Priority        → Flame
```

---

## 9. ANIMATION & MOTION

```
Micro-interaction (button press)    scale(0.96), 100ms ease
Card tap highlight                  background flash to #F5F0EB, 150ms
Page transition                     slide-from-right (push), 280ms ease-in-out
Bottom sheet open                   slide-up, 300ms cubic-bezier(0.32, 0.72, 0, 1)
Bottom sheet close                  slide-down, 250ms ease-in
Toast                               slide-in from top, 220ms; auto-dismiss 3s; slide-out 200ms
SOS pulse ring                      scale 1.0→1.3 opacity 1→0, 1.5s infinite ease-out
Badge appear                        scale 0→1, 200ms spring
Skeleton shimmer                    gradient sweep L→R, 1.4s infinite
Toggle switch                       200ms ease thumb translation
Countdown ring                      stroke-dashoffset linear, 1s tick
Offline banner                      slide-in from top, 300ms
```

No flashy transitions. Motion serves function: confirm action, indicate state change, guide eye.

---

## 10. PAGE LAYOUTS

### 10.1 Dashboard (Home)
```
┌─────────────────────────────┐
│ TopBar (teal, hostel name)  │
├─────────────────────────────┤
│ Alert banner (if any)       │  ← yellow pill, full width
├─────────────────────────────┤
│ Quick Actions Grid (2×4)    │  ← squircle icon cells
├─────────────────────────────┤
│ Today's Stats Row           │  ← Gate In / Out / Pending
├─────────────────────────────┤
│ Section: Announcements  >   │
│ [Horizontal scroll cards]   │
├─────────────────────────────┤
│ Section: Recent Activity >  │
│ [Vertical list items]       │
├─────────────────────────────┤
│ BottomNav                   │
└─────────────────────────────┘
```

### 10.2 Gate Pass Page
```
┌─────────────────────────────┐
│ TopBar (white, "Gate Pass") │
├─────────────────────────────┤
│ Active Pass Card            │  ← large white card, centered QR
│   [QR Code 220×220]         │
│   [Countdown ring + timer]  │
│   ENTRY badge               │
├─────────────────────────────┤
│ [Generate Entry Pass] btn   │  ← Yellow CTA, full width
│ [Generate Exit Pass] btn    │  ← Teal outline, full width
├─────────────────────────────┤
│ Section: History        >   │
│ [List of pass history]      │
│   Each: type chip | time | room
└─────────────────────────────┘
```

### 10.3 Mess Page
```
┌─────────────────────────────┐
│ TopBar (white, "Mess")      │
├─────────────────────────────┤
│ Week nav  < Mon 26 - Sun 1 >│
│ [7-day date strip]          │
├─────────────────────────────┤
│ Selected Day Card           │
│   Menu preview (items list) │
├─────────────────────────────┤
│ Meal Toggles Card           │
│   🌅 Breakfast  07:30   ⬛  │
│   ──────────────────────    │
│   ☀️ Lunch      13:00   ✅  │
│   ──────────────────────    │
│   🌙 Dinner     20:00   ✅  │
├─────────────────────────────┤
│ This Month Saving: ₹320     │  ← green badge, motivational
├─────────────────────────────┤
│ [View Bill] btn             │
└─────────────────────────────┘
```

### 10.4 Emergency Page
```
┌─────────────────────────────┐
│ TopBar (teal, "Emergency")  │
├─────────────────────────────┤
│ [         SOS          ]    │  ← centered pulsing red circle, 96px
│    Hold 1.5s to activate    │
├─────────────────────────────┤
│ Security         >          │
│ [Circular buttons row]      │
│  Raise Alarm | Message Guard│
│  [Warden] [Security] ...    │
├─────────────────────────────┤
│ Emergency Contacts      >   │
│ [2-col contact grid]        │
│  Main Gate 1  | Gate No.2   │
│  Hospital     | Police      │
└─────────────────────────────┘
```

### 10.5 Complaint Detail Page
```
┌─────────────────────────────┐
│ TopBar ("Complaint #1023")  │
├─────────────────────────────┤
│ Status badge  |  Priority   │
│ Category chip | Time ago    │
├─────────────────────────────┤
│ Description card            │
├─────────────────────────────┤
│ Photos (horizontal scroll)  │  ← 80px thumbnail cards
├─────────────────────────────┤
│ Section: Updates Timeline   │
│  ● Submitted    May 26 10:00│
│  │                          │
│  ● In Progress  May 26 14:00│
│    "Assigned to Ravi"       │
│  ○ Resolved    (pending)    │
├─────────────────────────────┤
│ Rate this resolution (stars)│  ← appears when resolved
└─────────────────────────────┘
```

### 10.6 Manager Dashboard
```
┌─────────────────────────────┐
│ TopBar (teal, "Manager")    │
├─────────────────────────────┤
│ Stats Row Card              │
│ [Occupancy][Open][Dues]     │
├─────────────────────────────┤
│ Section: Today's Gate Log > │
│ [Live entry/exit feed]      │
├─────────────────────────────┤
│ Section: Open Complaints >  │
│ [Priority-sorted list]      │
├─────────────────────────────┤
│ Section: Mess Demand Today  │
│ B:42  L:38  D:51  (out of 60│
├─────────────────────────────┤
│ Section: Pending Dues    >  │
└─────────────────────────────┘
```

---

## 11. EMPTY STATES

Every empty state has: centered illustration (simple line icon, 64px, teal) + title (16px bold) + sub-text (14px gray) + optional CTA button.

```
Gate Pass history     "No entries yet"
                      "Your entry and exit history will appear here"

Complaints            "Everything looks good!"
                      "No complaints submitted"
                      [Submit a Complaint] (yellow btn)

Mess this week        "Menu not posted yet"
                      "The warden hasn't added the menu for this week"

Payments              "You're all clear!"
                      "No pending dues"

Marketplace           "Nothing listed yet"
                      "Be the first to sell something"
                      [Post a Listing] (yellow btn)
```

---

## 12. LOADING STATES

- **Page skeleton:** match exact layout of real page; shimmer animation
- **Card skeleton:** 16px radius rect + title bar (60%) + subtitle bar (40%)
- **Avatar skeleton:** circle, same diameter as real avatar
- **List skeleton:** 3–4 rows, each matching list item height
- **Button loading:** spinner replaces text, button stays same size and color

Never show a blank white screen. Always skeleton.

---

## 13. RESPONSIVE BREAKPOINTS

```
Mobile      < 480px    Primary target — full-width cards, bottom nav
Tablet      480–768px  Cards max-width 480px centered, bottom nav stays
Desktop     > 768px    Sidebar (240px) + content area, top nav instead of bottom nav
```

On desktop: sidebar replaces BottomNav, cards max-width 480px, centered content column.

---

## 14. TAILWIND CONFIG TOKENS

```js
// tailwind.config.ts — extend section
colors: {
  canvas:   '#F5F0EB',
  surface:  '#FFFFFF',
  'surface-raised': '#F9F6F2',
  border:   '#E8E2DA',
  primary: {
    DEFAULT: '#1A3D3D',
    light:   '#E8F4F4',
    mid:     '#2D6B6B',
  },
  accent: {
    DEFAULT: '#F5C518',
    dark:    '#D4A800',
    light:   '#FEF7DC',
  },
  danger: {
    DEFAULT: '#E53935',
    light:   '#FDECEA',
  },
  success: {
    DEFAULT: '#2E7D32',
    light:   '#E8F5E9',
  },
  warning: {
    DEFAULT: '#F57C00',
    light:   '#FFF3E0',
  },
  info: {
    DEFAULT: '#1565C0',
    light:   '#E3F2FD',
  },
  text: {
    primary:   '#1A1A1A',
    secondary: '#5C5C5C',
    tertiary:  '#9E9E9E',
  },
},
borderRadius: {
  pill:  '9999px',
  card:  '16px',
  btn:   '12px',
  input: '10px',
  icon:  '14px',
  inner: '12px',
  sm:    '8px',
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
},
boxShadow: {
  card:  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
  raised:'0 4px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
  modal: '0 16px 48px rgba(0,0,0,0.18)',
},
```

---

## 15. DO / DON'T

### Do
- Use warm beige (#F5F0EB) as the page background — never plain white
- Give every major action a yellow CTA button — it's the eye-catcher
- Put stats in horizontal "stat row" cards inside other cards (MyGate pattern)
- Use circular buttons for emergency/security actions — they feel urgent and tappable
- Always show a section header with "> View All" link for scrollable sections
- Use the 2×4 Quick Actions grid on the dashboard home
- Keep cards white, clean, minimal — let content breathe
- Color-code the left border of cards by status (red = urgent, amber = pending, green = ok)

### Don't
- Don't use flat white as a page background — it looks like a broken screen
- Don't use more than 2 accent colors on a single card
- Don't use filled icons in the bottom nav inactive state
- Don't show more than 3 quick stats in a stat row (gets crowded)
- Don't make the SOS button look like a regular button — it must be circular and red
- Don't put text over QR codes or within 16px of the code edge
- Don't use blue as a primary brand color — reserved for info/links only
- Don't animate anything longer than 350ms — feels slow on mid-range Android
