# Connecting real ambulances to HFA SOS

The app already does what the walkthrough describes. An SOS takes the patient's GPS, picks the nearest available ambulance, gives the crew the patient's live location and Vital Health Card, and shows the patient a live ETA. Crews accept and update the job in the **Ambulance Crew** portal. The **SOS console** and **Ambulance Fleet** pages let the HFA emergency desk watch, reassign and escalate.

What the app can't do alone is put a real vehicle on the road. That needs partner ambulances, a backend and a 24/7 human dispatcher. This guide covers how to get there.

## 1. Who to connect

| Option | What it gives you | What it takes |
| --- | --- | --- |
| **A. Partner fleet on the HFA crew app** (recommended first) | Works today with the built-in dispatch engine | Agreements with private ambulance operators and hospital fleets in the pilot city. One Android phone per vehicle, logged in to the crew account linked to that unit |
| **B. Operator's own dispatch software (CAD)** | Jobs go straight into the operator's existing system | The operator must offer an API. Set `DispatchConfig.provider = 'api'` and build the backend adapter (section 3) |
| **C. SAMU 119 hand-off** | Public emergency coverage where no partner unit is free | A formal agreement with the regional SAMU regulation centre on how alerts reach them (voice and structured SMS/WhatsApp) and on patient-data sharing |

We are not aware of a public dispatch API for SAMU in Cameroon. Confirm with the Ministry of Public Health and the regional SAMU centres before planning around one. Until then, option C stays a phone hand-off: the app always shows **Call 119** and automatically escalates when no partner unit is free within `maxRadiusKm`.

## 2. Pilot plan

1. **Pick one area** (for example Limbe–Buea or one Douala district) and sign 3–5 units, mixing BLS and at least one ALS. Agree on payment per call or a monthly retainer, response-time targets, insurance and liability.
2. **Verify the crews.** Create crew accounts in **Admin → Ambulance Crews**, verify licences, and link each account to its unit in **Ambulance Fleet**.
3. **Equip the vehicles.** Give each a dedicated Android phone with the HFA app installed (PWA), location always on, and a power bank or car charger. If crews won't use phones, fit a GPS tracker reporting to a tracking server such as Traccar (open source) and feed positions into the fleet registry.
4. **Staff a 24/7 dispatch desk.** One person on the SOS console per shift. They confirm every job by phone, reassign when a crew doesn't answer (automatic after `acceptTimeoutSec`), and call SAMU when needed.
5. **Run drills** before going live, then measure time-to-assign, time-to-accept, response time and handover time. The crew portal's **Job History** already records them.

## 3. Backend you need before real patients

The static site is a demo: the dispatch engine runs in the browser. For production:

- **Move dispatch to the server.** Expose `POST /api/dispatch` (same origin, to match the page's Content-Security-Policy). It receives `{emergencyId, patientHfaId, location}`, runs the nearest-unit logic (see `rankUnits` and `roadEstimate` in `index.html`) or forwards to the operator's CAD, and returns `{ambulanceId, callSign, etaMin}`.
- **Use real-time updates.** Push job offers to crews and status/ETA to patients over WebSocket, plus mobile push notifications (for example Firebase Cloud Messaging) so a crew phone rings even with the app closed.
- **Use a road-aware ETA.** Replace the straight-line × 1.4 estimate with a routing service (OSRM or a commercial directions API).
- **Add SMS fallback.** Use an SMS gateway with Cameroon coverage (confirm coverage and sender-ID rules with the provider) for crews and patients with weak data, and set `DispatchConfig.smsNumber` so patients can text the dispatch desk while offline.
- **Keep secrets server-side.** Operator API keys and gateway credentials never go in `index.html`.
- **Keep audit and privacy rules.** Every assignment, status change and Vital Health Card view is logged. Crews see a patient's card only while the job is active (already true in the app).

## 4. Settings in `index.html`

```js
const EMERGENCY_NUMBER = '119';           // SAMU — medical emergency in Cameroon
const DispatchConfig = {
  provider: 'hfa',                        // 'hfa' built-in engine | 'api' your backend
  apiBaseUrl: '/api/dispatch',
  maxRadiusKm: 60,                        // beyond this: escalate to SAMU
  roadFactor: 1.4, urbanKmh: 30, ruralKmh: 50, mobilisationMin: 2,
  acceptTimeoutSec: 60,                   // reassign if the crew does not accept
  smsNumber: '',                          // HFA dispatch SMS line for no-data SOS
};
const DEMO_SIMULATE_CREW = true;          // set to false once real crews are live
```

Set `DEMO_SIMULATE_CREW = false` as soon as real crews are on the platform. Otherwise unanswered jobs are "accepted" by the simulated demo crew.
