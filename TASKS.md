# ASHIYAAN — TASKS

## Legend
- [ ] Not started
- [~] In progress
- [x] Done
- Priority: 🔴 Critical · 🟡 High · 🟢 Normal

---

## PHASE 0 — Foundation (Week 1–2)

### 0.1 Project Scaffold
- [ ] 🔴 Initialize Vite + React 18 + TypeScript project
- [ ] 🔴 Configure Tailwind CSS v3 with custom color tokens (primary blue, alert red, success green)
- [ ] 🔴 Add ESLint + Prettier + Husky pre-commit hook
- [ ] 🔴 Add absolute imports (tsconfig paths: @/components, @/features, @/lib, @/services, @/types)
- [ ] 🟡 Configure vite-plugin-pwa + Workbox (App Shell caching strategy)
- [ ] 🟡 Create PWA manifest (icons, shortcuts, theme color)
- [ ] 🟢 Add .env.local template with required Supabase keys

### 0.2 Supabase Setup
- [ ] 🔴 Create Supabase project
- [ ] 🔴 Write migration 001: all table definitions + enums
- [ ] 🔴 Write migration 002: RLS policies for every table (hostel_id isolation + role checks)
- [ ] 🔴 Write migration 003: DB triggers (updated_at on profiles, complaints; payment overdue auto-update)
- [ ] 🟡 Configure Supabase Storage bucket: complaint-photos (public), avatars (public), receipts (private)
- [ ] 🟡 Write seed data: 1 test hostel, 3 student accounts, 1 warden account
- [ ] 🟢 Install Supabase CLI + add `supabase gen types typescript` script to package.json

### 0.3 App Foundation
- [ ] 🔴 Supabase client singleton (src/lib/supabase.ts)
- [ ] 🔴 TanStack Query client configuration (staleTime, gcTime, retry policy)
- [ ] 🔴 Zustand auth store (session, profile, hostel_id)
- [ ] 🔴 React Router v6 setup with route definitions (router.tsx)
- [ ] 🔴 Protected route wrapper (redirects to /login if no session)
- [ ] 🔴 Role-based route guard (redirects to /unauthorized if wrong role)
- [ ] 🟡 Offline store (Zustand: pending mutation queue + isOnline flag)
- [ ] 🟢 Global error boundary component

### 0.4 Component Library — Primitives
- [ ] 🔴 Button (primary, secondary, ghost, danger, icon; sm/md/lg; loading spinner)
- [ ] 🔴 Input (text/tel/number/search; error state; icon slots)
- [ ] 🔴 Textarea (with char count display)
- [ ] 🔴 Badge (status variants: submitted, in_progress, resolved, paid, overdue, active, expired)
- [ ] 🔴 Card (flat, elevated, bordered variants)
- [ ] 🟡 Select (native on mobile)
- [ ] 🟡 Toggle / Switch (controlled, with label)
- [ ] 🟡 Modal (focus trap, backdrop close, accessible)
- [ ] 🟡 BottomSheet (snap points, mobile feel)
- [ ] 🟡 Avatar (initials fallback, sm/md/lg)
- [ ] 🟡 Skeleton (block, circle, text)
- [ ] 🟡 Spinner
- [ ] 🟡 EmptyState (icon + title + description + optional CTA)
- [ ] 🟡 Alert (inline: info/warning/error/success)
- [ ] 🟢 Tabs (underline variant)
- [ ] 🟢 Accordion

### 0.5 Layout Components
- [ ] 🔴 AppShell (renders BottomNav on mobile, Sidebar on desktop via media query)
- [ ] 🔴 BottomNav (5 tabs: Home / Gate / Mess / Complaints / Profile)
- [ ] 🔴 TopBar (page title + back button + notification bell icon)
- [ ] 🟡 Sidebar (desktop collapsible, full nav)
- [ ] 🟡 PageContainer (max-width wrapper + safe area insets)
- [ ] 🟢 OfflineBanner (sticky banner on network loss)
- [ ] 🟢 PullToRefresh wrapper

