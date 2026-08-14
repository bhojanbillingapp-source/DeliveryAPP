# Project Context

Living doc for AI assistants working on this repo. Update the "Next Up" section
as new work is scoped; keep "Done" in sync with what's actually shipped.

## What this is

`CustomerApp` — a React Native (0.87, RN CLI, not Expo) customer-facing mobile
app for ordering food for delivery from a **single restaurant outlet**. It's
the customer-facing counterpart to a separate POS/kiosk product ("PoSS") —
`src/theme.ts` mirrors color tokens from `frontend/src/theme/pos.ts` in that
other repo so the two apps read as one product family. This repo does not
contain the backend or the POS frontend, only this client.

- Platforms: Android + iOS (native projects checked in under `android/`, `ios/`)
- Language: TypeScript
- Nav: React Navigation (native-stack)
- State: React Context only (no Redux/Zustand) — `AuthContext`, `CartContext`
- HTTP: axios instance with an auth-token interceptor (`src/api/client.ts`)
- Local persistence: AsyncStorage (auth token + cached customer profile)

## Deployment model — important quirk

One build of this app = one restaurant outlet. `src/config.ts` reads
`OUTLET_ID` (a `bbs.clients.client_id` UUID) from `.env` at **build** time via
`react-native-dotenv` (see below) — there's no runtime outlet selection or
multi-tenant switching. Repointing this app to a different restaurant means
changing `OUTLET_ID` in `.env` and rebuilding (Metro/babel inlines the value
into the bundle; editing `.env` requires a full rebuild, not just Fast
Refresh).

`API_BASE_URL` in the same file is still a hardcoded constant (not in
`.env`), pointing at `10.0.2.2:8080` (Android emulator's alias for host
localhost) — swap to a LAN IP for physical-device testing.

### `.env` support (`react-native-dotenv`)

Added as a devDependency + babel plugin (`babel.config.js`) so `OUTLET_ID`
can differ per outlet build without editing source. `src/types/env.d.ts`
declares the `@env` module for TypeScript. `.env` is gitignored (was already
in `.gitignore`); `.env.example` documents the one required key. Import
pattern used in `src/config.ts` — `import { OUTLET_ID } from '@env'` then
re-export, **not** `export { OUTLET_ID } from '@env'` — the dotenv babel
plugin only intercepts plain import statements, not re-export-from syntax.

## Commands

```
npm start          # Metro bundler
npm run android     # build + run on Android emulator/device
npm run ios         # build + run on iOS simulator (needs `bundle exec pod install` first)
npm test            # jest
npm run lint         # eslint .
```

No test-filtering script is configured; use jest's own `-t <pattern>` /
`<file>` args via `npm test -- <args>`.

## Architecture

```
App.tsx                    → SafeAreaProvider > AuthProvider > RootNavigator
src/context/AuthContext.tsx → owns login/signup/logout, session persisted to AsyncStorage
src/context/CartContext.tsx → in-memory cart (lines, qty, total) — NOT persisted, cleared on order placement
src/navigation/RootNavigator.tsx → swaps between AuthStack (Login/Signup) and AppStack (Menu/Cart/Orders/OrderDetail) based on AuthContext.customer
src/api/client.ts          → single axios instance, attaches Bearer token from AsyncStorage on every request
src/screens/*               → one file per screen, screen owns its own StyleSheet (no shared component library beyond ScreenHeader)
src/theme.ts                → colors/spacing/radius tokens, shared statusColors map for order status badges
```

**Auth gate is the top-level branch.** `RootNavigator` decides AuthStack vs.
AppStack purely off whether `AuthContext.customer` is set — there's no
separate "splash/onboarding" state machine beyond the initial `isLoading`
check while AsyncStorage is read.

**Cart is not persisted.** `CartProvider` is mounted only inside the
authenticated `AppStack` branch, so it fully resets on logout/login and does
not survive an app restart.

## Backend API surface consumed (base: `API_BASE_URL`)

All requests include `outlet_id` (login/signup) or rely on the outlet being
implied server-side via the authenticated customer for order endpoints.

- `POST /customer-orders/auth/login` `{ outlet_id, mobile, password }` → `{ customer, accessToken }`
- `POST /customer-orders/auth/signup` `{ outlet_id, name, mobile, password }` → `{ customer, accessToken }`
- `GET /ordermenu?outlet_id=&order_type=delivery` → menu items (filtered client-side to `is_active && price != null`)
- `POST /customer-orders/orders` `{ items: [{item_id, quantity}], payment_method, delivery_landmark? }` → created order
- `GET /customer-orders/orders` → `{ orders: OrderSummary[] }`
- `GET /customer-orders/orders/:orderId` → `{ order, items }`

This app never talks to the backend directly for anything else (no payments
gateway integration yet — see below).

**Backend finding:** the `/customer-orders/*` endpoints above (auth/login,
auth/signup, orders, orders/:id) do **not exist yet** in `BILLINGAPP_API`
(checked `src/app.js` and `src/routes/`) — only staff-facing `/api/customers`
exists there. `bbs.customers` also has no password column. So this app was
built against an API contract that hasn't been implemented on the backend
yet — building it is a prerequisite for #1 below, not an incidental detail.

