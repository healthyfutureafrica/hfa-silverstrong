/**
 * Shared English strings used by @hfa/ui components and by every portal.
 * fr.js must define exactly the same keys (a test enforces full parity).
 * Placeholders such as {count} are filled in by t('key', { count: 3 }).
 */
const en = {
  common: {
    appName: 'Healthy Future Africa',
    appShortName: 'HFA',
    save: 'Save',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    confirm: 'Confirm',
    continue: 'Continue',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    retry: 'Try again',
    search: 'Search',
    filter: 'Filter',
    clear: 'Clear',
    loading: 'Loading…',
    saving: 'Saving…',
    yes: 'Yes',
    no: 'No',
    optional: 'Optional',
    required: 'Required',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    seeAll: 'See all',
    viewDetails: 'View details',
    download: 'Download',
    upload: 'Upload',
    lastUpdated: 'Last updated {time}'
  },
  avatar: {
    label: 'Profile picture',
    altFor: 'Profile picture of {name}',
    placeholderFor: 'No profile picture for {name}',
    dropHint: 'Drag a photo here, or click to choose one',
    dropActive: 'Drop the photo to upload it',
    requirements: 'JPG, PNG or WebP · at least 200×200 pixels · up to {maxMb} MB',
    takePhoto: 'Take photo',
    choosePhoto: 'Choose photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove photo',
    cropTitle: 'Adjust your photo',
    cropHelp: 'Drag to position your face inside the circle, then use the slider to zoom.',
    zoom: 'Zoom',
    usePhoto: 'Use this photo',
    processing: 'Preparing your photo…',
    uploading: 'Uploading… {percent}%',
    uploaded: 'Profile picture updated',
    removed: 'Profile picture removed',
    errorTooLarge: 'This photo is too large. The maximum size is {maxMb} MB.',
    errorWrongType: 'This file type is not supported. Please choose a JPG, PNG or WebP photo.',
    errorTooSmall: 'This photo is too small. It must be at least {min}×{min} pixels.',
    errorUnreadable: 'This photo could not be opened. Please try another one.',
    errorUploadFailed: 'The upload failed. Check your connection and try again.',
    errorRemoveFailed: 'The photo could not be removed. Please try again.'
  },
  profile: {
    completion: 'Profile {percent}% complete',
    completionGood: 'Your profile is complete',
    completionFair: 'Your profile is almost complete',
    completionLow: 'Please complete your profile',
    completionBlocked: 'Complete at least {min}% of your profile to continue.',
    completeNow: 'Complete my profile'
  },
  validation: {
    required: 'This field is required',
    invalidEmail: 'Enter a valid email address',
    invalidPhone: 'Enter a valid phone number, e.g. +237 6XX XX XX XX',
    tooShort: 'Must be at least {min} characters',
    tooLong: 'Must be at most {max} characters',
    passwordWeak: 'Use at least 8 characters with upper and lower case letters, a number and a symbol',
    passwordsDoNotMatch: 'The passwords do not match',
    invalidDate: 'Enter a valid date',
    futureDate: 'The date cannot be in the future'
  },
  network: {
    offline: 'You are offline — data will sync when connected',
    backOnline: 'You are back online',
    syncing: 'Syncing…',
    pendingSync: '{count} records waiting to sync',
    showingCached: 'Showing data saved on {time}'
  },
  notifications: {
    title: 'Notifications',
    open: 'Open notifications',
    unread: '{count} unread',
    markAllRead: 'Mark all as read',
    markRead: 'Mark as read',
    empty: 'You have no notifications',
    types: {
      appointment: 'Appointment',
      prescription: 'Prescription',
      labResult: 'Lab result',
      payment: 'Payment',
      system: 'System',
      emergency: 'Emergency'
    }
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'We could not reach HFA. Check your internet connection.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    forbidden: 'You do not have permission to do this.',
    notFound: 'We could not find what you were looking for.',
    boundaryTitle: 'This page could not be displayed',
    boundaryBody: 'An unexpected error occurred. Your data is safe.',
    reload: 'Reload page'
  },
  theme: {
    toggle: 'Switch colour theme',
    light: 'Light',
    dark: 'Dark',
    system: 'Use device setting'
  },
  language: {
    label: 'Language',
    en: 'English',
    fr: 'Français'
  },
  roles: {
    patient: 'Patient',
    doctor: 'Doctor',
    pharmacist: 'Pharmacist',
    lab: 'Laboratory technician',
    chw: 'Community health worker',
    admin: 'Administrator'
  },
  regions: {
    adamawa: 'Adamawa',
    centre: 'Centre',
    east: 'East',
    farNorth: 'Far North',
    littoral: 'Littoral',
    north: 'North',
    northWest: 'North-West',
    west: 'West',
    south: 'South',
    southWest: 'South-West'
  }
};

export default en;
