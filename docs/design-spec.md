# Brim - Design Specification

> [!IMPORTANT]
> **Authoritative.** Code that contradicts this file is a bug in one of the two - flag it, do not silently reconcile. [ADR 0003](adr/0003-cinematic-ui-override.md) records a product override of §15.
>
> [Docs hub](README.md) · [Self-hosting](self-hosting.md) · [ADRs](adr/README.md) · [Contributing](../CONTRIBUTING.md)

> **True journey cost for UK drivers** - fuel or energy, tolls, and clean-air charges,
> accurate to *your* vehicle and *the forecourt you'll actually stop at*.
> Aligned to Project Scaffold Template v0.4.

**Status:** v0.2 - decisions closed, pre-build
**Owner:** Humza
**Licence:** open source (see §20)
**Companion doc:** `brim-build-prompts.md` (phased Cursor prompt kit, P0–P4)

**Changelog v0.1 → v0.2:** all nine open decisions resolved. Scope widened from fuel to total
journey cost (tolls, ULEZ, CAZ, Dart Charge). EV modelled in v1. Tailwind + shadcn/ui adopted.
Accounts at launch via Better Auth. Extension resolved to context-menu-first. Open source, free,
built as a real product.

---

## 1. One-liner and thesis

Type where you're going, get the whole number - energy, tolls and charges - for the vehicle on
your driveway, at the prices you'll actually pay.

The arithmetic is worthless; the inputs are everything. Four inputs decide whether this beats
what people already have:

| Input | Everyone else | Brim |
|---|---|---|
| Distance | Same | Same (pluggable routing provider) |
| Consumption | Generic per engine type, or user-typed | Reg-resolved official figure, then **corrected by the user's own fill-up history** |
| Price | National average, or user-typed | Live per-forecourt price from the statutory Fuel Finder feed |
| Charges | Ignored entirely | Tolls, ULEZ, CAZ, Dart Charge - resolved against the vehicle's Euro standard |

Google Maps estimates fuel off *regionally representative vehicles per engine type*. It does not
know your car, and it says nothing about the £12.50 you'll pay to enter Birmingham. That gap is
the product.

**Positioning consequence of the charges scope:** for a Crawley-to-central-London journey, the
charges exceed the fuel. Brim is the only tool that gives the driver the whole figure in one
place, and that - not the mpg precision - is the headline.

---

## 2. Problem and positioning

### 2.1 What the user is actually asking
1. *What will this trip cost me, all in?* (drive vs train, budgeting)
2. *Should I fill up before I go, or on the way - and where?*
3. *Am I even allowed in, and what does it cost if I am?* (ULEZ/CAZ compliance)
4. *What do I charge for this?* (mileage claims, splitting with passengers)
5. *Is my car as thirsty as they said?* (curiosity that becomes retention)

### 2.2 Competitive position
Fuel-price apps answer *where is fuel cheap near me*. Toll calculators answer tolls. TfL's
checker answers ULEZ for one vehicle with no route context. **Nobody assembles the whole
journey cost against a specific vehicle.** Journey-costing was explicitly anticipated in the
DESNZ open-data consultation as a third-party use of the feed; the charges layer is the part
nobody has bolted on.

Defensible position: **the vehicle profile plus calibration history**. Prices and zone
boundaries are commodity open data. A user's converged real-world mpg, built from their own
fill-ups, is data only Brim holds.

### 2.3 What Brim is not
- Not a navigation app. No turn-by-turn, ever.
- Not a fuel-price map. Prices appear only in the context of a route.
- Not authoritative on charge liability (§9B.6 - this is a legal position, not modesty).
- Not a fleet product in v1.

---

## 3. Users and jobs

**Primary: the cost-aware private driver.** One or two vehicles, mix of commute and occasional
long trips. Wants a number before setting off.

**Secondary: the self-employed expense claimer.** Needs journey cost against HMRC approved
mileage (45p/mile to 10,000 miles, 25p thereafter) plus a record afterwards.

**Tertiary: the EV driver planning a long trip.** Wants cost and, more urgently, *will I get
there* - arrival state of charge.

Not targeted in v1: fleet managers, delivery operators, HGV/PSV operators.

### 3.1 Job stories
- When I'm deciding whether to drive to Manchester or take the train, I want the true door-to-door cost, so I can compare like for like.
- When I'm driving into Birmingham, I want to know before I set off whether my car is charged and how much, so I don't get a PCN three weeks later.
- When I'm about to set off, I want to know whether to fill at home or at the services, so I don't overpay.
- When I've finished a client visit, I want the journey logged with its cost, so quarterly expenses take five minutes.
- When I fill up, I want to record it in under fifteen seconds, so estimates improve without becoming a chore.

---

## 4. Scope

### 4.1 In scope for v1
- Route distance and shape via a pluggable routing provider
- Vehicle profile: manual entry, or reg lookup with derivative disambiguation
- **ICE and EV** energy estimation with litres/kWh, £, kg CO₂e, and a confidence band
- **EV arrival state of charge** - will you make it
- Live per-forecourt prices from Fuel Finder
- **Tolls, London Congestion Charge, ULEZ, CAZs, Scottish LEZs, Dart Charge**
- Cheapest-fill-on-route with detour cost accounted for
- Fill-up logging and mpg/kWh calibration
- HMRC AMAP comparison
- **Accounts at launch** (Better Auth), with anonymous-first estimating and claim-on-signup
- Chrome extension via context menu + Web Share Target

### 4.2 Explicitly out of scope for v1
- Turn-by-turn navigation
- **EV charging-stop routing** - we say whether you'll make it, not where to stop (§5.7)
- Live charge-point availability
- Multi-vehicle fleet views, driver assignment, reporting
- Real-time re-estimation mid-journey
- Native mobile apps (PWA only)
- HGV, PSV, taxi and private-hire charge classes - **cars, vans and motorcycles only**, stated plainly in the UI
- Ferries, Eurotunnel, airport drop-off charges
- Parking

---

## 5. The estimation engine

`packages/engine` - pure, no I/O, no clock reads, exhaustively tested. All inputs passed in.

### 5.1 Base calculation (ICE)

```
litres        = distance_km / 100 × l_per_100km_effective
cost_pence    = litres × price_pence_per_litre
co2_kg        = litres × emission_factor_kg_per_litre
```

Conversions (imperial gallon):
```
1 imp gallon  = 4.54609 L
l_per_100km   = 282.481 / mpg_imperial
mpg_imperial  = 282.481 / l_per_100km
```

