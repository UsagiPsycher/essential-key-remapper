const en = {
  "gesture.single": "Press",
  "gesture.double": "Double press",
  "gesture.hold": "Hold",

  "action.none": "No action",
  "action.torch": "Flashlight",
  "action.camera": "Camera",
  "action.screenshot": "Screenshot",
  "action.assistant": "Assistant",
  "action.lock": "Lock screen",
  "action.notifications": "Notifications",
  "action.quick_settings": "Quick settings",
  "action.recents": "Recent apps",
  "action.power_menu": "Power menu",
  "action.play_pause": "Play / pause",
  "action.next_track": "Next track",
  "action.vibrate_mode": "Vibrate mode",
  "action.dnd": "Do not disturb",
  "action.app": "Open an app",
  "tip.torch": "Turns the flashlight on or off",
  "tip.camera": "Works on the lock screen too",
  "tip.vibrate_mode": "Switches between ring and vibrate",
  "tip.dnd": "Turns Do not disturb on or off",
  "tip.assistant": "Opens your default voice assistant",

  "group.shortcuts": "Shortcuts",
  "group.system": "System",
  "group.sound": "Sound and music",
  "group.apps": "Apps",

  "tools.title": "Getting Android tools",
  "tools.note": "One-time download from Google, about 7 MB.",
  "tools.failed": "Download failed. Check your internet connection.",
  "tools.retry": "Try again",

  "connect.title": "Plug in your phone",
  "connect.lead": "Use a USB cable that carries data, not just power.",
  "connect.help": "USB debugging is off?",
  "connect.step1": "Settings › About phone: tap Build number 7 times.",
  "connect.step2": "Settings › System › Developer options: turn on USB debugging.",
  "connect.step3": "Unplug, plug back in, then allow this computer.",

  "auth.title": "Allow this computer on your phone",
  "auth.lead": "Tap Allow on the USB debugging prompt. Tick Always allow to skip this next time.",

  "nokey.title": "No Essential key on this phone",
  "nokey.lead": "Plug in a Nothing phone that has the Essential key.",

  "setup.title": "Set up the key",
  "setup.lead": "The key will stop opening Essential Space. You can bring it back at any time.",
  "setup.go": "Set up",
  "setup.update": "Update the phone app",
  "setup.retry": "Try again",
  "step.install": "Install the companion app",
  "step.stock": "Turn off Essential Space on the key",
  "step.service": "Let the app read the key",
  "step.ready": "Check the key is caught",

  "learn.title": "Press the Essential key",
  "learn.lead": "Once, on the side of the phone.",
  "learn.wrong": "Pressed another key? Press the Essential key instead.",

  "map.title": "What the key does",
  "map.saved": "Saved",
  "map.live": "Changes reach the phone right away.",
  "map.failed": "Not saved. Check the phone is still plugged in.",
  "map.dndHint": "Do not disturb needs permission on this phone.",

  "picker.title": "Choose an action",
  "picker.back": "Back",
  "picker.close": "Close",
  "picker.search": "Search apps",
  "picker.loading": "Loading apps…",
  "picker.noApps": "No app matches.",
  "picker.appsFailed": "Couldn't list the apps.",

  "stage.idle": "Press the key to try it",
  "stage.failed": "Didn't work on the phone",
  "stage.notPlugged": "Waiting for a phone",

  "menu.label": "More",
  "menu.haptics": "Vibrate on action",
  "menu.relearn": "Detect the key again",
  "menu.restore": "Bring back Essential Space…",

  "restore.title": "Bring back Essential Space?",
  "restore.lead": "The key goes back to how it was before.",
  "restore.uninstall": "Also remove the companion app",
  "restore.cancel": "Cancel",
  "restore.go": "Bring it back",
  "restore.done": "Essential Space is back",
  "restore.failed": "Couldn't restore. Check the phone is still plugged in.",

  "error.generic": "Something went wrong on the phone.",
};

type Key = keyof typeof en;