## Backend repo

Backend lives in the sibling repo `BILLINGAPP_API` (Node/Express + Postgres,
`bbs` schema, mix of Sequelize migrations under `migrations/*.js` and hand-run
raw SQL files `migrations/YYYYMMDD_description.sql`). Relevant existing pieces
found while scoping the roadmap below:

- `src/services/razorpayService.js` — Razorpay integration, currently used
  for subscription billing (`billing/subscription.*`) and UPI QR
  (`upiQrController.js`), not yet for customer order checkout.
- `src/services/geocodeService.js` — Google Geocoding + haversine distance,
  used today only by the "Order by Phone" delivery-radius check.
- `bbs.client_address` (migration `20260310082600-create-client-address.js`)
  — already has `google_latitude`/`google_longitude` per `client_id`
  (= outlet). This **is** the outlet's exact location; it's already stored,
  just only consumed by the phone-order radius check so far.
- `bbs.outlet_delivery_settings` — per-outlet delivery radius config, used by
  the same radius check.
- `bbs.orders.delivery_boy_id/name`, `delivery_landmark`, `delivery_latitude`,
  `delivery_longitude`, `delivery_distance_km` — added for "Order by Phone"
  (`20260705_add_delivery_boy.sql`, orderController.js's phone-order path).
- `bbs.delivery_status_history` (`20260803_create_delivery_status_history.sql`)
  — has `latitude`/`longitude` columns, explicitly left nullable/unused
  "until a future GPS-tracking phase" per the migration's own comment. This
  is the intended home for live tracker pings — nothing currently writes to
  those two columns.
- `bbs.customers.address` — single free-text column (`20260621_add_address_to_customers.sql`),
  no lat/lng, no multiple addresses. Not the same thing as an address book.
- Staff auth already has a full OTP flow (`send-otp`, `verify-otp`,
  `forgot-password`, `verify-reset-otp`, `reset-password` in
  `auth.routes.js`, backed by `bbs.otp_verifications` + `src/utils/otp.js`) —
  a reusable pattern for customer forgot-password once customer auth exists.
- Order-status messaging today is WhatsApp/SMS via Twilio
  (`src/services/notificationService.js` + `twilioService.js`), for
  "order ready" alerts. No FCM/APNs/device-token push infra exists.
- `src/realtime/io.js` — a socket layer already exists for other real-time
  features and could carry live tracker updates instead of polling.

## Done

- Mobile-number + password auth (login, signup with client-side min-length
  password check), session persisted across app restarts via AsyncStorage.
- Delivery menu browsing: category-grouped `SectionList`, client-side search
  filter, pull-to-refresh.
- Cart: add/increment/decrement/remove, running total, sticky "view cart" bar.
- Checkout: Cash-on-Delivery only, optional delivery landmark note, places
  order and clears cart.
- Order history list + order detail screen (per-item status, order status
  badge, payment status/method).
- Shared visual theme aligned with the sibling POS/kiosk product.
- Minimal jest smoke test (`App` renders without throwing) — currently
  failing on `main`/pre-existing (unrelated to any work here): jest can't
  transform `@react-native-async-storage/async-storage`'s ESM build, needs a
  `transformIgnorePatterns` fix in `jest.config.js`. Not touched.
- `OUTLET_ID` moved from a hardcoded constant to `.env` (via
  `react-native-dotenv`) — see "`.env` support" above.

## Known gaps / not yet done

- No online payment method — checkout is COD-only (`payment_method: 'COD'` is
  hardcoded in `CartScreen`).
- No address book — only a free-text "landmark" field per order, no delivery
  address entity, no map/location picker.
- No push notifications for order status changes — status is pull-only
  (manual refresh on Orders/OrderDetail screens).
- No forgot-password / OTP flow.
- No profile/account screen (view/edit name, mobile, etc.).
- No multi-outlet support in a single build (see deployment model above).
- Only one test file in the repo (`App.test.tsx`), no per-screen or context
  test coverage.

## Next Up

Approved backlog, in the order the user raised them. Backend work targets
`BILLINGAPP_API` (sibling repo — see "Backend repo" above); do not touch the
existing "Order by Phone" radius-check flow (`order_type === 'phone'` path in
`orderController.js`) while building any of this — extend alongside it,
share its tables where noted, don't rewire it.

1. **Online payment method** (currently COD-only)

   - Prerequisite: the `/customer-orders/*` API this app calls doesn't exist
     on the backend yet (see finding above) — this has to be built first,
     not just extended.
   - Reuse `razorpayService.js` for the payment provider rather than adding
     a new one. Check whether `order_bills` / `payment_qr_codes` /
     `dynamic_qr_codes` (already in the schema) cover order payment records
     before creating new tables.
2. **Address book with exact location** (multiple saved addresses, switchable)

   - New table needed — `bbs.customers.address` is a single free-text field,
     not an address book. Something like `bbs.customer_addresses`
     (`address_id`, `customer_id`, `label`, `address_line1/2`, `city`,
     `state`, `pin_code`, `landmark`, `latitude`, `longitude`, `is_default`,
     `created_at`/`updated_at`) — mirror `client_address`'s column style for
     consistency.
   - New CRUD endpoints (list/add/edit/delete/set-default) under
     `/customer-orders/`.
   - Client: address form with a map picker + "use current GPS location"
     (device geolocation), address selector on the Cart screen replacing the
     current free-text landmark input (keep `delivery_landmark` as a
     delivery-note field alongside the picked address, not a replacement).
   - Reuse `geocodeService.js` / `haversineDistanceKm` for validating a saved
     address against the outlet's delivery radius — same functions the phone
     order flow uses, don't fork them.
   - **Delivery radius requirement: 3 km from the outlet's stored location,
     configurable per restaurant — via DB, not a backend `.env` var.**
     `bbs.outlet_delivery_settings` is already keyed by `outlet_id` and exists
     exactly for this (per-outlet `delivery_radius_km` +
     `is_radius_check_enabled`), so no new table or env var is needed on the
     backend — that's the DB-driven config already in place. (Note: this app
     *does* now read its own `OUTLET_ID` from `.env` at build time — see
     "`.env` support" above — but that's a per-build client value, unrelated
     to this backend per-outlet DB setting; each build still only ever talks
     to the one outlet baked into it.) Keep the `3` fallback in
     `deliverySettingsService.js`'s `DEFAULT_SETTINGS` (used only when an
     outlet has no row yet) as a plain code constant. Note this radius check
     today only runs for `order_type === 'phone'` — the customer app's
     `delivery` order type needs the same check (and the same
     `outlet_delivery_settings` table) wired in, not a separate mechanism.