Emission factors from the current DEFRA/DESNZ greenhouse-gas conversion factors (direct
tailpipe, kg CO₂e per litre - approx. 2.31 petrol / 2.68 diesel). Published annually, so they
live in a **dated constants file** with the publication year recorded, never inline.

### 5.2 Effective consumption - the important part

Official figures are optimistic. Resolve through a precedence chain, and **always report which
tier was used**:

| Tier | Source | Typical error | Confidence label |
|---|---|---|---|
| 0 | User's calibrated figure (≥3 valid fill-ups / charges) | ±3–5% | *Based on your fill-ups* |
| 1 | User-entered mpg or mi/kWh | user's problem | *You told us* |
| 2 | VCA official figure × real-world correction | ±10% | *Official figure, adjusted* |
| 3 | Class average by fuel type + capacity/battery band | ±20% | *Estimated from similar vehicles* |
| 4 | Routing provider's own fuel estimate | ±25% | *Rough estimate* |

**Correction factors (tier 2)** - by test cycle, since provenance matters more than the car:

```
WLTP  (2017 →)    × 1.12
NEDC  (pre-2017)  × 1.25
WLTP EV           × 1.15   (EVs miss their figure by more than ICE)
```

Starting constants, not truths. Single tunable module, first thing to re-derive from aggregate
anonymised fill-up data once there is any (§13.4).

### 5.3 Route-shape adjustment

A motorway run and a town crawl at equal distance burn very differently, and **EVs invert the
ICE relationship** - speed hurts them.

```
             ICE      EV
urban      × 1.20   × 0.85     (regen recovers braking energy)
rural      × 1.00   × 1.00
motorway   × 0.95   × 1.20     (aero drag dominates above ~60 mph)
```

Without a road-class breakdown, fall back to the combined figure unmodified and drop one
confidence level. **Never fake precision the inputs don't support** - that principle governs
every fallback in this document.

### 5.4 Confidence band

Every estimate returns `{ point, low, high, tier, reasons[] }`. The band widens with tier and
with each fallback used. UI leads with the point estimate and never presents it as exact:
`£42` with `£38–£47` beneath, not `£42.17`.

### 5.5 EV energy model

```
mi_per_kwh → kwh_per_100km:   kwh_per_100km = 62.137 / mi_per_kwh
battery_kwh_used  = distance_km / 100 × kwh_per_100km_effective
grid_kwh_drawn    = battery_kwh_used / charging_efficiency
cost_pence        = grid_kwh_drawn × price_pence_per_kwh
co2_kg            = battery_kwh_used × grid_intensity_g_per_kwh / 1000
```

**Charging efficiency** defaults: AC home 0.88, DC rapid 0.94. Billing is on energy *drawn from
the grid*, not delivered to the battery - a detail nearly every EV cost calculator gets wrong,
and worth roughly 12% on a home charge.

**Temperature derating.** Cold weather is the dominant real-world EV variable, and we know the
journey date:
```
≥ 15°C   × 1.00
5–15°C   × 1.10
0–5°C    × 1.25
< 0°C    × 1.40
```
Applied only when a forecast temperature is available for the journey window; otherwise skipped,
with a reason string. Heat-pump-equipped vehicles get a reduced penalty (halve the uplift) where
the VCA/derivative data indicates one.

**Grid carbon intensity** comes from the National Grid ESO Carbon Intensity API - free, no key,
regional and forecast gCO₂/kWh. This makes Brim's EV carbon figure materially better than the
flat national average everyone else uses.

### 5.6 EV price sources - the honest gap

There is **no statutory open feed for EV charging prices**. Fuel Finder covers motor fuel only.
So:

1. Home tariff - user-entered p/kWh, with an off-peak rate and window (Octopus Go, Intelligent, Economy 7 patterns are the common shapes)
2. Public network averages - a hand-maintained, dated table in the repo per network and speed tier, user-editable
3. Fallback national average with a loud low-confidence reason

Say this plainly in the UI. "Petrol prices are live from the government feed. EV charging prices
are estimates you can correct." Users forgive a stated limitation and punish a hidden one.

The **National Chargepoint Registry** (DfT, open data) gives charge-point locations and connector
types but not live prices or availability - used for context only in v1, never for routing.

### 5.7 Arrival state of charge

Cheap to compute, disproportionately valuable, and the reason an EV driver opens the app:

```
arrival_pct = start_pct − (battery_kwh_used / usable_battery_kwh × 100)
```

Three outcomes, and the copy matters:
- `> 20%` → "You'll arrive with about 34%."
- `10–20%` → "Tight - about 14% on arrival. Worth a top-up."
- `< 10%` → "You won't make it without charging. You'll need roughly 18 kWh on the way."

We do **not** tell them where to charge (§4.2). Being honest about the shortfall without
pretending to solve it is better than a bad charging-stop recommendation.

### 5.8 Return payload

```ts
type Estimate = {
  distanceMeters: number
  durationSeconds: number
  energy: {
    kind: 'liquid' | 'electric'
    litres?:  { point: number; low: number; high: number }
    kwh?:     { battery: number; grid: number; low: number; high: number }
    arrivalStateOfCharge?: { percent: number; verdict: 'comfortable'|'tight'|'insufficient'; shortfallKwh?: number }
  }
  cost: {
    energyPence:  { point: number; low: number; high: number }
    chargesPence: number
    totalPence:   { point: number; low: number; high: number }
  }
  charges: Charge[]                    // §9B
  co2Kg: number
  consumption: { value: number; unit: 'l/100km'|'kWh/100km'; display: string; tier: 0|1|2|3|4; label: string }
  price: { pence: number; unit: 'ppl'|'p/kWh'; source: PriceSource; stationId?: string; observedAt: string }
  hmrc?: { approvedPence: number; deltaPence: number }
  reasons: string[]
  warnings: Warning[]                  // compliance uncertainty, stale data, unsupported vehicle class
}
```

---

## 6. Data sources

