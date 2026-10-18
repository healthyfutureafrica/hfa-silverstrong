/**
 * English strings for the HFA WhatsApp bot.
 * Every key here must also exist in fr.js (full parity is checked at startup by menu.js).
 * Placeholders in {curly braces} are replaced at send time.
 */
module.exports = {
  languageName: 'English',

  greeting:
    '👋 Welcome to *Healthy Future Africa (HFA)*.\n' +
    'Quality healthcare from your phone: talk to a qualified doctor, find a verified pharmacy, ' +
    'or book a lab test, wherever you are in Cameroon.\n\n' +
    'Tapez *FR* pour continuer en français.',

  returningGreeting: '👋 Welcome back to *Healthy Future Africa (HFA)*.',

  menuTitle: 'How can we help you today? Reply with a number:',
  menuOptions: [
    '1️⃣ I have symptoms / I feel unwell',
    '2️⃣ Book a doctor consultation',
    '3️⃣ Find a pharmacy near me',
    '4️⃣ Request a lab test',
    '5️⃣ I am a healthcare provider',
    '6️⃣ 🚨 Emergency',
    '7️⃣ Talk to a human'
  ],
  menuFooter: 'Reply *0* or *MENU* at any time to see this menu again.',

  optionSelected: {
    1: '🩺 *Symptom check*',
    2: '📅 *Book a doctor consultation*',
    3: '💊 *Find a pharmacy near me*',
    4: '🧪 *Request a lab test*',
    5: '👩‍⚕️ *Healthcare provider registration*',
    7: '🙋 *Talk to a human*'
  },
  comingSoon:
    'This service is being set up on WhatsApp and will be available very soon.\n' +
    'In the meantime you can use the HFA platform: {platformUrl}\n\n' +
    'Reply *0* for the main menu.',

  emergency:
    '🚨 *EMERGENCY*\n\n' +
    'If someone is in danger right now, *call SAMU on {samuNumber} immediately* ' +
    'or go to the nearest hospital emergency department.\n\n' +
    'Call for help now if there is: chest pain, difficulty breathing, signs of stroke ' +
    '(face drooping, arm weakness, speech problems), severe bleeding, loss of consciousness, ' +
    'a seizure, severe injury, or thoughts of harming yourself.\n\n' +
    'Do not wait for a reply on WhatsApp.',

  invalidOption: 'Sorry, I did not understand. Please reply with a number from *1* to *7*.',
  unsupportedMessageType: 'For now I can only read text messages. Please type your answer.',
  languageSwitched: '✅ I will continue in English.',
  errorFallback: 'Sorry, something went wrong on our side. Please try again in a moment, or reply *0* for the main menu.'
};
