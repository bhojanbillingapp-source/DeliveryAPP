# Project Context

Living doc for AI assistants working on this repo. Update the "Next Up" section
as new work is scoped; keep "Done" in sync with what's actually shipped.

## What this is

`CustomerApp` — a React Native (0.87, RN CLI, not Expo) customer-facing mobile
app for ordering food for delivery. It's the customer-facing counterpart to a
separate POS/kiosk product ("PoSS") — `src/theme.ts` mirrors color tokens from
`frontend/src/theme/pos.ts` in that other repo so the two apps read as one
product family. This repo does not contain the backend or the POS frontend,
only this client.

- Platforms: Android + iOS (native projects checked in under `android/`, `ios/`)
- Language: TypeScript
- Nav: React Navigation (native-stack)
- State: React Context only (no Redux/Zustand) — `OutletContext`, `AuthContext`, `CartContext`
- HTTP: axios instance with an auth-token interceptor (`src/api/client.ts`)
- Local persistence: AsyncStorage (selected outlet, auth token, cached customer profile)

## Deployment model

**Multi-outlet, runtime-selected (as of 2026-08-15)** — one app install can
serve any restaurant outlet. Previously this was one-build-per-outlet via a
build-time `.env` constant; see "Multi-outlet support" under "Done" below for
why and how that changed, and the git history of this file if you need the
old single-outlet framing. `src/context/OutletContext.tsx` persists the
selected `outlet_id` (a `bbs.clients.client_id` UUID) + display name to
AsyncStorage; `RootNavigator` shows `OutletSelectScreen` first whenever none
is stored. A customer enters the outlet ID their restaurant gave them
(no public outlet directory exists — see the "Outlet selection" scope
decision below), confirmed via `GET /customer-orders/outlet/:outletId`.

`API_BASE_URL` in `src/config.ts` is still a hardcoded constant (not in
`.env`), pointing at `10.0.2.2:8080` (Android emulator's alias for host
localhost) — swap to a LAN IP for physical-device testing.

### `.env` support (`react-native-dotenv`)