| Source | Gives | Licence / cost | Notes |
|---|---|---|---|
| **Google Routes API** | distance, duration, polyline, road composition, tolls, generic fuel estimate | Paid; Advanced SKU for fuel/eco/tolls | Primary provider. `TRAFFIC_AWARE_OPTIMAL`, `travelMode: DRIVE` |
| **OSRM / Valhalla** | distance, duration, polyline | Self-hosted, free | Fallback provider (§11.2). No tolls, no fuel |
| **Fuel Finder (CMA/DBT)** | per-forecourt prices by grade, site details, hours | OGL v3.0, free | OAuth2 client credentials, **30 req/min sequential only** (HTTP 429 if a second request starts before the previous finishes), ~8,000 forecourts, 30-min update obligation |
| **DVLA VES API** | make, fuel type, engine capacity, CO₂, year, Euro status | Free, API key, terms-bound | **No model or derivative, no mpg** |
| **VCA car fuel data** | official mpg / kWh / CO₂ by derivative | Downloadable dataset | Bulk-load via `data:sync-vca` (session cookie, then `download.aspx` / ZIP). **UK type-approved cars only** - not motorcycles, grey imports, or kit cars. No live API; make/model search is `GET /v1/vehicles/catalogue` |
| **National Grid ESO Carbon Intensity** | gCO₂/kWh, regional + forecast | Free, no key | EV carbon accuracy |
| **NCR (DfT)** | charge-point locations, connectors | OGL, free | Context only in v1 |
| **London Datastore** | ULEZ / CC / LEZ boundary geometry | OGL | Best-maintained zone source |
| **Individual councils / data.gov.uk** | CAZ boundaries | Mixed | **No single national dataset** - assembled by hand (§9B.4) |
| **DEFRA/DESNZ GHG factors** | kg CO₂e per litre | OGL, free | Annual, dated constants |

### 6.1 Routes API request shape

```
POST https://routes.googleapis.com/directions/v2:computeRoutes
X-Goog-FieldMask: routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,
                  routes.travelAdvisory.fuelConsumptionMicroliters,
                  routes.travelAdvisory.tollInfo,routes.routeLabels
{
  origin, destination,
  travelMode: "DRIVE",
  routingPreference: "TRAFFIC_AWARE_OPTIMAL",
  extraComputations: ["FUEL_CONSUMPTION", "TOLLS"],
  routeModifiers: { vehicleInfo: { emissionType: "GASOLINE"|"DIESEL"|"HYBRID"|"ELECTRIC" } },
  computeAlternativeRoutes: true
}
```

**Verify field names against current docs in P2** - the fuel and toll fields moved during the
Preview period and this spec is written from secondary sources. Verify UK toll coverage
specifically; if it's thin, the UK toll table (§9B.2) carries the feature and the API's toll
computation is dropped to save SKU cost.

---

## 7. Fuel Finder ingestion

Expect the feed to be dirty. This is a normalisation pipeline, not a fetch.

### 7.1 Sync job
Cloudflare cron (`workers/sync`, `*/20 * * * *`; obligation is 30 minutes). Sequential paginated
pull into Neon via OAuth2 client credentials. Never on a request path. Local/first load is
`data:sync-fuel`. ~8,000 sites at 500/batch is about 16 station pages plus 16 price pages; sleep
~4s between pages to stay under 30 rpm.

Base `https://www.fuel-finder.service.gov.uk`. Token: `POST /api/v1/oauth/generate_access_token`.
Stations: `GET /api/v1/pfs?batch-number=`. Prices: `GET /api/v1/pfs/fuel-prices?batch-number=`.
Incremental: `effective-start-timestamp=YYYY-MM-DD HH:MM:SS`.

Prices arrive as pence strings (`"0120.0000"` = 120.0 ppl); some sites still send pounds (`< 2`).
CMA types map onto the SQL CHECK (`E10|E5|B7|SDV|LPG`): `E10`→`E10`, `E5`→`E5`,
`B7_STANDARD`→`B7`, `B7_PREMIUM`→`SDV`. Skip `B10`, `HVO`, and unknown types. Do not widen the
CHECK to store those grades.

### 7.2 Known data problems and required handling

| Problem | Handling |
|---|---|
| Prices submitted as `1.339`, `133.9`, `1339` for the same value | Heuristic normaliser to tenths-of-a-penny integer, plausibility bounds 60–300 ppl. Out of range → reject and flag |
| Inconsistent brand strings (`SHELL`, `Shell`, `Shell UK Oil Products Ltd`) | Canonicalisation table, hand-maintained, in the repo |
| Addresses in all-caps | Title-case on display only; never mutate stored source data |
| Zombie sites - closed forecourts still reporting | `observedAt` unchanged 14 days → `stale`, excluded from cheapest-fill |
| Silent sites - in scope, not reporting | Keep station, `price: null`, show "price unknown", never as expensive |
| Duplicate sites across submissions | Dedupe on (lat/lng within 50 m) + brand |

**Store raw, serve normalised.** Persist the untouched payload beside the parsed row so
normalisation bugs are fixable retroactively.

### 7.3 Price selection precedence
1. Station the user explicitly picked
2. Cheapest suitable station on route (if opted in)
3. User's home-area median for their grade (within 10 miles of saved home, or the trip start if home is not saved)
4. National median for the grade
5. Hard-coded fallback with a loud "price data unavailable" reason

---

## 8. Vehicle resolution

DVLA VES returns make but **not model**, so reg → official consumption is a join, not a lookup.

### 8.1 Join strategy

```
DVLA VES:  make, fuelType, engineCapacity, co2Emissions, yearOfManufacture, euroStatus
                              ↓ join against ↓
VCA:       make, model, derivative, transmission, capacity, fuel, CO₂, mpg/kWh, cycle
```

Match on `make` + `fuelType` + `engineCapacity` (±50cc) + `co2Emissions` (±5 g/km) +
registration-year window. CO₂ is the strong discriminator - it separates derivatives sharing a
block, which capacity alone cannot.

`euroStatus` is separately load-bearing for §9B compliance and must be captured even when the
VCA join fails.

### 8.2 Outcomes and UI contract

| Match count | Behaviour |
|---|---|
| Exactly 1 | "We think this is your car", with a Change link. **Never assume silently** |
| 2–6 | Disambiguation list, most likely first, one tap |
| 0 | Tier 3 fallback + manual entry offered |
| >6 | Treat as 0 - not informative |

User confirmation is stored and never re-derived. A corrected match must never silently revert
on a later dataset sync.

### 8.3 Privacy - this matters legally

**A registration mark is personal data under UK GDPR** when linkable to an individual.
Non-negotiable:

- Never in a URL path or query string
- Never in application logs, analytics, or error reports - redaction filter in the logger, with a test asserting it
- Stored only where the user has an account and chose to save the vehicle; anonymous users' regs are resolved and discarded, keeping only the derived profile in local storage
- DVLA VES terms constrain use and caching - read before P9, record retention in an ADR
- Make/model entry is a **first-class path**, not a fallback, so a reg is never required. The picker is `GET /v1/vehicles/catalogue` against the ingested VCA dataset, not a live car API.

**Open-source consequence:** the redaction filter and its test are part of the public repo, and
a contributor's debug `console.log` is now a privacy incident. Add a lint rule banning direct
logging of any object typed with a `vrm` field.

---

