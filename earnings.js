// Earnings accounts for nurses and doctors (backend/earnings.js):
// - "My account": the balance, a counter towards the 10 credits needed to withdraw, totals and history;
//   nurses earn 3,000 FCFA per completed home visit, doctors what patients actually paid for completed consultations;
// - a withdrawal takes the whole balance and is paid automatically by the payout service (Maviance); the owner can
//   cancel it while it waits;
// - administrators see the queue, read-only: nobody marks money as paid or declines by hand.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const online = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline;

  Object.assign(T.en, {
    ea_nav: 'My account', ea_title: 'My HFA account',
    ea_intro_nurse: '{amount} is added to your account for each completed home visit (your report, the patient’s feedback and the doctor’s confirmation). You can withdraw your balance once it holds {min} visits.',
    ea_intro_doctor: 'Each consultation you complete adds what the patient paid for it (your consultation fee{fee}) to your account. A consultation that was not paid adds nothing. You can withdraw your balance once it holds {min} paid consultations.',
    ea_fee: ', currently {amount}', ea_balance: 'Balance',
    ea_in_home_visit: '{n} home visit(s) in your account', ea_in_consultation: '{n} paid consultation(s) in your account',
    ea_progress_home_visit: '{n} of {min} visits: {left} more before you can withdraw.', ea_progress_consultation: '{n} of {min} consultations: {left} more before you can withdraw.',
    ea_can_withdraw: 'You can withdraw your balance.', ea_withdraw: 'Withdraw {amount}', ea_how: 'Pay me by', ea_to_mm: 'Mobile money number', ea_to_bank: 'Bank details (bank, account holder, account number or RIB)',
    ea_confirm_withdraw: 'Withdraw your whole balance of {amount}? It is paid automatically to the account you give.',
    ea_m_mobile_money: 'Mobile money', ea_m_bank_transfer: 'Bank transfer',
    ea_pending_queued: 'Withdrawal of {amount} to {destination}, requested on {date}: waiting for automatic payment.', ea_pending_processing: 'Withdrawal of {amount} to {destination}: being paid.',
    ea_waiting_service: 'Automatic payments are not switched on yet. Your request keeps its place in the queue and is paid as soon as they are.',
    ea_cancel: 'Cancel this withdrawal', ea_confirm_cancel: 'Cancel this withdrawal? The amount stays in your account.',
    ea_failed_note: 'A withdrawal on {date} could not be paid ({reason}). The amount is back in your account.',
    ea_total_earned: 'Earned in total', ea_total_paid: 'Paid to you', ea_history: 'History', ea_none: 'Nothing yet.',
    ea_line_home_visit: 'Home visit · {patient}', ea_line_consultation: 'Consultation · {patient}', ea_line_withdrawal: 'Withdrawal · {method} · {destination}',
    ea_s_available: 'In your account', ea_s_queued: 'Waiting', ea_s_processing: 'Being paid', ea_s_paid: 'Paid', ea_s_failed: 'Not paid', ea_s_cancelled: 'Cancelled',
    ea_dash: 'My HFA account', ea_open: 'Open my account', ea_reference: 'Reference',
    ea_admin_nav: 'Payouts', ea_admin_title: 'Payouts to nurses and doctors',
    ea_admin_intro: 'Nurses and doctors withdraw their balance once it holds 10 completed, paid pieces of work. Withdrawals are paid automatically by the payment service; nobody can mark one as paid or decline it by hand.',
    ea_admin_off: 'Automatic payouts are not connected yet (Maviance). Requests wait in the queue and are paid once the service is connected.',
    ea_admin_on: 'Automatic payouts are connected.', ea_waiting_total: 'Waiting to be paid', ea_in_accounts: 'In {role} accounts ({n})',
    ea_role_nurse: 'nurses’', ea_role_doctor: 'doctors’', ea_who: 'Person', ea_amount: 'Amount', ea_to: 'Pay to', ea_n_credits: '{n} credits'
  });
  Object.assign(T.fr, {
    ea_nav: 'Mon compte', ea_title: 'Mon compte HFA',
    ea_intro_nurse: '{amount} sont ajoutés à votre compte pour chaque visite à domicile terminée (votre rapport, l’avis du patient et la confirmation du médecin). Vous pouvez retirer votre solde dès qu’il compte {min} visites.',
    ea_intro_doctor: 'Chaque consultation que vous terminez ajoute à votre compte ce que le patient a payé (vos frais de consultation{fee}). Une consultation non payée n’ajoute rien. Vous pouvez retirer votre solde dès qu’il compte {min} consultations payées.',
    ea_fee: ', actuellement {amount}', ea_balance: 'Solde',
    ea_in_home_visit: '{n} visite(s) à domicile sur votre compte', ea_in_consultation: '{n} consultation(s) payée(s) sur votre compte',
    ea_progress_home_visit: '{n} sur {min} visites : encore {left} avant de pouvoir retirer.', ea_progress_consultation: '{n} sur {min} consultations : encore {left} avant de pouvoir retirer.',
    ea_can_withdraw: 'Vous pouvez retirer votre solde.', ea_withdraw: 'Retirer {amount}', ea_how: 'Me payer par', ea_to_mm: 'Numéro mobile money', ea_to_bank: 'Coordonnées bancaires (banque, titulaire, numéro de compte ou RIB)',
    ea_confirm_withdraw: 'Retirer la totalité de votre solde, soit {amount} ? Il est payé automatiquement sur le compte indiqué.',
    ea_m_mobile_money: 'Mobile money', ea_m_bank_transfer: 'Virement bancaire',
    ea_pending_queued: 'Retrait de {amount} vers {destination}, demandé le {date} : en attente de paiement automatique.', ea_pending_processing: 'Retrait de {amount} vers {destination} : en cours de paiement.',
    ea_waiting_service: 'Les paiements automatiques ne sont pas encore activés. Votre demande garde sa place dans la file et sera payée dès qu’ils le seront.',
    ea_cancel: 'Annuler ce retrait', ea_confirm_cancel: 'Annuler ce retrait ? Le montant reste sur votre compte.',
    ea_failed_note: 'Un retrait du {date} n’a pas pu être payé ({reason}). Le montant est de retour sur votre compte.',
    ea_total_earned: 'Gagné au total', ea_total_paid: 'Payé', ea_history: 'Historique', ea_none: 'Rien pour l’instant.',
    ea_line_home_visit: 'Visite à domicile · {patient}', ea_line_consultation: 'Consultation · {patient}', ea_line_withdrawal: 'Retrait · {method} · {destination}',
    ea_s_available: 'Sur votre compte', ea_s_queued: 'En attente', ea_s_processing: 'En paiement', ea_s_paid: 'Payé', ea_s_failed: 'Non payé', ea_s_cancelled: 'Annulé',
    ea_dash: 'Mon compte HFA', ea_open: 'Ouvrir mon compte', ea_reference: 'Référence',
    ea_admin_nav: 'Versements', ea_admin_title: 'Versements aux infirmiers et médecins',
    ea_admin_intro: 'Infirmiers et médecins retirent leur solde dès qu’il compte 10 prestations terminées et payées. Les retraits sont payés automatiquement par le service de paiement ; personne ne peut en marquer un comme payé ni le refuser à la main.',
    ea_admin_off: 'Les versements automatiques ne sont pas encore connectés (Maviance). Les demandes attendent dans la file et seront payées dès la connexion du service.',
    ea_admin_on: 'Les versements automatiques sont connectés.', ea_waiting_total: 'En attente de paiement', ea_in_accounts: 'Sur les comptes des {role} ({n})',
    ea_role_nurse: 'infirmiers', ea_role_doctor: 'médecins', ea_who: 'Personne', ea_amount: 'Montant', ea_to: 'Payer à', ea_n_credits: '{n} prestations'
  });

  const fcfa = amount => `${Number(amount || 0).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US')} FCFA`;
  const date = value => String(value || '').slice(0, 10);
  const fail = (box, error) => { if (box) box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; };
  const badge = status => `<span class="badge ${status === 'paid' ? 'bsu' : status === 'failed' ? 'bda' : status === 'available' ? 'bin' : status === 'cancelled' ? 'bse' : 'bwa'}">${esc(t('ea_s_' + status))}</span>`;
  const wrap = (name, replacement) => { const original = window[name]; if (typeof original === 'function') window[name] = (...args) => replacement(original, ...args); };

  for (const role of ['nurse', 'doctor']) if (NAV[role]?.[0] && !NAV[role][0].items.some(item => item.id === 'my-account')) NAV[role][0].items.push({ id: 'my-account', l: () => t('ea_nav'), i: 'file' });
  if (NAV.admin?.[1] && !NAV.admin[1].items.some(item => item.id === 'payouts')) NAV.admin[1].items.push({ id: 'payouts', l: () => t('ea_admin_nav'), i: 'file' });
  const handles = (page, role) => (page === 'my-account' && ['nurse', 'doctor'].includes(role)) || (page === 'payouts' && role === 'admin');
  function renderPage(page, pc) {
    if (!online()) { pc.innerHTML = `<div class="page"><div class="card"><p class="mu">${esc(t('nw_needs_server'))}</p></div></div>`; return; }
    return page === 'payouts' ? renderAdmin(pc) : renderAccount(pc);
  }

  // ───── Counter: balance and progress towards a withdrawal ─────
  function counter(a) {
    const left = Math.max(0, a.minimumCredits - a.availableCredits), percent = Math.min(100, Math.round(a.availableCredits / a.minimumCredits * 100));
    const pending = a.pending && tf('ea_pending_' + a.pending.status, { amount: fcfa(a.pending.amount), destination: a.pending.destination, date: date(a.pending.requestedAt) });
    return `<div class="mu sm">${esc(t('ea_balance'))}</div><div class="ea-balance">${esc(fcfa(a.balance))}</div>
      <div class="sm">${esc(tf('ea_in_' + a.unit, { n: a.availableCredits }))}</div>
      <div class="st-progress mt8" role="progressbar" aria-valuemin="0" aria-valuemax="${a.minimumCredits}" aria-valuenow="${Math.min(a.availableCredits, a.minimumCredits)}"><span style="width:${percent}%"></span></div>
      <div class="sm mt8">${esc(pending || (left ? tf('ea_progress_' + a.unit, { n: a.availableCredits, min: a.minimumCredits, left }) : t('ea_can_withdraw')))}</div>`;
  }

  async function renderAccount(pc) {
    $('tbt').textContent = t('ea_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ea_title'))}</h2><p id="ea-intro"></p></div><div id="ea"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('ea');
    try {
      const a = (await apiRequest('/api/v1/earnings/account')).data;
      if (!box.isConnected) return;
      $('ea-intro').textContent = a.role === 'doctor'
        ? tf('ea_intro_doctor', { fee: a.consultationFee ? tf('ea_fee', { amount: fcfa(a.consultationFee * 600) }) : '', min: a.minimumCredits })
        : tf('ea_intro_nurse', { amount: fcfa(3000), min: a.minimumCredits });
      const failed = a.withdrawals.find(w => w.status === 'failed' && !a.withdrawals.some(other => other.requestedAt > w.requestedAt));
      const history = [
        ...a.credits.map(c => ({ at: c.creditedAt, text: tf('ea_line_' + c.source, { patient: c.patientName || '—' }) + (c.date ? ` (${c.date})` : ''), amount: `+${fcfa(c.amount)}`, status: c.status })),
        ...a.withdrawals.map(w => ({ at: w.requestedAt, text: tf('ea_line_withdrawal', { method: t('ea_m_' + w.method), destination: w.destination }) + (w.reference ? ` · ${t('ea_reference')}: ${w.reference}` : '') + (w.reason ? ` · ${w.reason}` : ''), amount: `−${fcfa(w.amount)}`, status: w.status }))
      ].sort((x, y) => String(y.at).localeCompare(String(x.at)));
      box.innerHTML = `<div class="card mb18">${counter(a)}
          ${a.pending && !a.automaticPayouts ? `<div class="alt ai mt8">${esc(t('ea_waiting_service'))}</div>` : ''}
          ${a.pending?.status === 'queued' ? `<button type="button" class="btn bs bsm mt8" id="ea-cancel" data-confirm="${esc(t('ea_confirm_cancel'))}">${esc(t('ea_cancel'))}</button>` : ''}
          ${failed && !a.pending ? `<div class="alt ae mt8">${esc(tf('ea_failed_note', { date: date(failed.updatedAt), reason: failed.reason || '—' }))}</div>` : ''}
          ${a.canWithdraw ? `<form class="mt18" onsubmit="return false"><div class="fr"><div class="fg"><label class="fl" for="ea-method">${esc(t('ea_how'))}</label><select class="fc" id="ea-method"><option value="mobile_money">${esc(t('ea_m_mobile_money'))}</option><option value="bank_transfer">${esc(t('ea_m_bank_transfer'))}</option></select></div>
              <div class="fg"><label class="fl" for="ea-to" id="ea-to-label">${esc(t('ea_to_mm'))}</label><input class="fc" id="ea-to" data-v="phone" maxlength="200" required value="${esc(CU.phone || '')}"></div></div>
              <div id="ea-msg"></div><button type="button" class="btn bp" id="ea-send" data-confirm="${esc(tf('ea_confirm_withdraw', { amount: fcfa(a.balance) }))}">${esc(tf('ea_withdraw', { amount: fcfa(a.balance) }))}</button></form>` : ''}</div>
        <div class="stats"><div class="sc ce"><div class="sv">${esc(fcfa(a.totalEarned))}</div><div class="sl">${esc(t('ea_total_earned'))}</div></div><div class="sc cb"><div class="sv">${esc(fcfa(a.totalPaid))}</div><div class="sl">${esc(t('ea_total_paid'))}</div></div></div>
        <div class="card"><div class="ch"><div class="ct">${esc(t('ea_history'))}</div></div>${history.length ? `<div class="tw"><table><tbody>${history.map(item => `<tr><td class="sm mu" style="white-space:nowrap">${esc(date(item.at))}</td><td class="sm">${esc(item.text)}</td><td class="sm bo" style="white-space:nowrap">${esc(item.amount)}</td><td>${badge(item.status)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mu sm">${esc(t('ea_none'))}</p>`}</div>`;
      const method = $('ea-method');
      method?.addEventListener('change', () => {
        const to = $('ea-to'), bank = method.value === 'bank_transfer';
        $('ea-to-label').textContent = t(bank ? 'ea_to_bank' : 'ea_to_mm');
        if (bank) { to.removeAttribute('data-v'); to.setAttribute('minlength', '10'); to.value = ''; } else { to.setAttribute('data-v', 'phone'); to.removeAttribute('minlength'); to.value = CU.phone || ''; }
      });
      $('ea-send')?.addEventListener('click', async () => {
        try { await apiRequest('/api/v1/earnings/withdrawals', 'POST', { method: method.value, destination: $('ea-to').value.trim() }); renderAccount($('pgc')); }
        catch (error) { fail($('ea-msg'), error); }
      });
      $('ea-cancel')?.addEventListener('click', async () => {
        try { await apiRequest(`/api/v1/earnings/withdrawals/${encodeURIComponent(a.pending.id)}/cancel`, 'POST', {}); renderAccount($('pgc')); }
        catch (error) { fail($('ea'), error); }
      });
    } catch (error) { fail(box, error); }
  }

  // ───── Administrators: the payout queue, read-only ─────
  async function renderAdmin(pc) {
    $('tbt').textContent = t('ea_admin_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ea_admin_title'))}</h2><p>${esc(t('ea_admin_intro'))}</p></div><div id="ea-admin"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('ea-admin');
    try {
      const data = (await apiRequest('/api/v1/admin/earnings')).data;
      if (!box.isConnected) return;
      box.innerHTML = `<div class="alt ${data.automaticPayouts ? 'ao' : 'ai'} mb18">${esc(t(data.automaticPayouts ? 'ea_admin_on' : 'ea_admin_off'))}</div>
        <div class="stats"><div class="sc cg"><div class="sv">${esc(fcfa(data.waiting))}</div><div class="sl">${esc(t('ea_waiting_total'))}</div></div>
          ${data.balances.map(b => `<div class="sc cb"><div class="sv">${esc(fcfa(b.total))}</div><div class="sl">${esc(tf('ea_in_accounts', { role: t('ea_role_' + b.role), n: b.credits }))}</div></div>`).join('')}</div>
        <div class="card">${data.withdrawals.length ? `<div class="tw"><table><thead><tr><th>${esc(t('ea_who'))}</th><th>${esc(t('ea_amount'))}</th><th>${esc(t('ea_to'))}</th><th>${t('status')}</th></tr></thead><tbody>${data.withdrawals.map(w => `<tr>
          <td class="sm"><strong>${esc(w.name || '')}</strong><div class="mu sm">${esc(tv(w.role || ''))} · ${esc(date(w.requestedAt))}</div></td>
          <td class="sm"><strong>${esc(fcfa(w.amount))}</strong><div class="mu sm">${esc(tf('ea_n_credits', { n: w.credits }))}</div></td>
          <td class="sm">${esc(t('ea_m_' + w.method))}<div>${esc(w.destination)}</div></td>
          <td>${badge(w.status)}${w.reference ? `<div class="mu sm">${esc(w.reference)}</div>` : ''}${w.reason ? `<div class="mu sm">${esc(w.reason)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mu sm">${esc(t('ea_none'))}</p>`}</div>`;
    } catch (error) { fail(box, error); }
  }

  // A counter on nurses' and doctors' dashboards.
  wrap('renderPage', (original, page) => {
    const result = original(page);
    if (['nurse', 'doctor'].includes(CU?.role) && online() && page === 'dashboard') {
      apiRequest('/api/v1/earnings/account').then(({ data }) => {
        if (CP !== 'dashboard' || document.getElementById('ea-dash')) return;
        const host = $('pgc')?.querySelector('.page') || $('pgc'), anchor = host?.querySelector('.ph');
        const card = `<div class="card mb18" id="ea-dash"><div class="ch"><div class="ct">💰 ${esc(t('ea_dash'))}</div><button type="button" class="btn ${data.canWithdraw ? 'bp' : 'bs'} bsm" onclick="navigate('my-account')">${esc(data.canWithdraw ? tf('ea_withdraw', { amount: fcfa(data.balance) }) : t('ea_open'))}</button></div>${counter(data)}</div>`;
        if (anchor) anchor.insertAdjacentHTML('afterend', card); else host?.insertAdjacentHTML('afterbegin', card);
      }).catch(() => {});
    }
    return result;
  });

  document.head.insertAdjacentHTML('beforeend', '<style>.ea-balance{font-size:2rem;font-weight:800;color:var(--em);line-height:1.2}</style>');
  window.HFAEarnings = { handles, renderPage };
})();