const fr: Record<Key, string> = {
  "gesture.single": "Appui",
  "gesture.double": "Double appui",
  "gesture.hold": "Appui long",

  "action.none": "Aucune action",
  "action.torch": "Lampe torche",
  "action.camera": "Appareil photo",
  "action.screenshot": "Capture d’écran",
  "action.assistant": "Assistant",
  "action.lock": "Verrouiller l’écran",
  "action.notifications": "Notifications",
  "action.quick_settings": "Réglages rapides",
  "action.recents": "Apps récentes",
  "action.power_menu": "Menu marche/arrêt",
  "action.play_pause": "Lecture / pause",
  "action.next_track": "Piste suivante",
  "action.vibrate_mode": "Mode vibreur",
  "action.dnd": "Ne pas déranger",
  "action.app": "Ouvrir une app",
  "tip.torch": "Allume ou éteint la lampe",
  "tip.camera": "Fonctionne aussi écran verrouillé",
  "tip.vibrate_mode": "Bascule entre sonnerie et vibreur",
  "tip.dnd": "Active ou coupe Ne pas déranger",
  "tip.assistant": "Ouvre l’assistant vocal par défaut",

  "group.shortcuts": "Raccourcis",
  "group.system": "Système",
  "group.sound": "Son et musique",
  "group.apps": "Apps",

  "tools.title": "Préparation des outils Android",
  "tools.note": "Téléchargement unique depuis Google, environ 7 Mo.",
  "tools.failed": "Téléchargement impossible. Vérifiez la connexion internet.",
  "tools.retry": "Réessayer",

  "connect.title": "Branchez votre téléphone",
  "connect.lead": "Avec un câble USB qui transfère les données, pas seulement la charge.",
  "connect.help": "Le débogage USB est désactivé ?",
  "connect.step1": "Paramètres › À propos du téléphone : touchez 7 fois Numéro de build.",
  "connect.step2": "Paramètres › Système › Options pour les développeurs : activez Débogage USB.",
  "connect.step3": "Débranchez, rebranchez, puis autorisez cet ordinateur.",

  "auth.title": "Autorisez cet ordinateur sur le téléphone",
  "auth.lead": "Touchez Autoriser sur l’invite de débogage USB. Cochez Toujours autoriser pour ne plus avoir à le faire.",

  "nokey.title": "Ce téléphone n’a pas de touche Essential",
  "nokey.lead": "Branchez un téléphone Nothing équipé de la touche Essential.",

  "setup.title": "Configurer la touche",
  "setup.lead": "La touche n’ouvrira plus Essential Space. Vous pourrez le rétablir à tout moment.",
  "setup.go": "Configurer",
  "setup.update": "Mettre à jour l’app du téléphone",
  "setup.retry": "Réessayer",
  "step.install": "Installer l’app compagnon",
  "step.stock": "Retirer Essential Space de la touche",
  "step.service": "Autoriser l’app à lire la touche",
  "step.ready": "Vérifier que la touche est captée",

  "learn.title": "Appuyez sur la touche Essential",
  "learn.lead": "Une fois, sur la tranche du téléphone.",
  "learn.wrong": "Autre touche ? Appuyez plutôt sur la touche Essential.",

  "map.title": "Ce que fait la touche",
  "map.saved": "Enregistré",
  "map.live": "Chaque choix s’applique tout de suite au téléphone.",
  "map.failed": "Non enregistré. Vérifiez que le téléphone est toujours branché.",
  "map.dndHint": "Ne pas déranger demande une autorisation sur ce téléphone.",

  "picker.title": "Choisir une action",
  "picker.back": "Retour",
  "picker.close": "Fermer",
  "picker.search": "Rechercher une app",
  "picker.loading": "Chargement des apps…",
  "picker.noApps": "Aucune app ne correspond.",
  "picker.appsFailed": "Impossible de lister les apps.",

  "stage.idle": "Appuyez sur la touche pour essayer",
  "stage.failed": "N’a pas fonctionné sur le téléphone",
  "stage.notPlugged": "En attente d’un téléphone",

  "menu.label": "Plus",
  "menu.haptics": "Vibrer à chaque action",
  "menu.relearn": "Détecter la touche à nouveau",
  "menu.restore": "Rétablir Essential Space…",

  "restore.title": "Rétablir Essential Space ?",
  "restore.lead": "La touche retrouve son comportement d’origine.",
  "restore.uninstall": "Supprimer aussi l’app compagnon",
  "restore.cancel": "Annuler",
  "restore.go": "Rétablir",
  "restore.done": "Essential Space est rétabli",
  "restore.failed": "Rétablissement impossible. Vérifiez que le téléphone est toujours branché.",

  "error.generic": "Une erreur est survenue sur le téléphone.",
};

const dict = navigator.language.toLowerCase().startsWith("fr") ? fr : en;
document.documentElement.lang = dict === fr ? "fr" : "en";

export const t = (key: Key) => dict[key];
export type { Key };