## 9A. Cheapest fill on route

### 9A.1 Algorithm (v1 - deliberately simple)
1. Decode the route polyline
2. Simplify with Ramer–Douglas–Peucker
3. Query stations within ~1.5 km using PostGIS `ST_DWithin` on geography
4. Detour penalty: `detour_km ≈ 2 × perpendicular_distance`, `detour_cost = detour_km × cost_per_km + fixed_time_penalty`
5. `total = (litres_to_fill × price) + detour_cost` versus filling at the user's home-area median
6. Rank by saving; **suppress anything under £1** - noise damages trust

### 9A.2 Deliberate simplifications
- Straight-line proximity, not real detour routing (costs one routing call per candidate; not worth it until the feature is used)
- Assumes filling the remaining tank capacity - tank size comes from the vehicle profile
- Opening hours shown, not filtered

### 9A.3 Trust rule
Every recommendation shows price, observation time, and assumed detour. A wrong price
discovered at the pump is the fastest way to lose a user, so the freshness stamp is not chrome -
it is the product's honesty.

---

## 9B. Charges: tolls and clean-air zones

The highest-stakes subsystem in the product. **A wrong fuel estimate is an annoyance; a wrong
compliance answer is a £180 penalty charge notice.** Everything here is designed around that
asymmetry.

### 9B.1 Charge taxonomy

| Kind | Basis | Examples | Dedup |
|---|---|---|---|
| `toll` | Per crossing/use | M6 Toll, Mersey Gateway, Tyne Tunnel, Dartford (Dart Charge) | Per crossing |
| `zone_charge` | Per day, if non-compliant | ULEZ, Birmingham CAZ D, Bath CAZ C, Bristol CAZ D, Bradford, Sheffield, Tyneside, Portsmouth | **Per calendar day, per zone** |
| `zone_charge` | Per day, all vehicles | London Congestion Charge | Per day, time-windowed |
| `restriction` | **Not a charge - a prohibition** | Scottish LEZs (Glasgow, Edinburgh, Dundee, Aberdeen) | Penalty, not payment |

**The `restriction` distinction is critical.** Scottish LEZs do not charge non-compliant
vehicles - they fine them. Presenting a Glasgow LEZ as a £X cost would be actively harmful. The
UI must say *"Your vehicle cannot enter this zone"*, and the engine models it as a blocking
warning with no price.

### 9B.2 Time and day windows
- **London Congestion Charge** - applies within its operating hours, not 24/7, and not on the Christmas exemption period
- **ULEZ** - 24/7 except the Christmas exemption
- **Dart Charge** - applies within its charging window; free outside it
- **CAZs** - generally 24/7, but per-zone

Journey time therefore changes the answer. The engine takes the journey's start time and
duration, derives which local days the route touches, and applies each charge **once per
calendar day** - so a same-day return trip through the ULEZ is one charge, not two. Get this
wrong and the product looks careless in exactly the case people check most.

**Rule:** all window logic in Europe/London local time with correct BST handling, in the pure
engine, with tests around the DST boundaries and the Christmas exemption.

### 9B.3 Compliance determination

Compliance depends on vehicle **class** and **Euro standard**:
- ULEZ, broadly: petrol Euro 4 or better, diesel Euro 6 or better
- CAZ class C charges buses, coaches, HGVs, taxis and vans but **not cars**; class D adds cars
- Class comes from the vehicle profile; Euro standard from DVLA `euroStatus`, or derived from fuel type plus registration date when absent

Derivation is a **fallback, not a fact**. When Euro standard is derived rather than stated, the
result is downgraded to "likely compliant - check with the operator" and never asserted.

### 9B.4 Zone geometry - the maintenance problem

There is no single national dataset. London Datastore publishes ULEZ/CC/LEZ boundaries well;
CAZ boundaries come from individual councils in inconsistent formats. Consequences:

- Zone polygons live in the repo as versioned, **dated** GeoJSON with a `source_url` and `verified_on` per zone
- A `data:verify-zones` script checks the age of every zone record and **fails CI when any zone hasn't been re-verified in 180 days**
- Zones near a boundary get a buffer test: if the route passes within 500 m of a zone edge without entering, surface it as "passes close to" rather than staying silent
- Being open source helps here - zone boundary corrections are exactly the contribution a local user can make, and the versioned-GeoJSON structure is designed for a PR

### 9B.5 Detection
Route polyline vs. zone polygon intersection in PostGIS. A charge triggers on any intersection,
however brief - clipping a ULEZ corner for 200 m still costs the full daily rate, which is
precisely the case a driver wants warned about.

### 9B.6 Liability position

Brim is not authoritative on charge liability, and the product must say so where it matters:

- Every charge result carries a "check with the operator" link to the relevant official checker (TfL, the council, National Highways)
- The `warnings` array surfaces any derived-rather-than-stated input
- Never the word "compliant" without a qualifier unless `euroStatus` came directly from DVLA
- Terms of use state clearly that Brim is an estimate and the driver remains responsible

This is a legal position, not modesty. Write it into the UI copy in P7, not into a footer nobody reads.

---

## 10. Product surfaces

### 10.1 Web app (primary)
React 19 + Vite + Tailwind + shadcn/ui, deployed to Cloudflare Pages. Installable PWA - this is
a phone-in-the-car use case and a PWA avoids app-store overhead. Offline: last estimate and
saved vehicles readable; new estimates need network.

### 10.2 Chrome extension - context-menu first (decision closed)

**Resolved: ship the context-menu and share-target paths first. Treat DOM injection as a later
experiment, if at all.**

Reasoning: injecting into and re-deriving from Google Maps sits awkwardly with the Maps ToS, and
extensions doing it have been removed from the Web Store before. Since Brim is free and open
source, a takedown costs the project its distribution with no revenue to justify the risk.

**Primary path - context menu.** Right-click on a Maps directions page → "Estimate journey cost
with Brim" → opens the web app with origin and destination pre-filled. No injection, no DOM
dependency, works on any maps provider.

**URL parsing only, never DOM scraping.** The one shared module `packages/shared/maps-url.ts`
parses:
```
https://www.google.com/maps/dir/<origin>/<destination>/@<lat>,<lng>,<zoom>z/data=...
```
Origin, destination and waypoints are path segments; travel mode is in the `data` blob
(`!3e0` = driving). The DOM is obfuscated and changes without notice - anything read from it
will break.

Manifest V3, minimal permissions: `contextMenus`, `activeTab`, host permission for the Brim API
origin only. No `tabs`, no `<all_urls>`.