### 0.6 Auth Feature
- [ ] 🔴 LoginPage (email input → OTP request → OTP verify flow)
- [ ] 🔴 SignupPage (name, email, phone, role selection, hostel code)
- [ ] 🔴 OnboardingPage (manager: create hostel profile)
- [ ] 🔴 useAuth hook (login, logout, session refresh)
- [ ] 🔴 Profile auto-creation on first signup (trigger or client-side upsert)
- [ ] 🟡 "Hostel Code" join flow (student enters code to link to existing hostel)
- [ ] 🟢 Persist session across hard refresh

### 0.7 CI / Deployment
- [ ] 🟡 GitHub repository setup
- [ ] 🟡 Vercel project linked to repo (auto-deploy main + preview on PRs)
- [ ] 🟢 GitHub Actions: lint + type-check on every PR

---

## PHASE 1 — Core MVP (Week 3–8)

### 1.1 Gate Pass Feature
- [ ] 🔴 Edge Function: generate-qr (HMAC-SHA256 token from userId + timestamp + secret)
- [ ] 🔴 gate_passes service functions: generatePass, getActivePass, getHistory
- [ ] 🔴 useGatePass hook (generate, poll for active pass, expire countdown)
- [ ] 🔴 GatePassPage: show active QR with 5-minute countdown OR "Generate Pass" button
- [ ] 🔴 QRCodeDisplay component (qrcode.react, countdown ring, expired state)
- [ ] 🔴 HistoryPage: paginated entry/exit log (last 30 days), entry/exit type filter
- [ ] 🔴 Offline: cache last generated pass to IndexedDB (survives app close)
- [ ] 🟡 Security scan page: QRScanner component (camera API), verify token via Supabase, mark pass as used
- [ ] 🟡 Late-night alert: Edge Function triggered by DB insert (gate_passes after 22:00 → push warden)
- [ ] 🟢 Pass status indicators (active green ring, expired grey, used checkmark)

### 1.2 Emergency (SOS) — ship with Gate Pass sprint
- [ ] 🔴 EmergencyPage: SOSButton + static emergency contacts list
- [ ] 🔴 SOSButton component (large red, confirm modal before fire, one-tap)
- [ ] 🔴 sos_incidents service: insert row + trigger push to warden + security
- [ ] 🔴 Emergency contacts: pre-seed warden, security, hospital, police, ambulance for hostel
- [ ] 🟡 Geolocation: attach lat/lng to SOS incident if permission granted
- [ ] 🟢 Cache emergency contacts page in service worker (offline-accessible)

### 1.3 Mess Management Feature
- [ ] 🔴 Mess menu service: getWeeklyMenu, getOptouts, upsertOptout
- [ ] 🔴 useMessMenu hook + useOptouts hook
- [ ] 🔴 MessPage: 7-day calendar view with MealToggleRow per day
- [ ] 🔴 MealToggleRow component: Breakfast / Lunch / Dinner toggles, current status, disable past dates
- [ ] 🔴 MealCalendar component: week navigation (prev/next), today highlighted
- [ ] 🔴 Offline queue: toggle changes stored in offline.store, synced on reconnect
- [ ] 🟡 Edge Function: calculate-mess-bill (join mess_optouts + mess_rates for month)
- [ ] 🟡 MessBillPage: day-by-day breakdown table, total, PDF download
- [ ] 🟡 Manager: mess menu editor (set items per day per meal)
- [ ] 🟡 Manager: set/update mess rates (breakfast/lunch/dinner per day rate)
- [ ] 🟢 Meal feedback: star rating per meal (post-MVP display; store in DB now)
- [ ] 🟢 Opt-out deadline enforcement: disable toggles for meals within 2 hours

