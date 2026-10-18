/**
 * Chaînes françaises partagées par les composants @hfa/ui et par tous les portails.
 * Doit définir exactement les mêmes clés que en.js (un test vérifie la parité complète).
 * Les variables comme {count} sont remplies par t('clé', { count: 3 }).
 */
const fr = {
  common: {
    appName: 'Healthy Future Africa',
    appShortName: 'HFA',
    save: 'Enregistrer',
    saveChanges: 'Enregistrer les modifications',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    continue: 'Continuer',
    back: 'Retour',
    next: 'Suivant',
    finish: 'Terminer',
    close: 'Fermer',
    edit: 'Modifier',
    delete: 'Supprimer',
    remove: 'Retirer',
    retry: 'Réessayer',
    search: 'Rechercher',
    filter: 'Filtrer',
    clear: 'Effacer',
    loading: 'Chargement…',
    saving: 'Enregistrement…',
    yes: 'Oui',
    no: 'Non',
    optional: 'Facultatif',
    required: 'Obligatoire',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    seeAll: 'Tout voir',
    viewDetails: 'Voir les détails',
    download: 'Télécharger',
    upload: 'Téléverser',
    lastUpdated: 'Dernière mise à jour {time}'
  },
  avatar: {
    label: 'Photo de profil',
    altFor: 'Photo de profil de {name}',
    placeholderFor: 'Pas de photo de profil pour {name}',
    dropHint: 'Glissez une photo ici ou cliquez pour en choisir une',
    dropActive: 'Déposez la photo pour la téléverser',
    requirements: 'JPG, PNG ou WebP · au moins 200×200 pixels · jusqu’à {maxMb} Mo',
    takePhoto: 'Prendre une photo',
    choosePhoto: 'Choisir une photo',
    changePhoto: 'Changer de photo',
    removePhoto: 'Retirer la photo',
    cropTitle: 'Ajustez votre photo',
    cropHelp: 'Faites glisser pour placer votre visage dans le cercle, puis utilisez le curseur pour zoomer.',
    zoom: 'Zoom',
    usePhoto: 'Utiliser cette photo',
    processing: 'Préparation de votre photo…',
    uploading: 'Téléversement… {percent} %',
    uploaded: 'Photo de profil mise à jour',
    removed: 'Photo de profil retirée',
    errorTooLarge: 'Cette photo est trop lourde. La taille maximale est de {maxMb} Mo.',
    errorWrongType: 'Ce type de fichier n’est pas pris en charge. Choisissez une photo JPG, PNG ou WebP.',
    errorTooSmall: 'Cette photo est trop petite. Elle doit faire au moins {min}×{min} pixels.',
    errorUnreadable: 'Cette photo n’a pas pu être ouverte. Veuillez en essayer une autre.',
    errorUploadFailed: 'Le téléversement a échoué. Vérifiez votre connexion et réessayez.',
    errorRemoveFailed: 'La photo n’a pas pu être retirée. Veuillez réessayer.'
  },
  profile: {
    completion: 'Profil complété à {percent} %',
    completionGood: 'Votre profil est complet',
    completionFair: 'Votre profil est presque complet',
    completionLow: 'Veuillez compléter votre profil',
    completionBlocked: 'Complétez au moins {min} % de votre profil pour continuer.',
    completeNow: 'Compléter mon profil'
  },
  validation: {
    required: 'Ce champ est obligatoire',
    invalidEmail: 'Saisissez une adresse e-mail valide',
    invalidPhone: 'Saisissez un numéro valide, par ex. +237 6XX XX XX XX',
    tooShort: 'Au moins {min} caractères',
    tooLong: 'Au plus {max} caractères',
    passwordWeak: 'Utilisez au moins 8 caractères avec majuscules, minuscules, un chiffre et un symbole',
    passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
    invalidDate: 'Saisissez une date valide',
    futureDate: 'La date ne peut pas être dans le futur'
  },
  network: {
    offline: 'Vous êtes hors ligne — les données seront synchronisées à la reconnexion',
    backOnline: 'Vous êtes de nouveau en ligne',
    syncing: 'Synchronisation…',
    pendingSync: '{count} enregistrements en attente de synchronisation',
    showingCached: 'Données enregistrées le {time}'
  },
  notifications: {
    title: 'Notifications',
    open: 'Ouvrir les notifications',
    unread: '{count} non lues',
    markAllRead: 'Tout marquer comme lu',
    markRead: 'Marquer comme lu',
    empty: 'Vous n’avez aucune notification',
    types: {
      appointment: 'Rendez-vous',
      prescription: 'Ordonnance',
      labResult: 'Résultat d’analyse',
      payment: 'Paiement',
      system: 'Système',
      emergency: 'Urgence'
    }
  },
  errors: {
    generic: 'Un problème est survenu. Veuillez réessayer.',
    network: 'Impossible de joindre HFA. Vérifiez votre connexion internet.',
    sessionExpired: 'Votre session a expiré. Veuillez vous reconnecter.',
    forbidden: 'Vous n’avez pas l’autorisation de faire cela.',
    notFound: 'Nous n’avons pas trouvé ce que vous cherchez.',
    boundaryTitle: 'Cette page n’a pas pu s’afficher',
    boundaryBody: 'Une erreur inattendue s’est produite. Vos données sont en sécurité.',
    reload: 'Recharger la page'
  },
  theme: {
    toggle: 'Changer le thème de couleur',
    light: 'Clair',
    dark: 'Sombre',
    system: 'Utiliser le réglage de l’appareil'
  },
  language: {
    label: 'Langue',
    en: 'English',
    fr: 'Français'
  },
  roles: {
    patient: 'Patient',
    doctor: 'Médecin',
    pharmacist: 'Pharmacien',
    lab: 'Technicien de laboratoire',
    chw: 'Agent de santé communautaire',
    admin: 'Administrateur'
  },
  regions: {
    adamawa: 'Adamaoua',
    centre: 'Centre',
    east: 'Est',
    farNorth: 'Extrême-Nord',
    littoral: 'Littoral',
    north: 'Nord',
    northWest: 'Nord-Ouest',
    west: 'Ouest',
    south: 'Sud',
    southWest: 'Sud-Ouest'
  }
};

export default fr;