### 10.3 Share target / paste
Web Share Target API on the PWA plus a paste field - share a Maps link from the phone, get an
estimate. Same `maps-url.ts` parser. This is the mobile path and needs no extension at all.

### 10.4 Accounts (decision closed)
**Better Auth enabled at launch**, but **anonymous-first**: a first-time visitor gets an
estimate without signing up, on a signed anon session. The account prompt appears at the point
it buys something - saving a vehicle, logging a fill-up, syncing across devices - and the anon
profile is claimed into the account on signup, losing nothing.

Rationale: accounts at launch is right (calibration and journey history are the retention loop
and both need persistence), but requiring signup before the first estimate would break the
45-seconds-to-first-value criterion in §23. Email/password plus one social provider; magic links
via Resend.

---

## 11. Architecture

```
brim/
├── apps/
│   ├── web/                    React 19 + Vite + Tailwind + shadcn/ui, Pages, PWA
│   ├── api/                    Hono on Cloudflare Workers
│   └── extension/              MV3, TS, React popup, Vite build
├── packages/
│   ├── engine/                 pure domain - consumption, charges, bands. No I/O, no clock
│   ├── routing/                RoutingProvider interface + Google/OSRM adapters
│   ├── shared/                 types, zod schemas, maps-url parser, unit conversions
│   ├── ui-kit/                 Tailwind preset, shadcn theme tokens, Brim-specific components
│   └── config/                 tsconfig/eslint/vitest base configs
├── data/
│   ├── zones/                  versioned dated GeoJSON per clean-air zone
│   ├── tolls/                  UK toll table
│   └── tariffs/                EV network price table
├── workers/
│   └── sync/                   cron ingestion: Fuel Finder, VCA, carbon intensity
├── docs/
│   ├── design-spec.md          this document
│   ├── self-hosting.md         required - the project is open source
│   └── adr/
├── scripts/
├── AGENTS.md
├── CONTRIBUTING.md
└── LICENSE
```

npm workspaces + Turborepo. **npm only - never pnpm or yarn.** TypeScript project references.

### 11.1 Boundaries that must not be violated
- `packages/engine` imports only `packages/shared`. If it ever needs `fetch`, the design is wrong
- `apps/api` is the only holder of third-party keys. Web and extension never call Google, DVLA or Fuel Finder directly
- Database access confined to `apps/api` and `workers/sync`
- Per-request factories throughout: `createDb(c.env.DATABASE_URL)`, `createAuth(env)` - never a module-scope client. Workers bindings exist only per request, and a module-load `process.env` read crashes in production

### 11.2 Routing provider abstraction (required, not optional)

Free product + no revenue + the most expensive SKU on the hottest path means routing must be
swappable from day one.

```ts
interface RoutingProvider {
  computeRoute(req: RouteRequest): Promise<RouteResult>
  capabilities: { tolls: boolean; fuelEstimate: boolean; roadComposition: boolean; alternatives: boolean }
}
```

- `GoogleRoutesProvider` - primary, full capabilities
- `OsrmProvider` - self-hostable fallback: distance, duration, polyline only

The engine already degrades gracefully when road composition or a provider fuel estimate is
missing (§5.3, tier 4), so the fallback is a confidence downgrade, not a broken product.
Provider selection is per-request: cheap provider by default, Google when a capability is
genuinely needed, and **automatic failover to OSRM when the monthly spend ceiling is hit**
rather than serving errors.

This is also what makes self-hosting real. Someone running their own Brim with no Google
billing account gets a working product.

### 11.3 Fixture mode (open-source requirement)
`npm run dev` must work for a contributor with **zero API keys**. A `BRIM_FIXTURES=1` mode
serves recorded responses for Routes, Fuel Finder, DVLA and VCA from `packages/shared/fixtures`.
Without this, the barrier to a first contribution is a Google billing account, and there will be
no contributors.

---

## 12. Data model

Neon Postgres + Drizzle, PostGIS for station and zone geometry. **RLS-first**: every user-scoped
table gets a policy at creation, and `db:force-rls` fails CI if any lacks one.

```
users / sessions / accounts     (Better Auth managed)
anon_profiles                   id, created_at, claimed_by_user_id?

vehicles         id, owner_id, nickname, kind ('car'|'van'|'motorcycle'),
                 propulsion ('petrol'|'diesel'|'hybrid'|'phev'|'bev'),
                 make, model, derivative, transmission, year, engine_cc?,
                 co2_gkm, euro_status, euro_status_source ('dvla'|'derived'),
                 official_consumption, official_unit, official_cycle,
                 tank_litres?, battery_kwh_usable?, has_heat_pump?,
                 vca_match_id, vrm_encrypted?, vrm_hash, created_at

tariffs          id, vehicle_id, kind ('home'|'public'), pence_per_kwh,
                 offpeak_pence?, offpeak_window?, network?, is_default

calibrations     id, vehicle_id, calculated_value, unit, sample_count, stddev, last_computed_at

fill_ups         id, vehicle_id, odometer_miles, quantity, unit ('litres'|'kwh'),
                 price_pence, station_id?, filled_to_brim, occurred_at, note

journeys         id, owner_id, vehicle_id, origin_label, dest_label, origin_point, dest_point,
                 distance_meters, duration_seconds, polyline, departs_at,
                 estimate_json, charges_json, is_saved, created_at

owner_settings  owner_id, default_vehicle_id?, updated_at
saved_places     id, owner_id, kind ('home'|'work'|'favourite'), label, lat, lng, created_at
                 unique (owner_id, kind) where kind in ('home','work')

stations         id, brand, brand_canonical, name, address, postcode,
                 location geography(Point,4326), opening_hours_json, last_seen_at, is_stale

station_prices   station_id, grade ('E10'|'E5'|'B7'|'SDV'|'LPG'), price_tenths_pence,
                 observed_at, raw_payload_json          -- (station_id, grade) unique

zones            id, name, authority, kind ('caz'|'ulez'|'congestion'|'lez'),
                 caz_class?, charge_pence?, is_restriction, applies_hours_json,
                 geometry geography(Polygon,4326), source_url, verified_on, dataset_version

tolls            id, name, operator, location geography, charge_pence_by_class_json,
                 applies_hours_json, source_url, verified_on

vca_vehicles     id, make, model, derivative, fuel, engine_cc, transmission,
                 co2_gkm, consumption_combined, unit, cycle, dataset_version

grid_intensity   region, intensity_g_per_kwh, valid_from, valid_to

route_cache      cache_key, provider, response_json, expires_at
```