### 1.4 Complaints Feature
- [ ] 🔴 Complaints service: createComplaint, getComplaints, getComplaintById, updateStatus
- [ ] 🔴 useComplaints hook + useComplaintDetail hook
- [ ] 🔴 NewComplaintPage: form with category, title, description (min 20 chars), priority, photo upload
- [ ] 🔴 PhotoUpload component: up to 3 images, preview thumbnails, remove button, upload to Supabase Storage
- [ ] 🔴 ComplaintsPage: list with status badges, category filter, date sort
- [ ] 🔴 ComplaintDetailPage: full details + StatusTimeline component
- [ ] 🔴 StatusTimeline component: vertical timeline from complaint_updates rows
- [ ] 🟡 Realtime subscription: complaint status updates pushed to student without refresh
- [ ] 🟡 Manager: complaint management page (filter by status/priority, assign to staff, add update note)
- [ ] 🟡 Auto-assign logic: round-robin or by category (configurable per hostel)
- [ ] 🟡 Post-resolution rating: star rating prompt after status → resolved
- [ ] 🟢 Complaint notification: push to student on every status change

---

## PHASE 2 — Operations (Week 9–12)

### 2.1 Payment Dashboard
- [ ] 🔴 Payments service: getPayments, getPaymentSummary
- [ ] 🔴 usePayments hook
- [ ] 🔴 PaymentsPage: consolidated view (rent, mess, electricity, misc) with status badges
- [ ] 🔴 PaymentCard component: amount, due date, status, receipt button
- [ ] 🔴 DB trigger: auto-set status to 'overdue' when due_date < today and status = 'pending'
- [ ] 🟡 Due date reminder: Edge Function cron (daily) → push notification for dues in 3 days
- [ ] 🟡 Receipt download: generate PDF receipt (jsPDF or server-side Edge Function)
- [ ] 🟡 Roommate expense calculator: enter total amount, split equally/custom/percentage
- [ ] 🟢 Payment history: past payments list with date, amount, type