3. **Outlet exact location** — mostly already done

   - `bbs.client_address.google_latitude/google_longitude` already stores
     this per outlet. No new column needed.
   - Work is just: make sure it's populated for every real outlet (an
     onboarding/admin step if it isn't already), and reuse it for the
     customer-app map/tracker instead of the phone-order flow being its only
     consumer.
4. **Live map tracker for delivery** — biggest unknown

   - There is currently no delivery-boy-facing app or client of any kind —
     `delivery_boy_id/name` get assigned to an order, but nothing produces a
     GPS ping. This needs a location *source* before it needs a map:
     minimally, some client (could be a lightweight webview/PWA, doesn't
     have to be a full app) that a delivery person uses to send periodic
     lat/lng. Flagging this as a dependency to decide on, not deferring it.
   - Once pings exist, write them into `bbs.delivery_status_history.latitude/longitude`
     (columns already exist for exactly this) rather than a new table.
   - Customer app: a "Track order" view reading the latest ping — either
     polling `delivery_status_history`, or over `src/realtime/io.js` if
     socket delivery is preferred (see suggestion below).
5. **Forgot-password / OTP** for customers

   - Depends on customer auth existing first (#1's prerequisite). Once it
     does, reuse the existing staff OTP pattern
     (`otp_verifications` + `src/utils/otp.js` + the
     `send-otp`/`verify-otp`/`forgot-password`/`reset-password` routes)
     rather than building a second OTP mechanism.
6. **Profile/account screen** (view/edit name, mobile)

   - Mostly client-side once #1 exists; a mobile-number change should route
     through the OTP flow from #5 rather than a bare `PUT`.
7. **Push notifications for order status**

   - No push infra (FCM/APNs/device tokens) exists in the backend today —
     only WhatsApp/SMS via Twilio for a different flow (order-ready alerts).
     Worth deciding before building: real push notifications, or extend the
     existing Twilio WhatsApp/SMS pattern to order-status changes (much
     smaller lift, reuses `notificationService.js`).
8. **Multi-outlet support in a single build**

   - Client-only change (drop the build-time `OUTLET_ID` constant in
     `src/config.ts`, add outlet selection/detection). No backend blocker.

## Suggestions (not requested — needs approval, tackle last)

- Prefer sockets (`src/realtime/io.js`, already used elsewhere in the
  backend) over polling for the live tracker in #4 — cheaper and lower
  latency than the customer app repeatedly hitting an endpoint.
- Before creating any new payment-record table for #1, check whether
  `order_bills`/`payment_qr_codes`/`dynamic_qr_codes` already cover it —
  the schema has grown a lot of billing tables that may already fit.
- Soft-delete (`deleted_at`) on `customer_addresses` instead of hard delete,
  so past orders keep a stable snapshot of the address they were delivered
  to even after a customer edits/removes it later.
- Reuse the Twilio WhatsApp/SMS pattern (not just for #7) to notify a
  customer when their assigned delivery boy goes `OUT_FOR_DELIVERY` —
  cheap addition once #4's status pings exist, no push infra needed.
- Rate-limit/throttle the new customer auth + OTP endpoints from #1/#5 the
  same way staff auth likely already does (`verification.middleware.js`) —
  wasn't verified in detail, worth checking before shipping customer OTP.