RLS: `vehicles`, `tariffs`, `fill_ups`, `journeys`, `calibrations`, `owner_settings`,
`saved_places` owner-scoped. `stations`,
`station_prices`, `zones`, `tolls`, `vca_vehicles`, `grid_intensity` public-read,
service-role-write. Anonymous users get a signed anon session id as the RLS subject, so the same
policies cover both, and claim-on-signup is an owner-id rewrite inside a transaction.

---

## 13. API surface (Hono)

zod-validated at the boundary, responses typed from `packages/shared`.

```
POST   /v1/estimate                  { origin, destination, waypoints?, departsAt?,
                                       vehicleId?|vehicleInline?, priceStrategy, tariffId? }
                                     → Estimate (§5.8)
POST   /v1/estimate/from-maps-url    { url } → resolves, delegates

GET    /v1/vehicles                  |  POST /v1/vehicles
GET    /v1/vehicles/catalogue        ?q= → { vehicles[] }   make/model/derivative search, cap 20
                                         ?make=&model= → { vehicles[] }   trims for that pair, cap 80
GET    /v1/vehicles/catalogue/makes  → { makes: { name, count }[] }
GET    /v1/vehicles/catalogue/models ?make= → { models: { name, count }[] }
GET    /v1/vehicles/catalogue/:id    → official consumption fields for the estimate path
POST   /v1/vehicles/resolve          { vrm } → { candidates[] }   ← never logged, never in URL
PATCH  /v1/vehicles/:id              |  DELETE /v1/vehicles/:id
GET    /v1/vehicles/:id/compliance   → per-zone compliance for this vehicle, with caveats
POST   /v1/vehicles/:id/tariffs      |  GET /v1/vehicles/:id/tariffs

POST   /v1/fill-ups                  { vehicleId, odometerMiles, quantity, unit, price, brim }
GET    /v1/vehicles/:id/fill-ups     → { fillUps[] }
DELETE /v1/fill-ups/:id
GET    /v1/vehicles/:id/calibration  → { value, unit, sampleCount, stddev, confidence }

GET    /v1/settings                  |  PATCH /v1/settings  { defaultVehicleId }
GET    /v1/saved-places              |  POST /v1/saved-places
PATCH  /v1/saved-places/:id          |  DELETE /v1/saved-places/:id

GET    /v1/stations/near-route       { polyline, grade, maxDetourKm } → ranked (P8)
GET    /v1/stations/near             { lat, lng, radiusKm, grade } → cap, exclude stale
GET    /v1/charges/for-route         { polyline, departsAt, vehicleId } → Charge[]
GET    /v1/zones                     public zone list with verified_on dates

POST   /v1/journeys                  |  GET /v1/journeys  |  GET /v1/journeys/export (CSV)
GET    /v1/journeys/summary          tax-year miles, AMAP, actual spend
GET    /v1/journeys/:id
POST   /v1/auth/claim-anon           merge anon profile into account
GET    /v1/meta/prices               national medians per grade + observedAt
GET    /health
```

### 13.4 Aggregate learning (privacy-preserving)
Once fill-up volume allows, recompute §5.2 correction factors from anonymised aggregates by
(make, model, year, cycle). **Minimum cohort of 30 vehicles** before any aggregate is used or
displayed, never exposing a figure that could identify one user's car. This compounds - estimates
improve the longer the product runs, and being open source means the methodology is auditable,
which is a feature.

---

## 14. Caching and cost control

**With no revenue, this is the subsystem that decides whether the project survives.** Controls in
order of impact:

1. **Two-tier provider strategy.** A distance-only route is enough for consumption tiers 0–3 - which is every user with a vehicle profile. The expensive Advanced SKU is called only for tolls, or for tier 4 when there's no profile at all. **Most estimates should never touch the Advanced SKU.**
2. **Route cache** keyed on `hash(origin_rounded, dest_rounded, mode, time_bucket, provider)`. Coordinates rounded to ~100 m, time bucket = hour-of-week. TTL 6 h traffic-aware, 30 d distance-only. KV hot, Neon durable.
3. **Charges are computed locally** from our own zone and toll tables against the cached polyline - zero marginal cost, which is a strong argument for dropping the API's toll computation entirely (§6.1).
4. **Fuel Finder** free but rate-limited: sync job only, 20-min cron, never on a request path.
5. Per-IP and per-session rate limits via the Workers rate-limiting binding.
6. **Hard monthly ceiling with automatic failover to OSRM** (§11.2) rather than errors or a surprise bill. Alert at 60% and 85%.
7. Cost per estimate tracked as a first-class metric on a public dashboard - open source means the running costs can be honest, which also makes a sponsorship ask credible if it ever becomes necessary.

---

## 15. Visual direction

**Subject:** the forecourt and the trip computer. The vernacular to steal is the pump display and
the dashboard readout - segmented numerals, litres to two decimals, the amber of a low-fuel
warning - not the generic SaaS dashboard.

### 15.1 Tailwind + shadcn/ui, with the defaults overridden

shadcn is the right call for velocity and for the Radix accessibility underneath it - dialogs,
combobox, select, tabs, form, toast and drawer are all things worth not hand-building. The risk
is that **stock shadcn is instantly recognisable**: `--radius: 0.5rem`, the default neutral
palette, `border-border` everywhere. Shipped untouched it reads as a template, which undercuts
the one thing the design is for.

So: **shadcn for behaviour, Brim tokens for appearance.** Non-negotiables in `packages/ui-kit`:

```css
--radius: 2px;              /* stock 0.5rem is the tell - instruments have sharp corners */
--background: 20 10% 9%;    /* forecourt   #14171A */
--foreground: 40 20% 94%;   /* pump        #F2F0EB */
--primary:   41 82% 58%;    /* gauge       #E8B33C - amber, once per screen */
--secondary: 170 56% 28%;   /* diesel      #1F6F63 - savings, positive states */
--destructive: 12 62% 47%;  /* warning     #C4472F - stale data, non-compliance */
```

Palette (5 values, and no sixth):
```
--forecourt   #14171A   near-black, the ground
--pump        #F2F0EB   warm off-white, panels
--gauge       #E8B33C   amber - the primary number and nothing else
--diesel      #1F6F63   deep petrol green - savings, compliance
--warning     #C4472F   burnt red - stale prices, low confidence, restrictions
```

**Type:**
- Display / the number: a wide grotesque with presence at size - Archivo Expanded or similar. The estimate should read like a pump total
- Body: Inter Tight
- Data: JetBrains Mono, **tabular figures**. Every number in the product is mono and tabular so columns of prices actually align. This is a Tailwind theme extension, applied via a `.tabular` utility, not sprinkled ad hoc

