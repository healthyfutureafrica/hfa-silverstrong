/**
 * Chaînes françaises du bot WhatsApp HFA.
 * Chaque clé doit aussi exister dans en.js (parité complète, vérifiée au démarrage par menu.js).
 * Les éléments entre {accolades} sont remplacés à l'envoi.
 */
module.exports = {
  languageName: 'Français',

  greeting:
    '👋 Bienvenue chez *Healthy Future Africa (HFA)*.\n' +
    'Des soins de qualité depuis votre téléphone : parlez à un médecin qualifié, trouvez une ' +
    'pharmacie vérifiée ou demandez un examen de laboratoire, où que vous soyez au Cameroun.\n\n' +
    'Type *EN* to continue in English.',

  returningGreeting: '👋 Bon retour chez *Healthy Future Africa (HFA)*.',

  menuTitle: 'Comment pouvons-nous vous aider aujourd’hui ? Répondez par un numéro :',
  menuOptions: [
    '1️⃣ J’ai des symptômes / Je ne me sens pas bien',
    '2️⃣ Prendre rendez-vous avec un médecin',
    '3️⃣ Trouver une pharmacie près de chez moi',
    '4️⃣ Demander un examen de laboratoire',
    '5️⃣ Je suis un professionnel de santé',
    '6️⃣ 🚨 Urgence',
    '7️⃣ Parler à une personne'
  ],
  menuFooter: 'Répondez *0* ou *MENU* à tout moment pour revoir ce menu.',

  optionSelected: {
    1: '🩺 *Évaluation des symptômes*',
    2: '📅 *Prendre rendez-vous avec un médecin*',
    3: '💊 *Trouver une pharmacie près de chez moi*',
    4: '🧪 *Demander un examen de laboratoire*',
    5: '👩‍⚕️ *Inscription des professionnels de santé*',
    7: '🙋 *Parler à une personne*'
  },
  comingSoon:
    'Ce service est en cours de mise en place sur WhatsApp et sera bientôt disponible.\n' +
    'En attendant, vous pouvez utiliser la plateforme HFA : {platformUrl}\n\n' +
    'Répondez *0* pour le menu principal.',

  emergency:
    '🚨 *URGENCE*\n\n' +
    'Si une personne est en danger maintenant, *appelez immédiatement le SAMU au {samuNumber}* ' +
    'ou rendez-vous aux urgences de l’hôpital le plus proche.\n\n' +
    'Appelez les secours sans attendre en cas de : douleur thoracique, difficulté à respirer, ' +
    'signes d’AVC (visage qui tombe, faiblesse d’un bras, troubles de la parole), saignement ' +
    'abondant, perte de connaissance, convulsions, blessure grave ou idées de vous faire du mal.\n\n' +
    'N’attendez pas une réponse sur WhatsApp.',

  invalidOption: 'Désolé, je n’ai pas compris. Veuillez répondre par un numéro de *1* à *7*.',
  unsupportedMessageType: 'Pour le moment, je ne lis que les messages texte. Veuillez écrire votre réponse.',
  languageSwitched: '✅ Je continue en français.',
  errorFallback: 'Désolé, un problème est survenu de notre côté. Veuillez réessayer dans un instant ou répondre *0* pour le menu principal.'
};
