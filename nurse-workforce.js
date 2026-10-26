// Screens for nurses working with HFA (backend/nurse-workforce.js):
// - registration: nursing school, graduation year and a supervisor; administrators validate each nurse with a
//   checklist after contacting the supervisor;
// - home visits: the nurse files the report, the patient gives feedback, the doctor in charge confirms; the nurse's
//   pay for the visit (3,000 FCFA) is then due and administrators record its payment;
// - a weekly availability timetable each nurse keeps current (a reminder shows on every page until it is).
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const online = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline;
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const CHECKS = ['identity', 'licence', 'qualifications', 'education', 'employment', 'supervisor'];
  const WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  Object.assign(T.en, {
    nw_reg_title: 'Education and supervisor', nw_reg_note: 'Before your account is activated, HFA contacts your supervisor and checks your licence, qualifications and nursing school.',
    nw_licence: 'Nursing licence (council registration) number', nw_school: 'Nursing school (educational institution)', nw_school_ph: 'e.g. Higher Institute of Nursing Sciences, Yaoundé', nw_grad: 'Year of graduation',
    nw_sv_name: 'Supervisor’s full name', nw_sv_position: 'Supervisor’s position', nw_sv_position_ph: 'e.g. Head nurse, ward manager', nw_sv_inst: 'Supervisor’s institution', nw_sv_phone: 'Supervisor’s phone', nw_sv_email: 'Supervisor’s email (optional)',
    nw_needs_server: 'This works when the app is connected to the HFA server.',
    nw_verify_nav: 'Nurse validation', nw_verify_title: 'Nurse validation', nw_verify_intro: 'A nurse can work only after you have contacted their supervisor and confirmed every item of the checklist.',
    nw_open: 'Check and validate', nw_view: 'View', nw_progress: '{done} of {total} confirmed', nw_problems: '{n} problem(s)', nw_validated_on: 'Validated on {date}', nw_legacy: 'Active before this process',
    nw_awaiting: 'Awaiting validation', nw_no_nurses: 'No nurses yet.',
    nw_status_pending: 'To check', nw_status_confirmed: 'Confirmed', nw_status_problem: 'Problem',
    nw_check_identity: 'Identity', nw_check_identity_d: 'The ID card or passport matches the name given.',
    nw_check_licence: 'Nursing licence', nw_check_licence_d: 'Licence {no} is valid with the nursing council. Record its expiry date.',
    nw_check_qualifications: 'Qualifications', nw_check_qualifications_d: 'Certificates seen for: {value}.',
    nw_check_education: 'Education', nw_check_education_d: 'The school confirms the diploma: {school}, {year}.',
    nw_check_employment: 'Workplace', nw_check_employment_d: 'The workplace confirms the nurse works there: {value}.',
    nw_check_supervisor: 'Supervisor', nw_check_supervisor_d: 'The supervisor was contacted and vouched for the nurse (record the contact below first).',
    nw_confirm: 'Confirmed', nw_problem: 'Problem', nw_note: 'Note: what you checked, and with whom', nw_by: 'by {name}, {date}',
    nw_expiry: 'Licence expiry date', nw_licence_ok: 'Licence valid', nw_licence_bad: 'Not valid',
    nw_details: 'Details given by the nurse', nw_registered: 'Registered on', nw_id_doc: 'ID document', nw_open_doc: 'Open document', nw_none: 'Not given',
    nw_supervisor: 'Supervisor', nw_call: 'Call', nw_email_btn: 'Email',
    nw_email_subject: 'HFA SilverStrong: please confirm {name}',
    nw_email_body: 'Hello {supervisor},\n\n{name} has applied to work as a nurse with HFA SilverStrong and named you as their supervisor. Could you confirm that they work under your supervision, and their qualifications ({qualifications})?\n\nThank you,\nHFA SilverStrong',
    nw_wa_text: 'Hello {supervisor}, this is HFA SilverStrong. {name} has applied to work with us as a nurse and named you as their supervisor. Could you confirm this?',
    nw_contacts: 'Contacts with the supervisor', nw_no_contacts: 'Not contacted yet.', nw_method: 'How', nw_outcome: 'Outcome', nw_contact_note: 'What did the supervisor say?', nw_save_contact: 'Record contact',
    nw_m_phone: 'Phone call', nw_m_email: 'Email', nw_m_whatsapp: 'WhatsApp', nw_m_in_person: 'In person',
    nw_o_confirmed: 'Confirmed the nurse', nw_o_not_reached: 'Not reached', nw_o_declined: 'Did not confirm',
    nw_validate: 'Validate nurse', nw_validate_hint: 'Available once all six items are confirmed.', nw_validated: 'Validated. The nurse can now sign in and work.',
    nw_confirm_validate: 'Validate this nurse? They will be able to sign in and work with patients.',
    nw_tt_nav: 'My availability', nw_tt_title: 'Weekly availability', nw_tt_intro: 'The hours you can work with HFA each week. Patients can book home visits with you only during these hours. Confirm or update it at least once a week.',
    nw_day_mon: 'Monday', nw_day_tue: 'Tuesday', nw_day_wed: 'Wednesday', nw_day_thu: 'Thursday', nw_day_fri: 'Friday', nw_day_sat: 'Saturday', nw_day_sun: 'Sunday',
    nw_add_slot: '+ Add hours', nw_remove: 'Remove', nw_not_working: 'Not working', nw_copy_mon: 'Copy Monday to Tuesday–Friday', nw_from: 'From', nw_to: 'To',
    nw_tt_note: 'Note for HFA (optional, e.g. on leave 12–19 May)', nw_tt_save: 'Save timetable', nw_tt_still: 'Still correct — confirm for this week',
    nw_tt_current: 'Up to date. Confirmed on {date}; confirm or update it again by {due}.',
    nw_tt_overdue: 'Your weekly timetable is out of date (last confirmed {date}). Patients cannot book home visits with you until you confirm or update it.',
    nw_tt_missing: 'You have not published your weekly timetable yet. Patients cannot book home visits with you until you do.',
    nw_tt_banner_btn: 'Update my availability', nw_tt_saved: 'Saved. Your timetable is up to date.', nw_tt_bad: '{day}: times overlap or end before they start.',
    nw_hv_nav: 'Home visits', nw_hv_title: 'Home visits',
    nw_hv_intro_nurse: 'File the report after each visit. {amount} is added to your HFA account once the patient has given feedback and the doctor in charge confirms receiving all the data.',
    nw_hv_intro_doctor: 'Reports from nurses’ home visits to your patients. Confirm when you have received all the data you need, or ask the nurse for more.',
    nw_hv_intro_patient: 'Your nurse home visits. After a visit, tell us how it went.',
    nw_hv_intro_admin: 'Progress of every home visit, from the nurse’s report to the nurse’s payment.',
    nw_no_visits: 'No home visits yet.', nw_patient: 'Patient', nw_nurse: 'Nurse', nw_doctor: 'Doctor in charge',
    nw_step_report: 'Visit report', nw_step_feedback: 'Patient feedback', nw_step_doctor: 'Doctor confirmation', nw_step_pay: 'Payment',
    nw_file_report: 'File visit report', nw_update_report: 'Update report', nw_after_visit: 'File the report after the visit.', nw_returned: 'The doctor asked for more: {note}',
    nw_report_title: 'Home visit report', nw_vitals: 'Vital signs', nw_temp: 'Temperature (°C)', nw_sys: 'Blood pressure, systolic (mmHg)', nw_dia: 'Blood pressure, diastolic (mmHg)', nw_pulse: 'Pulse (beats/min)',
    nw_resp: 'Breathing rate (/min, optional)', nw_spo2: 'SpO₂ (%, optional)', nw_weight: 'Weight (kg, optional)', nw_glucose: 'Blood glucose (mmol/L, optional)',
    nw_observations: 'What you found', nw_care: 'Care given', nw_recs: 'Recommendations and follow-up (optional)', nw_send_report: 'Send report', nw_bp: 'Blood pressure',
    nw_rate: 'How was this visit?', nw_comment: 'Comment (optional)', nw_send_feedback: 'Send feedback', nw_your_rating: 'Rating: {stars}',
    nw_confirm_receipt: 'All data received — confirm', nw_ask_more: 'Ask the nurse for more', nw_ask_note: 'What is missing?', nw_confirm_note: 'Note (optional)',
    nw_confirmed_on: 'Confirmed by {name} on {date}', nw_no_doctor: 'An administrator is assigning the doctor in charge of this visit.', nw_assign_doctor: 'Assign doctor in charge', nw_assign_hint: 'This visit has no active doctor in charge. Choose one: they confirm the visit data before the nurse is paid.',
    nw_pay_due: 'Due: {amount}', nw_pay_paid: 'Paid: {amount} on {date}', nw_pay_pending: 'After the three steps',
    nw_earn_nav: 'My earnings', nw_earn_title: 'My earnings', nw_earn_intro: '{amount} per home visit, due once your report, the patient’s feedback and the doctor’s confirmation are all in.',
    nw_due_total: 'Due to you', nw_paid_total: 'Paid to you', nw_due_admin: 'Due to nurses', nw_tt_s_current: 'Up to date', nw_tt_s_overdue: 'Out of date', nw_tt_s_missing: 'Not published', nw_no_payouts: 'No payments yet.', nw_visit: 'Visit', nw_amount: 'Amount', nw_reference: 'Reference', nw_method_paid: 'Method',
    nw_pay_nav: 'Nurse payments', nw_pay_title: 'Nurse payments', nw_pay_intro: 'Pay each amount due by mobile money or bank transfer, then record the reference here. The nurse is told.',
    nw_m_mobile_money: 'Mobile money', nw_m_bank_transfer: 'Bank transfer', nw_m_cash: 'Cash', nw_mark_paid: 'Mark as paid', nw_confirm_paid: 'Record this payment as made? Check the reference first.',
    nw_status_due: 'Due', nw_status_paid: 'Paid',
    nw_hours_on: '{name} works on {day}: {hours}.', nw_hours_none: '{name} does not work on {day}. Choose another day or nurse.', nw_stale: 'timetable not up to date', nw_outside: 'Choose a time within the nurse’s working hours.'
  });
  Object.assign(T.fr, {
    nw_reg_title: 'Formation et superviseur', nw_reg_note: 'Avant l’activation de votre compte, HFA contacte votre superviseur et vérifie votre licence, vos diplômes et votre école d’infirmiers.',
    nw_licence: 'Numéro d’inscription à l’ordre infirmier', nw_school: 'École d’infirmiers (établissement de formation)', nw_school_ph: 'ex. Institut supérieur des sciences infirmières, Yaoundé', nw_grad: 'Année d’obtention du diplôme',
    nw_sv_name: 'Nom complet du superviseur', nw_sv_position: 'Fonction du superviseur', nw_sv_position_ph: 'ex. Major, surveillant(e) de service', nw_sv_inst: 'Établissement du superviseur', nw_sv_phone: 'Téléphone du superviseur', nw_sv_email: 'E-mail du superviseur (facultatif)',
    nw_needs_server: 'Cette fonction marche lorsque l’application est connectée au serveur HFA.',
    nw_verify_nav: 'Validation des infirmiers', nw_verify_title: 'Validation des infirmiers', nw_verify_intro: 'Un(e) infirmier(e) ne peut travailler qu’après que vous avez contacté son superviseur et confirmé chaque point de la liste.',
    nw_open: 'Vérifier et valider', nw_view: 'Voir', nw_progress: '{done} sur {total} confirmés', nw_problems: '{n} problème(s)', nw_validated_on: 'Validé(e) le {date}', nw_legacy: 'Actif(ve) avant cette procédure',
    nw_awaiting: 'En attente de validation', nw_no_nurses: 'Aucun(e) infirmier(e) pour l’instant.',
    nw_status_pending: 'À vérifier', nw_status_confirmed: 'Confirmé', nw_status_problem: 'Problème',
    nw_check_identity: 'Identité', nw_check_identity_d: 'La CNI ou le passeport correspond au nom donné.',
    nw_check_licence: 'Licence infirmière', nw_check_licence_d: 'La licence {no} est valable auprès de l’ordre infirmier. Enregistrez sa date d’expiration.',
    nw_check_qualifications: 'Diplômes', nw_check_qualifications_d: 'Certificats vus pour : {value}.',
    nw_check_education: 'Formation', nw_check_education_d: 'L’école confirme le diplôme : {school}, {year}.',
    nw_check_employment: 'Lieu de travail', nw_check_employment_d: 'Le lieu de travail confirme que la personne y travaille : {value}.',
    nw_check_supervisor: 'Superviseur', nw_check_supervisor_d: 'Le superviseur a été contacté et s’est porté garant (enregistrez d’abord le contact ci-dessous).',
    nw_confirm: 'Confirmé', nw_problem: 'Problème', nw_note: 'Note : ce que vous avez vérifié, et auprès de qui', nw_by: 'par {name}, {date}',
    nw_expiry: 'Date d’expiration de la licence', nw_licence_ok: 'Licence valable', nw_licence_bad: 'Non valable',
    nw_details: 'Informations données par l’infirmier(e)', nw_registered: 'Inscrit(e) le', nw_id_doc: 'Pièce d’identité', nw_open_doc: 'Ouvrir le document', nw_none: 'Non renseigné',
    nw_supervisor: 'Superviseur', nw_call: 'Appeler', nw_email_btn: 'E-mail',
    nw_email_subject: 'HFA SilverStrong : merci de confirmer {name}',
    nw_email_body: 'Bonjour {supervisor},\n\n{name} a demandé à travailler comme infirmier(e) avec HFA SilverStrong et vous a désigné(e) comme superviseur. Pourriez-vous confirmer que cette personne travaille sous votre supervision, ainsi que ses diplômes ({qualifications}) ?\n\nMerci,\nHFA SilverStrong',
    nw_wa_text: 'Bonjour {supervisor}, ici HFA SilverStrong. {name} a demandé à travailler avec nous comme infirmier(e) et vous a désigné(e) comme superviseur. Pouvez-vous le confirmer ?',
    nw_contacts: 'Contacts avec le superviseur', nw_no_contacts: 'Pas encore contacté.', nw_method: 'Comment', nw_outcome: 'Résultat', nw_contact_note: 'Qu’a dit le superviseur ?', nw_save_contact: 'Enregistrer le contact',
    nw_m_phone: 'Appel téléphonique', nw_m_email: 'E-mail', nw_m_whatsapp: 'WhatsApp', nw_m_in_person: 'En personne',
    nw_o_confirmed: 'A confirmé', nw_o_not_reached: 'Injoignable', nw_o_declined: 'N’a pas confirmé',
    nw_validate: 'Valider l’infirmier(e)', nw_validate_hint: 'Possible quand les six points sont confirmés.', nw_validated: 'Validé(e). La personne peut maintenant se connecter et travailler.',
    nw_confirm_validate: 'Valider cette personne ? Elle pourra se connecter et travailler avec des patients.',
    nw_tt_nav: 'Mes disponibilités', nw_tt_title: 'Disponibilités hebdomadaires', nw_tt_intro: 'Les heures où vous pouvez travailler avec HFA chaque semaine. Les patients ne peuvent réserver une visite à domicile avec vous que pendant ces heures. Confirmez-les ou mettez-les à jour au moins une fois par semaine.',
    nw_day_mon: 'Lundi', nw_day_tue: 'Mardi', nw_day_wed: 'Mercredi', nw_day_thu: 'Jeudi', nw_day_fri: 'Vendredi', nw_day_sat: 'Samedi', nw_day_sun: 'Dimanche',
    nw_add_slot: '+ Ajouter des heures', nw_remove: 'Retirer', nw_not_working: 'Pas de travail', nw_copy_mon: 'Copier lundi sur mardi–vendredi', nw_from: 'De', nw_to: 'À',
    nw_tt_note: 'Note pour HFA (facultatif, ex. en congé du 12 au 19 mai)', nw_tt_save: 'Enregistrer', nw_tt_still: 'Toujours exact — confirmer pour cette semaine',
    nw_tt_current: 'À jour. Confirmé le {date} ; à confirmer ou mettre à jour avant le {due}.',
    nw_tt_overdue: 'Vos disponibilités ne sont plus à jour (dernière confirmation le {date}). Les patients ne peuvent pas réserver de visite avec vous tant que vous ne les confirmez pas.',
    nw_tt_missing: 'Vous n’avez pas encore publié vos disponibilités. Les patients ne peuvent pas réserver de visite à domicile avec vous avant cela.',
    nw_tt_banner_btn: 'Mettre à jour mes disponibilités', nw_tt_saved: 'Enregistré. Vos disponibilités sont à jour.', nw_tt_bad: '{day} : des heures se chevauchent ou finissent avant de commencer.',
    nw_hv_nav: 'Visites à domicile', nw_hv_title: 'Visites à domicile',
    nw_hv_intro_nurse: 'Remplissez le rapport après chaque visite. {amount} sont ajoutés à votre compte HFA dès que le patient a donné son avis et que le médecin responsable confirme avoir reçu toutes les données.',
    nw_hv_intro_doctor: 'Les rapports des visites à domicile des infirmiers chez vos patients. Confirmez quand vous avez reçu toutes les données nécessaires, ou demandez des compléments.',
    nw_hv_intro_patient: 'Vos visites infirmières à domicile. Après une visite, dites-nous comment elle s’est passée.',
    nw_hv_intro_admin: 'Le suivi de chaque visite à domicile, du rapport de l’infirmier(e) à son paiement.',
    nw_no_visits: 'Aucune visite à domicile pour l’instant.', nw_patient: 'Patient', nw_nurse: 'Infirmier(e)', nw_doctor: 'Médecin responsable',
    nw_step_report: 'Rapport de visite', nw_step_feedback: 'Avis du patient', nw_step_doctor: 'Confirmation du médecin', nw_step_pay: 'Paiement',
    nw_file_report: 'Remplir le rapport', nw_update_report: 'Compléter le rapport', nw_after_visit: 'Remplissez le rapport après la visite.', nw_returned: 'Le médecin demande des compléments : {note}',
    nw_report_title: 'Rapport de visite à domicile', nw_vitals: 'Signes vitaux', nw_temp: 'Température (°C)', nw_sys: 'Tension, systolique (mmHg)', nw_dia: 'Tension, diastolique (mmHg)', nw_pulse: 'Pouls (battements/min)',
    nw_resp: 'Fréquence respiratoire (/min, facultatif)', nw_spo2: 'SpO₂ (%, facultatif)', nw_weight: 'Poids (kg, facultatif)', nw_glucose: 'Glycémie (mmol/L, facultatif)',
    nw_observations: 'Ce que vous avez constaté', nw_care: 'Soins donnés', nw_recs: 'Recommandations et suivi (facultatif)', nw_send_report: 'Envoyer le rapport', nw_bp: 'Tension artérielle',
    nw_rate: 'Comment s’est passée cette visite ?', nw_comment: 'Commentaire (facultatif)', nw_send_feedback: 'Envoyer mon avis', nw_your_rating: 'Note : {stars}',
    nw_confirm_receipt: 'Toutes les données reçues — confirmer', nw_ask_more: 'Demander des compléments', nw_ask_note: 'Que manque-t-il ?', nw_confirm_note: 'Note (facultatif)',
    nw_confirmed_on: 'Confirmé par {name} le {date}', nw_no_doctor: 'Un administrateur attribue le médecin responsable de cette visite.', nw_assign_doctor: 'Attribuer le médecin responsable', nw_assign_hint: 'Cette visite n’a pas de médecin responsable actif. Choisissez-en un : il confirme les données de la visite avant le paiement de l’infirmier(e).',
    nw_pay_due: 'À payer : {amount}', nw_pay_paid: 'Payé : {amount} le {date}', nw_pay_pending: 'Après les trois étapes',
    nw_earn_nav: 'Mes gains', nw_earn_title: 'Mes gains', nw_earn_intro: '{amount} par visite à domicile, dû dès que votre rapport, l’avis du patient et la confirmation du médecin sont enregistrés.',
    nw_due_total: 'Dû', nw_paid_total: 'Payé', nw_due_admin: 'Dû aux infirmiers', nw_tt_s_current: 'À jour', nw_tt_s_overdue: 'Pas à jour', nw_tt_s_missing: 'Non publié', nw_no_payouts: 'Aucun paiement pour l’instant.', nw_visit: 'Visite', nw_amount: 'Montant', nw_reference: 'Référence', nw_method_paid: 'Moyen',
    nw_pay_nav: 'Paiements infirmiers', nw_pay_title: 'Paiements des infirmiers', nw_pay_intro: 'Payez chaque montant dû par mobile money ou virement, puis enregistrez la référence ici. L’infirmier(e) est prévenu(e).',
    nw_m_mobile_money: 'Mobile money', nw_m_bank_transfer: 'Virement bancaire', nw_m_cash: 'Espèces', nw_mark_paid: 'Marquer comme payé', nw_confirm_paid: 'Enregistrer ce paiement comme effectué ? Vérifiez d’abord la référence.',
    nw_status_due: 'À payer', nw_status_paid: 'Payé',
    nw_hours_on: '{name} travaille le {day} : {hours}.', nw_hours_none: '{name} ne travaille pas le {day}. Choisissez un autre jour ou une autre personne.', nw_stale: 'disponibilités non à jour', nw_outside: 'Choisissez une heure dans les heures de travail de l’infirmier(e).'
  });

  Object.assign(T.en, {
    nw_earn_nav: 'My account', nw_earn_title: 'My HFA account',
    nw_earn_intro: '{amount} is added to your account for each completed home visit (your report, the patient’s feedback and the doctor’s confirmation). You can withdraw your balance once it holds {min} visits.',
    nw_balance: 'Balance', nw_visits_in: '{n} visit(s) in your account', nw_progress_to: '{n} of {min} visits: {left} more before you can withdraw.', nw_can_withdraw: 'You can withdraw your balance.',
    nw_withdraw: 'Withdraw {amount}', nw_withdraw_how: 'Pay me by', nw_to_mm: 'Mobile money number', nw_to_bank: 'Bank details (bank, account holder, account number or RIB)', nw_send_withdraw: 'Request withdrawal',
    nw_confirm_withdraw: 'Withdraw your whole balance of {amount}? HFA pays it within a few working days.',
    nw_pending: 'Withdrawal of {amount} requested on {date}, to {destination}. HFA is processing it.', nw_declined_note: 'Withdrawal declined on {date}: {note}. The amount is back in your account.',
    nw_total_earned: 'Earned in total', nw_total_paid: 'Paid to you', nw_history: 'History', nw_credit_line: 'Home visit · {patient}', nw_withdraw_line: 'Withdrawal · {method}',
    nw_status_available: 'In your account', nw_status_requested: 'Being paid', nw_status_declined: 'Declined',
    nw_pay_credited: 'Credited: {amount}', nw_pay_requested: 'Being paid: {amount}',
    nw_dash_account: 'My HFA account', nw_open_account: 'Open my account',
    nw_pay_intro: 'Nurses withdraw their balance once it holds 10 completed visits. Pay each request by mobile money or bank transfer, then record the reference; or decline it with the reason (the amount returns to the nurse’s account).',
    nw_requested_total: 'Requested', nw_credited_total: 'In nurses’ accounts ({n} visits)', nw_no_withdrawals: 'No withdrawal requests yet.',
    nw_decline: 'Decline', nw_decline_note: 'Reason for declining', nw_confirm_decline: 'Decline this withdrawal? The amount returns to the nurse’s account.',
    nw_confirm_paid: 'Record this withdrawal as paid? Check the reference first.', nw_destination: 'Pay to', nw_visits_n: '{n} visits', nw_amount: 'Amount', nw_reference: 'Reference'
  });
  Object.assign(T.fr, {
    nw_earn_nav: 'Mon compte', nw_earn_title: 'Mon compte HFA',
    nw_earn_intro: '{amount} sont ajoutés à votre compte pour chaque visite à domicile terminée (votre rapport, l’avis du patient et la confirmation du médecin). Vous pouvez retirer votre solde dès qu’il compte {min} visites.',
    nw_balance: 'Solde', nw_visits_in: '{n} visite(s) sur votre compte', nw_progress_to: '{n} sur {min} visites : encore {left} avant de pouvoir retirer.', nw_can_withdraw: 'Vous pouvez retirer votre solde.',
    nw_withdraw: 'Retirer {amount}', nw_withdraw_how: 'Me payer par', nw_to_mm: 'Numéro mobile money', nw_to_bank: 'Coordonnées bancaires (banque, titulaire, numéro de compte ou RIB)', nw_send_withdraw: 'Demander le retrait',
    nw_confirm_withdraw: 'Retirer la totalité de votre solde, soit {amount} ? HFA le paie sous quelques jours ouvrables.',
    nw_pending: 'Retrait de {amount} demandé le {date}, vers {destination}. HFA le traite.', nw_declined_note: 'Retrait refusé le {date} : {note}. Le montant est de retour sur votre compte.',
    nw_total_earned: 'Gagné au total', nw_total_paid: 'Payé', nw_history: 'Historique', nw_credit_line: 'Visite à domicile · {patient}', nw_withdraw_line: 'Retrait · {method}',
    nw_status_available: 'Sur votre compte', nw_status_requested: 'En paiement', nw_status_declined: 'Refusé',
    nw_pay_credited: 'Crédité : {amount}', nw_pay_requested: 'En paiement : {amount}',
    nw_dash_account: 'Mon compte HFA', nw_open_account: 'Ouvrir mon compte',
    nw_pay_intro: 'Les infirmiers retirent leur solde dès qu’il compte 10 visites terminées. Payez chaque demande par mobile money ou virement, puis enregistrez la référence ; ou refusez-la en donnant la raison (le montant revient sur le compte de l’infirmier(e)).',
    nw_requested_total: 'Demandé', nw_credited_total: 'Sur les comptes des infirmiers ({n} visites)', nw_no_withdrawals: 'Aucune demande de retrait pour l’instant.',
    nw_decline: 'Refuser', nw_decline_note: 'Raison du refus', nw_confirm_decline: 'Refuser ce retrait ? Le montant revient sur le compte de l’infirmier(e).',
    nw_confirm_paid: 'Enregistrer ce retrait comme payé ? Vérifiez d’abord la référence.', nw_destination: 'Payer à', nw_visits_n: '{n} visites', nw_amount: 'Montant', nw_reference: 'Référence'
  });

  const fcfa = amount => `${Number(amount || 0).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US')} FCFA`;
  const date = value => String(value || '').slice(0, 10);
  const fail = (box, error) => { if (box) box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; };
  const needsServer = pc => { pc.innerHTML = `<div class="page"><div class="card"><p class="mu">${esc(t('nw_needs_server'))}</p></div></div>`; };
  const wrap = (name, replacement) => { const original = window[name]; if (typeof original === 'function') window[name] = (...args) => replacement(original, ...args); };
  const field = (id, label, attrs = '', type = 'text') => `<div class="fg"><label class="fl" for="${id}">${esc(label)}</label><input class="fc" id="${id}" type="${type}" ${attrs}></div>`;
  const badge = status => `<span class="badge ${status === 'confirmed' || status === 'paid' ? 'bsu' : status === 'problem' || status === 'declined' ? 'bda' : status === 'available' ? 'bin' : 'bwa'}">${esc(t('nw_status_' + status))}</span>`;
  const options = (prefix, values) => values.map(value => `<option value="${value}">${esc(t(prefix + value))}</option>`).join('');

  // ───── Menus ─────
  const push = (role, section, item) => { if (NAV[role]?.[section] && !NAV[role][section].items.some(entry => entry.id === item.id)) NAV[role][section].items.push(item); };
  push('admin', 1, { id: 'nurse-verify', l: () => t('nw_verify_nav'), i: 'heart' });
  push('admin', 1, { id: 'home-visits', l: () => t('nw_hv_nav'), i: 'clip' });
  push('admin', 1, { id: 'nurse-pay', l: () => t('nw_pay_nav'), i: 'file' });
  push('nurse', 0, { id: 'home-visits', l: () => t('nw_hv_nav'), i: 'clip' });
  push('nurse', 0, { id: 'nurse-timetable', l: () => t('nw_tt_nav'), i: 'cal' });
  push('nurse', 0, { id: 'nurse-earnings', l: () => t('nw_earn_nav'), i: 'file' });
  push('doctor', 0, { id: 'home-visits', l: () => t('nw_hv_nav'), i: 'clip' });
  push('patient', 0, { id: 'home-visits', l: () => t('nw_hv_nav'), i: 'clip' });
  const PAGES = { 'nurse-verify': ['admin'], 'nurse-pay': ['admin'], 'home-visits': ['admin', 'nurse', 'doctor', 'patient'], 'nurse-timetable': ['nurse'], 'nurse-earnings': ['nurse'] };
  const handles = (page, role) => !!PAGES[page]?.includes(role);
  function renderPage(page, pc) {
    if (!online()) return needsServer(pc);
    ({ 'nurse-verify': renderVerifications, 'nurse-pay': renderPayouts, 'home-visits': renderVisits, 'nurse-timetable': renderTimetable, 'nurse-earnings': renderEarnings })[page](pc);
  }

  // ───── Registration: education and supervisor ─────
  const applicationFields = prefix => `<div class="nw-app" data-prefix="${prefix}"><h4 class="mt8" style="font-size:.9rem">${esc(t('nw_reg_title'))}</h4><p class="mu sm">${esc(t('nw_reg_note'))}</p>
    ${field(`${prefix}-nw-school`, t('nw_school'), `minlength="3" maxlength="160" required placeholder="${esc(t('nw_school_ph'))}"`)}
    ${field(`${prefix}-nw-grad`, t('nw_grad'), `min="1960" max="${new Date().getFullYear()}" step="1" required inputmode="numeric"`, 'number')}
    ${field(`${prefix}-nw-sv-name`, t('nw_sv_name'), 'data-v="name" maxlength="120" required')}
    <div class="fr">${field(`${prefix}-nw-sv-position`, t('nw_sv_position'), `minlength="2" maxlength="120" required placeholder="${esc(t('nw_sv_position_ph'))}"`)}${field(`${prefix}-nw-sv-inst`, t('nw_sv_inst'), 'minlength="3" maxlength="160" required')}</div>
    <div class="fr">${field(`${prefix}-nw-sv-phone`, t('nw_sv_phone'), 'data-v="phone" maxlength="20" required placeholder="+237 6XX XX XX XX"', 'tel')}${field(`${prefix}-nw-sv-email`, t('nw_sv_email'), 'data-v="email" maxlength="254"', 'email')}</div></div>`;
  /** The nurse application from a form's fields (prefix "reg" or "au"). */
  function application(prefix) {
    const value = name => ($(`${prefix}-nw-${name}`)?.value || '').trim();
    const supervisor = { name: value('sv-name'), position: value('sv-position'), institution: value('sv-inst'), phone: window.HFAValidation?.phone ? window.HFAValidation.phone(value('sv-phone')) : value('sv-phone') };
    if (value('sv-email')) supervisor.email = value('sv-email').toLowerCase();
    return { school: value('school'), graduationYear: Number(value('grad')), supervisor };
  }
  function installRegistrationFields() {
    const nurseForm = $('nf');
    if (!nurseForm || nurseForm.querySelector('.nw-app')) return;
    const qualifications = $('rqu')?.closest('.fg');
    (qualifications || nurseForm.lastElementChild).insertAdjacentHTML('afterend', applicationFields('reg'));
    for (const id of ['rni', 'rqu']) $(id)?.setAttribute('required', '');
    relabel();
  }
  /** Static labels follow the language toggle. */
  function relabel() {
    const licenceLabel = $('rni')?.closest('.fg')?.querySelector('label');
    if (licenceLabel) licenceLabel.textContent = t('nw_licence');
    const box = document.querySelector('#nf .nw-app');
    if (box) { const values = {}; box.querySelectorAll('input').forEach(input => { values[input.id] = input.value; }); box.outerHTML = applicationFields('reg'); Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).value = value; }); }
  }
  wrap('updateStaticHTML', original => { original(); relabel(); });
  wrap('backendRegister', (original, localUser) => original(localUser?.role === 'nurse' && $('reg-nw-school') ? { ...localUser, nurseApplication: application('reg') } : localUser));
  // Administrators adding a nurse give the same information.
  wrap('showAddUser', (original, role) => {
    original(role);
    if (role !== 'nurse') return;
    $('au-ni')?.setAttribute('required', '');
    const footer = document.querySelector('#mbox .mf');
    footer?.insertAdjacentHTML('beforebegin', `${field('au-qu', t('qualifications'), 'minlength="2" maxlength="200" required')}${applicationFields('au')}`);
  });

  // ───── Administrators: validation checklist ─────
  async function renderVerifications(pc) {
    $('tbt').textContent = t('nw_verify_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('nw_verify_title'))}</h2><p>${esc(t('nw_verify_intro'))}</p></div><div class="card"><div class="tw" id="nw-list"><p class="mu sm">…</p></div></div></div>`;
    const box = $('nw-list');
    try {
      const { nurses } = (await apiRequest('/api/v1/admin/nurse-verifications')).data;
      if (!box.isConnected) return;
      box.innerHTML = nurses.length ? `<table><thead><tr><th>${t('user')}</th><th>${t('status')}</th><th>${esc(t('nw_tt_nav'))}</th><th>${t('actions')}</th></tr></thead><tbody>${nurses.map(nurse => `<tr>
        <td><strong class="sm">${esc(nurse.name)}</strong><div class="mu sm">${esc(nurse.email)} · <code class="code-chip">${esc(nurse.hfaId || '')}</code></div></td>
        <td>${nurse.validatedAt ? `<span class="badge bsu">${esc(tf('nw_validated_on', { date: date(nurse.validatedAt) }))}</span>` : nurse.legacy ? `<span class="badge bin">${esc(t('nw_legacy'))}</span>`
          : `<span class="badge bwa">${esc(t('nw_awaiting'))}</span><div class="mu sm">${esc(tf('nw_progress', { done: nurse.confirmed, total: nurse.total }))}${nurse.problems ? ' · ' + esc(tf('nw_problems', { n: nurse.problems })) : ''}</div>`}</td>
        <td><span class="badge ${nurse.timetable === 'current' ? 'bsu' : nurse.timetable === 'overdue' ? 'bda' : 'bwa'}">${esc(t('nw_tt_s_' + nurse.timetable))}</span></td>
        <td><button type="button" class="btn ${nurse.validatedAt || nurse.legacy ? 'bs' : 'bp'} bsm" data-verify="${esc(nurse.id)}">${esc(t(nurse.validatedAt || nurse.legacy ? 'nw_view' : 'nw_open'))}</button></td></tr>`).join('')}</tbody></table>`
        : `<p class="mu sm">${esc(t('nw_no_nurses'))}</p>`;
      box.querySelectorAll('[data-verify]').forEach(button => { button.onclick = () => openVerification(button.dataset.verify); });
    } catch (error) { fail(box, error); }
  }

  async function openVerification(id) {
    openMo(`<div class="mh"><div class="mt2">${esc(t('nw_verify_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div><div id="nw-ver"><p class="mu sm">…</p></div>`);
    try { paintVerification((await apiRequest(`/api/v1/admin/nurse-verifications/${encodeURIComponent(id)}`)).data); }
    catch (error) { fail($('nw-ver'), error); }
  }
  function checkDescription(item, v) {
    const n = v.nurse, a = v.application || {};
    return item === 'licence' ? tf('nw_check_licence_d', { no: n.licenseNo || t('nw_none') })
      : item === 'qualifications' ? tf('nw_check_qualifications_d', { value: n.qualifications || t('nw_none') })
      : item === 'education' ? tf('nw_check_education_d', { school: a.school || t('nw_none'), year: a.graduationYear || '—' })
      : item === 'employment' ? tf('nw_check_employment_d', { value: [n.hospital, n.department].filter(Boolean).join(', ') || t('nw_none') })
      : t(`nw_check_${item}_d`);
  }
  function paintVerification(v) {
    const box = $('nw-ver'); if (!box) return;
    const n = v.nurse, a = v.application, s = a?.supervisor, open = !v.validatedAt && !v.legacy && !!a;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const vars = { name: n.name, supervisor: s?.name || '', qualifications: n.qualifications || '' };
    const row = (label, value) => `<tr><th class="sm" style="width:42%">${esc(label)}</th><td class="sm">${value}</td></tr>`;
    box.innerHTML = `
      ${v.validatedAt ? `<div class="alt ao">${esc(tf('nw_validated_on', { date: date(v.validatedAt) }))}${v.validatedBy ? ' · ' + esc(v.validatedBy) : ''}</div>` : v.legacy ? `<div class="alt ai">${esc(t('nw_legacy'))}</div>` : ''}
      <h4 class="mb12">${esc(t('nw_details'))}</h4>
      <div class="tw"><table><tbody>
        ${row(t('full_name_lbl'), `<strong>${esc(n.name)}</strong> <code class="code-chip">${esc(n.hfaId || '')}</code>`)}
        ${row(t('email_lbl'), esc(n.email || '—'))}${row(t('phone_lbl'), esc(n.phone || '—'))}
        ${row(t('nw_licence'), esc(n.licenseNo || t('nw_none')))}${row(t('qualifications'), esc(n.qualifications || t('nw_none')))}
        ${row(t('nw_school'), esc(a?.school || t('nw_none')))}${row(t('nw_grad'), esc(a?.graduationYear || '—'))}
        ${row(t('hospital'), esc([n.hospital, n.department, n.specialty && tv(n.specialty)].filter(Boolean).join(' · ') || t('nw_none')))}
        ${row(t('nw_registered'), esc(date(n.createdAt)))}
        ${row(t('nw_id_doc'), n.idDocument ? `<a class="btn bs bsm" href="/api/admin/users/${encodeURIComponent(n.id)}/documents/identity" target="_blank" rel="noopener">${esc(t('nw_open_doc'))}</a>` : esc(t('nw_none')))}
      </tbody></table></div>
      ${s ? `<h4 class="mt18 mb12">${esc(t('nw_supervisor'))}</h4>
        <p class="sm"><strong>${esc(s.name)}</strong> · ${esc(s.position)} · ${esc(s.institution)}<br>${esc(s.phone)}${s.email ? ' · ' + esc(s.email) : ''}</p>
        <div class="pc-actions" style="margin-top:6px">
          <a class="btn bs bsm" href="tel:${esc(s.phone)}">📞 ${esc(t('nw_call'))}</a>
          <a class="btn bs bsm" href="https://wa.me/${esc(s.phone.replace(/\D/g, ''))}?text=${encodeURIComponent(tf('nw_wa_text', vars))}" target="_blank" rel="noopener">💬 WhatsApp</a>
          ${s.email ? `<a class="btn bs bsm" href="mailto:${esc(s.email)}?subject=${encodeURIComponent(tf('nw_email_subject', vars))}&body=${encodeURIComponent(tf('nw_email_body', vars))}">✉️ ${esc(t('nw_email_btn'))}</a>` : ''}
        </div>
        <h4 class="mt18 mb12">${esc(t('nw_contacts'))}</h4>
        ${v.contacts.length ? `<ul class="sm" style="padding-left:18px">${v.contacts.map(item => `<li>${esc(date(item.at))} · ${esc(t('nw_m_' + item.method))} · <strong>${esc(t('nw_o_' + item.outcome))}</strong>${item.note ? ' — ' + esc(item.note) : ''} <span class="mu">(${esc(item.by || '')})</span></li>`).join('')}</ul>` : `<p class="mu sm">${esc(t('nw_no_contacts'))}</p>`}
        ${open ? `<div class="fr"><div class="fg"><label class="fl" for="nw-c-method">${esc(t('nw_method'))}</label><select class="fc" id="nw-c-method">${options('nw_m_', ['phone', 'whatsapp', 'email', 'in_person'])}</select></div>
          <div class="fg"><label class="fl" for="nw-c-outcome">${esc(t('nw_outcome'))}</label><select class="fc" id="nw-c-outcome">${options('nw_o_', ['confirmed', 'not_reached', 'declined'])}</select></div></div>
          <div class="fg"><label class="fl" for="nw-c-note">${esc(t('nw_contact_note'))}</label><textarea class="fc" id="nw-c-note" rows="2" maxlength="1000"></textarea></div>
          <button type="button" class="btn bs bsm" id="nw-c-save" data-novalidate>${esc(t('nw_save_contact'))}</button><div id="nw-c-msg" class="mt8"></div>` : ''}` : ''}
      <h4 class="mt18 mb12">✔ ${esc(t('nw_verify_title'))}</h4>
      ${CHECKS.map(item => { const check = v.checks[item]; return `<div class="card mb12" style="padding:12px">
        <div class="ch" style="margin-bottom:6px;flex-wrap:wrap;gap:8px"><div class="ct sm">${esc(t('nw_check_' + item))}</div>${badge(check.status)}</div>
        <p class="mu sm">${esc(checkDescription(item, v))}</p>
        ${check.note ? `<p class="sm">${esc(check.note)}</p>` : ''}${check.by ? `<p class="mu sm">${esc(tf('nw_by', { name: check.by, date: date(check.at) }))}</p>` : ''}
        ${open ? item === 'licence'
          ? `<div class="pc-actions" style="align-items:flex-end"><div class="fg" style="margin:0"><label class="fl" for="nw-exp">${esc(t('nw_expiry'))}</label><input class="fc" type="date" id="nw-exp" min="${tomorrow}" value="${esc(check.expiresOn || '')}"></div>
              <button type="button" class="btn bp bsm" data-licence="verified" data-novalidate>${esc(t('nw_licence_ok'))}</button><button type="button" class="btn bd2 bsm" data-licence="rejected" data-novalidate>${esc(t('nw_licence_bad'))}</button></div>`
          : `<div class="fg"><label class="fl" for="nw-n-${item}">${esc(t('nw_note'))}</label><textarea class="fc" id="nw-n-${item}" rows="2" maxlength="1000"></textarea></div>
              <div class="pc-actions" style="margin-top:0"><button type="button" class="btn bp bsm" data-check="${item}" data-status="confirmed" data-novalidate>${esc(t('nw_confirm'))}</button><button type="button" class="btn bd2 bsm" data-check="${item}" data-status="problem" data-novalidate>${esc(t('nw_problem'))}</button></div>` : ''}
        <div id="nw-m-${item}"></div></div>`; }).join('')}
      ${open ? `<div class="mf" style="flex-wrap:wrap"><span class="mu sm" style="flex:1">${v.ready ? '' : esc(t('nw_validate_hint'))}</span>
        <button type="button" class="btn bd2" onclick="askReject('${esc(n.id)}')">${esc(t('reject'))}</button>
        <button type="button" class="btn bp" id="nw-validate" ${v.ready ? '' : 'disabled'} data-novalidate data-confirm="${esc(t('nw_confirm_validate'))}">${esc(t('nw_validate'))}</button></div><div id="nw-v-msg"></div>` : ''}`;
    const path = `/api/v1/admin/nurse-verifications/${encodeURIComponent(n.id)}`;
    const act = async (request, messageBox) => { try { paintVerification((await request()).data); } catch (error) { fail($(messageBox), error); } };
    $('nw-c-save')?.addEventListener('click', () => act(() => apiRequest(`${path}/contacts`, 'POST', { method: $('nw-c-method').value, outcome: $('nw-c-outcome').value, note: $('nw-c-note').value.trim() }), 'nw-c-msg'));
    box.querySelectorAll('[data-check]').forEach(button => button.addEventListener('click', () => act(() => apiRequest(`${path}/checks/${button.dataset.check}`, 'POST', { status: button.dataset.status, note: $(`nw-n-${button.dataset.check}`).value.trim() }), `nw-m-${button.dataset.check}`)));
    box.querySelectorAll('[data-licence]').forEach(button => button.addEventListener('click', () => act(async () => {
      const expiresOn = $('nw-exp').value;
      await apiRequest(`/api/v1/admin/clinicians/${encodeURIComponent(n.id)}/licence`, 'POST', { status: button.dataset.licence, ...(expiresOn ? { expiresOn } : {}) });
      return apiRequest(path);
    }, 'nw-m-licence')));
    $('nw-validate')?.addEventListener('click', () => act(async () => {
      const result = await apiRequest(`${path}/validate`, 'POST', {});
      const local = G(n.id); if (local) local.status = 'active';
      buildSidebar();
      setTimeout(() => { const msg = $('nw-v-msg'); if (msg) msg.innerHTML = `<div class="alt ao">${esc(t('nw_validated'))}</div>`; }, 0);
      return result;
    }, 'nw-v-msg'));
  }
  // Approving a nurse goes through the checklist.
  wrap('askApprove', (original, id) => G(id)?.role === 'nurse' && online() ? openVerification(id) : original(id));

  // ───── Nurses: weekly timetable ─────
  let availability = null, availabilityAt = 0;
  async function loadAvailability(force = false) {
    if (!force && availability && Date.now() - availabilityAt < 60000) return availability;
    availability = (await apiRequest('/api/v1/nurse/availability')).data; availabilityAt = Date.now();
    return availability;
  }
  const statusText = a => a.status === 'current' ? tf('nw_tt_current', { date: date(a.confirmedAt), due: date(a.dueAt) }) : a.status === 'overdue' ? tf('nw_tt_overdue', { date: date(a.confirmedAt) }) : t('nw_tt_missing');
  let draft = null;
  async function renderTimetable(pc) {
    $('tbt').textContent = t('nw_tt_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('nw_tt_title'))}</h2><p>${esc(t('nw_tt_intro'))}</p></div><div id="nw-tt-status"></div><div class="card" id="nw-tt"><p class="mu sm">…</p></div></div>`;
    try {
      const a = await loadAvailability(true);
      draft = Object.fromEntries(DAYS.map(day => [day, (a.slots?.[day] || []).map(slot => ({ ...slot }))]));
      paintTimetable(a);
    } catch (error) { fail($('nw-tt'), error); }
  }
  function paintTimetable(a, message = '') {
    const box = $('nw-tt'), status = $('nw-tt-status'); if (!box) return;
    status.innerHTML = `<div class="alt ${a.status === 'current' ? 'ao' : 'ae'} mb18" role="status">${esc(statusText(a))}</div>`;
    box.innerHTML = `${DAYS.map(day => `<div class="goal-row" style="align-items:flex-start;flex-wrap:wrap;gap:8px;padding:10px 0;border-bottom:1px solid var(--bd)">
        <div class="bo sm" style="width:110px">${esc(t('nw_day_' + day))}</div>
        <div style="flex:1;min-width:220px">${draft[day].length ? draft[day].map((slot, index) => `<div class="pc-actions" style="margin:0 0 6px;align-items:center;flex-wrap:nowrap">
            <label class="sr-only" for="nw-s-${day}-${index}">${esc(t('nw_from'))}</label><input class="fc" type="time" id="nw-s-${day}-${index}" data-day="${day}" data-index="${index}" data-edge="start" value="${esc(slot.start)}" style="max-width:120px" required>
            <span class="mu sm">–</span>
            <label class="sr-only" for="nw-e-${day}-${index}">${esc(t('nw_to'))}</label><input class="fc" type="time" id="nw-e-${day}-${index}" data-day="${day}" data-index="${index}" data-edge="end" value="${esc(slot.end)}" style="max-width:120px" required>
            <button type="button" class="btn bgh bsm" data-remove="${day}:${index}" aria-label="${esc(t('nw_remove'))}">✕</button></div>`).join('') : `<span class="mu sm">${esc(t('nw_not_working'))}</span>`}
          <div><button type="button" class="btn bgh bsm" data-add="${day}">${esc(t('nw_add_slot'))}</button></div></div></div>`).join('')}
      <div class="pc-actions"><button type="button" class="btn bs bsm" id="nw-copy">${esc(t('nw_copy_mon'))}</button></div>
      <div class="fg mt18"><label class="fl" for="nw-tt-note">${esc(t('nw_tt_note'))}</label><input class="fc" id="nw-tt-note" maxlength="300" value="${esc(a.note || '')}"></div>
      <div id="nw-tt-msg">${message}</div>
      <div class="pc-actions"><button type="button" class="btn bp" id="nw-tt-save">${esc(t('nw_tt_save'))}</button>${a.slots ? `<button type="button" class="btn bs" id="nw-tt-confirm" data-novalidate>${esc(t('nw_tt_still'))}</button>` : ''}</div>`;
    box.querySelectorAll('input[type=time]').forEach(input => input.addEventListener('change', () => { draft[input.dataset.day][Number(input.dataset.index)][input.dataset.edge] = input.value; }));
    const keepNote = () => { a.note = $('nw-tt-note').value; };
    box.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => { keepNote(); const list = draft[button.dataset.add]; const last = list.at(-1); list.push(last ? { start: last.end < '20:00' ? last.end : '08:00', end: last.end < '20:00' ? '21:00' : '12:00' } : { start: '08:00', end: '17:00' }); paintTimetable(a); }));
    box.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { keepNote(); const [day, index] = button.dataset.remove.split(':'); draft[day].splice(Number(index), 1); paintTimetable(a); }));
    $('nw-copy').addEventListener('click', () => { keepNote(); for (const day of ['tue', 'wed', 'thu', 'fri']) draft[day] = draft.mon.map(slot => ({ ...slot })); paintTimetable(a); });
    $('nw-tt-save').addEventListener('click', async () => {
      const bad = DAYS.find(day => [...draft[day]].sort((x, y) => x.start.localeCompare(y.start)).some((slot, index, all) => !slot.start || !slot.end || slot.start >= slot.end || (index && all[index - 1].end > slot.start)));
      if (bad) { $('nw-tt-msg').innerHTML = `<div class="alt ae" role="alert">${esc(tf('nw_tt_bad', { day: t('nw_day_' + bad) }))}</div>`; return; }
      try { const result = (await apiRequest('/api/v1/nurse/availability', 'PUT', { slots: draft, note: $('nw-tt-note').value.trim() })).data; availability = result; availabilityAt = Date.now(); paintTimetable(result, `<div class="alt ao">${esc(t('nw_tt_saved'))}</div>`); }
      catch (error) { fail($('nw-tt-msg'), error); }
    });
    $('nw-tt-confirm')?.addEventListener('click', async () => {
      try { const result = (await apiRequest('/api/v1/nurse/availability/confirm', 'POST', {})).data; availability = result; availabilityAt = Date.now(); paintTimetable(result, `<div class="alt ao">${esc(t('nw_tt_saved'))}</div>`); }
      catch (error) { fail($('nw-tt-msg'), error); }
    });
  }
  // A reminder on every page while the timetable is missing or out of date.
  wrap('renderPage', (original, page) => {
    const result = original(page);
    if (CU?.role === 'nurse' && online() && page === 'dashboard') {
      apiRequest('/api/v1/nurse/account').then(({ data }) => {
        if (CP !== 'dashboard' || document.getElementById('nw-dash-account')) return;
        const host = $('pgc')?.querySelector('.page') || $('pgc');
        const anchor = host?.querySelector('.ph');
        const card = `<div class="card mb18" id="nw-dash-account"><div class="ch"><div class="ct">💰 ${esc(t('nw_dash_account'))}</div><button type="button" class="btn ${data.canWithdraw ? 'bp' : 'bs'} bsm" onclick="navigate('nurse-earnings')">${esc(data.canWithdraw ? tf('nw_withdraw', { amount: fcfa(data.balance) }) : t('nw_open_account'))}</button></div>${counter(data)}</div>`;
        if (anchor) anchor.insertAdjacentHTML('afterend', card); else host?.insertAdjacentHTML('afterbegin', card);
      }).catch(() => {});
    }
    if (CU?.role === 'nurse' && online() && page !== 'nurse-timetable') {
      loadAvailability().then(a => {
        if (a.status === 'current' || CP !== page || document.getElementById('nw-banner')) return;
        const host = $('pgc')?.querySelector('.page') || $('pgc');
        host?.insertAdjacentHTML('afterbegin', `<div class="alt ae mb18" id="nw-banner" role="status" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1">📅 ${esc(statusText(a))}</span><button type="button" class="btn bp bsm" onclick="navigate('nurse-timetable')">${esc(t('nw_tt_banner_btn'))}</button></div>`);
      }).catch(() => {});
    }
    return result;
  });

  // ───── Home visits: report, feedback, confirmation ─────
  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
  function reportHtml(report) {
    if (!report) return '';
    const v = report.vitals, item = (label, value) => value === undefined || value === null || value === '' ? '' : `<tr><th class="sm" style="width:45%">${esc(label)}</th><td class="sm">${esc(String(value))}</td></tr>`;
    return `<details class="mt8"><summary class="sm bo">${esc(t('nw_report_title'))} · ${esc(date(report.filedAt))}</summary><div class="tw mt8"><table><tbody>
      ${item(t('nw_temp'), v.temperatureC)}${item(t('nw_bp'), `${v.systolic}/${v.diastolic} mmHg`)}${item(t('nw_pulse'), v.pulse)}${item(t('nw_resp'), v.respiratoryRate)}${item(t('nw_spo2'), v.spo2)}${item(t('nw_weight'), v.weightKg)}${item(t('nw_glucose'), v.glucoseMmol)}
      ${item(t('nw_observations'), report.observations)}${item(t('nw_care'), report.careGiven)}${item(t('nw_recs'), report.recommendations)}</tbody></table></div></details>`;
  }
  const stepChip = (label, done) => `<span class="badge ${done ? 'bsu' : 'bse'}" style="margin:2px">${done ? '✅' : '⏳'} ${esc(label)}</span>`;
  let payPerVisit = 3000;
  async function renderVisits(pc) {
    $('tbt').textContent = t('nw_hv_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('nw_hv_title'))}</h2><p id="nw-hv-intro"></p></div><div id="nw-hv"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('nw-hv');
    try {
      const { visits, payPerVisit: pay } = (await apiRequest('/api/v1/home-visits/progress')).data;
      payPerVisit = pay.amount;
      if (!box.isConnected) return;
      $('nw-hv-intro').textContent = tf('nw_hv_intro_' + CU.role, { amount: fcfa(pay.amount) });
      box.innerHTML = visits.length ? visits.map(visitCard).join('') : `<div class="card"><p class="mu sm">${esc(t('nw_no_visits'))}</p></div>`;
      bindVisits(box, visits);
    } catch (error) { fail(box, error); }
  }
  function visitCard(v) {
    const role = CU.role, today = new Date().toISOString().slice(0, 10), filed = !!v.reportAt && !v.returnedAt;
    const pay = !v.payout ? t('nw_pay_pending') : v.payout.status === 'paid' ? tf('nw_pay_paid', { amount: fcfa(v.payout.amount), date: date(v.payout.paidAt) }) : tf(v.payout.status === 'requested' ? 'nw_pay_requested' : 'nw_pay_credited', { amount: fcfa(v.payout.amount) });
    let actions = '';
    if (role === 'nurse') {
      actions = v.confirmedAt ? '' : v.visitDate > today ? `<p class="mu sm">${esc(t('nw_after_visit'))}</p>`
        : `<button type="button" class="btn ${v.reportAt && !v.returnedAt ? 'bs' : 'bp'} bsm mt8" data-report="${esc(v.visitId)}" data-novalidate>${esc(t(v.reportAt ? 'nw_update_report' : 'nw_file_report'))}</button>`;
    } else if (role === 'patient' && v.reportAt && !v.feedback) {
      actions = `<div class="mt8"><div class="fl">${esc(t('nw_rate'))}</div><div class="pc-actions" role="radiogroup" style="margin-top:4px">${[1, 2, 3, 4, 5].map(n => `<label class="btn bs bsm"><input type="radio" name="nw-r-${esc(v.visitId)}" value="${n}" required> ${'★'.repeat(n)}</label>`).join('')}</div>
        <div class="fg"><label class="fl" for="nw-fc-${esc(v.visitId)}">${esc(t('nw_comment'))}</label><textarea class="fc" id="nw-fc-${esc(v.visitId)}" rows="2" maxlength="1000"></textarea></div>
        <button type="button" class="btn bp bsm" data-feedback="${esc(v.visitId)}">${esc(t('nw_send_feedback'))}</button></div>`;
    } else if (role === 'doctor' && filed && !v.confirmedAt) {
      actions = `<div class="fg mt8"><label class="fl" for="nw-dn-${esc(v.visitId)}">${esc(t('nw_confirm_note'))} / ${esc(t('nw_ask_note'))}</label><textarea class="fc" id="nw-dn-${esc(v.visitId)}" rows="2" maxlength="1000"></textarea></div>
        <div class="pc-actions" style="margin-top:0"><button type="button" class="btn bp bsm" data-confirm-visit="${esc(v.visitId)}" data-novalidate>${esc(t('nw_confirm_receipt'))}</button><button type="button" class="btn bs bsm" data-return="${esc(v.visitId)}" data-novalidate>${esc(t('nw_ask_more'))}</button></div>`;
    }
    return `<div class="card mb18"><div class="ch" style="flex-wrap:wrap;gap:8px"><div><div class="ct">${esc(v.visitDate || '')} ${esc(v.visitTime || '')}</div>
        <div class="mu sm">${esc(t('nw_patient'))}: ${esc(v.patientName || '—')} · ${esc(t('nw_nurse'))}: ${esc(v.nurseName || '—')} · ${esc(t('nw_doctor'))}: ${esc(v.doctorName || '—')}</div></div><span class="badge ${v.status === 'completed' ? 'bin' : 'bsu'}">${esc(tv(v.status || ''))}</span></div>
      <div>${stepChip(t('nw_step_report'), filed)}${stepChip(t('nw_step_feedback'), !!v.feedback)}${stepChip(t('nw_step_doctor'), !!v.confirmedAt)}${stepChip(`${t('nw_step_pay')}: ${pay}`, v.payout?.status === 'paid')}</div>
      ${!v.doctorId ? role === 'admin' && !v.confirmedAt ? `<form class="mt8" onsubmit="return false"><div class="alt ae">${esc(t('nw_assign_hint'))}</div>
          <div class="pc-actions" style="align-items:center"><label class="sr-only" for="nw-ad-${esc(v.visitId)}">${esc(t('nw_doctor'))}</label><select class="fc" id="nw-ad-${esc(v.visitId)}" required style="max-width:280px">${doctorOptions()}</select>
          <button type="button" class="btn bp bsm" data-assign="${esc(v.visitId)}">${esc(t('nw_assign_doctor'))}</button></div></form>` : `<div class="alt ai mt8">${esc(t('nw_no_doctor'))}</div>` : ''}
      ${v.returnedAt && v.returnedNote ? `<div class="alt ae mt8">${esc(tf('nw_returned', { note: v.returnedNote }))}</div>` : ''}
      ${v.feedback ? `<p class="sm mt8">${esc(tf('nw_your_rating', { stars: stars(v.feedback.rating) }))}${v.feedback.comment ? ' — ' + esc(v.feedback.comment) : ''}</p>` : ''}
      ${v.confirmedAt ? `<p class="mu sm">${esc(tf('nw_confirmed_on', { name: v.confirmedBy || '', date: date(v.confirmedAt) }))}${v.confirmNote ? ' — ' + esc(v.confirmNote) : ''}</p>` : ''}
      ${reportHtml(v.report)}${actions}<div id="nw-vm-${esc(v.visitId)}" class="mt8"></div></div>`;
  }
  const doctorOptions = () => `<option value="">—</option>${DB.users.filter(u => u.role === 'doctor' && u.status === 'active').sort((a, b) => a.name.localeCompare(b.name)).map(d => `<option value="${esc(d.id)}">${esc(d.name)}${d.hospital ? ' · ' + esc(d.hospital) : ''}</option>`).join('')}`;
  function bindVisits(box, visits) {
    const refresh = () => renderVisits($('pgc'));
    const call = async (id, request) => { try { await request(); refresh(); } catch (error) { fail($(`nw-vm-${id}`), error); } };
    box.querySelectorAll('[data-assign]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.assign; call(id, () => apiRequest(`/api/v1/admin/home-visits/${encodeURIComponent(id)}/doctor`, 'POST', { doctorId: $(`nw-ad-${id}`).value })); }));
    box.querySelectorAll('[data-report]').forEach(button => button.addEventListener('click', () => openReport(visits.find(v => v.visitId === button.dataset.report))));
    box.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.feedback, rating = Number(box.querySelector(`input[name="nw-r-${CSS.escape(id)}"]:checked`)?.value || 0);
      if (!rating) return fail($(`nw-vm-${id}`), new Error(t('nw_rate')));
      call(id, () => apiRequest(`/api/v1/home-visits/${encodeURIComponent(id)}/feedback`, 'POST', { rating, comment: $(`nw-fc-${id}`).value.trim() }));
    }));
    box.querySelectorAll('[data-confirm-visit]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.confirmVisit; call(id, () => apiRequest(`/api/v1/home-visits/${encodeURIComponent(id)}/confirm`, 'POST', { note: $(`nw-dn-${id}`).value.trim() })); }));
    box.querySelectorAll('[data-return]').forEach(button => button.addEventListener('click', () => { const id = button.dataset.return; call(id, () => apiRequest(`/api/v1/home-visits/${encodeURIComponent(id)}/return`, 'POST', { note: $(`nw-dn-${id}`).value.trim() })); }));
  }
  function openReport(v) {
    const r = v.report, val = (value, fallback = '') => esc(value === undefined || value === null ? fallback : String(value));
    openMo(`<div class="mh"><div class="mt2">${esc(t('nw_report_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <p class="mu sm">${esc(v.visitDate)} ${esc(v.visitTime || '')} · ${esc(v.patientName || '')}</p>
      ${v.returnedNote && v.returnedAt ? `<div class="alt ae">${esc(tf('nw_returned', { note: v.returnedNote }))}</div>` : ''}
      <h4 class="mb12">${esc(t('nw_vitals'))}</h4>
      <div class="fr">${field('nw-temp', t('nw_temp'), `min="30" max="45" step="0.1" required inputmode="decimal" value="${val(r?.vitals.temperatureC)}"`, 'number')}${field('nw-pulse', t('nw_pulse'), `min="20" max="250" step="1" required value="${val(r?.vitals.pulse)}"`, 'number')}</div>
      <div class="fr">${field('nw-sys', t('nw_sys'), `min="50" max="260" step="1" required value="${val(r?.vitals.systolic)}"`, 'number')}${field('nw-dia', t('nw_dia'), `min="30" max="160" step="1" required value="${val(r?.vitals.diastolic)}"`, 'number')}</div>
      <div class="fr">${field('nw-resp', t('nw_resp'), `min="5" max="80" step="1" value="${val(r?.vitals.respiratoryRate)}"`, 'number')}${field('nw-spo2', t('nw_spo2'), `min="50" max="100" step="1" value="${val(r?.vitals.spo2)}"`, 'number')}</div>
      <div class="fr">${field('nw-weight', t('nw_weight'), `min="0.5" max="400" step="0.1" inputmode="decimal" value="${val(r?.vitals.weightKg)}"`, 'number')}${field('nw-glucose', t('nw_glucose'), `min="1" max="40" step="0.1" inputmode="decimal" value="${val(r?.vitals.glucoseMmol)}"`, 'number')}</div>
      <div class="fg"><label class="fl" for="nw-obs">${esc(t('nw_observations'))}</label><textarea class="fc" id="nw-obs" rows="3" minlength="10" maxlength="4000" required>${val(r?.observations)}</textarea></div>
      <div class="fg"><label class="fl" for="nw-care">${esc(t('nw_care'))}</label><textarea class="fc" id="nw-care" rows="3" minlength="3" maxlength="4000" required>${val(r?.careGiven)}</textarea></div>
      <div class="fg"><label class="fl" for="nw-recs">${esc(t('nw_recs'))}</label><textarea class="fc" id="nw-recs" rows="2" maxlength="4000">${val(r?.recommendations)}</textarea></div>
      <div id="nw-r-msg"></div>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bp" id="nw-r-send">${esc(t('nw_send_report'))}</button></div>`);
    $('nw-r-send').addEventListener('click', async () => {
      const num = id => $(id).value === '' ? undefined : Number($(id).value);
      const vitals = { temperatureC: num('nw-temp'), systolic: num('nw-sys'), diastolic: num('nw-dia'), pulse: num('nw-pulse'), respiratoryRate: num('nw-resp'), spo2: num('nw-spo2'), weightKg: num('nw-weight'), glucoseMmol: num('nw-glucose') };
      Object.keys(vitals).forEach(key => vitals[key] === undefined && delete vitals[key]);
      try {
        await apiRequest(`/api/v1/home-visits/${encodeURIComponent(v.visitId)}/report`, 'POST', { vitals, observations: $('nw-obs').value.trim(), careGiven: $('nw-care').value.trim(), recommendations: $('nw-recs').value.trim() });
        closeMo(); renderVisits($('pgc'));
      } catch (error) { fail($('nw-r-msg'), error); }
    });
  }

  // ───── Nurses: their HFA account (balance, withdrawal from 10 visits) ─────
  const counter = a => {
    const left = Math.max(0, a.minimumVisits - a.availableVisits), percent = Math.min(100, Math.round(a.availableVisits / a.minimumVisits * 100));
    return `<div class="nw-counter"><div class="mu sm">${esc(t('nw_balance'))}</div><div class="nw-balance">${esc(fcfa(a.balance))}</div>
      <div class="sm">${esc(tf('nw_visits_in', { n: a.availableVisits }))}</div>
      <div class="st-progress mt8" role="progressbar" aria-valuemin="0" aria-valuemax="${a.minimumVisits}" aria-valuenow="${Math.min(a.availableVisits, a.minimumVisits)}"><span style="width:${percent}%"></span></div>
      <div class="sm mt8">${esc(a.pending ? tf('nw_pending', { amount: fcfa(a.pending.amount), date: date(a.pending.requestedAt), destination: a.pending.destination }) : left ? tf('nw_progress_to', { n: a.availableVisits, min: a.minimumVisits, left }) : t('nw_can_withdraw'))}</div></div>`;
  };
  async function renderEarnings(pc) {
    $('tbt').textContent = t('nw_earn_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('nw_earn_title'))}</h2><p id="nw-e-intro"></p></div><div id="nw-e"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('nw-e');
    try {
      const a = (await apiRequest('/api/v1/nurse/account')).data;
      if (!box.isConnected) return;
      $('nw-e-intro').textContent = tf('nw_earn_intro', { amount: fcfa(a.payPerVisit), min: a.minimumVisits });
      const declined = a.withdrawals.find(item => item.status === 'declined' && !a.withdrawals.some(other => other.status !== 'declined' && other.requestedAt > item.requestedAt));
      const history = [
        ...a.credits.map(c => ({ at: c.dueAt, text: tf('nw_credit_line', { patient: c.patientName || '—' }) + (c.visitDate ? ` (${c.visitDate})` : ''), amount: `+${fcfa(c.amount)}`, status: c.status })),
        ...a.withdrawals.map(w => ({ at: w.requestedAt, text: tf('nw_withdraw_line', { method: t('nw_m_' + w.method) }) + ` · ${w.destination}${w.reference ? ` · ${t('nw_reference')}: ${w.reference}` : ''}${w.note ? ` · ${w.note}` : ''}`, amount: `−${fcfa(w.amount)}`, status: w.status }))
      ].sort((x, y) => String(y.at).localeCompare(String(x.at)));
      box.innerHTML = `<div class="card mb18">${counter(a)}
          ${declined ? `<div class="alt ae mt8">${esc(tf('nw_declined_note', { date: date(declined.decidedAt), note: declined.note || '' }))}</div>` : ''}
          ${a.canWithdraw ? `<form class="mt18" id="nw-wd" onsubmit="return false"><div class="fr"><div class="fg"><label class="fl" for="nw-wd-method">${esc(t('nw_withdraw_how'))}</label><select class="fc" id="nw-wd-method">${options('nw_m_', ['mobile_money', 'bank_transfer'])}</select></div>
              <div class="fg"><label class="fl" for="nw-wd-to" id="nw-wd-label">${esc(t('nw_to_mm'))}</label><input class="fc" id="nw-wd-to" data-v="phone" maxlength="200" required value="${esc(CU.phone || '')}"></div></div>
              <div id="nw-wd-msg"></div><button type="button" class="btn bp" id="nw-wd-send" data-confirm="${esc(tf('nw_confirm_withdraw', { amount: fcfa(a.balance) }))}">${esc(tf('nw_withdraw', { amount: fcfa(a.balance) }))}</button></form>` : ''}</div>
        <div class="stats"><div class="sc ce"><div class="sv">${esc(fcfa(a.totalEarned))}</div><div class="sl">${esc(t('nw_total_earned'))}</div></div><div class="sc cb"><div class="sv">${esc(fcfa(a.totalPaid))}</div><div class="sl">${esc(t('nw_total_paid'))}</div></div></div>
        <div class="card"><div class="ch"><div class="ct">${esc(t('nw_history'))}</div></div>${history.length ? `<div class="tw"><table><tbody>${history.map(item => `<tr><td class="sm mu" style="white-space:nowrap">${esc(date(item.at))}</td><td class="sm">${esc(item.text)}</td><td class="sm bo" style="white-space:nowrap">${esc(item.amount)}</td><td>${badge(item.status)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mu sm">${esc(t('nw_no_payouts'))}</p>`}</div>`;
      const method = $('nw-wd-method');
      method?.addEventListener('change', () => {
        const to = $('nw-wd-to'), bank = method.value === 'bank_transfer';
        $('nw-wd-label').textContent = t(bank ? 'nw_to_bank' : 'nw_to_mm');
        if (bank) { to.removeAttribute('data-v'); to.setAttribute('minlength', '10'); to.value = ''; } else { to.setAttribute('data-v', 'phone'); to.removeAttribute('minlength'); to.value = CU.phone || ''; }
      });
      $('nw-wd-send')?.addEventListener('click', async () => {
        try { await apiRequest('/api/v1/nurse/withdrawals', 'POST', { method: method.value, destination: $('nw-wd-to').value.trim() }); renderEarnings($('pgc')); }
        catch (error) { fail($('nw-wd-msg'), error); }
      });
    } catch (error) { fail(box, error); }
  }

  // ───── Administrators: withdrawal requests ─────
  async function renderPayouts(pc) {
    $('tbt').textContent = t('nw_pay_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('nw_pay_title'))}</h2><p>${esc(t('nw_pay_intro'))}</p></div><div id="nw-p"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('nw-p');
    try {
      const data = (await apiRequest('/api/v1/admin/nurse-withdrawals')).data;
      if (!box.isConnected) return;
      box.innerHTML = `<div class="stats"><div class="sc cg"><div class="sv">${esc(fcfa(data.requested))}</div><div class="sl">${esc(t('nw_requested_total'))}</div></div><div class="sc cb"><div class="sv">${esc(fcfa(data.credited))}</div><div class="sl">${esc(tf('nw_credited_total', { n: data.creditedVisits }))}</div></div></div>
        <div class="card">${data.withdrawals.length ? `<div class="tw"><table><thead><tr><th>${esc(t('nw_nurse'))}</th><th>${esc(t('nw_amount'))}</th><th>${esc(t('nw_destination'))}</th><th>${t('status')}</th></tr></thead><tbody>${data.withdrawals.map(w => `<tr>
          <td class="sm"><strong>${esc(w.nurseName || '')}</strong><div class="mu sm">${esc(date(w.requestedAt))}</div></td>
          <td class="sm"><strong>${esc(fcfa(w.amount))}</strong><div class="mu sm">${esc(tf('nw_visits_n', { n: w.visits }))}</div></td>
          <td class="sm">${esc(t('nw_m_' + w.method))}<div>${esc(w.destination)}</div></td>
          <td>${badge(w.status)}${w.status === 'paid' ? `<div class="mu sm">${esc(w.reference || '')} · ${esc(date(w.decidedAt))}${w.decidedBy ? ' · ' + esc(w.decidedBy) : ''}</div>` : w.status === 'declined' ? `<div class="mu sm">${esc(w.note || '')}</div>` : `
            <form class="pc-actions" style="margin:6px 0 0;flex-wrap:wrap" onsubmit="return false"><label class="sr-only" for="nw-ref-${esc(w.id)}">${esc(t('nw_reference'))}</label><input class="fc" id="nw-ref-${esc(w.id)}" placeholder="${esc(t('nw_reference'))}" minlength="3" maxlength="80" required style="max-width:200px">
              <button type="button" class="btn bp bsm" data-paid="${esc(w.id)}" data-confirm="${esc(t('nw_confirm_paid'))}">${esc(t('nw_mark_paid'))}</button></form>
            <form class="pc-actions" style="margin:6px 0 0;flex-wrap:wrap" onsubmit="return false"><label class="sr-only" for="nw-dec-${esc(w.id)}">${esc(t('nw_decline_note'))}</label><input class="fc" id="nw-dec-${esc(w.id)}" placeholder="${esc(t('nw_decline_note'))}" minlength="5" maxlength="500" required style="max-width:200px">
              <button type="button" class="btn bd2 bsm" data-decline="${esc(w.id)}" data-confirm="${esc(t('nw_confirm_decline'))}">${esc(t('nw_decline'))}</button></form><div id="nw-pmsg-${esc(w.id)}"></div>`}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mu sm">${esc(t('nw_no_withdrawals'))}</p>`}</div>`;
      const act = async (id, path, body) => { try { await apiRequest(`/api/v1/admin/nurse-withdrawals/${encodeURIComponent(id)}/${path}`, 'POST', body); renderPayouts($('pgc')); } catch (error) { fail($(`nw-pmsg-${id}`), error); } };
      box.querySelectorAll('[data-paid]').forEach(button => button.addEventListener('click', () => act(button.dataset.paid, 'paid', { reference: $(`nw-ref-${button.dataset.paid}`).value.trim() })));
      box.querySelectorAll('[data-decline]').forEach(button => button.addEventListener('click', () => act(button.dataset.decline, 'decline', { note: $(`nw-dec-${button.dataset.decline}`).value.trim() })));
    } catch (error) { fail(box, error); }
  }

  // ───── Patients booking a home visit: nurses' working hours ─────
  let roster = null;
  function hoursHint() {
    const box = $('nw-hours'), nurse = G($('hv-nurse')?.value), visitDate = $('hv-date')?.value;
    if (!box || !nurse || !roster || !visitDate) return;
    const entry = roster[nurse.id], day = WEEKDAY[new Date(`${visitDate}T00:00:00`).getDay()], slots = entry?.slots?.[day] || [];
    box.className = `alt ${slots.length ? 'ai' : 'ae'} mt8`;
    box.textContent = slots.length ? tf('nw_hours_on', { name: nurse.name, day: t('nw_day_' + day), hours: slots.map(s => `${s.start}–${s.end}`).join(', ') }) : tf('nw_hours_none', { name: nurse.name, day: t('nw_day_' + day) });
  }
  function fits(nurseId, visitDate, visitTime) {
    const entry = roster?.[nurseId]; if (!entry) return true;
    if (entry.status !== 'current') return false;
    const day = WEEKDAY[new Date(`${visitDate}T00:00:00`).getDay()];
    return (entry.slots?.[day] || []).some(s => s.start <= visitTime && visitTime < s.end);
  }
  wrap('scheduleHomeVisit', original => {
    original();
    if (!online() || !$('hv-nurse')) return;
    $('hv-date')?.closest('.fr')?.insertAdjacentHTML('afterend', '<div id="nw-hours" role="status"></div>');
    apiRequest('/api/v1/nurses/availability').then(({ data }) => {
      roster = Object.fromEntries(data.nurses.map(item => [item.nurseId, item]));
      const select = $('hv-nurse'); if (!select) return;
      [...select.options].forEach(option => { if (roster[option.value]?.status !== 'current') { option.disabled = true; option.textContent += ` (${t('nw_stale')})`; } });
      if (select.selectedOptions[0]?.disabled) { const first = [...select.options].find(option => !option.disabled); if (first) select.value = first.value; }
      ['hv-nurse', 'hv-date'].forEach(id => $(id)?.addEventListener('change', hoursHint));
      if (typeof renderHomeVisitFee === 'function') renderHomeVisitFee();
      hoursHint();
    }).catch(() => {});
  });
  wrap('confirmHomeVisitBooking', (original, ...args) => {
    const nurseId = $('hv-nurse')?.value, visitDate = $('hv-date')?.value, visitTime = $('hv-time')?.value;
    if (online() && roster && nurseId && visitDate && visitTime && !fits(nurseId, visitDate, visitTime)) { const status = $('hv-status'); if (status) status.textContent = t('nw_outside'); hoursHint(); return; }
    return original(...args);
  });

  document.head.insertAdjacentHTML('beforeend', '<style>.nw-balance{font-size:2rem;font-weight:800;color:var(--em);line-height:1.2}</style>');
  installRegistrationFields();
  window.HFANurses = { handles, renderPage, openVerification, application, adminFields: () => ({ licenseNo: ($('au-ni')?.value || '').trim(), qualifications: ($('au-qu')?.value || '').trim(), nurseApplication: application('au') }) };
})();