Still wired up (`babel.config.js` + `src/types/env.d.ts`) but currently
unused — `OUTLET_ID` was its only consumer and that moved to runtime
selection. Left in place in case a future per-build key is needed; `.env` /
`.env.example` no longer declare any keys.

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
App.tsx                     → SafeAreaProvider > OutletProvider > AuthProvider > RootNavigator
src/context/OutletContext.tsx → owns selected outlet_id/name, persisted to AsyncStorage; getStoredOutletId() for non-component modules
src/context/AuthContext.tsx → owns login/signup/logout/updateCustomer, session persisted to AsyncStorage
src/context/CartContext.tsx → in-memory cart (lines, qty, total) — NOT persisted, cleared on order placement
src/navigation/RootNavigator.tsx → OutletSelectScreen (no outlet) → AuthStack (Login/Signup/ForgotPassword) → AppStack (Menu/Cart/Orders/OrderDetail/AddressList/AddressForm/TrackOrder/Profile), gated on OutletContext then AuthContext.customer
src/api/client.ts          → single axios instance, attaches Bearer token from AsyncStorage on every request
src/screens/*               → one file per screen, screen owns its own StyleSheet (no shared component library beyond ScreenHeader)
src/theme.ts                → colors/spacing/radius tokens, shared statusColors map for order status badges
```

**Gating is now two-level.** `RootNavigator` first checks
`OutletContext.outletId` (outlet-select screen if unset), then
`AuthContext.customer` (AuthStack vs. AppStack) — both gates read from
AsyncStorage on startup via their own `isLoading` flag.

**Cart is not persisted.** `CartProvider` is mounted only inside the
authenticated `AppStack` branch, so it fully resets on logout/login and does
not survive an app restart.

## Backend API surface consumed (base: `API_BASE_URL`)

All requests include `outlet_id` (outlet lookup, login/signup, forgot-password)
or rely on the outlet being implied server-side via the authenticated
customer's JWT for order/address/profile/tracking endpoints.

- `GET /customer-orders/outlet/:outletId` → `{ outlet: { outlet_id, name } }` (public, no listing — caller must already have the ID)
- `POST /customer-orders/auth/login` `{ outlet_id, mobile, password }` → `{ customer, accessToken }`
- `POST /customer-orders/auth/signup` `{ outlet_id, name, mobile, password }` → `{ customer, accessToken }`
- `POST /customer-orders/auth/forgot-password` `{ outlet_id, mobile }` → sends OTP (`dev_otp` in response outside production)
- `POST /customer-orders/auth/verify-reset-otp` `{ outlet_id, mobile, otp }` → marks OTP verified
- `POST /customer-orders/auth/reset-password` `{ outlet_id, mobile, otp, new_password }` → sets new password
- `GET /ordermenu?outlet_id=&order_type=delivery` → menu items (filtered client-side to `is_active && price != null`)
- `POST /customer-orders/orders` `{ items: [{item_id, quantity}], payment_method, address_id?, delivery_landmark? }` → created order
- `GET /customer-orders/orders` → `{ orders: OrderSummary[] }`
- `GET /customer-orders/orders/:orderId` → `{ order, items }`
- `GET /customer-orders/orders/:orderId/track` → `{ status, delivery_boy_name, location }`, customer-scoped
- `GET /customer-orders/addresses` → `{ addresses: Address[] }`
- `POST /customer-orders/addresses` `{ label, address_line1, address_line2?, city?, state?, pin_code?, landmark?, latitude, longitude, is_default? }` → created address (422 `OUT_OF_RADIUS` if outside the outlet's delivery radius)
- `PUT /customer-orders/addresses/:addressId` → updated address
- `DELETE /customer-orders/addresses/:addressId` → soft-deletes (sets `deleted_at`)
- `PUT /customer-orders/addresses/:addressId/default` → marks it the default, unsets any other
- `GET /customer-orders/profile` → `{ customer }`
- `PUT /customer-orders/profile` `{ name }` → bare update, no OTP needed
- `POST /customer-orders/profile/mobile/request-otp` `{ new_mobile }` → sends OTP to the new number
- `POST /customer-orders/profile/mobile/confirm` `{ new_mobile, otp }` → applies the mobile change

This app never talks to the backend directly for anything else (no payments
gateway integration — see "Known gaps" below).

## Backend repo

Backend lives in the sibling repo `BILLINGAPP_API` (Node/Express + Postgres,
`bbs` schema, mix of Sequelize migrations under `migrations/*.js` and hand-run
raw SQL files `migrations/YYYYMMDD_description.sql`). Relevant pieces:

- `src/services/razorpayService.js` — Razorpay integration, currently used
  for subscription billing (`billing/subscription.*`) and UPI QR
  (`upiQrController.js`), not yet for customer order checkout (blocked on a
  real Razorpay account — see "Known gaps").
- `src/services/geocodeService.js` — Google Geocoding + haversine distance,
  used by the "Order by Phone" delivery-radius check and reused (haversine
  only, no geocoding needed) by the customer address book's radius check.
- `bbs.client_address` — has `google_latitude`/`google_longitude` per
  `client_id` (= outlet), the outlet's exact location.
- `bbs.outlet_delivery_settings` — per-outlet delivery radius config
  (`delivery_radius_km`, `is_radius_check_enabled`), shared by the phone-order
  radius check and the customer address book's radius check.
- `bbs.orders.delivery_boy_id/name`, `delivery_landmark`, `delivery_latitude`,
  `delivery_longitude`, `delivery_distance_km` — delivery-assignment/snapshot
  columns, populated by both the phone-order flow and customer app checkout.
- `bbs.delivery_status_history` — discrete delivery status transitions
  (ASSIGNED/ACCEPTED/PICKED_UP/ON_THE_WAY/DELIVERED/RETURNED), written by
  `deliveryTrackingService.advanceStatus`. Its own `latitude`/`longitude`
  columns are unused — live GPS pings go to `bbs.delivery_locations` instead
  (separate append-only table, high write volume vs. this table's low
  volume — see that migration's comment).
- `bbs.delivery_locations` — GPS ping trail from the delivery-boy-facing app,
  written via `POST /api/delivery/:orderId/location`
  (`deliveryTrackingController.js`, staff/delivery-boy auth only). Read by
  customers indirectly through the customer-scoped `.../track` endpoint above.
- `bbs.customer_addresses` — the customer address book. Soft-delete via
  `deleted_at`. `bbs.customers.address` (the old single free-text column)
  is untouched/still there for the phone-order flow.
- `bbs.otp_verifications` — shared OTP table. Staff OTP flows (`send-otp`,
  `verify-otp`, `forgot-password`, `verify-reset-otp`, `reset-password` in
  `auth.routes.js`) scope by `user_id` (FK to `bbs.client_users`). Customer
  OTP flows (forgot-password, mobile-number change) reuse the same table via
  a parallel nullable `customer_id` column (added
  `20260815_add_customer_id_to_otp_verifications.sql`) rather than forking
  the table — `phone` alone isn't a safe scoping key since the same mobile
  number can belong to different customers at different outlets.
- `src/services/notificationService.js` + `twilioService.js` — WhatsApp/SMS.
  Originally only `sendOrderReadyNotification` (takeaway "order ready"
  alerts, triggered from `kitchenController.js`). Now also
  `sendOrderStatusNotification` (delivery `ON_THE_WAY`/`DELIVERED` alerts,
  triggered from `deliveryTrackingController.advanceDeliveryStatus` — see
  "Done" below). No FCM/APNs/device-token push infra exists; this is the
  intentional substitute (see the "Push notifications" scope decision).
- `src/realtime/io.js` — a socket layer exists for staff-side real-time
  features (delivery status/location broadcast to `order:<id>` rooms) but
  its connection-auth middleware only decodes staff-shaped JWTs
  (`decoded.user_id`, `decoded.client_id`) — a customer JWT
  (`type: 'customer'`, `customer_id`, `outlet_id`) isn't handled, so the
  customer app's order tracker polls REST instead of subscribing. See the
  socket-auth suggestion below if this becomes worth doing.

## Done

- Mobile-number + password auth (login, signup with client-side min-length
  password check), session persisted across app restarts via AsyncStorage.
- Delivery menu browsing: category-grouped `SectionList`, client-side search
  filter, pull-to-refresh.
- Cart: add/increment/decrement/remove, running total, sticky "view cart" bar.
- Checkout: Cash-on-Delivery only, places order and clears cart.
- Order history list + order detail screen (per-item status, order status
  badge, payment status/method).
- Shared visual theme aligned with the sibling POS/kiosk product.
- Minimal jest smoke test (`App` renders without throwing) — currently
  failing on `main`/pre-existing (unrelated to any work here): jest can't
  transform `@react-native-async-storage/async-storage`'s ESM build, needs a
  `transformIgnorePatterns` fix in `jest.config.js`. Not touched.
- **Address book (2026-08-15)**: `bbs.customer_addresses` (soft-delete via
  `deleted_at`) + list/add/edit/delete/set-default endpoints under
  `/customer-orders/addresses`. Client: `AddressListScreen` +
  `AddressFormScreen` (GPS "use current location" via
  `@react-native-community/geolocation` + manual address fields — **no
  interactive map picker**, see scope decision below), wired into
  `CartScreen` as an address selector replacing the old free-text-only
  landmark input (`delivery_landmark` is a separate optional delivery *note*
  alongside the picked address). The 3km delivery-radius check
  (`outlet_delivery_settings` + `client_address` lat/lng, no geocoding
  needed since the app already has device lat/lng) runs both when an address
  is saved and again at order placement.
  **Scope decision**: a true map picker needs `react-native-maps` + a Google
  Maps API key + native Android/iOS project changes that couldn't be built
  or visually verified in this environment — GPS + manual fields was chosen
  instead. Revisit if a map UI becomes a hard requirement.
- **Customer-facing order tracking (2026-08-15)**: `GET
  /customer-orders/orders/:orderId/track` — customer-scoped read of
  `deliveryTrackingService.getCurrentStatus` + `getLastKnownLocation`, never
  exposes the delivery boy's identity beyond their name. Client:
  `TrackOrderScreen`, reachable via a "Track order" button on
  `OrderDetailScreen` while `order.status === 'OPEN'`; polls every 8s and
  stops once status is `DELIVERED`/`RETURNED`.
  **Scope decision**: polling over REST, not `src/realtime/io.js` sockets —
  see the socket-auth suggestion below. No in-app map rendering either —
  "view location" opens the device's Maps app via `Linking` with the
  last-known lat/lng instead of embedding a map view.
- **Forgot-password / OTP for customers (2026-08-15)**: reuses
  `bbs.otp_verifications` (see "Backend repo" above for the `customer_id`
  column addition) rather than a second OTP mechanism.
  `customerOtp.service.js` — 60s resend cooldown, max 3 requests / 5 min, max
  5 verify attempts, 5-minute OTP expiry, bcrypt-hashed OTPs (mirrors the
  staff flow's shape). Client: `ForgotPasswordScreen` (mobile → OTP → new
  password, 3-step), linked from `LoginScreen`.
  **Scope decision**: delivery via `twilioService.sendSMS`, not
  `utils/sns.js` (AWS SNS, what staff reset OTPs use) — this app already
  depends on Twilio for order notifications, so reusing that credential
  avoids adding a second unconfigured external SMS dependency. In
  non-production, the OTP is returned as `dev_otp` in the response and
  logged server-side (same bypass shape as the staff flow), no real SMS
  sent.
- **Profile/account screen (2026-08-15)**: `GET/PUT /customer-orders/profile`
  for name (bare update). Mobile-number change is a separate
  request-otp/confirm pair (`customerProfile.service.js`, same
  `otp_verifications` + `customer_id` pattern as forgot-password, purpose
  `CUSTOMER_CHANGE_MOBILE`) rather than a bare `PUT`, checking the new
  number isn't already in use at that outlet first. Client: `ProfileScreen`
  (name edit, mobile change flow, switch-restaurant, log out), reachable via
  a "Profile" header link on `MenuScreen` (replaced the old inline "Log Out"
  link — logout now lives on the Profile screen instead).
- **Push notifications for order status (2026-08-15)**: extended the
  existing Twilio WhatsApp/SMS pattern rather than building FCM/APNs/device-
  token infra. `notificationService.sendOrderStatusNotification` fires
  (fire-and-forget, non-blocking, same shape as the existing
  `sendOrderReadyNotification`/`kitchenController.js` "AutoNotify" pattern)
  from `deliveryTrackingController.advanceDeliveryStatus` when a delivery
  reaches `ON_THE_WAY` or `DELIVERED`.
  **Scope decision**: this was an explicit choice over real push — no push
  provider account exists (same kind of external-credential blocker as
  Razorpay), and Twilio is already configured for this app's other
  notifications.
- **Multi-outlet support (2026-08-15)**: see "Deployment model" above for
  the full picture. `src/context/OutletContext.tsx` (AsyncStorage-backed,
  `getStoredOutletId()` for non-component modules like `api/passwordReset.ts`)
  replaces the build-time `OUTLET_ID` constant everywhere it was read
  (`AuthContext`, `MenuScreen`, `api/passwordReset.ts`). `OutletSelectScreen`
  gates the app when no outlet is stored; switching restaurants (from
  `ProfileScreen`) clears both the outlet and the auth session together,
  since a customer account is scoped to one outlet.
  **Scope decision (outlet selection)**: manual outlet-ID entry, not a
  public outlet directory. Every existing `/clients/*` listing endpoint
  requires staff auth; building a new unauthenticated "browse restaurants"
  endpoint would be a bigger, more public-facing change than this task
  implied. `GET /customer-orders/outlet/:outletId` only confirms/names one
  already-known ID (deliberately not a search/list endpoint) — a customer
  needs the ID from the restaurant (e.g. printed on a table tent), same as
  before but no longer baked into the build.

## Known gaps / not yet done

- No online payment method — checkout is COD-only
  (`VALID_PAYMENT_METHODS = ['COD']` hardcoded in the backend's
  `customerOrderController.js`, with a comment noting no Razorpay account
  access yet). This is a real-world credential blocker, not a missing-code
  gap — the rest of the `/customer-orders/*` API this needs already exists.
  See "Next Up" #1.
- No interactive map picker for addresses or the order tracker — GPS
  "use current location" + manual fields on the address form, and
  "open in Maps" via `Linking` on the tracker, instead of an in-app map view
  (see "Done" above for why).
- Order tracking is poll-only (8s interval), not socket-pushed — the
  `src/realtime/io.js` connection-auth middleware only understands staff
  JWTs today (see "Done" above and the socket-auth suggestion below).
- No real push notifications (FCM/APNs) — order-status alerts go via
  WhatsApp/SMS instead, by explicit scope decision (see "Done" above).
- No public outlet directory/search — outlet selection is manual-ID-entry
  only (see "Done" above).
- Only one test file in the repo (`App.test.tsx`), no per-screen or context
  test coverage.

## Next Up

Backend work targets `BILLINGAPP_API` (sibling repo — see "Backend repo"
above); do not touch the existing "Order by Phone" radius-check flow
(`order_type === 'phone'` path in `orderController.js`) while building any of
this — extend alongside it, share its tables where noted, don't rewire it.

1. **Online payment method** (currently COD-only) — blocked on a real
   Razorpay account, not on code. This is the only item left from the
   original backlog (#2–#8 are all done, 2026-08-15 — see "Done" above).

   - The `/customer-orders/*` API this app calls already exists (auth +
     orders + addresses + profile + tracking) — every code-side prerequisite
     is done.
   - What's actually blocking this: `customerOrderController.js` hardcodes
     `VALID_PAYMENT_METHODS = ['COD']` with a comment that Razorpay account
     access isn't available yet. Get real Razorpay credentials before
     picking this up — building against fake/sandbox keys risks rework.
   - Once unblocked: reuse `razorpayService.js` for the payment provider
     rather than adding a new one. Check whether `order_bills` /
     `payment_qr_codes` / `dynamic_qr_codes` (already in the schema) cover
     order payment records before creating new tables.

## Suggestions (not requested — needs approval, tackle last)

- Move the live tracker onto `src/realtime/io.js` sockets instead of REST
  polling — cheaper and lower latency. Concretely blocked on: `io.js`'s
  connection-auth middleware only decodes staff-shaped tokens
  (`decoded.user_id`, `decoded.client_id`) and `canTrackOrder` only checks
  staff outlet membership; a customer JWT (`type: 'customer'`,
  `customer_id`, `outlet_id`) would need its own branch in both, plus
  `canTrackOrder` checking `order.customer_id` for that branch instead of
  just outlet match — small but touches shared connection code, so left as
  a follow-up.
- Before creating any new payment-record table for #1, check whether
  `order_bills`/`payment_qr_codes`/`dynamic_qr_codes` already cover it —
  the schema has grown a lot of billing tables that may already fit.
- Rate-limit/throttle the customer auth + OTP endpoints (signup/login,
  forgot-password, mobile-change) the same way staff auth likely already
  does (`verification.middleware.js`) — wasn't verified in detail, worth
  checking before this gets real traffic. The OTP flows already have their
  own request/attempt limits (cooldown + max requests + max attempts, see
  "Done" above) but that's separate from endpoint-level rate limiting.
- A public, opt-in outlet directory (name/city search) if manual outlet-ID
  entry proves too much friction for real customers — see the outlet-
  selection scope decision in "Done" above for why it wasn't built now.
