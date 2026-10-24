// MTN Mobile Money in the browser: asks for the payer's MTN number, sends the payment request to the HFA server
// (which sets the amount), then waits while the payer approves on their phone. Resolves only when MTN confirms.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const POLL_MS = 4000, GIVE_UP_MS = 11 * 60 * 1000;

  Object.assign(T.en, {
    mm_title: 'Pay with MTN Mobile Money', mm_number: 'Your MTN Mobile Money number', mm_number_hint: 'For example 6 7X XX XX XX. You will approve the payment on this phone.',
    mm_send: 'Send payment request', mm_cancel: 'Cancel', mm_waiting: 'A payment request for {amount} was sent to {number}. Approve it on your phone with your Mobile Money PIN.',
    mm_success: 'Payment received. Thank you.', mm_failed: 'The payment was not completed: {reason}', mm_close: 'Close',
    payments_unavailable: 'Online payment is not available yet. The fee is recorded and payable at the health facility.',
    payments_unavailable_short: 'Online payment is not available yet.', fee_due_at_visit: 'Booked. The fee is payable at the visit.', mtn_momo: 'MTN Mobile Money'
  });
  Object.assign(T.fr, {
    mm_title: 'Payer avec MTN Mobile Money', mm_number: 'Votre numéro MTN Mobile Money', mm_number_hint: 'Par exemple 6 7X XX XX XX. Vous validerez le paiement sur ce téléphone.',
    mm_send: 'Envoyer la demande de paiement', mm_cancel: 'Annuler', mm_waiting: 'Une demande de paiement de {amount} a été envoyée au {number}. Validez-la sur votre téléphone avec votre code Mobile Money.',
    mm_success: 'Paiement reçu. Merci.', mm_failed: 'Le paiement n’a pas abouti : {reason}', mm_close: 'Fermer',
    payments_unavailable: 'Le paiement en ligne n’est pas encore disponible. Les frais sont enregistrés et payables au centre de santé.',
    payments_unavailable_short: 'Le paiement en ligne n’est pas encore disponible.', fee_due_at_visit: 'Réservé. Les frais sont payables lors de la visite.', mtn_momo: 'MTN Mobile Money'
  });

  const available = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline && !!ApiState.paymentsAvailable;
  const reason = code => ({ payer_did_not_approve_in_time: LANG === 'fr' ? 'non validé à temps' : 'not approved in time', amount_mismatch: LANG === 'fr' ? 'montant différent' : 'amount did not match',
    not_received_by_provider: LANG === 'fr' ? 'demande non reçue par MTN' : 'MTN did not receive the request' }[code] || code || '—');

  /** What the server needs to price this payment (it never accepts an amount from the browser). */
  function apiBody(request, msisdn) {
    const body = { purpose: request.purpose, msisdn, idempotencyKey: request.id.replace(/[^A-Za-z0-9_-]/g, '').padEnd(8, '0').slice(0, 64) };
    if (request.purpose === 'subscription') body.tier = request.metadata.tier;
    if (['consultation_fee', 'nurse_home_visit'].includes(request.purpose)) body.targetId = request.payeeId;
    if (request.metadata.appointmentId) body.details = { appointmentId: String(request.metadata.appointmentId) };
    return body;
  }

  function dialog() {
    let box = document.getElementById('mm-overlay');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mm-overlay'; box.className = 'sg-overlay';
      box.innerHTML = '<div class="sg-box" role="dialog" aria-modal="true" aria-labelledby="mm-title" id="mm-box"></div>';
      document.body.appendChild(box);
    }
    return box;
  }
  const close = () => document.getElementById('mm-overlay')?.remove();

  /** Runs one payment; resolves { success: true, reference, providerStatus, paymentId } or rejects. */
  function charge(request) {
    return new Promise((resolve, reject) => {
      const box = dialog(), inner = box.querySelector('#mm-box');
      const number = String(CU?.whatsappNumber || CU?.phone || '').replace(/^\+?237/, '');
      inner.innerHTML = `<h2 id="mm-title">📱 ${esc(t('mm_title'))}</h2>
        <div class="fg mt8"><label class="fl" for="mm-number">${esc(t('mm_number'))}</label><input class="fc" id="mm-number" inputmode="tel" autocomplete="tel" value="${esc(number)}"></div>
        <p class="mu sm">${esc(t('mm_number_hint'))}</p><div id="mm-msg" aria-live="polite"></div>
        <div class="sg-actions"><button type="button" class="btn bs" id="mm-cancel">${esc(t('mm_cancel'))}</button><button type="button" class="btn bp" id="mm-send">${esc(t('mm_send'))}</button></div>`;
      const message = (html, kind = 'ai') => { inner.querySelector('#mm-msg').innerHTML = `<div class="alt ${kind}">${html}</div>`; };
      inner.querySelector('#mm-number').focus();
      inner.querySelector('#mm-cancel').onclick = () => { close(); reject(new Error(t('payment_failed'))); };
      inner.querySelector('#mm-send').onclick = async () => {
        const send = inner.querySelector('#mm-send'), cancel = inner.querySelector('#mm-cancel');
        send.disabled = true;
        let payment;
        try { payment = (await apiRequest('/api/v1/payments', 'POST', apiBody(request, inner.querySelector('#mm-number').value), 30000)).data.payment; }
        catch (error) { send.disabled = false; message(esc(error.message), 'ae'); return; }
        const amount = `${Number(payment.amount).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB')} ${payment.currency}`;
        message(esc(tf('mm_waiting', { amount, number: inner.querySelector('#mm-number').value })));
        send.hidden = true; cancel.textContent = t('mm_close');
        const started = Date.now();
        let stop = false;
        cancel.onclick = () => { stop = true; close(); reject(new Error(t('payment_failed'))); };
        while (!stop && payment.status === 'pending' && Date.now() - started < GIVE_UP_MS) {
          await new Promise(done => setTimeout(done, POLL_MS));
          try { payment = (await apiRequest(`/api/v1/payments/${encodeURIComponent(payment.id)}`)).data.payment; } catch (error) { /* weak network: keep waiting */ }
        }
        if (stop) return;
        if (payment.status === 'successful') {
          message(esc(t('mm_success')), 'ao');
          setTimeout(close, 1200);
          resolve({ success: true, reference: payment.financialTransactionId || payment.id, providerStatus: 'completed', paymentId: payment.id, amount: payment.amount, currency: payment.currency });
        } else {
          message(esc(tf('mm_failed', { reason: reason(payment.failureReason || payment.status) })), 'ae');
          reject(new Error(tf('mm_failed', { reason: reason(payment.failureReason || payment.status) })));
        }
      };
    });
  }

  window.HFAMobileMoney = { available, charge, apiBody };
})();
