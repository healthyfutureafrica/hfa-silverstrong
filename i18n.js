// French for the whole interface.
// 1. Interface strings for static HTML marked with data-i18n / data-i18n-html / data-i18n-ph / data-i18n-aria / data-i18n-title.
// 2. VALUE_FR: French labels for values stored in English in the database (specialties, departments, statuses,
//    roles, services…). Stored values never change — only how they are displayed — so data stays consistent.
// Loaded after index.html's main script; tv() in index.html reads VALUE_FR.
(function () {
  Object.assign(T.en, {
    month: 'month', at: 'at', free: 'Free',
    i_public_nav: 'Public site navigation', i_fh_nav: 'Free Health Hub navigation',
    i_hero_title: 'Advanced <span>Telehealth</span><br>for Every Patient',
    i_hero_text: 'Connecting patients, nurses, and doctors across Africa with encrypted video consultations, real-time messaging, and comprehensive care management — all in one secure platform.',
    i_get_started: 'Get Started →', i_access_portal: 'Access Portal →', i_access_panel: 'Access Panel →',
    i_auth_tagline: 'Healthcare Telehealth Platform',
    i_auth_f1: 'Secure video & text consultations', i_auth_f2: 'Role-based portals for all users', i_auth_f3: 'Real-time patient-doctor communication',
    i_auth_f4: 'Full admin audit trail & control', i_auth_f5: 'Add, suspend, or remove any user',
    i_login_ph: 'your@email.com / +237 6XX XX XX XX', i_email_ph: 'your@email.com', i_email_example: 'email@example.com',
    i_toggle_pw: 'Show or hide the password', i_full_legal_name_ph: 'Full legal name', i_institution_ph: 'Institution name', i_institution: 'Institution',
    i_nursing_specialty: 'Nursing Specialty', i_dept_ph: 'e.g. Emergency Care',
    i_contact_name: 'Contact name', i_physician: 'Physician', i_you: 'You',
    i_toggle_mic: 'Turn the microphone on or off', i_toggle_cam: 'Turn the camera on or off', i_end_call: 'End call', i_toggle_speaker: 'Turn the speaker on or off',
    i_select_fee: 'Select fee...', i_select_patient: 'Select patient...', i_select_doctor: 'Select doctor...',
    i_consultation_mode: 'Consultation Mode', i_video: '📹 Video', i_voice: '📞 Voice',
    i_email_in_use: 'Email already in use.', i_fill_required: 'Please fill all required fields.', i_reschedule_failed: 'Rescheduling payment failed',
    i_rated: 'Rated {n} out of 5 stars', i_not_rated: 'Not yet rated', i_stars: '{n} stars', i_star: '1 star',
    i_referral_illness_ph: 'e.g. chest pain, abnormal ECG, skin lesion',
    i_referral_reason_ph: 'Clinical findings, suspected illness, and why specialist care is needed...',
    i_report_summary_ph: 'e.g. Hypertension follow-up, diabetes review, cardiology concern',
    i_lab_test_ph: 'CBC, malaria test, lipid panel, X-ray report...',
    i_recent_care_notes: 'Recent Care Notes',
    i_consent_records: '{n} active telehealth consent record(s).', i_verified_records: '{n} verified provider credential record(s).',
    i_open_alerts: '{n} open allergy or medication review alert(s).', i_triage_requests: '{n} active triage request(s).',
    i_config_status: 'Configuration status: {status}.', i_env_status: 'Environment: {env} · Status: {status}', i_status_recorded: 'Status: {status} · Recorded {date}',
    i_chip_consent: 'CONSENT', i_chip_verify: 'VERIFY', i_chip_med_safe: 'MED SAFE',
    i_manage_all: 'Manage all {what} on the platform', i_years: '{n} yr', i_how_experience: 'How was your experience with this {role}?',
    i_add_doctor: 'Add a new doctor', i_add_nurse: 'Add a new nurse', i_add_patient: 'Add a new patient', i_add_admin: 'Add a new administrator',
    i_sidebar_nav: 'Application sidebar navigation', i_menu: 'Menu', i_copyright: 'Copyright',
    i_triage_emergency: 'Call your local emergency number now. Your triage request has been recorded for the care team.',
    i_triage_received: 'Your triage request has been received. A care team member will review it.'
  });
  Object.assign(T.fr, {
    month: 'mois', at: 'à', free: 'Gratuit',
    email_lbl: 'E-mail', pc_email: 'E-mail', super_admin_role: 'Super administrateur', super_admin_badge: 'Super administrateur', subscription_plan: 'Formule',
    i_public_nav: 'Navigation du site public', i_fh_nav: 'Navigation de l’Espace Santé Gratuit',
    i_hero_title: 'Une <span>télésanté</span> de pointe<br>pour chaque patient',
    i_hero_text: 'Nous relions patients, infirmiers et médecins à travers l’Afrique grâce à des consultations vidéo chiffrées, une messagerie en temps réel et une gestion complète des soins — le tout sur une seule plateforme sécurisée.',
    i_get_started: 'Commencer →', i_access_portal: 'Accéder au portail →', i_access_panel: 'Accéder au panneau →',
    i_auth_tagline: 'Plateforme de télésanté',
    i_auth_f1: 'Consultations vidéo et écrites sécurisées', i_auth_f2: 'Un portail adapté à chaque rôle', i_auth_f3: 'Communication patient-médecin en temps réel',
    i_auth_f4: 'Traçabilité et contrôle administratifs complets', i_auth_f5: 'Ajouter, suspendre ou retirer tout utilisateur',
    i_login_ph: 'votre@email.com / +237 6XX XX XX XX', i_email_ph: 'votre@email.com', i_email_example: 'email@exemple.com',
    i_toggle_pw: 'Afficher ou masquer le mot de passe', i_full_legal_name_ph: 'Nom légal complet', i_institution_ph: 'Nom de l’établissement', i_institution: 'Établissement',
    i_nursing_specialty: 'Spécialité infirmière', i_dept_ph: 'ex. Soins d’urgence',
    i_contact_name: 'Nom du contact', i_physician: 'Médecin', i_you: 'Vous',
    i_toggle_mic: 'Activer ou couper le micro', i_toggle_cam: 'Activer ou couper la caméra', i_end_call: 'Raccrocher', i_toggle_speaker: 'Activer ou couper le haut-parleur',
    i_select_fee: 'Choisir les frais...', i_select_patient: 'Choisir un patient...', i_select_doctor: 'Choisir un médecin...',
    i_consultation_mode: 'Mode de consultation', i_video: '📹 Vidéo', i_voice: '📞 Voix',
    i_email_in_use: 'Cette adresse e-mail est déjà utilisée.', i_fill_required: 'Veuillez remplir tous les champs obligatoires.', i_reschedule_failed: 'Le paiement du report a échoué',
    i_rated: 'Noté {n} sur 5 étoiles', i_not_rated: 'Pas encore noté', i_stars: '{n} étoiles', i_star: '1 étoile',
    i_referral_illness_ph: 'ex. douleur thoracique, ECG anormal, lésion cutanée',
    i_referral_reason_ph: 'Constatations cliniques, maladie suspectée et raisons pour lesquelles un avis spécialisé est nécessaire...',
    i_report_summary_ph: 'ex. suivi d’hypertension, bilan du diabète, problème cardiaque',
    i_lab_test_ph: 'NFS, test du paludisme, bilan lipidique, compte rendu de radiographie...',
    i_recent_care_notes: 'Notes de soins récentes',
    i_consent_records: '{n} consentement(s) de télésanté actif(s).', i_verified_records: '{n} qualification(s) de prestataire vérifiée(s).',
    i_open_alerts: '{n} alerte(s) d’allergie ou de revue médicamenteuse en cours.', i_triage_requests: '{n} demande(s) de triage en cours.',
    i_config_status: 'État de la configuration : {status}.', i_env_status: 'Environnement : {env} · Statut : {status}', i_status_recorded: 'Statut : {status} · Enregistré le {date}',
    i_chip_consent: 'CONSENTEMENT', i_chip_verify: 'VÉRIFICATION', i_chip_med_safe: 'SÉCURITÉ MÉD.',
    i_manage_all: 'Gérer tous les {what} de la plateforme', i_years: '{n} ans', i_how_experience: 'Comment s’est passée votre expérience avec ce {role} ?',
    i_add_doctor: 'Ajouter un médecin', i_add_nurse: 'Ajouter un(e) infirmier(e)', i_add_patient: 'Ajouter un patient', i_add_admin: 'Ajouter un administrateur',
    department: 'Service', pc_department: 'Service',
    i_sidebar_nav: 'Navigation latérale de l’application', i_menu: 'Menu', i_copyright: 'Droits d’auteur',
    i_triage_emergency: 'Appelez immédiatement votre numéro d’urgence local. Votre demande de triage a été transmise à l’équipe soignante.',
    i_triage_received: 'Votre demande de triage a bien été reçue. Un membre de l’équipe soignante va l’examiner.',
    // Clearer French for existing strings
    admin_dashboard: 'Tableau de bord administrateur', open_chat: 'Ouvrir la discussion', start_text: 'Démarrer la discussion', add_admin: 'Ajouter un administrateur',
    super_admin_only_msg: 'Seul un super administrateur peut effectuer cette action sur un compte administrateur.',
    admin_pending_note: 'Les comptes administrateurs créés par un super administrateur sont actifs immédiatement. Ceux créés par d’autres administrateurs doivent être validés par un super administrateur avant de pouvoir se connecter.',
    admin_pending_review_msg: 'Compte administrateur soumis. Il restera inactif jusqu’à sa validation par un super administrateur.',
    super_admin_protect_msg: 'Le compte du super administrateur ne peut être ni modifié, ni suspendu, ni supprimé par un autre administrateur.',
    feature_unlimited_chat: 'Discussion illimitée avec médecins et infirmiers',
    basic_tier_desc: 'Accès complet : messages, appels et discussions avec médecins et infirmiers'
  });

  // French labels for values stored in English.
  window.VALUE_FR = {
    // Medical specialties
    'General Medicine': 'Médecine générale', 'Family Medicine': 'Médecine familiale', 'Internal Medicine': 'Médecine interne', 'Emergency Medicine': 'Médecine d’urgence',
    'Cardiology': 'Cardiologie', 'Endocrinology': 'Endocrinologie', 'Gastroenterology': 'Gastro-entérologie', 'Nephrology': 'Néphrologie', 'Neurology': 'Neurologie',
    'Oncology': 'Oncologie', 'Pediatrics': 'Pédiatrie', 'Geriatrics': 'Gériatrie', 'Obstetrics and Gynecology': 'Gynécologie-obstétrique', 'Dermatology': 'Dermatologie',
    'Ophthalmology': 'Ophtalmologie', 'Otolaryngology (ENT)': 'Oto-rhino-laryngologie (ORL)', 'Orthopedics': 'Orthopédie', 'Urology': 'Urologie',
    'General Surgery': 'Chirurgie générale', 'Anesthesiology': 'Anesthésiologie', 'Radiology': 'Radiologie', 'Pathology': 'Anatomopathologie',
    'Infectious Disease': 'Maladies infectieuses', 'Pulmonology': 'Pneumologie', 'Rheumatology': 'Rhumatologie', 'Physiotherapy': 'Kinésithérapie',
    'Physical Medicine and Rehabilitation': 'Médecine physique et de réadaptation', 'Psychiatry': 'Psychiatrie', 'Mental Health': 'Santé mentale',
    'Clinical Psychology': 'Psychologie clinique', 'Counseling Psychology': 'Psychologie du conseil', 'Behavioral Health': 'Santé comportementale',
    'Psychotherapy': 'Psychothérapie', 'Public Health': 'Santé publique',
    // Nursing specialties
    'General Nursing': 'Soins infirmiers généraux', 'Critical Care Nursing': 'Soins infirmiers critiques', 'Emergency Nursing': 'Soins infirmiers d’urgence',
    'Pediatric Nursing': 'Soins infirmiers pédiatriques', 'Neonatal Nursing': 'Soins infirmiers néonatals', 'Oncology Nursing': 'Soins infirmiers en oncologie',
    'Surgical and Perioperative Nursing': 'Soins infirmiers chirurgicaux et périopératoires', 'Maternal and Midwifery Care': 'Soins maternels et obstétricaux',
    'Psychiatric and Mental Health Nursing': 'Soins infirmiers en psychiatrie et santé mentale', 'Community and Public Health Nursing': 'Soins infirmiers communautaires et de santé publique',
    'Geriatric Nursing': 'Soins infirmiers gériatriques', 'Renal Nursing': 'Soins infirmiers en néphrologie', 'Cardiac Nursing': 'Soins infirmiers en cardiologie',
    'Infection Prevention and Control': 'Prévention et contrôle des infections', 'Nurse Anesthesia': 'Infirmier anesthésiste', 'Rehabilitation Nursing': 'Soins infirmiers de réadaptation',
    'Occupational Health Nursing': 'Soins infirmiers en santé au travail',
    // Departments
    'Emergency Care': 'Soins d’urgence', 'ICU': 'Réanimation', 'General Ward': 'Salle générale', 'Operating Room': 'Bloc opératoire', 'Outpatient': 'Consultation externe', 'Maternity': 'Maternité',
    // Gender
    'Male': 'Homme', 'Female': 'Femme', 'Other': 'Autre', 'Prefer not to say': 'Je préfère ne pas répondre',
    // Statuses and priorities
    'active': 'actif', 'suspended': 'suspendu', 'pending_approval': 'en attente de validation', 'rejected': 'refusé', 'deleted': 'supprimé',
    'scheduled': 'planifié', 'completed': 'terminé', 'cancelled': 'annulé', 'open': 'ouvert', 'resolved': 'résolu', 'closed': 'clôturé',
    'connected': 'connecté', 'configuration required': 'configuration requise', 'manual handoff': 'transfert manuel', 'review': 'à revoir', 'critical': 'critique',
    'emergency': 'urgence vitale', 'urgent': 'urgent', 'routine': 'courant', 'verified': 'vérifié', 'pending': 'en attente', 'demo': 'démonstration',
    'success': 'réussi', 'failed': 'échoué', 'paid': 'payé', 'unpaid': 'non payé',
    // Roles
    'doctor': 'médecin', 'nurse': 'infirmier(e)', 'patient': 'patient', 'admin': 'administrateur', 'labtech': 'technicien de laboratoire', 'pharmacist': 'pharmacien',
    'Super Admin': 'Super administrateur', 'Administrator': 'Administrateur', 'Platform Owner': 'Propriétaire de la plateforme', 'Clinical Operations': 'Opérations cliniques',
    'Compliance Officer': 'Responsable de la conformité', 'Support Administrator': 'Administrateur du support',
    // Virtual services
    'Virtual primary care': 'Soins primaires à distance', 'General consultations, follow-ups, and preventive care.': 'Consultations générales, suivis et soins préventifs.',
    'Virtual mental health': 'Santé mentale à distance', 'Confidential support with a mental health specialist.': 'Accompagnement confidentiel par un spécialiste de la santé mentale.',
    'Virtual physiotherapy': 'Kinésithérapie à distance', 'Guided rehabilitation, mobility, and exercise planning.': 'Rééducation guidée, mobilité et programme d’exercices.',
    'Virtual cardiology': 'Cardiologie à distance', 'Remote heart-health review and care planning.': 'Bilan cardiaque à distance et plan de soins.',
    'Medication review': 'Revue des médicaments', 'Review medicines, adherence, and possible concerns.': 'Revue des médicaments, de l’observance et des éventuels problèmes.',
    'Virtual nutrition': 'Nutrition à distance', 'Personalized nutrition guidance for ongoing care.': 'Conseils nutritionnels personnalisés pour le suivi.',
    'Lab result review': 'Revue des résultats d’analyses', 'Discuss results and agree on next clinical steps.': 'Discuter des résultats et convenir des prochaines étapes cliniques.',
    'Urgent virtual triage': 'Triage urgent à distance', 'Prompt assessment to direct non-life-threatening concerns.': 'Évaluation rapide pour orienter les problèmes sans danger vital.',
    'Doctor or Nurse': 'Médecin ou infirmier(e)', 'Mental health specialist': 'Spécialiste de la santé mentale', 'Physiotherapist': 'Kinésithérapeute',
    'Cardiologist': 'Cardiologue', 'Care specialist': 'Spécialiste des soins',
    // Appointment types
    'consultation': 'consultation', 'follow-up': 'suivi',
    // Audit and notification resources
    'User Management': 'Gestion des utilisateurs', 'System': 'Système', 'Consultations': 'Consultations', 'Appointments': 'Rendez-vous',
    'Medical Records': 'Dossiers médicaux', 'Lab Results': 'Résultats d’analyses', 'Urgent Care': 'Soins urgents', 'Care Coordination': 'Coordination des soins',
    'Billing': 'Facturation', 'Account': 'Compte', 'Profile Photos': 'Photos de profil', 'Identity Verification': 'Vérification d’identité', 'Healthcare': 'Soins de santé',
    'Communications': 'Communications', 'Clinical Safety': 'Sécurité clinique', 'Care Team': 'Équipe soignante', 'Care Notes': 'Notes de soins', 'Home Visits': 'Visites à domicile',
    // System records
    'Telehealth and data sharing': 'Télésanté et partage de données', 'Terms and Conditions': 'Conditions générales',
    'Penicillin allergy recorded; verify medication allergies before prescribing.': 'Allergie à la pénicilline enregistrée ; vérifiez les allergies médicamenteuses avant de prescrire.',
    'Clinical data exchange': 'Échange de données cliniques', 'Terminology service': 'Service de terminologie',
    'ICD-10-CM, SNOMED CT, LOINC, RxNorm validation': 'Validation CIM-10-CM, SNOMED CT, LOINC, RxNorm',
    'Emergency dispatch': 'Régulation des urgences', 'Local emergency escalation': 'Transfert vers les urgences locales',
    'None': 'Aucune', 'Unknown': 'Inconnu', 'requested': 'demandée',
    // Messages from the server
    'Invalid email or password': 'E-mail, numéro de téléphone ou mot de passe incorrect',
    'Email already registered': 'Cette adresse e-mail a déjà un compte',
    'Phone number already registered': 'Ce numéro de téléphone a déjà un compte',
    'Email or phone already registered': 'Cette adresse e-mail ou ce numéro de téléphone a déjà un compte',
    'Account is not active; administrator review may be required': 'Ce compte n’est pas actif ; une validation par un administrateur peut être nécessaire',
    'Sign in required': 'Veuillez vous connecter',
    'Administrator required': 'Réservé aux administrateurs',
    'Invalid request origin': 'Origine de la requête non valide',
    'Backend request failed': 'La requête au serveur a échoué',
    'Invalid request body': 'Requête non valide',
    'Encrypted document storage is not configured': 'Le stockage chiffré des documents n’est pas configuré',
    'Encrypted health record storage is not configured': 'Le stockage chiffré des dossiers de santé n’est pas configuré',
    'Encrypted file storage is not configured': 'Le stockage chiffré des fichiers n’est pas configuré',
    'Administrator provisions laboratory staff': 'Le personnel de laboratoire est créé par un administrateur',
    'Too many requests, please try again later.': 'Trop de tentatives, veuillez réessayer plus tard.',
    'hospitalId: Choose a hospital from the list': 'Choisissez un hôpital dans la liste',
    'Only the patient can update this health profile': 'Seul le patient peut modifier ce profil de santé',
    'You can only change your own profile picture': 'Vous ne pouvez modifier que votre propre photo de profil',
    'Only JPG, PNG or WebP photos are accepted': 'Seules les photos JPG, PNG ou WebP sont acceptées',
    'The photo could not be read': 'La photo n’a pas pu être lue',
    'Only PDF, PNG, JPEG and WebP files are accepted': 'Seuls les fichiers PDF, PNG, JPEG et WebP sont acceptés',
    'Account file storage limit reached': 'Limite de stockage de fichiers du compte atteinte',
    'Pharmacy credentials or registration documents are incomplete': 'Les qualifications ou documents d’enregistrement de la pharmacie sont incomplets',
    'Confirm original pharmacy credentials were reviewed before activation': 'Confirmez que les qualifications originales de la pharmacie ont été vérifiées avant l’activation',
    // Offline files and settings
    'Close other app tabs and try again': 'Fermez les autres onglets de l’application et réessayez',
    'Storage operation failed': 'L’opération de stockage a échoué',
    'Wait for synchronization to finish': 'Attendez la fin de la synchronisation',
    'Sign in to save files on this device': 'Connectez-vous pour enregistrer des fichiers sur cet appareil',
    'Select between 1 and 20 files': 'Sélectionnez entre 1 et 20 fichiers',
    'Offline storage limit reached (50 MB or 100 pending files)': 'Limite de stockage hors ligne atteinte (50 Mo ou 100 fichiers en attente)',
    'Each file must be between 1 byte and 5 MB': 'Chaque fichier doit faire entre 1 octet et 5 Mo',
    'File name is too long or invalid': 'Le nom du fichier est trop long ou invalide',
    'Signed out before files could be saved': 'Déconnexion avant l’enregistrement des fichiers',
    'Sign in to the account that saved this file': 'Connectez-vous au compte qui a enregistré ce fichier',
    'Invalid upload receipt': 'Accusé de téléversement non valide',
    'Encrypted offline files need HTTPS or localhost and a supported browser': 'Les fichiers hors ligne chiffrés nécessitent HTTPS (ou localhost) et un navigateur compatible',
    'Country preference could not be saved': 'La préférence de pays n’a pas pu être enregistrée',
    // Notification text sent by the server (it stores the English original)
    'HFA SilverStrong: New activity on your account needs your attention. Sign in securely to review it. This is an automated notification. Do not reply.':
      'HFA SilverStrong : une nouvelle activité sur votre compte requiert votre attention. Connectez-vous en toute sécurité pour la consulter. Ceci est une notification automatique, merci de ne pas y répondre.'
  };

  // Static HTML: translate every element marked with a data-i18n* attribute.
  function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(element => { element.innerHTML = t(element.dataset.i18nHtml); }); // trusted strings from T only
    root.querySelectorAll('[data-i18n-ph]').forEach(element => { element.placeholder = t(element.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    root.querySelectorAll('[data-i18n-title]').forEach(element => { element.title = t(element.dataset.i18nTitle); });
    // Option lists whose values are stored in English (specialties, departments…).
    root.querySelectorAll('select[data-i18n-values] option[value]').forEach(option => { if (option.value) option.textContent = tv(option.value); });
  }
  window.applyI18n = applyI18n;

  const original = window.updateStaticHTML;
  if (typeof original === 'function') {
    window.updateStaticHTML = function () {
      const result = original.apply(this, arguments);
      applyI18n();
      if (typeof HFATheme !== 'undefined') HFATheme.apply();
      return result;
    };
  }
  applyI18n();
})();