### 2.2 Manager Dashboard
- [ ] 🔴 ManagerDashboard page: stat cards (occupancy, open complaints, today's entries, pending payments)
- [ ] 🔴 Manager gate log page: real-time feed of entry/exit, search by student name/room
- [ ] 🟡 Mess opt-out summary: for today/tomorrow — how many students per meal (food planning)
- [ ] 🟡 Complaint resolution metrics: avg resolution time, open by priority
- [ ] 🟡 Payment collection summary: total collected vs outstanding this month
- [ ] 🟢 CSV export: gate log, payment report, complaint report

---

## PHASE 3 — Community + Retention (Week 13–16)

### 3.1 Noticeboard
- [ ] 🔴 Announcements service: getAnnouncements, createAnnouncement, pinAnnouncement
- [ ] 🔴 NoticeboardPage: feed with category filter, pinned items at top
- [ ] 🔴 AnnouncementCard component: title, category badge, posted_by, date, pin indicator
- [ ] 🟡 Manager: post / edit / delete announcements, set expiry, pin
- [ ] 🟡 Push notification for 'emergency' category announcements (all students)
- [ ] 🟢 Acknowledgment tracking: mark as read, manager sees read count

### 3.2 Visitor Management
- [ ] 🔴 Visitors service: createVisitor, getVisitors, updateVisitorStatus
- [ ] 🔴 VisitorsPage: upcoming visitors list
- [ ] 🔴 NewVisitorPage: form (name, phone, purpose, date, time window)
- [ ] 🟡 Security: look up pre-registered visitor by phone, mark arrived/left
- [ ] 🟢 Auto-expire visitors pass at pass_expiry timestamp (DB trigger)

### 3.3 Marketplace
- [ ] 🟡 Marketplace service: createListing, getListings, getListingById, markSold
- [ ] 🟡 MarketplacePage: grid/list view, category + condition filters, search
- [ ] 🟡 MarketplaceCard component: image, title, price, condition badge, "I'm Interested" button
- [ ] 🟡 NewListingPage: form with up to 3 image uploads
- [ ] 🟡 ListingDetailPage: full details + contact seller (opens WhatsApp or in-app message)
- [ ] 🟢 Mark as sold: listing owner can close listing

### 3.4 Lost & Found
- [ ] 🟢 LostFound service: createReport, getReports
- [ ] 🟢 LostFoundPage: separate tabs for Lost / Found, search by item name
- [ ] 🟢 ReportForm: type (lost/found), item name, description, location, date, optional photo
- [ ] 🟢 Keyword match suggestion: when posting "lost", show existing "found" items with matching words

---

## PHASE 4 — Polish + Testing (Week 17–20)

### 4.1 PWA Hardening
- [ ] 🔴 Lighthouse PWA audit: target score ≥ 90 on all categories
- [ ] 🔴 Offline scenarios: test QR pass offline, emergency contacts offline, mess toggle queue
- [ ] 🔴 iOS install instructions: in-app guide ("tap Share → Add to Home Screen")
- [ ] 🟡 Custom install prompt component (shown after 2nd session, dismissible)
- [ ] 🟡 Push notification opt-in prompt (shown after login, explains value)
- [ ] 🟢 Background sync: verify queued mutations fire reliably on reconnect

### 4.2 Performance
- [ ] 🔴 Route-level code splitting (React.lazy + Suspense on all feature pages)
- [ ] 🔴 Image optimization: resize on upload (Supabase Edge Function or client-side canvas)
- [ ] 🟡 TanStack Query prefetch: prefetch mess menu on dashboard load
- [ ] 🟢 Bundle analysis: vite-bundle-visualizer, address any large dependencies

### 4.3 Testing
- [ ] 🟡 Playwright E2E: auth flow (signup → OTP → dashboard)
- [ ] 🟡 Playwright E2E: gate pass generation → QR display → scan → mark used
- [ ] 🟡 Playwright E2E: mess opt-out toggle → bill recalculation
- [ ] 🟡 Playwright E2E: complaint submit → status update → notification
- [ ] 🟢 Unit tests (Vitest): bill calculation util, QR token format validation

### 4.4 Accessibility
- [ ] 🟡 All interactive elements keyboard navigable
- [ ] 🟡 ARIA labels on icon-only buttons (BottomNav, SOSButton)
- [ ] 🟢 Color contrast check: WCAG 2.1 AA minimum
- [ ] 🟢 Focus visible styles on all focusable elements

---

## PHASE 5 — Pilot Launch (Week 21–24)

### 5.1 Onboarding
- [ ] 🔴 Manager onboarding flow: create hostel → set mess rates → invite students via hostel code
- [ ] 🔴 Student join flow: enter hostel code → assign room → profile complete
- [ ] 🟡 Bulk student import: CSV upload (name, email, phone, room number)
- [ ] 🟢 Welcome notification: first-login push with quick-start tips

### 5.2 Operations
- [ ] 🔴 Production Supabase project (separate from dev)
- [ ] 🔴 Vercel production deployment + custom domain
- [ ] 🟡 Error monitoring (Sentry or Supabase logs dashboard)
- [ ] 🟡 Uptime monitoring
- [ ] 🟢 Supabase automated daily backups confirmed

### 5.3 Pilot Feedback
- [ ] 🟡 In-app feedback button (simple: rating + text → stored in DB)
- [ ] 🟡 Analytics: track DAU, feature usage events (Supabase Analytics or Plausible)
- [ ] 🟢 Weekly feedback review + prioritized fix sprint

---

## BACKLOG (Post-MVP)

- [ ] Parent portal (consent-gated: entry/exit patterns, payment status, emergency alerts)
- [ ] Room management (room details, room change requests, room inventory)
- [ ] Payment gateway integration (Razorpay / PhonePe UPI)
- [ ] Native mobile apps (React Native or Capacitor wrapper)
- [ ] AI meal demand prediction (reduce food waste beyond manual opt-out)
- [ ] Multi-hostel management under one manager account
- [ ] Warden staff management (assign roles, manage security guard accounts)
- [ ] University ERP / student ID system integration
- [ ] White-label / custom branding per hostel
- [ ] Advanced analytics dashboard (trends, cohort analysis)
- [ ] Smart lock IoT integration (replace QR scanner with physical scanner)
