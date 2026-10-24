// Patient Portal — multi-step registration & onboarding (5 steps, progress saved on the device).
// Also reused, without the account fields, as "Complete my profile" for signed-in patients.
// Loaded after index.html's main script and hfa-ui.js; uses their globals.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const DRAFT_KEY = 'hfa-patient-registration-draft';
  const MAX_DOCUMENT = 2 * 1024 * 1024; // matches the server limit for registration documents
  const DOCUMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

  Object.assign(T.en, {
    wz_title: 'Create your patient account', wz_complete_title: 'My health profile',
    wz_step: 'Step {n} of 5', wz_s1: 'Personal identity', wz_s2: 'Contact & location', wz_s3: 'Medical identity', wz_s4: 'Lifestyle & social', wz_s5: 'Consent & preferences',
    wz_saved_note: 'Your answers are saved on this device until you finish. Your password and documents are not saved — you will choose them again if you leave.',
    wz_start_over: 'Start over', wz_start_over_confirm: 'Clear everything you have entered and start again?',
    wz_next: 'Continue', wz_back: 'Back', wz_submit: 'Create my account', wz_save: 'Save my health profile', wz_submitting: 'Creating your account…', wz_saving: 'Saving…',
    wz_fix: 'Please correct the highlighted fields.', wz_required: 'This field is required', wz_optional: 'optional',
    wz_full_name: 'Full legal name', wz_full_name_hint: 'Exactly as written on your CNI or passport', wz_name_invalid: 'Use letters, spaces, apostrophes, dots or hyphens only',
    wz_dob: 'Date of birth', wz_age: 'Age: {age} years', wz_dob_future: 'The date of birth cannot be in the future', wz_dob_invalid: 'Enter a valid date of birth',
    wz_gender: 'Gender', wz_male: 'Male', wz_female: 'Female', wz_undisclosed: 'Prefer not to say',
    wz_cni: 'CNI number (Carte Nationale d’Identité)', wz_cni_hint: 'Optional — lets us look up your insurance', wz_cni_invalid: 'Use letters and numbers only',
    wz_photo: 'Profile picture', wz_photo_add: 'Add a photo', wz_photo_change: 'Change photo', wz_photo_hint: 'Optional — helps your care team recognise you',
    wz_language: 'Preferred language', wz_id_type: 'ID document type', wz_id_file: 'Photo or scan of your CNI or passport', wz_id_hint: 'JPG, PNG, WebP or PDF, up to 2 MB. Reviewed by our team.',
    wz_id_on_file: 'Your ID document is already on file.',
    wz_phone: 'Primary phone number', wz_phone_hint: 'You can sign in with this number. Example: +237 6XX XX XX XX', wz_phone_invalid: 'Enter a valid number, e.g. +237 677 12 34 56',
    wz_is_whatsapp: 'Is this your WhatsApp number?', wz_phone2: 'Secondary phone number', wz_email: 'Email address', wz_email_hint: 'Optional — many patients do not have one', wz_email_invalid: 'Enter a valid email address',
    wz_password: 'Password', wz_password_hint: 'At least 12 characters', wz_password_short: 'Use at least 12 characters', wz_password2: 'Confirm password', wz_password_mismatch: 'The passwords do not match',
    wz_region: 'Region', wz_division: 'Division (département)', wz_choose_region_first: 'Choose your region first', wz_town: 'Town / village', wz_district: 'Nearest health district', wz_district_hint: 'Name of the health district where you usually get care',
    wz_gps: 'Your location', wz_gps_ask: 'Allow HFA to know your location for finding nearby doctors and pharmacies?', wz_gps_allow: 'Yes, use my location', wz_gps_saved: 'Location saved: {lat}, {lng} (±{acc} m)', wz_gps_remove: 'Remove location',
    wz_gps_denied: 'Location permission was refused. You can continue without it.', wz_gps_failed: 'Your location could not be found. You can continue without it.', wz_gps_unsupported: 'This device cannot share its location.', wz_gps_finding: 'Finding your location…',
    wz_settlement: 'Area type', wz_urban: 'Urban', wz_peri_urban: 'Peri-urban', wz_rural: 'Rural',
    wz_blood: 'Blood group', wz_genotype: 'Genotype', wz_unknown: 'I don’t know',
    wz_conditions: 'Known chronic conditions', wz_other_condition: 'Other condition', wz_other_condition_required: 'Describe the other condition',
    wz_drug_allergies: 'Drug allergies', wz_drug: 'Medicine', wz_severity: 'Severity', wz_mild: 'Mild', wz_moderate: 'Moderate', wz_severe: 'Severe', wz_anaphylaxis: 'Anaphylaxis', wz_add_drug_allergy: 'Add a drug allergy',
    wz_food_allergies: 'Food allergies', wz_env_allergies: 'Environmental allergies (dust, pollen…)', wz_none_hint: 'Leave empty if none',
    wz_medications: 'Current regular medications', wz_med_name: 'Medicine', wz_med_dose: 'Dose', wz_med_frequency: 'How often', wz_med_prescriber: 'Prescribing doctor', wz_med_since: 'Since', wz_add_medication: 'Add a medication',
    wz_surgeries: 'Past surgeries', wz_surgery: 'Procedure', wz_surgery_year: 'Year', wz_surgery_hospital: 'Hospital', wz_add_surgery: 'Add a surgery', wz_year_invalid: 'Enter a year between 1900 and this year',
    wz_family: 'Family history', wz_family_other: 'Other family condition', wz_disability: 'Disability', wz_none: 'None', wz_disability_other: 'Describe the disability',
    wz_vaccination: 'Vaccination record (carnet de vaccination)', wz_vaccination_hint: 'Optional — PDF or photo, up to 2 MB', wz_remove_row: 'Remove',
    wz_change_file: 'Change file', wz_file_too_large: 'The file is larger than 2 MB', wz_file_type: 'Only PDF, JPG, PNG or WebP files are accepted', wz_file_reselect: 'Choose the file again — files are not kept when you leave the page',
    wz_smoking: 'Smoking', wz_never: 'Never', wz_former: 'Former smoker', wz_current: 'Current smoker', wz_cigarettes: 'Cigarettes per day', wz_cigarettes_invalid: 'Enter a number from 1 to 200',
    wz_alcohol: 'Alcohol', wz_occasional: 'Occasional', wz_heavy: 'Heavy', wz_occupation: 'Occupation', wz_sector: 'Sector',
    wz_water: 'Main drinking water source', wz_toilet: 'Toilet facility', wz_social_note: 'Water and sanitation answers help doctors assess risks such as cholera and typhoid (WHO social determinants of health).',
    wz_income: 'Monthly household income', wz_income_hint: 'Optional — used only anonymously for health statistics', wz_prefer_not: 'Prefer not to say',
    wz_insurance: 'Health insurance', wz_insurance_number: 'Insurance number',
    wz_emergency: 'Emergency contact', wz_ec_name: 'Name', wz_ec_relationship: 'Relationship', wz_ec_phone: 'Phone',
    wz_consent_intro: 'Choose how HFA may use your information. You can change these choices later. (Cameroon Law No. 2024/017 on the protection of personal data.)',
    wz_c_data: 'I agree that HFA stores and shares my health information with the clinicians who treat me, so they can provide my care.', wz_c_data_required: 'This consent is needed to provide care through HFA',
    wz_c_research: 'My data may be used anonymously for public health research.', wz_c_sms: 'Send me SMS notifications (appointments, results).',
    wz_c_whatsapp: 'Send me WhatsApp notifications.', wz_c_whatsapp_none: 'Available when your primary phone is a WhatsApp number.',
    wz_c_ministry: 'My data may be shared anonymously with the Ministry of Public Health for disease surveillance.',
    wz_commitment: 'I confirm that all information I provide is truthful, accurate and complete, and I will not misuse the platform.',
    wz_terms: 'I have read and agree to the', wz_terms_link: 'Terms & Conditions', wz_terms_required: 'You must accept the Terms & Conditions',
    wz_phone_taken: 'This phone number already has an account. Sign in instead.', wz_saved_done: 'Your health profile has been saved.',
    wz_photo_offline: 'Your profile picture could not be saved because you are offline. You can add it from your dashboard.',
    wz_my_profile: 'My health profile',
    vhc_title: 'Vital Health Card', vhc_sub: 'Your key medical information at a glance', vhc_blood: 'Blood group', vhc_genotype: 'Genotype', vhc_allergies: 'Allergies',
    vhc_conditions: 'Conditions', vhc_last: 'Last consultation', vhc_none: 'None recorded', vhc_unknown: 'Not known', vhc_never: 'No consultation yet', vhc_days_ago: '{days} days ago', vhc_today: 'today', vhc_yesterday: 'yesterday',
    vhc_update: 'Update', login_identifier: 'Email or phone number'
  });
  Object.assign(T.fr, {
    wz_title: 'Créez votre compte patient', wz_complete_title: 'Mon profil de santé',
    wz_step: 'Étape {n} sur 5', wz_s1: 'Identité', wz_s2: 'Contact et localisation', wz_s3: 'Identité médicale', wz_s4: 'Mode de vie et situation sociale', wz_s5: 'Consentements et préférences',
    wz_saved_note: 'Vos réponses sont enregistrées sur cet appareil jusqu’à la fin. Votre mot de passe et vos documents ne sont pas enregistrés — vous les choisirez à nouveau si vous partez.',
    wz_start_over: 'Recommencer', wz_start_over_confirm: 'Effacer tout ce que vous avez saisi et recommencer ?',
    wz_next: 'Continuer', wz_back: 'Retour', wz_submit: 'Créer mon compte', wz_save: 'Enregistrer mon profil de santé', wz_submitting: 'Création de votre compte…', wz_saving: 'Enregistrement…',
    wz_fix: 'Veuillez corriger les champs signalés.', wz_required: 'Ce champ est obligatoire', wz_optional: 'facultatif',
    wz_full_name: 'Nom légal complet', wz_full_name_hint: 'Exactement comme sur votre CNI ou votre passeport', wz_name_invalid: 'Utilisez uniquement des lettres, espaces, apostrophes, points ou tirets',
    wz_dob: 'Date de naissance', wz_age: 'Âge : {age} ans', wz_dob_future: 'La date de naissance ne peut pas être dans le futur', wz_dob_invalid: 'Saisissez une date de naissance valide',
    wz_gender: 'Sexe', wz_male: 'Homme', wz_female: 'Femme', wz_undisclosed: 'Je préfère ne pas répondre',
    wz_cni: 'Numéro de CNI (Carte Nationale d’Identité)', wz_cni_hint: 'Facultatif — permet de retrouver votre assurance', wz_cni_invalid: 'Utilisez uniquement des lettres et des chiffres',
    wz_photo: 'Photo de profil', wz_photo_add: 'Ajouter une photo', wz_photo_change: 'Changer la photo', wz_photo_hint: 'Facultatif — aide votre équipe soignante à vous reconnaître',
    wz_language: 'Langue préférée', wz_id_type: 'Type de pièce d’identité', wz_id_file: 'Photo ou scan de votre CNI ou passeport', wz_id_hint: 'JPG, PNG, WebP ou PDF, jusqu’à 2 Mo. Vérifié par notre équipe.',
    wz_id_on_file: 'Votre pièce d’identité est déjà enregistrée.',
    wz_phone: 'Numéro de téléphone principal', wz_phone_hint: 'Vous pourrez vous connecter avec ce numéro. Exemple : +237 6XX XX XX XX', wz_phone_invalid: 'Saisissez un numéro valide, par ex. +237 677 12 34 56',
    wz_is_whatsapp: 'Est-ce votre numéro WhatsApp ?', wz_phone2: 'Numéro de téléphone secondaire', wz_email: 'Adresse e-mail', wz_email_hint: 'Facultatif — beaucoup de patients n’en ont pas', wz_email_invalid: 'Saisissez une adresse e-mail valide',
    wz_password: 'Mot de passe', wz_password_hint: 'Au moins 12 caractères', wz_password_short: 'Utilisez au moins 12 caractères', wz_password2: 'Confirmez le mot de passe', wz_password_mismatch: 'Les mots de passe ne correspondent pas',
    wz_region: 'Région', wz_division: 'Département', wz_choose_region_first: 'Choisissez d’abord votre région', wz_town: 'Ville / village', wz_district: 'District de santé le plus proche', wz_district_hint: 'Nom du district de santé où vous vous soignez habituellement',
    wz_gps: 'Votre position', wz_gps_ask: 'Autoriser HFA à connaître votre position pour trouver les médecins et pharmacies proches ?', wz_gps_allow: 'Oui, utiliser ma position', wz_gps_saved: 'Position enregistrée : {lat}, {lng} (±{acc} m)', wz_gps_remove: 'Retirer la position',
    wz_gps_denied: 'L’autorisation de localisation a été refusée. Vous pouvez continuer sans.', wz_gps_failed: 'Votre position n’a pas pu être trouvée. Vous pouvez continuer sans.', wz_gps_unsupported: 'Cet appareil ne peut pas partager sa position.', wz_gps_finding: 'Recherche de votre position…',
    wz_settlement: 'Type de zone', wz_urban: 'Urbaine', wz_peri_urban: 'Périurbaine', wz_rural: 'Rurale',
    wz_blood: 'Groupe sanguin', wz_genotype: 'Génotype', wz_unknown: 'Je ne sais pas',
    wz_conditions: 'Maladies chroniques connues', wz_other_condition: 'Autre maladie', wz_other_condition_required: 'Décrivez l’autre maladie',
    wz_drug_allergies: 'Allergies médicamenteuses', wz_drug: 'Médicament', wz_severity: 'Gravité', wz_mild: 'Légère', wz_moderate: 'Modérée', wz_severe: 'Grave', wz_anaphylaxis: 'Anaphylaxie', wz_add_drug_allergy: 'Ajouter une allergie médicamenteuse',
    wz_food_allergies: 'Allergies alimentaires', wz_env_allergies: 'Allergies environnementales (poussière, pollen…)', wz_none_hint: 'Laissez vide s’il n’y en a pas',
    wz_medications: 'Médicaments pris régulièrement', wz_med_name: 'Médicament', wz_med_dose: 'Dose', wz_med_frequency: 'Fréquence', wz_med_prescriber: 'Médecin prescripteur', wz_med_since: 'Depuis', wz_add_medication: 'Ajouter un médicament',
    wz_surgeries: 'Chirurgies passées', wz_surgery: 'Intervention', wz_surgery_year: 'Année', wz_surgery_hospital: 'Hôpital', wz_add_surgery: 'Ajouter une chirurgie', wz_year_invalid: 'Saisissez une année entre 1900 et cette année',
    wz_family: 'Antécédents familiaux', wz_family_other: 'Autre antécédent familial', wz_disability: 'Handicap', wz_none: 'Aucun', wz_disability_other: 'Décrivez le handicap',
    wz_vaccination: 'Carnet de vaccination', wz_vaccination_hint: 'Facultatif — PDF ou photo, jusqu’à 2 Mo', wz_remove_row: 'Retirer',
    wz_change_file: 'Changer de fichier', wz_file_too_large: 'Le fichier dépasse 2 Mo', wz_file_type: 'Seuls les fichiers PDF, JPG, PNG ou WebP sont acceptés', wz_file_reselect: 'Choisissez à nouveau le fichier — les fichiers ne sont pas conservés quand vous quittez la page',
    wz_smoking: 'Tabac', wz_never: 'Jamais', wz_former: 'Ancien fumeur', wz_current: 'Fumeur actuel', wz_cigarettes: 'Cigarettes par jour', wz_cigarettes_invalid: 'Saisissez un nombre de 1 à 200',
    wz_alcohol: 'Alcool', wz_occasional: 'Occasionnel', wz_heavy: 'Important', wz_occupation: 'Profession', wz_sector: 'Secteur',
    wz_water: 'Principale source d’eau de boisson', wz_toilet: 'Type de toilettes', wz_social_note: 'Les réponses sur l’eau et l’assainissement aident les médecins à évaluer des risques comme le choléra et la typhoïde (déterminants sociaux de la santé de l’OMS).',
    wz_income: 'Revenu mensuel du ménage', wz_income_hint: 'Facultatif — utilisé uniquement de façon anonyme pour les statistiques de santé', wz_prefer_not: 'Je préfère ne pas répondre',
    wz_insurance: 'Assurance maladie', wz_insurance_number: 'Numéro d’assurance',
    wz_emergency: 'Contact d’urgence', wz_ec_name: 'Nom', wz_ec_relationship: 'Lien de parenté', wz_ec_phone: 'Téléphone',
    wz_consent_intro: 'Choisissez comment HFA peut utiliser vos informations. Vous pourrez modifier ces choix plus tard. (Loi camerounaise n° 2024/017 relative à la protection des données à caractère personnel.)',
    wz_c_data: 'J’accepte que HFA conserve et partage mes informations de santé avec les soignants qui me suivent, afin qu’ils puissent me soigner.', wz_c_data_required: 'Ce consentement est nécessaire pour recevoir des soins via HFA',
    wz_c_research: 'Mes données peuvent être utilisées de façon anonyme pour la recherche en santé publique.', wz_c_sms: 'M’envoyer des notifications par SMS (rendez-vous, résultats).',
    wz_c_whatsapp: 'M’envoyer des notifications WhatsApp.', wz_c_whatsapp_none: 'Disponible si votre numéro principal est un numéro WhatsApp.',
    wz_c_ministry: 'Mes données peuvent être partagées de façon anonyme avec le Ministère de la Santé Publique pour la surveillance des maladies.',
    wz_commitment: 'Je confirme que toutes les informations fournies sont véridiques, exactes et complètes, et je n’utiliserai pas la plateforme de manière abusive.',
    wz_terms: 'J’ai lu et j’accepte les', wz_terms_link: 'Conditions générales', wz_terms_required: 'Vous devez accepter les Conditions générales',
    wz_phone_taken: 'Ce numéro de téléphone a déjà un compte. Connectez-vous plutôt.', wz_saved_done: 'Votre profil de santé a été enregistré.',
    wz_photo_offline: 'Votre photo de profil n’a pas pu être enregistrée car vous êtes hors ligne. Vous pourrez l’ajouter depuis votre tableau de bord.',
    wz_my_profile: 'Mon profil de santé',
    vhc_title: 'Carte de santé vitale', vhc_sub: 'Vos informations médicales essentielles en un coup d’œil', vhc_blood: 'Groupe sanguin', vhc_genotype: 'Génotype', vhc_allergies: 'Allergies',
    vhc_conditions: 'Maladies', vhc_last: 'Dernière consultation', vhc_none: 'Aucune enregistrée', vhc_unknown: 'Inconnu', vhc_never: 'Pas encore de consultation', vhc_days_ago: 'il y a {days} jours', vhc_today: 'aujourd’hui', vhc_yesterday: 'hier',
    vhc_update: 'Mettre à jour', login_identifier: 'E-mail ou numéro de téléphone'
  });

  // Option lists: stable codes (validated by the server) with English and French labels.
  const O = {
    region: [['adamawa', 'Adamawa', 'Adamaoua'], ['centre', 'Centre', 'Centre'], ['east', 'East', 'Est'], ['far_north', 'Far North', 'Extrême-Nord'], ['littoral', 'Littoral', 'Littoral'],
      ['north', 'North', 'Nord'], ['north_west', 'North West', 'Nord-Ouest'], ['west', 'West', 'Ouest'], ['south', 'South', 'Sud'], ['south_west', 'South West', 'Sud-Ouest']],
    conditions: [['hypertension', 'Hypertension', 'Hypertension'], ['diabetes_type1', 'Diabetes (Type 1)', 'Diabète (type 1)'], ['diabetes_type2', 'Diabetes (Type 2)', 'Diabète (type 2)'],
      ['asthma', 'Asthma', 'Asthme'], ['hiv_aids', 'HIV/AIDS', 'VIH/SIDA'], ['tuberculosis', 'Tuberculosis', 'Tuberculose'], ['sickle_cell', 'Sickle cell disease', 'Drépanocytose'],
      ['epilepsy', 'Epilepsy', 'Épilepsie'], ['cancer', 'Cancer', 'Cancer'], ['chronic_kidney_disease', 'Chronic kidney disease', 'Maladie rénale chronique'], ['heart_disease', 'Heart disease', 'Maladie cardiaque'],
      ['malaria_recurrent', 'Malaria (recurrent)', 'Paludisme (récurrent)'], ['mental_health', 'Mental health condition', 'Trouble de santé mentale'], ['other', 'Other', 'Autre']],
    family: [['hypertension', 'Hypertension', 'Hypertension'], ['diabetes', 'Diabetes', 'Diabète'], ['cancer', 'Cancer', 'Cancer'], ['heart_disease', 'Heart disease', 'Maladie cardiaque'],
      ['stroke', 'Stroke', 'AVC'], ['mental_health', 'Mental health', 'Santé mentale'], ['sickle_cell', 'Sickle cell', 'Drépanocytose'], ['other', 'Other', 'Autre']],
    disability: [['none', 'None', 'Aucun'], ['visual', 'Visual', 'Visuel'], ['hearing', 'Hearing', 'Auditif'], ['physical', 'Physical', 'Physique'], ['cognitive', 'Cognitive', 'Cognitif'], ['other', 'Other', 'Autre']],
    severity: [['mild', 'Mild', 'Légère'], ['moderate', 'Moderate', 'Modérée'], ['severe', 'Severe', 'Grave'], ['anaphylaxis', 'Anaphylaxis', 'Anaphylaxie']],
    alcohol: [['none', 'None', 'Aucun'], ['occasional', 'Occasional', 'Occasionnel'], ['moderate', 'Moderate', 'Modéré'], ['heavy', 'Heavy', 'Important']],
    sector: [['agriculture', 'Agriculture', 'Agriculture'], ['mining', 'Mining', 'Mines'], ['government', 'Government', 'Administration'], ['healthcare', 'Healthcare', 'Santé'],
      ['education', 'Education', 'Éducation'], ['commerce', 'Commerce', 'Commerce'], ['informal', 'Informal', 'Secteur informel'], ['unemployed', 'Unemployed', 'Sans emploi'],
      ['student', 'Student', 'Étudiant'], ['other', 'Other', 'Autre']],
    water: [['tap', 'Tap', 'Robinet'], ['well', 'Well', 'Puits'], ['river', 'River', 'Rivière'], ['rainwater', 'Rainwater', 'Eau de pluie'], ['vendor', 'Water vendor', 'Vendeur d’eau']],
    toilet: [['flush', 'Flush toilet', 'Toilettes à chasse d’eau'], ['pit_latrine', 'Pit latrine', 'Latrine à fosse'], ['open_defecation', 'Open defecation', 'Défécation à l’air libre'], ['other', 'Other', 'Autre']],
    income: [['lt_50k', 'Less than 50,000 XAF', 'Moins de 50 000 XAF'], ['50k_150k', '50,000 – 150,000 XAF', '50 000 – 150 000 XAF'], ['150k_500k', '150,000 – 500,000 XAF', '150 000 – 500 000 XAF'], ['gt_500k', 'More than 500,000 XAF', 'Plus de 500 000 XAF']],
    insurance: [['none', 'None', 'Aucune'], ['cnps', 'CNPS', 'CNPS'], ['private', 'Private', 'Privée'], ['mutual', 'Mutual (mutuelle)', 'Mutuelle'], ['other', 'Other', 'Autre']],
    settlement: [['urban', 'Urban', 'Urbaine'], ['peri_urban', 'Peri-urban', 'Périurbaine'], ['rural', 'Rural', 'Rurale']],
    gender: [['male', 'Male', 'Homme'], ['female', 'Female', 'Femme'], ['undisclosed', 'Prefer not to say', 'Je préfère ne pas répondre']],
    smoking: [['never', 'Never', 'Jamais'], ['former', 'Former smoker', 'Ancien fumeur'], ['current', 'Current smoker', 'Fumeur actuel']]
  };
  const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC'];
  // The 58 divisions (départements) of Cameroon, by region.
  const DIVISIONS = {
    adamawa: ['Djérem', 'Faro-et-Déo', 'Mayo-Banyo', 'Mbéré', 'Vina'],
    centre: ['Haute-Sanaga', 'Lekié', 'Mbam-et-Inoubou', 'Mbam-et-Kim', 'Méfou-et-Afamba', 'Méfou-et-Akono', 'Mfoundi', 'Nyong-et-Kéllé', 'Nyong-et-Mfoumou', 'Nyong-et-So’o'],
    east: ['Boumba-et-Ngoko', 'Haut-Nyong', 'Kadey', 'Lom-et-Djérem'],
    far_north: ['Diamaré', 'Logone-et-Chari', 'Mayo-Danay', 'Mayo-Kani', 'Mayo-Sava', 'Mayo-Tsanaga'],
    littoral: ['Moungo', 'Nkam', 'Sanaga-Maritime', 'Wouri'],
    north: ['Bénoué', 'Faro', 'Mayo-Louti', 'Mayo-Rey'],
    north_west: ['Boyo', 'Bui', 'Donga-Mantung', 'Menchum', 'Mezam', 'Momo', 'Ngo-Ketunjia'],
    west: ['Bamboutos', 'Haut-Nkam', 'Hauts-Plateaux', 'Koung-Khi', 'Menoua', 'Mifi', 'Ndé', 'Noun'],
    south: ['Dja-et-Lobo', 'Mvila', 'Océan', 'Vallée-du-Ntem'],
    south_west: ['Fako', 'Koupé-Manengouba', 'Lebialem', 'Manyu', 'Meme', 'Ndian']
  };
  const label = (list, code) => { const item = O[list].find(([value]) => value === code); return item ? (LANG === 'fr' ? item[2] : item[1]) : ''; };
  const options = list => O[list].map(([value, en, fr]) => [value, LANG === 'fr' ? fr : en]);

  const blank = () => ({
    name: '', dob: '', gender: '', cni: '', language: LANG === 'fr' ? 'fr' : 'en', idType: '',
    phone: '+237 ', phoneIsWhatsApp: true, phone2: '', email: '', hospitalId: '', hospitalOther: '', region: '', division: '', town: '', district: '', gps: null, settlement: '',
    bloodGroup: '', genotype: '', conditions: [], otherCondition: '', drugAllergies: [], foodAllergies: '', envAllergies: '', medications: [], surgeries: [],
    familyHistory: [], familyOther: '', disability: 'none', disabilityOther: '',
    smoking: '', cigs: '', alcohol: '', occupation: '', sector: '', water: '', toilet: '', income: '', insurance: '', insuranceNumber: '', ecName: '', ecRelation: '', ecPhone: '',
    cData: false, cResearch: false, cSms: false, cWhatsapp: false, cMinistry: false, commitment: false, terms: false
  });

  // Wizard state. Passwords, files and the photo live only in memory.
  let RS = null;
  const NAME_PATTERN = /^[\p{L}\p{M}\p{N} .'’-]+$/u;
  const normPhone = value => {
    let number = String(value || '').replace(/[\s().-]/g, '');
    if (/^00[1-9]/.test(number)) number = '+' + number.slice(2);
    if (/^237\d{9}$/.test(number)) number = '+' + number;
    if (/^[26]\d{8}$/.test(number)) number = '+237' + number;
    return number;
  };
  const validPhone = value => /^\+[1-9]\d{7,14}$/.test(normPhone(value));
  const trim = value => String(value ?? '').trim();
  const today = () => new Date().toISOString().slice(0, 10);
  const ageFrom = dob => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
    const birth = new Date(dob + 'T00:00:00'), now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  function loadDraft() {
    try { const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (saved?.data) return { step: Math.min(5, Math.max(1, saved.step || 1)), data: { ...blank(), ...saved.data } }; }
    catch (error) { /* unreadable draft: start fresh */ }
    return null;
  }
  let saveTimer = null;
  function saveDraft() {
    if (RS?.mode !== 'register') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: RS.step, data: { ...RS.data, terms: false, commitment: false }, savedAt: new Date().toISOString() })); }
      catch (error) { /* storage full or blocked: the wizard still works */ }
    }, 300);
  }
  function clearDraft() { clearTimeout(saveTimer); try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* ignore */ } }

  // Pre-fills the wizard from an existing patient (complete-profile mode).
  function fromUser(user) {
    const health = user.healthProfile || {}, identity = health.identity || {}, location = health.location || {}, medical = health.medical || {}, lifestyle = health.lifestyle || {}, consents = health.consents || {};
    const legacyGender = { Male: 'male', Female: 'female' }[user.gender] || '';
    return {
      ...blank(), name: user.name || '', dob: identity.dateOfBirth || user.dateOfBirth || '', gender: identity.gender || legacyGender, cni: identity.cniNumber || '',
      language: user.preferredLanguage || LANG, phone: user.phone || user.whatsappNumber || '+237 ', phoneIsWhatsApp: !!user.whatsappNumber && normPhone(user.whatsappNumber) === normPhone(user.phone || user.whatsappNumber),
      phone2: location.secondaryPhone || '', email: user.email || '',
      hospitalId: user.facilityId || (user.hospitalOther ? 'other' : 'none'), hospitalOther: user.hospitalOther || '', region: location.region || '', division: location.division || '', town: location.town || '', district: location.healthDistrict || '',
      gps: location.gps || null, settlement: location.settlement || '',
      bloodGroup: medical.bloodGroup || (BLOOD.includes(user.bloodType) ? user.bloodType : ''), genotype: medical.genotype || '', conditions: medical.conditions || [], otherCondition: medical.otherCondition || '',
      drugAllergies: medical.drugAllergies || [], foodAllergies: medical.foodAllergies || '', envAllergies: medical.environmentalAllergies || '',
      medications: medical.medications || [], surgeries: (medical.surgeries || []).map(item => ({ ...item, year: item.year ? String(item.year) : '' })),
      familyHistory: medical.familyHistory || [], familyOther: medical.familyHistoryOther || '', disability: medical.disability || 'none', disabilityOther: medical.disabilityOther || '',
      smoking: lifestyle.smoking || '', cigs: lifestyle.cigarettesPerDay ? String(lifestyle.cigarettesPerDay) : '', alcohol: lifestyle.alcohol || '', occupation: lifestyle.occupation || '', sector: lifestyle.sector || '',
      water: lifestyle.waterSource || '', toilet: lifestyle.toilet || '', income: lifestyle.income || '', insurance: lifestyle.insurance || '', insuranceNumber: lifestyle.insuranceNumber || '',
      ecName: lifestyle.emergencyContact?.name || '', ecRelation: lifestyle.emergencyContact?.relationship || '', ecPhone: lifestyle.emergencyContact?.phone || '',
      cData: !!consents.dataSharing, cResearch: !!consents.research, cSms: !!consents.sms, cWhatsapp: !!consents.whatsapp, cMinistry: !!consents.ministry
    };
  }

  // ─────────────── Field templates ───────────────
  const D = () => RS.data;
  const err = field => RS.errors[field];
  const described = (field, hint) => [err(field) ? `we-${field}` : '', hint ? `wh-${field}` : ''].filter(Boolean).join(' ');
  function wrap(field, labelText, control, { hint, required, optional } = {}) {
    return `<div class="fg wz-field${err(field) ? ' has-error' : ''}" id="rf-${field}">
      <label class="fl" for="w-${field}">${esc(labelText)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}${optional ? ` <span class="wz-opt">(${esc(t('wz_optional'))})</span>` : ''}</label>
      ${control}
      ${hint ? `<p class="mu sm wz-hint" id="wh-${field}">${esc(hint)}</p>` : ''}
      ${err(field) ? `<p class="wz-err" id="we-${field}" role="alert">${esc(err(field))}</p>` : ''}
    </div>`;
  }
  const aria = (field, hint, required) => `aria-invalid="${err(field) ? 'true' : 'false'}"${described(field, hint) ? ` aria-describedby="${described(field, hint)}"` : ''}${required ? ' aria-required="true"' : ''}`;
  function input(field, labelText, { type = 'text', hint, required, optional, max = 200, attrs = '', rerender = false } = {}) {
    return wrap(field, labelText, `<input class="fc" id="w-${field}" data-f="${field}"${rerender ? ' data-rerender="1"' : ''} type="${type}" value="${esc(D()[field] ?? '')}" maxlength="${max}" ${aria(field, hint, required)} ${attrs}>`, { hint, required, optional });
  }
  function select(field, labelText, list, { hint, required, optional, placeholder = '—', rerender = false, attrs = '' } = {}) {
    const value = D()[field];
    return wrap(field, labelText, `<select class="fc" id="w-${field}" data-f="${field}"${rerender ? ' data-rerender="1"' : ''} ${aria(field, hint, required)} ${attrs}>
      <option value="">${esc(placeholder)}</option>${list.map(([code, text]) => `<option value="${esc(code)}"${code === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>`, { hint, required, optional });
  }
  function radios(field, legend, list, { required, rerender = false, hint } = {}) {
    return `<fieldset class="fg wz-field wz-fieldset${err(field) ? ' has-error' : ''}" id="rf-${field}" ${described(field, hint) ? `aria-describedby="${described(field, hint)}"` : ''}>
      <legend class="fl">${esc(legend)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</legend>
      <div class="wz-seg">${list.map(([code, text], index) => `<label class="wz-chip"><input type="radio" name="w-${field}" id="w-${field}${index ? '-' + index : ''}" value="${esc(code)}" data-f="${field}"${rerender ? ' data-rerender="1"' : ''}${D()[field] === code ? ' checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div>
      ${hint ? `<p class="mu sm wz-hint" id="wh-${field}">${esc(hint)}</p>` : ''}
      ${err(field) ? `<p class="wz-err" id="we-${field}" role="alert">${esc(err(field))}</p>` : ''}
    </fieldset>`;
  }
  function checks(field, legend, list, { rerender = false } = {}) {
    const selected = D()[field] || [];
    return `<fieldset class="fg wz-fieldset" id="rf-${field}"><legend class="fl">${esc(legend)}</legend>
      <div class="wz-checks">${list.map(([code, text]) => `<label class="wz-check"><input type="checkbox" value="${esc(code)}" data-multi="${field}"${rerender ? ' data-rerender="1"' : ''}${selected.includes(code) ? ' checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div></fieldset>`;
  }
  function toggle(field, text, { required, hint, disabled = false } = {}) {
    return `<div class="fg wz-field wz-consent${err(field) ? ' has-error' : ''}" id="rf-${field}">
      <label class="wz-check"><input type="checkbox" id="w-${field}" data-f="${field}"${D()[field] ? ' checked' : ''}${disabled ? ' disabled' : ''} ${aria(field, hint, required)}><span>${esc(text)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span></label>
      ${hint ? `<p class="mu sm wz-hint" id="wh-${field}">${esc(hint)}</p>` : ''}
      ${err(field) ? `<p class="wz-err" id="we-${field}" role="alert">${esc(err(field))}</p>` : ''}
    </div>`;
  }
  function fileInput(field, labelText, { hint, required } = {}) {
    const chosen = RS.files[field];
    // Browsers cannot redisplay a chosen file after the step is redrawn, so show the name with a "Change" button instead.
    return wrap(field, labelText, `<input class="fc${chosen ? ' sr-only' : ''}" type="file" id="w-${field}" data-file="${field}" accept="image/jpeg,image/png,image/webp,application/pdf" ${aria(field, hint, required)}>${chosen ? `<p class="sm wz-file">✓ ${esc(chosen.name)} <button type="button" class="btn bgh bsm" onclick="document.getElementById('w-${field}').click()">${esc(t('wz_change_file'))}</button></p>` : ''}`, { hint, required });
  }
  function rows(list, columns, addLabel, legend) {
    const items = D()[list];
    return `<fieldset class="fg wz-fieldset" id="rf-${list}"><legend class="fl">${esc(legend)}</legend>
      ${items.map((item, index) => `<div class="wz-row" role="group" aria-label="${esc(legend)} ${index + 1}">
        ${columns.map(([key, text, type, extra]) => {
          const id = `w-${list}-${index}-${key}`, error = RS.errors[`${list}.${index}.${key}`];
          const control = type === 'select'
            ? `<select class="fc" id="${id}" data-list="${list}" data-index="${index}" data-key="${key}" aria-invalid="${error ? 'true' : 'false'}">${extra.map(([code, optionText]) => `<option value="${esc(code)}"${item[key] === code ? ' selected' : ''}>${esc(optionText)}</option>`).join('')}</select>`
            : `<input class="fc" id="${id}" type="${type}" data-list="${list}" data-index="${index}" data-key="${key}" value="${esc(item[key] ?? '')}" ${extra || ''} aria-invalid="${error ? 'true' : 'false'}"${error ? ` aria-describedby="${id}-e"` : ''}>`;
          return `<div class="wz-cell"><label class="fl" for="${id}">${esc(text)}</label>${control}${error ? `<p class="wz-err" id="${id}-e" role="alert">${esc(error)}</p>` : ''}</div>`;
        }).join('')}
        <button type="button" class="btn bgh bsm wz-remove" onclick="HFAPatientRegistration.removeRow('${list}',${index})">${esc(t('wz_remove_row'))}</button>
      </div>`).join('')}
      <button type="button" class="btn bs bsm" onclick="HFAPatientRegistration.addRow('${list}')">+ ${esc(addLabel)}</button></fieldset>`;
  }

  // ─────────────── Steps ───────────────
  function step1() {
    const d = D(), age = ageFrom(d.dob);
    const photoUser = { name: d.name || '?', avatarPreview: RS.photo?.previewUrl };
    const hasId = RS.mode === 'complete' && !!(CU?.idDocument || CU?.idDocumentName);
    return `
      ${input('name', t('wz_full_name'), { required: true, hint: t('wz_full_name_hint'), attrs: 'autocomplete="name"', ...(RS.mode === 'complete' ? { attrs: 'readonly' } : {}) })}
      <div class="fr">
        ${wrap('dob', t('wz_dob'), `<input class="fc" id="w-dob" data-f="dob" type="date" max="${today()}" min="1900-01-01" value="${esc(d.dob)}" ${aria('dob', 'x', true)}><p class="mu sm wz-hint" id="wh-dob" aria-live="polite">${age !== null && age >= 0 ? esc(tf('wz_age', { age })) : ''}</p>`, { required: true })}
        ${input('cni', t('wz_cni'), { optional: true, hint: t('wz_cni_hint'), max: 40, attrs: 'autocomplete="off" inputmode="text"' })}
      </div>
      ${radios('gender', t('wz_gender'), options('gender'), { required: true })}
      <div class="fg wz-photo">
        <span class="fl">${esc(t('wz_photo'))} <span class="wz-opt">(${esc(t('wz_optional'))})</span></span>
        <div class="wz-photo-row">${HFAAvatar.html(photoUser, { size: 'lg' })}
          <div><button type="button" class="btn bs bsm" onclick="HFAPatientRegistration.choosePhoto()">${esc(t(RS.photo ? 'wz_photo_change' : 'wz_photo_add'))}</button>
          <p class="mu sm">${esc(RS.photo ? t('avatar_selected') : t('wz_photo_hint'))}</p></div></div>
      </div>
      ${radios('language', t('wz_language'), [['en', 'English'], ['fr', 'Français']], { required: true, rerender: true })}
      ${hasId ? `<div class="alt ai">${esc(t('wz_id_on_file'))}</div>` : `<div class="fr">
        ${select('idType', t('wz_id_type'), [['national_id', LANG === 'fr' ? 'Carte nationale d’identité' : 'National ID card'], ['passport', LANG === 'fr' ? 'Passeport' : 'Passport']], { required: RS.mode === 'register', optional: RS.mode !== 'register' })}
        ${fileInput('idFile', t('wz_id_file'), { required: RS.mode === 'register', hint: t('wz_id_hint') })}
      </div>`}`;
  }

  function step2() {
    const d = D(), divisions = DIVISIONS[d.region] || [];
    const gps = d.gps;
    return `
      ${RS.mode === 'complete' ? `<div class="alt ai">${esc(t('wz_phone'))}: <strong>${esc(d.phone)}</strong>${d.email ? ` · ${esc(d.email)}` : ''}</div>` : `
      ${input('phone', t('wz_phone'), { type: 'tel', required: true, hint: t('wz_phone_hint'), max: 20, attrs: 'inputmode="tel" autocomplete="tel"' })}
      ${toggle('phoneIsWhatsApp', t('wz_is_whatsapp'))}
      ${input('email', t('wz_email'), { type: 'email', optional: true, hint: t('wz_email_hint'), max: 254, attrs: 'autocomplete="email" inputmode="email"' })}
      <div class="fr">
        ${input('password', t('wz_password'), { type: 'password', required: true, hint: t('wz_password_hint'), max: 128, attrs: 'autocomplete="new-password"' })}
        ${input('password2', t('wz_password2'), { type: 'password', required: true, max: 128, attrs: 'autocomplete="new-password"' })}
      </div>`}
      ${input('phone2', t('wz_phone2'), { type: 'tel', optional: true, max: 20, attrs: 'inputmode="tel"' })}
      ${hospitalField()}
      <div class="fr">
        ${select('region', t('wz_region'), options('region'), { required: true, rerender: true })}
        ${select('division', t('wz_division'), divisions.map(name => [name, name]), { required: true, placeholder: d.region ? '—' : t('wz_choose_region_first'), attrs: d.region ? '' : 'disabled' })}
      </div>
      <div class="fr">
        ${input('town', t('wz_town'), { required: true, max: 120, attrs: 'autocomplete="address-level2"' })}
        ${input('district', t('wz_district'), { optional: true, hint: t('wz_district_hint'), max: 120 })}
      </div>
      <div class="fg wz-gps" id="rf-gps">
        <span class="fl">${esc(t('wz_gps'))} <span class="wz-opt">(${esc(t('wz_optional'))})</span></span>
        ${gps ? `<p class="sm">${esc(tf('wz_gps_saved', { lat: gps.lat.toFixed(5), lng: gps.lng.toFixed(5), acc: Math.round(gps.accuracy) }))}</p><button type="button" class="btn bgh bsm" onclick="HFAPatientRegistration.clearGps()">${esc(t('wz_gps_remove'))}</button>`
          : `<p class="mu sm" id="wz-gps-q">${esc(t('wz_gps_ask'))}</p><button type="button" class="btn bs bsm" id="wz-gps-btn" aria-describedby="wz-gps-q" onclick="HFAPatientRegistration.captureGps()">${esc(t('wz_gps_allow'))}</button>`}
        <p class="mu sm" id="wz-gps-status" aria-live="polite">${esc(RS.gpsMessage || '')}</p>
      </div>
      ${radios('settlement', t('wz_settlement'), options('settlement'))}`;
  }

  // The hospital a patient registers under appears in their number (HFA-PT-<hospital>-000001).
  function hospitalField() {
    const d = D(), hospitals = RS.hospitals;
    const chosen = (hospitals || []).find(hospital => hospital.id === d.hospitalId);
    const prefix = `HFA-PT-${chosen ? chosen.code : HFANumbering.NO_HOSPITAL}-`;
    const list = [...(hospitals || []).map(hospital => [hospital.id, `${hospital.name} (${hospital.code})`]), ['none', t('wz_hospital_none')], ['other', t('wz_hospital_other')]];
    const hint = hospitals ? `${t('wz_hospital_hint')} ${d.hospitalId ? tf('wz_hospital_number', { prefix }) : ''}` : t('wz_hospital_loading');
    return `${select('hospitalId', t('wz_hospital'), list, { required: true, rerender: true, hint })}
      ${d.hospitalId === 'other' ? input('hospitalOther', t('wz_hospital_other_name'), { max: 200 }) : ''}`;
  }

  function step3() {
    const d = D();
    return `
      <div class="fr">
        ${select('bloodGroup', t('wz_blood'), [...BLOOD.map(value => [value, value]), ['unknown', t('wz_unknown')]], { optional: true })}
        ${select('genotype', t('wz_genotype'), [...GENOTYPES.map(value => [value, value]), ['unknown', t('wz_unknown')]], { optional: true })}
      </div>
      ${checks('conditions', t('wz_conditions'), options('conditions'), { rerender: true })}
      ${d.conditions.includes('other') ? input('otherCondition', t('wz_other_condition'), { required: true, max: 200 }) : ''}
      ${rows('drugAllergies', [['name', t('wz_drug'), 'text', 'maxlength="120"'], ['severity', t('wz_severity'), 'select', options('severity')]], t('wz_add_drug_allergy'), t('wz_drug_allergies'))}
      <div class="fr">
        ${wrap('foodAllergies', t('wz_food_allergies'), `<textarea class="fc" id="w-foodAllergies" data-f="foodAllergies" rows="2" maxlength="500" aria-describedby="wh-foodAllergies">${esc(d.foodAllergies)}</textarea>`, { hint: t('wz_none_hint') })}
        ${wrap('envAllergies', t('wz_env_allergies'), `<textarea class="fc" id="w-envAllergies" data-f="envAllergies" rows="2" maxlength="500" aria-describedby="wh-envAllergies">${esc(d.envAllergies)}</textarea>`, { hint: t('wz_none_hint') })}
      </div>
      ${rows('medications', [['name', t('wz_med_name'), 'text', 'maxlength="120"'], ['dose', t('wz_med_dose'), 'text', 'maxlength="60"'], ['frequency', t('wz_med_frequency'), 'text', 'maxlength="60"'],
        ['prescriber', t('wz_med_prescriber'), 'text', 'maxlength="120"'], ['since', t('wz_med_since'), 'date', `max="${today()}"`]], t('wz_add_medication'), t('wz_medications'))}
      ${rows('surgeries', [['procedure', t('wz_surgery'), 'text', 'maxlength="160"'], ['year', t('wz_surgery_year'), 'number', `min="1900" max="${new Date().getFullYear()}" inputmode="numeric"`], ['hospital', t('wz_surgery_hospital'), 'text', 'maxlength="160"']], t('wz_add_surgery'), t('wz_surgeries'))}
      ${checks('familyHistory', t('wz_family'), options('family'), { rerender: true })}
      ${d.familyHistory.includes('other') ? input('familyOther', t('wz_family_other'), { max: 200 }) : ''}
      ${select('disability', t('wz_disability'), options('disability'), { rerender: true, placeholder: t('wz_none') })}
      ${d.disability === 'other' ? input('disabilityOther', t('wz_disability_other'), { max: 200 }) : ''}
      ${fileInput('vaccinationFile', t('wz_vaccination'), { hint: t('wz_vaccination_hint') })}`;
  }

  function step4() {
    const d = D();
    return `
      ${radios('smoking', t('wz_smoking'), options('smoking'), { rerender: true })}
      ${d.smoking === 'current' ? input('cigs', t('wz_cigarettes'), { type: 'number', required: true, max: 3, attrs: 'min="1" max="200" inputmode="numeric"' }) : ''}
      ${select('alcohol', t('wz_alcohol'), options('alcohol'))}
      <div class="fr">
        ${input('occupation', t('wz_occupation'), { max: 120, attrs: 'autocomplete="organization-title"' })}
        ${select('sector', t('wz_sector'), options('sector'))}
      </div>
      <p class="mu sm wz-note">${esc(t('wz_social_note'))}</p>
      <div class="fr">
        ${select('water', t('wz_water'), options('water'))}
        ${select('toilet', t('wz_toilet'), options('toilet'))}
      </div>
      ${select('income', t('wz_income'), options('income'), { optional: true, hint: t('wz_income_hint'), placeholder: t('wz_prefer_not') })}
      <div class="fr">
        ${select('insurance', t('wz_insurance'), options('insurance'), { rerender: true })}
        ${d.insurance && d.insurance !== 'none' ? input('insuranceNumber', t('wz_insurance_number'), { max: 60, optional: true }) : ''}
      </div>
      <fieldset class="fg wz-fieldset"><legend class="fl">${esc(t('wz_emergency'))}</legend>
        <div class="fr">
          ${input('ecName', t('wz_ec_name'), { max: 120 })}
          ${input('ecRelation', t('wz_ec_relationship'), { max: 60 })}
        </div>
        ${input('ecPhone', t('wz_ec_phone'), { type: 'tel', max: 20, attrs: 'inputmode="tel"' })}
      </fieldset>`;
  }

  function step5() {
    const whatsapp = RS.mode === 'complete' ? !!CU?.whatsappNumber : D().phoneIsWhatsApp;
    return `
      <p class="mu sm wz-note">${esc(t('wz_consent_intro'))}</p>
      ${toggle('cData', t('wz_c_data'), { required: true })}
      ${toggle('cResearch', t('wz_c_research'))}
      ${toggle('cSms', t('wz_c_sms'))}
      ${toggle('cWhatsapp', t('wz_c_whatsapp'), { disabled: !whatsapp, hint: whatsapp ? '' : t('wz_c_whatsapp_none') })}
      ${toggle('cMinistry', t('wz_c_ministry'))}
      ${RS.mode === 'register' ? `
        ${toggle('commitment', t('wz_commitment'), { required: true })}
        <div class="fg wz-field wz-consent${err('terms') ? ' has-error' : ''}" id="rf-terms">
          <label class="wz-check"><input type="checkbox" id="w-terms" data-f="terms"${D().terms ? ' checked' : ''} ${aria('terms', '', true)}><span>${esc(t('wz_terms'))} <a href="#" class="alk" onclick="event.preventDefault();showTerms()">${esc(t('wz_terms_link'))}</a> <span class="req" aria-hidden="true">*</span></span></label>
          ${err('terms') ? `<p class="wz-err" id="we-terms" role="alert">${esc(err('terms'))}</p>` : ''}
        </div>` : ''}`;
  }

  const STEPS = [step1, step2, step3, step4, step5];

  // ─────────────── Validation ───────────────
  function validateStep(step) {
    const d = D(), e = {};
    const required = (field, value = d[field]) => { if (!trim(value)) e[field] = t('wz_required'); };
    if (step === 1) {
      required('name');
      if (!e.name && (trim(d.name).length < 2 || !NAME_PATTERN.test(trim(d.name)))) e.name = t('wz_name_invalid');
      required('dob');
      if (!e.dob) { const age = ageFrom(d.dob); if (d.dob > today()) e.dob = t('wz_dob_future'); else if (age === null || age > 130 || d.dob < '1900-01-01') e.dob = t('wz_dob_invalid'); }
      required('gender');
      if (trim(d.cni) && !/^[A-Za-z0-9 -]{1,40}$/.test(trim(d.cni))) e.cni = t('wz_cni_invalid');
      const hasId = RS.mode === 'complete' && !!(CU?.idDocument || CU?.idDocumentName);
      if (RS.mode === 'register') {
        required('idType');
        if (!RS.files.idFile) e.idFile = RS.draftRestored ? t('wz_file_reselect') : t('wz_required');
      } else if (!hasId && (d.idType || RS.files.idFile) && !(d.idType && RS.files.idFile)) {
        if (!d.idType) e.idType = t('wz_required'); else e.idFile = t('wz_required');
      }
      if (RS.fileErrors.idFile) e.idFile = RS.fileErrors.idFile;
    }
    if (step === 2) {
      if (RS.mode === 'register') {
        if (!validPhone(d.phone)) e.phone = t('wz_phone_invalid');
        if (trim(d.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(d.email))) e.email = t('wz_email_invalid');
        if ((RS.password || '').length < 12) e.password = t('wz_password_short');
        if (!e.password && RS.password !== RS.password2) e.password2 = t('wz_password_mismatch');
      }
      if (trim(d.phone2) && !validPhone(d.phone2)) e.phone2 = t('wz_phone_invalid');
      required('hospitalId');
      required('region'); required('division'); required('town');
    }
    if (step === 3) {
      if (d.conditions.includes('other')) required('otherCondition');
      d.drugAllergies.forEach((item, index) => { if (!trim(item.name)) e[`drugAllergies.${index}.name`] = t('wz_required'); });
      d.medications.forEach((item, index) => { if (!trim(item.name)) e[`medications.${index}.name`] = t('wz_required'); if (item.since && item.since > today()) e[`medications.${index}.since`] = t('wz_dob_future'); });
      d.surgeries.forEach((item, index) => {
        if (!trim(item.procedure)) e[`surgeries.${index}.procedure`] = t('wz_required');
        const year = Number(item.year);
        if (trim(item.year) && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) e[`surgeries.${index}.year`] = t('wz_year_invalid');
      });
      if (RS.fileErrors.vaccinationFile) e.vaccinationFile = RS.fileErrors.vaccinationFile;
    }
    if (step === 4) {
      if (d.smoking === 'current') { const count = Number(d.cigs); if (!Number.isInteger(count) || count < 1 || count > 200) e.cigs = t('wz_cigarettes_invalid'); }
      if (trim(d.ecPhone) && !validPhone(d.ecPhone)) e.ecPhone = t('wz_phone_invalid');
    }
    if (step === 5) {
      if (!d.cData) e.cData = t('wz_c_data_required');
      if (RS.mode === 'register') { if (!d.commitment) e.commitment = t('patient_commitment_required'); if (!d.terms) e.terms = t('wz_terms_required'); }
    }
    return e;
  }

  // ─────────────── Rendering ───────────────
  function container() { return document.getElementById(RS?.mode === 'complete' ? 'pwz-page' : 'pwz'); }

  function render(focusFirstError = false) {
    const root = container();
    if (!root) return;
    const titles = ['wz_s1', 'wz_s2', 'wz_s3', 'wz_s4', 'wz_s5'];
    root.innerHTML = `<div class="wz" data-step="${RS.step}">
      <ol class="wz-steps" aria-label="${esc(t(RS.mode === 'complete' ? 'wz_complete_title' : 'wz_title'))}">
        ${titles.map((key, index) => `<li class="wz-step${index + 1 === RS.step ? ' current' : ''}${index + 1 < RS.step ? ' done' : ''}"${index + 1 === RS.step ? ' aria-current="step"' : ''}>
          ${index + 1 < RS.step ? `<button type="button" onclick="HFAPatientRegistration.goTo(${index + 1})" aria-label="${esc(tf('wz_step', { n: index + 1 }))}: ${esc(t(key))}"><span class="wz-num">${index + 1}</span><span class="wz-lbl">${esc(t(key))}</span></button>`
          : `<span><span class="wz-num">${index + 1}</span><span class="wz-lbl">${esc(t(key))}</span></span>`}</li>`).join('')}
      </ol>
      <h3 class="wz-h" id="wz-heading" tabindex="-1"><span class="mu sm">${esc(tf('wz_step', { n: RS.step }))}</span><br>${esc(t(titles[RS.step - 1]))}</h3>
      ${RS.message ? `<div class="alt ${RS.messageType === 'ok' ? 'ao' : RS.messageType === 'info' ? 'ai' : 'ae'}" role="alert">${esc(RS.message)}</div>` : ''}
      <div class="wz-body">${STEPS[RS.step - 1]()}</div>
      <div class="wz-nav">
        ${RS.step > 1 ? `<button type="button" class="btn bs" onclick="HFAPatientRegistration.back()">${esc(t('wz_back'))}</button>` : '<span></span>'}
        ${RS.step < 5 ? `<button type="button" class="btn bp" onclick="HFAPatientRegistration.next()">${esc(t('wz_next'))}</button>`
          : `<button type="button" class="btn bp" id="wz-submit" onclick="HFAPatientRegistration.submit()"${RS.busy ? ' disabled aria-busy="true"' : ''}>${esc(RS.busy ? t(RS.mode === 'complete' ? 'wz_saving' : 'wz_submitting') : t(RS.mode === 'complete' ? 'wz_save' : 'wz_submit'))}</button>`}
      </div>
      ${RS.mode === 'register' ? `<p class="mu sm wz-saved">${esc(t('wz_saved_note'))} <button type="button" class="alk wz-link" onclick="HFAPatientRegistration.startOver()">${esc(t('wz_start_over'))}</button></p>` : ''}
    </div>`;
    // Passwords are never written into the HTML; restore them from memory.
    const password = root.querySelector('#w-password'), password2 = root.querySelector('#w-password2');
    if (password) password.value = RS.password || '';
    if (password2) password2.value = RS.password2 || '';
    root.oninput = onInput;
    root.onchange = onChange;
    if (focusFirstError) {
      const invalid = root.querySelector('[aria-invalid="true"], .has-error input, .has-error select');
      (invalid || root.querySelector('.alt.ae'))?.focus();
    }
  }

  function assign(element) {
    if (element.dataset.multi) {
      const list = D()[element.dataset.multi];
      const index = list.indexOf(element.value);
      if (element.checked && index < 0) list.push(element.value);
      if (!element.checked && index >= 0) list.splice(index, 1);
      return true;
    }
    if (element.dataset.list) {
      D()[element.dataset.list][Number(element.dataset.index)][element.dataset.key] = element.value;
      return true;
    }
    const field = element.dataset.f;
    if (!field) return false;
    if (field === 'password' || field === 'password2') { RS[field] = element.value; return true; }
    if (element.type === 'checkbox') D()[field] = element.checked;
    else if (element.type === 'radio') { if (element.checked) D()[field] = element.value; }
    else D()[field] = element.value;
    return true;
  }

  // Removes the error shown under a field once the person edits it.
  function clearError(element) {
    const key = element.dataset.list ? `${element.dataset.list}.${element.dataset.index}.${element.dataset.key}` : (element.dataset.f || element.dataset.multi);
    if (!key || !RS.errors[key]) return;
    delete RS.errors[key];
    const field = element.dataset.list ? element.closest('.wz-cell') : document.getElementById('rf-' + key);
    field?.classList.remove('has-error');
    field?.querySelector('.wz-err')?.remove();
    field?.querySelectorAll('[aria-invalid="true"]').forEach(node => node.setAttribute('aria-invalid', 'false'));
    if (!Object.keys(RS.errors).length) { RS.message = ''; container()?.querySelector('.wz > .alt.ae')?.remove(); }
  }

  function onInput(event) {
    const element = event.target;
    clearError(element);
    if (element.type === 'file' || element.type === 'radio' || element.type === 'checkbox' || element.tagName === 'SELECT') return;
    if (assign(element)) saveDraft();
    if (element.dataset.f === 'dob') {
      const age = ageFrom(element.value), hint = document.getElementById('wh-dob');
      if (hint) hint.textContent = age !== null && age >= 0 && age <= 130 ? tf('wz_age', { age }) : '';
    }
  }

  function onChange(event) {
    const element = event.target;
    if (element.dataset.file) { readFile(element); return; }
    clearError(element);
    if (!assign(element)) return;
    if (element.dataset.f === 'region') D().division = '';
    if (element.dataset.f === 'phoneIsWhatsApp' && !element.checked) D().cWhatsapp = false;
    if (element.dataset.f === 'smoking' && element.value !== 'current') D().cigs = '';
    if (element.dataset.f === 'language' && element.value !== LANG) { saveDraft(); setLang(element.value); return; } // the whole wizard switches language
    saveDraft();
    if (element.dataset.rerender) { const id = element.id; render(); document.getElementById(id)?.focus(); }
  }

  function readFile(element) {
    const field = element.dataset.file, file = element.files?.[0];
    delete RS.fileErrors[field];
    RS.files[field] = null;
    if (file) {
      if (!DOCUMENT_TYPES.includes(file.type)) RS.fileErrors[field] = t('wz_file_type');
      else if (file.size > MAX_DOCUMENT) RS.fileErrors[field] = t('wz_file_too_large');
      else RS.files[field] = file;
    }
    delete RS.errors[field];
    if (RS.fileErrors[field]) RS.errors[field] = RS.fileErrors[field];
    render();
    document.getElementById('w-' + field)?.focus();
  }

  const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const fileToDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  const safeName = name => String(name || 'document').replace(/[<>\u0000-\u001f/\\]/g, '_').slice(0, 180);

  // Builds the server's healthProfile, leaving out everything the patient did not answer.
  function buildHealthProfile() {
    const d = D();
    const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== '' && value !== null));
    const text = value => trim(value) || undefined;
    const emergency = clean({ name: text(d.ecName), relationship: text(d.ecRelation), phone: trim(d.ecPhone) ? normPhone(d.ecPhone) : undefined });
    return {
      identity: clean({ dateOfBirth: d.dob, gender: d.gender, cniNumber: text(d.cni) }),
      location: clean({ secondaryPhone: trim(d.phone2) ? normPhone(d.phone2) : undefined, region: d.region, division: d.division, town: trim(d.town), healthDistrict: text(d.district), gps: d.gps || undefined, settlement: d.settlement || undefined }),
      medical: clean({
        bloodGroup: d.bloodGroup || undefined, genotype: d.genotype || undefined, conditions: [...d.conditions], otherCondition: d.conditions.includes('other') ? text(d.otherCondition) : undefined,
        drugAllergies: d.drugAllergies.map(item => ({ name: trim(item.name), severity: item.severity || 'mild' })),
        foodAllergies: text(d.foodAllergies), environmentalAllergies: text(d.envAllergies),
        medications: d.medications.map(item => clean({ name: trim(item.name), dose: text(item.dose), frequency: text(item.frequency), prescriber: text(item.prescriber), since: item.since || undefined })),
        surgeries: d.surgeries.map(item => clean({ procedure: trim(item.procedure), year: trim(item.year) ? Number(item.year) : undefined, hospital: text(item.hospital) })),
        familyHistory: [...d.familyHistory], familyHistoryOther: d.familyHistory.includes('other') ? text(d.familyOther) : undefined,
        disability: d.disability || 'none', disabilityOther: d.disability === 'other' ? text(d.disabilityOther) : undefined
      }),
      lifestyle: clean({
        smoking: d.smoking || undefined, cigarettesPerDay: d.smoking === 'current' ? Number(d.cigs) : undefined, alcohol: d.alcohol || undefined,
        occupation: text(d.occupation), sector: d.sector || undefined, waterSource: d.water || undefined, toilet: d.toilet || undefined,
        income: d.income || undefined, insurance: d.insurance || undefined, insuranceNumber: d.insurance && d.insurance !== 'none' ? text(d.insuranceNumber) : undefined,
        emergencyContact: Object.keys(emergency).length ? emergency : undefined
      }),
      consents: { dataSharing: true, research: !!d.cResearch, sms: !!d.cSms, whatsapp: !!d.cWhatsapp, ministry: !!d.cMinistry }
    };
  }

  // Copies the structured record into the fields the rest of the platform already displays.
  function applyLegacy(user) {
    const health = user?.healthProfile;
    if (!health) return user;
    const identity = health.identity || {}, location = health.location || {}, medical = health.medical || {}, lifestyle = health.lifestyle || {};
    if (identity.dateOfBirth) user.dateOfBirth = identity.dateOfBirth;
    if (identity.gender) user.gender = { male: 'Male', female: 'Female', undisclosed: 'Prefer not to say' }[identity.gender];
    if (medical.bloodGroup && medical.bloodGroup !== 'unknown') user.bloodType = medical.bloodGroup;
    const allergies = [...(medical.drugAllergies || []).map(item => `${item.name} (${label('severity', item.severity)})`), medical.foodAllergies, medical.environmentalAllergies].filter(Boolean);
    user.allergies = allergies.length ? allergies.join(', ') : 'None';
    if (location.town) user.address = [location.town, location.division, label('region', location.region)].filter(Boolean).join(', ');
    const contact = lifestyle.emergencyContact;
    if (contact?.name || contact?.phone) user.emergencyContact = `${contact.name || ''}${contact.relationship ? ` (${contact.relationship})` : ''}${contact.phone ? ` — ${contact.phone}` : ''}`.trim();
    if (!user.medicalHistory && medical.conditions?.length) user.medicalHistory = medical.conditions.map(code => code === 'other' ? medical.otherCondition : label('conditions', code)).filter(Boolean).join(', ');
    return user;
  }

  function goToFirstError(errors) {
    RS.errors = errors;
    RS.message = t('wz_fix'); RS.messageType = 'error';
    render(true);
  }

  function hospitalPayload() {
    const d = D();
    if (d.hospitalId === 'other') return trim(d.hospitalOther) ? { hospitalOther: trim(d.hospitalOther) } : {};
    if (d.hospitalId && d.hospitalId !== 'none') return { hospitalId: d.hospitalId };
    return {};
  }

  async function submitRegister() {
    const d = D();
    if (typeof ApiState !== 'undefined' && ApiState.loading) await ApiState.ready;
    if (ApiState.failed) { RS.message = t('backend_unavailable'); RS.messageType = 'error'; render(); return; }
    const phone = normPhone(d.phone), email = trim(d.email).toLowerCase();
    const health = buildHealthProfile();
    RS.busy = true; RS.message = ''; render();
    try {
      if (ApiState.enabled) {
        const payload = {
          name: trim(d.name), password: RS.password, role: 'patient', phone, preferredLanguage: d.language,
          ...(email ? { email } : {}), ...(d.phoneIsWhatsApp ? { whatsappNumber: phone, whatsappNotificationsConsent: !!d.cWhatsapp } : {}),
          ...hospitalPayload(),
          idDocumentType: d.idType, idDocument: { fileName: safeName(RS.files.idFile.name), content: await fileToBase64(RS.files.idFile) },
          ...(RS.files.vaccinationFile ? { vaccinationDocument: { fileName: safeName(RS.files.vaccinationFile.name), content: await fileToBase64(RS.files.vaccinationFile) } } : {}),
          healthProfile: health
        };
        const { data, queued } = await HFAOffline.submitRegistration('/api/auth/register', payload);
        if (queued) {
          clearDraft(); RS.busy = false;
          swtTab('login'); $('le').value = email || phone; amsg(t('offline_registration_queued') + (RS.photo ? ' ' + t('wz_photo_offline') : ''), 'i');
          return;
        }
        installBackendSession(data, {});
        DB.users.forEach(applyLegacy);
        await HFAOffline.afterOnlineLogin(data.user, RS.password);
        if (RS.photo?.file) { try { await HFAAvatar.upload(RS.photo.file); } catch (error) { /* account exists; the photo can be added from the dashboard */ } }
        finishSuccess(false);
      } else {
        if (DB.users.find(user => email && user.email?.toLowerCase() === email)) throw Object.assign(new Error(t('email_exists')), { status: 409 });
        if (DB.users.find(user => user.phone && normPhone(user.phone) === phone)) throw Object.assign(new Error(t('wz_phone_taken')), { status: 409 });
        const id = 'pat' + Date.now();
        const user = {
          id, role: 'patient', name: trim(d.name), email, password: RS.password, phone, status: 'active', createdAt: todayD(),
          facilityId: hospitalPayload().hospitalId || null, hospitalOther: hospitalPayload().hospitalOther || '',
          whatsappNumber: d.phoneIsWhatsApp ? phone : '', whatsappNotificationsConsent: !!(d.phoneIsWhatsApp && d.cWhatsapp), whatsappConsentAt: d.phoneIsWhatsApp && d.cWhatsapp ? tsNow() : null,
          preferredLanguage: d.language, healthProfile: { ...health, consents: { ...health.consents, recordedAt: new Date().toISOString(), version: '2026.1' } },
          assignedDoctor: null, assignedNurse: null, medicalHistory: '', termsAcceptedAt: tsNow(), patientCommitmentAt: tsNow(),
          idDocumentType: d.idType, idDocumentName: RS.files.idFile.name, idDocumentData: await fileToDataUrl(RS.files.idFile), idUploadedAt: tsNow(), idVerificationStatus: 'pending',
          ...(RS.photo?.file ? { avatarData: await fileToDataUrl(RS.photo.file) } : {})
        };
        applyLegacy(user);
        user.hfaId = nextHfaId('patient', user);
        DB.users.push(user);
        DB.consents.push({ id: 'con' + Date.now(), patientId: id, type: 'Terms and Conditions', status: 'active', version: '2025.1', recordedAt: todayD() });
        CU = user;
        log('REGISTER', 'System');
        finishSuccess(true);
      }
    } catch (error) {
      RS.busy = false;
      RS.message = error.status === 409 && /phone/i.test(error.message) ? t('wz_phone_taken') : error.message || t('backend_unavailable');
      RS.messageType = 'error';
      render(true);
    }
  }

  function finishSuccess(staticDemo) {
    clearDraft();
    if (RS.photo?.previewUrl) URL.revokeObjectURL(RS.photo.previewUrl);
    RS = null;
    const host = document.getElementById('pwz'); if (host) host.innerHTML = '';
    goApp();
    if (staticDemo) navigate('subscriptions');
  }

  async function submitComplete() {
    const health = buildHealthProfile();
    RS.busy = true; RS.message = ''; render();
    try {
      if (ApiState.enabled) {
        const hospital = hospitalPayload();
        const body = { preferredLanguage: D().language, healthProfile: health, hospitalId: hospital.hospitalId || null, hospitalOther: hospital.hospitalOther || null };
        if (RS.files.vaccinationFile) body.vaccinationDocument = { fileName: safeName(RS.files.vaccinationFile.name), content: await fileToBase64(RS.files.vaccinationFile) };
        if (RS.files.idFile && D().idType) { body.idDocumentType = D().idType; body.idDocument = { fileName: safeName(RS.files.idFile.name), content: await fileToBase64(RS.files.idFile) }; }
        const data = await apiRequest(`/api/v1/users/${encodeURIComponent(CU.id)}/health-profile`, 'PUT', body, 30000);
        Object.assign(CU, data.user);
      } else {
        CU.healthProfile = { ...health, consents: { ...health.consents, recordedAt: new Date().toISOString(), version: '2026.1' } };
        CU.preferredLanguage = D().language;
        const hospital = hospitalPayload(), facility = (RS.hospitals || []).find(item => item.id === hospital.hospitalId);
        Object.assign(CU, { facilityId: facility?.id || null, facilityName: facility?.name || null, facilityCode: facility?.code || null, hospitalOther: hospital.hospitalOther || '' });
        if (RS.files.idFile && D().idType) Object.assign(CU, { idDocumentType: D().idType, idDocumentName: RS.files.idFile.name, idDocumentData: await fileToDataUrl(RS.files.idFile), idUploadedAt: tsNow(), idVerificationStatus: 'pending' });
      }
      applyLegacy(CU);
      log('UPDATE_HEALTH_PROFILE', 'Medical Records');
      RS = null;
      navigate('dashboard');
      const page = document.querySelector('#pgc .page');
      page?.insertAdjacentHTML('afterbegin', `<div class="alt ao" role="status">${esc(t('wz_saved_done'))}</div>`);
    } catch (error) {
      RS.busy = false; RS.message = error.message || t('backend_unavailable'); RS.messageType = 'error'; render(true);
    }
  }

  function loadHospitals() {
    if (!RS || RS.hospitals || RS.loadingHospitals) return;
    RS.loadingHospitals = true;
    const state = RS;
    HFAFacilities.hospitals(true).then(list => {
      state.hospitals = list; state.loadingHospitals = false;
      // A hospital chosen in a saved draft that is no longer listed must be chosen again.
      if (state.data.hospitalId && !['none', 'other'].includes(state.data.hospitalId) && !list.some(item => item.id === state.data.hospitalId)) state.data.hospitalId = '';
      if (RS === state && RS.step === 2) render();
    });
  }

  // Wizard text follows the interface language; re-render whenever it changes.
  const originalUpdateStaticHTML = window.updateStaticHTML;
  if (typeof originalUpdateStaticHTML === 'function') {
    window.updateStaticHTML = function () {
      const result = originalUpdateStaticHTML.apply(this, arguments);
      if (RS && container()) render();
      const label = document.getElementById('lbl-email'); if (label) label.textContent = t('login_identifier');
      return result;
    };
  }

  // ─────────────── Vital Health Card ───────────────
  function vitalCard(user = CU) {
    const health = user.healthProfile || {}, medical = health.medical || {};
    const blood = medical.bloodGroup && medical.bloodGroup !== 'unknown' ? medical.bloodGroup : (user.bloodType || '');
    const genotype = medical.genotype && medical.genotype !== 'unknown' ? medical.genotype : '';
    const allergies = medical.drugAllergies
      ? [...medical.drugAllergies.map(item => ({ text: `${item.name} (${label('severity', item.severity)})`, severe: item.severity === 'severe' || item.severity === 'anaphylaxis' })),
        ...(medical.foodAllergies ? [{ text: medical.foodAllergies }] : []), ...(medical.environmentalAllergies ? [{ text: medical.environmentalAllergies }] : [])]
      : (user.allergies && user.allergies !== 'None' ? [{ text: user.allergies }] : []);
    const conditions = medical.conditions?.length
      ? medical.conditions.map(code => code === 'other' ? medical.otherCondition : label('conditions', code)).filter(Boolean)
      : (Array.isArray(user.conditions) ? user.conditions.map(item => item.display).filter(Boolean) : []);
    const last = (DB.appointments || []).filter(item => item.patientId === user.id && item.status === 'completed').sort((a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`))[0];
    let lastText = t('vhc_never');
    if (last) {
      const doctor = G(last.doctorId), days = Math.max(0, Math.round((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86400000));
      lastText = `${doctor ? doctor.name : ''} — ${days === 0 ? t('vhc_today') : days === 1 ? t('vhc_yesterday') : tf('vhc_days_ago', { days })}`;
    }
    const item = (icon, title, value, extra = '') => `<div class="vhc-item ${extra}"><span class="vhc-icon" aria-hidden="true">${icon}</span><div><div class="vhc-label">${esc(title)}</div><div class="vhc-value">${value}</div></div></div>`;
    return `<section class="card mb18 vhc" aria-labelledby="vhc-title">
      <div class="ch"><div><h3 class="ct" id="vhc-title">${esc(t('vhc_title'))}</h3><div class="rating-note">${esc(t('vhc_sub'))}</div></div>
        <button type="button" class="btn bs bsm" onclick="HFAPatientRegistration.openCompletion()">${esc(t('vhc_update'))}</button></div>
      <div class="vhc-grid">
        ${item('🩸', t('vhc_blood'), esc(blood || t('vhc_unknown')))}
        ${item('🧬', t('vhc_genotype'), esc(genotype || t('vhc_unknown')))}
        ${item('⚠️', t('vhc_allergies'), allergies.length ? allergies.map(entry => `<span class="${entry.severe ? 'vhc-severe' : ''}">${esc(entry.text)}</span>`).join(', ') : esc(t('vhc_none')), allergies.some(entry => entry.severe) ? 'vhc-alert' : '')}
        ${item('💊', t('vhc_conditions'), esc(conditions.length ? conditions.join(', ') : t('vhc_none')))}
        ${item('📋', t('vhc_last'), esc(lastText))}
      </div>
    </section>`;
  }

  window.HFAPatientRegistration = {
    // Called when the patient role is chosen on the register screen.
    mount() {
      const host = document.getElementById('pwz');
      if (!host) return;
      if (!RS || RS.mode !== 'register') {
        const draft = loadDraft();
        RS = { mode: 'register', step: draft?.step || 1, data: draft?.data || blank(), errors: {}, files: {}, fileErrors: {}, photo: null, password: '', password2: '', draftRestored: !!draft, message: '', busy: false };
        if (draft && draft.data.language && draft.data.language !== LANG) { setLang(draft.data.language); return; }
      }
      loadHospitals();
      render();
    },
    unmount() { if (RS?.mode === 'register') { const host = document.getElementById('pwz'); if (host) host.innerHTML = ''; } },
    openCompletion() { navigate('complete-profile'); },
    renderPage(pc) {
      $('tbt').textContent = t('wz_complete_title');
      if (!RS || RS.mode !== 'complete') RS = { mode: 'complete', step: 1, data: fromUser(CU), errors: {}, files: {}, fileErrors: {}, photo: null, message: '', busy: false };
      loadHospitals();
      pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('wz_complete_title'))}</h2><p>${esc(HFACompletion.compute(CU).percent + '%')} · ${esc(t('pc_title'))}</p></div><div class="card" id="pwz-page"></div></div>`;
      render();
    },
    next() {
      const errors = validateStep(RS.step);
      if (Object.keys(errors).length) { goToFirstError(errors); return; }
      RS.errors = {}; RS.message = ''; RS.step = Math.min(5, RS.step + 1); saveDraft(); render();
      document.getElementById('wz-heading')?.focus();
      container()?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    },
    back() { RS.errors = {}; RS.message = ''; RS.step = Math.max(1, RS.step - 1); saveDraft(); render(); document.getElementById('wz-heading')?.focus(); },
    goTo(step) { if (step < RS.step) { RS.errors = {}; RS.message = ''; RS.step = step; saveDraft(); render(); document.getElementById('wz-heading')?.focus(); } },
    addRow(list) {
      const empty = { drugAllergies: { name: '', severity: 'mild' }, medications: { name: '', dose: '', frequency: '', prescriber: '', since: '' }, surgeries: { procedure: '', year: '', hospital: '' } }[list];
      D()[list].push({ ...empty }); saveDraft(); render();
      document.getElementById(`w-${list}-${D()[list].length - 1}-${Object.keys(empty)[0]}`)?.focus();
    },
    removeRow(list, index) {
      D()[list].splice(index, 1);
      Object.keys(RS.errors).filter(key => key.startsWith(list + '.')).forEach(key => delete RS.errors[key]);
      saveDraft(); render();
    },
    choosePhoto() {
      HFAAvatar.openEditor({ mode: 'select', user: { name: trim(D().name) || '?' }, previewUrl: RS.photo?.previewUrl, onSelect: (file, previewUrl) => {
        if (RS.photo?.previewUrl && RS.photo.previewUrl !== previewUrl) URL.revokeObjectURL(RS.photo.previewUrl);
        RS.photo = file ? { file, previewUrl } : null;
        render();
      } });
    },
    captureGps() {
      if (!navigator.geolocation) { RS.gpsMessage = t('wz_gps_unsupported'); render(); return; }
      const status = document.getElementById('wz-gps-status'); if (status) status.textContent = t('wz_gps_finding');
      const button = document.getElementById('wz-gps-btn'); if (button) button.disabled = true;
      navigator.geolocation.getCurrentPosition(position => {
        if (!RS) return;
        D().gps = { lat: Math.round(position.coords.latitude * 1e5) / 1e5, lng: Math.round(position.coords.longitude * 1e5) / 1e5, accuracy: Math.min(100000, Math.round(position.coords.accuracy || 0)), capturedAt: new Date().toISOString() };
        RS.gpsMessage = ''; saveDraft(); render();
      }, error => {
        if (!RS) return;
        RS.gpsMessage = error.code === 1 ? t('wz_gps_denied') : t('wz_gps_failed'); render();
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    },
    clearGps() { D().gps = null; RS.gpsMessage = ''; saveDraft(); render(); },
    startOver() {
      if (!confirm(t('wz_start_over_confirm'))) return;
      clearDraft();
      if (RS?.photo?.previewUrl) URL.revokeObjectURL(RS.photo.previewUrl);
      RS = { mode: 'register', step: 1, data: blank(), errors: {}, files: {}, fileErrors: {}, photo: null, password: '', password2: '', draftRestored: false, message: '', busy: false };
      loadHospitals();
      render();
      document.getElementById('wz-heading')?.focus();
    },
    async submit() {
      if (RS.busy) return;
      for (let step = 1; step <= 5; step++) {
        const errors = validateStep(step);
        if (Object.keys(errors).length) { RS.step = step; goToFirstError(errors); return; }
      }
      RS.errors = {};
      if (RS.mode === 'complete') submitComplete(); else submitRegister();
    },
    vitalCard,
    applyLegacy,
    normPhone,
    // Exposed for tests.
    _state: () => RS, _validateStep: validateStep, _buildHealthProfile: buildHealthProfile, DIVISIONS, OPTIONS: O
  };
})();
