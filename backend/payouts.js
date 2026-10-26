// Automatic payouts of nurses' and doctors' withdrawals (Maviance), so no person ever marks money as paid by hand.
//
// NOT CONNECTED YET: createPayoutProvider returns null, and withdrawal requests wait in the queue (earnings.js).
// To connect Maviance, return an object with these two methods once its credentials are configured:
//
//   async send({ id, amount, currency, method, destination, name })
//     id: the withdrawal id (use it as the idempotency / external reference so a retry never pays twice)
//     method: 'mobile_money' (destination: +2376XXXXXXXX) or 'bank_transfer' (destination: bank details text)
//     → { status: 'paid' | 'processing', reference }
//
//   async check({ id, reference })
//     → { status: 'paid' | 'processing' | 'failed', reference?, reason? }
//
// Throw an Error with `permanent = true` when the payout is refused for good (wrong number, rejected account):
// the money then returns to the person's account. Any other error is treated as temporary and retried.
// Keep within Cameroonian and CEMAC rules for transfers (amount limits, identification of the payee).
function createPayoutProvider(env = process.env) { // eslint-disable-line no-unused-vars
  return null;
}

module.exports = { createPayoutProvider };
