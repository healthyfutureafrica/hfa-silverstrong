# Connecting real ambulances to HFA SOS

The software side is built. **SOS** sends the patient's GPS position to `backend/dispatch.js`, which offers the job to the nearest on-duty partner ambulance. Crews accept and update the job in the **Ambulance crew** portal, patients follow it live, and administrators run the **SOS console** and **Ambulance fleet** pages. Nothing is simulated: until real ambulances and crews are registered, no request can be accepted. Patients are then told at once and directed to `1515` and the verified hospital contacts.

To put real vehicles behind it:

## 1. Partners

| Option | What it gives you | What it takes |
| --- | --- | --- |
| **A. Partner fleet on the HFA crew app** (start here) | Works today | Agreements with private operators and hospital fleets in a pilot area. One Android phone per vehicle, signed in to a crew account linked to that unit |
| **B. Operator's own dispatch software** | Jobs go into the operator's system | An operator API. Add a server-side adapter in `offerNext()` (`backend/dispatch.js`) that forwards the offer and maps their status updates back. Operator credentials stay in the server environment |
| **C. SAMU / `1515` hand-off** | Public coverage when no partner is free | A formal procedure with the regional emergency service for receiving HFA alerts (voice, SMS) and for patient-data sharing |

We know of no public dispatch API for the Cameroon emergency service. Confirm with the Ministry of Public Health before planning around one.

## 2. Pilot

1. **Sign units.** Pick one area (for example Limbe–Buea) and sign 3–5 units. Agree response-time targets, fees (the provider sets and collects any fare), insurance and liability.
2. **Register them.** In **Ambulance fleet**, register each unit with its call sign, type, operator, crew phone and base coordinates. Create crew accounts there (crews cannot self-register) and verify each crew member's identity and licence.
3. **Equip the vehicles.** Give each a dedicated Android phone with location always on and a car charger. Crews press **On duty** at shift start: a unit whose position is more than 30 minutes old is not offered jobs.
4. **Staff the console.** Keep someone on the **SOS console** around the clock to watch requests with no available unit, assign manually and call `1515` when needed.
5. **Drill, then measure.** Run drills before going live, then measure time to offer, time to accept, response time and handover time (all in each request's timeline).

## 3. Before real patients

- **Push alerts.** Add mobile push notifications so a crew phone rings even with the app closed. Today crews see offers when the app is open, plus an in-app notification.
- **Road-aware ETA.** Replace the straight-line × 1.4 estimate with a routing service (OSRM or a commercial directions API).
- **SMS fallback.** Use an SMS gateway with Cameroon coverage, so crews and patients with weak data still get alerts.
- **Legal review.** Data-protection review of sharing the emergency summary with crews (Law No. 2024/017).