**Signature element:** the total renders as a **pump readout** - the pounds counting up from zero
in segmented mono, exactly as a forecourt pump does while filling. Roughly 600 ms, the only
motion in the product, snapping straight to the final value under `prefers-reduced-motion`.
This is hand-built, not a shadcn component, and it is where the design's one risk is spent.

**Restraint:** amber appears once per screen. Confidence bands, freshness stamps and caveats sit
quiet in small mono - present and honest, never shouty. No gradients, no glass, no card shadows.
Before shipping any screen, remove one element.

### 15.2 Copy voice
Plain and specific. "Based on your last 4 fill-ups", not "AI-powered accuracy". Empty states
invite: "Add your car and we'll stop guessing." Errors say what happened and what to do:
"Couldn't reach the price feed - showing prices from 14:20." Charge warnings are unambiguous:
"Your vehicle cannot enter Glasgow's LEZ" beats any softer phrasing.

---

## 16. Non-functional requirements

**Performance** - Lighthouse ≥ 90 mobile on the estimate route. Estimate p95 < 800 ms warm,
< 2.5 s cold. Initial JS < 150 kB gzipped; map rendering lazy and route-split. shadcn components
imported individually, never barrel-imported.

**Accessibility** - WCAG 2.2 AA. Amber on near-black verified at 4.5:1 for the display numeral.
`:focus-visible` ring everywhere. The pump readout announces its final value once via a polite
live region, not per tick. Full keyboard path through estimate → station → save.

**Privacy** - location only on explicit action, never background. Reg redaction filter, tested.
No fingerprinting analytics; self-hosted and privacy-preserving only. Export and account deletion
in the UI, not by email request.

**Resilience** - every third-party source has a defined degraded mode and none can take the
product down. The product must produce an honest answer given only a distance and a fuel type.

---

## 17. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Engine | Vitest | Exhaustive. Conversions, every tier, every fallback, band widths, EV temperature and efficiency paths, known-vehicle fixtures with hand-verified outputs |
| **Charges** | Vitest | **Highest bar in the codebase.** Day-boundary dedup, BST transitions, Christmas exemption, operating-hour edges, restriction-vs-charge, class/Euro matrices |
| Normalisation | Vitest | Fixture corpus of real dirty Fuel Finder rows - `1.339`/`133.9`/`1339`, out-of-range, missing grades |
| Vehicle join | Vitest | 50 real reg→derivative cases with known answers, asserting match-count buckets |
| Zone geometry | Vitest + PostGIS | Known points inside/outside/on-boundary for every zone; corner-clipping cases |
| API | Vitest + Miniflare | Contracts, zod rejection, auth, rate limits, provider failover |
| RLS | `test:rls` | Cross-tenant attempts must fail. Gated in CI |
| E2E | Playwright | Estimate, vehicle add, fill-up, anon→account claim, extension URL parse |

**Golden rule:** correctness lives in `packages/engine` - ≥95% lines, **100% on tier selection
and on all charge-window logic**.

---

## 18. Scripts and conventions

`<domain>:<action>` throughout.

```
dev:web / dev:api / dev:ext / dev:all / dev:fixtures
build:web / build:api / build:ext
test / test:watch / test:ci / test:rls / test:e2e
db:generate / db:migrate / db:migrate:development / db:migrate:staging / db:migrate:production / db:migrate:all / db:studio / db:force-rls / db:rls:check / db:seed
data:sync-fuel / data:sync-fuel:staging / data:sync-fuel:prod / data:sync-vca / data:sync-vca:staging / data:sync-vca:prod / data:sync-carbon / data:normalise-check / data:verify-zones
env:setup / env:merge / env:sync / env:sync:staging / env:sync:prod / cf:sync / cf:sync:staging / cf:sync:prod / rules:sync / rules:check / ignore:sync
check / ship-it / doctor / git:unlock / clean / reset / size
deploy:staging / deploy:prod / deploy:preview / deploy:all / deploy:sync:staging / deploy:sync:prod
```

All data and database commands go through `scripts/with-env.mjs` so the target environment is
explicit, never inferred. `db:migrate:*` uses the `pg` driver over TCP - not the Neon websocket
client Workers use at request time. `with-env` loads `.env` and `.dev.vars`; an empty value never
overwrites a filled one. `env:setup` copies committed `.example` templates into the gitignored
`.env` / `.dev.vars` files when those files are missing. `env:merge` does the same and also
appends keys that exist in the example but not yet in the dest, without changing existing
values. Both default to all three environments (`--env dev|staging|prod` to scope) and never
print secret values. `env:sync` still goes through `with-env.mjs` and rewrites dotenv ↔
Wrangler lockstep for one environment. `cf:sync` reads those files and uploads non-empty
Worker secrets with `wrangler secret bulk` (`--env staging` / `--env production`, top-level
Worker for local/dev). `BRIM_FIXTURES` and `WEB_ORIGIN` stay in `wrangler.jsonc` `vars` and
apply on the next deploy. Empty keys are skipped. Staging and production require `--yes`.
The command never prints secret values. `AGENTS.md` is the single source for agent rules;
Cursor/Claude Code/Windsurf/Aider/Copilot rule files are generated by `rules:sync` and
drift-checked in CI.

---

## 19. CI/CD and environments

Three environments - dev (local + Neon branch), staging, production. Three workflows: PR checks
(lint, typecheck, `test:ci`, RLS, `data:verify-zones`, drift, Conventional Commits), staging
deploy on merge to main, guarded production release on version tag. Changesets for versioning.
Neon branching per PR.

Secrets: `GOOGLE_MAPS_API_KEY`, `FUEL_FINDER_CLIENT_ID`, `FUEL_FINDER_CLIENT_SECRET`,
`DVLA_VES_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`,
`VRM_ENCRYPTION_KEY`. Managed via `keys:*` and Wrangler secrets.

**Open-source additions:** secret scanning on every PR and on the full history before the repo
goes public; forked PRs run against fixtures only and never touch real secrets; a
`SECURITY.md` with a disclosure route.

---

## 20. Open source and funding

**Licence (recommended split):**
- `packages/engine`, `packages/shared`, `packages/routing` - **MIT**. The conversions, correction factors, charge-window logic and unit handling are genuinely useful to other people, and permissive licensing maximises both adoption and portfolio value
- `apps/*` - **AGPL-3.0**. Free to self-host and modify; a hosted commercial clone must publish its changes

**Required from day one, not retrofitted:** `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
`SECURITY.md`, issue and PR templates, `docs/self-hosting.md`, and fixture mode (§11.3) so a
contributor can run the whole stack with no API keys.

**Funding:** the product is free with no paid tier and no ads. Running costs are controlled by
§14 rather than offset by revenue. If costs ever outgrow that, the honest options in order are:
GitHub Sponsors with a public cost dashboard; then a self-host-first posture where the hosted
instance is a convenience. **Not** an option: selling journey or location data, ever. Write that
into the README so it constrains future-you.

**Contribution surface that's genuinely open to non-developers:** zone boundary verification,
brand canonicalisation entries, and EV network tariff updates are all data PRs. Structure them
so a local user can fix their own city.

---

## 21. Stack defaults deliberately N/A for v1

- **Stripe / LemonSqueezy** - no paid surface, by decision. Not deferred; excluded.
- **Bunny CDN** - no user media; static assets via Pages edge.
- **Durable Objects / PartyKit** - no realtime surface.
- **Sanity or any CMS** - marketing copy is small and lives in the repo.

Now **in** scope, having been N/A in v0.1: **Resend** (auth emails, arriving with Better Auth at
P4) and **Tailwind + shadcn/ui** (§15).

---

## 22. Roadmap

| Phase | Deliverable |
|---|---|
| **P0** | Workspaces, tooling, quality floor. `check`/`ship-it`/`doctor`/`clean`/`reset`. Hello-world web + api deployed. `AGENTS.md` + `rules:sync`. **Licence, CONTRIBUTING, fixture-mode skeleton - the repo is public from commit one** |
| **P1** | `packages/engine` - conversions, tiers, bands, ICE + EV consumption, correction factors, full unit suite. No I/O. **This is where correctness is decided; do not rush it** |
| **P2** | `packages/routing` - provider interface, Google adapter, OSRM adapter, route cache, two-tier strategy, spend-ceiling failover. Estimate endpoint live with manual consumption input |
| **P3** | Web app v1: Tailwind + shadcn theme, estimate flow, manual vehicle entry, pump-readout hero. **Shippable here** |
| **P4** | Persistence + Better Auth + RLS + anon sessions + claim-on-signup. Journeys saved, history, CSV export |
| **P5** | Fuel Finder ingestion, normalisation, station model, price precedence. Real prices replace medians |
| **P6** | EV: tariffs, grid carbon intensity sync, temperature derating, arrival state of charge |
| **P7** | **Charges: toll table, zone geometry, compliance engine, `data:verify-zones`, liability copy.** Highest test bar in the project |
| **P8** | Cheapest-fill-on-route, PostGIS proximity, detour penalty |
| **P9** | Reg lookup: DVLA VES + VCA join + disambiguation + reg privacy controls |
| **P10** | Fill-up logging + calibration + tier-0 estimates. The retention loop |
| **P11** | Extension (context menu) + Web Share Target + parser hardening, PWA, a11y pass, HMRC comparison, Herald What's-New surface |

`brim-build-prompts.md` implements P0–P4. Later phases get their own kits.

**Ship gates.** P3 is a product. P5 makes it better than the alternatives. **P7 is what makes it
unlike anything else** - if you can only build one thing after P5, build charges, not reg lookup.
P9–P10 are weeks of fiddly work and should be paid for by demonstrated demand.

---

## 23. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Routing API cost with no revenue** | **High** | §14 two-tier, local charge computation, hard ceiling with OSRM failover, public cost dashboard |
| **A wrong compliance answer causes a real penalty** | **High** | §9B.6 liability position, never assert on derived Euro status, official-checker links, 100% test coverage on charge logic |
| Zone boundaries go stale after a scheme change | High | Dated GeoJSON, `data:verify-zones` fails CI at 180 days, open-source data PRs |
| EV price estimates are visibly worse than fuel prices | Medium | Stated plainly in the UI (§5.6); user-editable tariffs; never presented with false confidence |
| Reg → derivative matching is poor in practice | Medium | Disambiguation UI makes a bad match visible; tier 3 fallback is honest |
| Fuel Finder data quality worse than expected | Medium | Raw-store + normalisation + staleness flags + freshness always displayed |
| shadcn defaults make it look like every other AI-built app | Medium | §15.1 token overrides are a review gate, not a suggestion |
| Nobody wants it | High | P3 ships in weeks. Validate before P9 |

---

## 24. Success criteria for v1

- An estimate for a calibrated vehicle lands within **8%** of actual fuel used on a >100-mile trip, measured brim-to-brim
- EV arrival state of charge within **5 percentage points** on a >100-mile trip
- **Charge determination correct on 100%** of a 40-journey manual test set spanning ULEZ, three CAZs, a Scottish LEZ, Dart Charge and the M6 Toll. Anything less than 100% blocks the P7 release
- Median time from landing to first estimate under **45 seconds**, with no account
- Zero regs in logs, verified by an automated CI grep over a captured log sample
- At least one external contributor merges a data PR within 90 days of the repo going public

---

## 25. Decisions taken (v0.2)

1. **Name** - Brim. Confirmed.
2. **Styling** - Tailwind + shadcn/ui, with mandatory token overrides (§15.1). The pump readout stays bespoke.
3. **Accounts** - enabled at launch (P4), anonymous-first with claim-on-signup (§10.4).
4. **Extension** - context menu + share target. DOM injection not shipped (§10.2).
5. **EV** - modelled in v1 including arrival state of charge. Charging-stop routing remains out (§5.5–5.7).
6. **Tolls and zones** - in scope, own phase (P7), highest test bar (§9B).
7. **Licence** - open source: MIT for engine/shared/routing, AGPL-3.0 for apps (§20).
8. **Monetisation** - free, no ads, no paid tier, no data sale. Cost controlled rather than offset (§14, §20).
9. **Posture** - real product, not a portfolio piece. This is why §9B.6, §16 privacy and §24 exist in this form.

## 26. Remaining open questions

1. **Domain and Web Store name availability** for Brim - check before P0, since the repo goes public immediately.
2. **Confirm the MIT/AGPL split** - a single MIT licence across everything is simpler and better portfolio surface; AGPL on the apps is better protection. Pick before the first public commit; relicensing after contributions arrive is painful.
3. **Who owns zone data maintenance** once schemes change - is `data:verify-zones` failing CI enough, or does this need a calendar reminder and a named owner?
4. **EV public charging price table** - hand-maintain per network, or drop public charging in v1 and support home tariffs only? Home-only is more honest and much less maintenance.
5. **OSRM hosting** - self-host on a small VPS, or use a public demo endpoint for the fallback? Public endpoints have no availability guarantee, which undermines the point of a failover.
6. **Vans and motorcycles** - CAZ classes treat them differently from cars, and supporting them roughly doubles the compliance matrix. In for v1, or cars only with a clear "cars only" statement?
