/** English source strings and French UI translations. User content is excluded. */
const fr = {
  "Paid with income": "Payé avec le revenu",
  "Payment date": "Date de paiement",
  "Not included in projected reserves.": "Non compté dans les réserves prévisionnelles.",
  "Common budget amount": "Montant du commun",
  "Show budget title": "Afficher le titre du budget",
  "Show period and dates": "Afficher la période et les dates",
  "Show budget icon": "Afficher l’icône du budget",
  "Show remaining after expenses": "Afficher le reste après les dépenses",
  "Show calculation label": "Afficher le mode de calcul",
  "Show income": "Afficher les revenus",
  "Show expenses": "Afficher les dépenses",
  "Show common budget amount": "Afficher le montant du commun",
  "Show available after reserves": "Afficher le disponible après réserves",
  "Show reserve explanation": "Afficher l’explication des réserves",
  "Show link to Autonomous Budget": "Afficher le lien vers Autonomous Budget",
  "Next pay period": "Prochaine période de paie",
  "Reserved for this pay period": "Réservé pour cette période de paie",
  "Budget type": "Type de budget",
  "Personal budget": "Budget personnel",
  "Shared budget": "Budget commun",
  "Shared": "Commun",
  "Shared budget allocation": "Répartition du budget commun",
  "Manage allocation": "Gérer la répartition",
  "Automatic contributions to personal budgets": "Contributions automatiques aux budgets personnels",
  "Choose the personal budgets and percentages to share these expenses.": "Choisissez les budgets personnels et les pourcentages pour répartir ces dépenses.",
  "Next contribution": "Prochaine contribution",
  "Each share covers this budget’s expenses. Income is not deducted. Contributions are added as mandatory expenses on each person’s payday.": "Chaque part couvre les dépenses de ce budget. Les revenus ne sont pas déduits. Les contributions sont ajoutées comme dépenses obligatoires à la date de paie de chaque personne.",
  "Automatic contribution": "Contribution automatique",
  "Open shared budget": "Ouvrir le budget commun",
  "Based on participants’ paydays": "Selon les dates de paie des participants",
  "Create a personal budget for each person first, using the same currency as the shared budget. Each person’s optional pay schedule determines their contribution dates.": "Créez d’abord un budget personnel par personne, dans la même devise que le budget commun. Le calendrier de paie facultatif de chacun détermine ses dates de contribution.",
  "Share (%)": "Part (%)",
  "Set a share to 0 to remove the contribution. Unallocated amounts remain in the shared budget.": "Mettez une part à 0 pour supprimer la contribution. Les montants non répartis restent dans le budget commun.",
  "The total allocation cannot exceed 100%.": "La répartition totale ne peut pas dépasser 100 %.",
  "Linked contributions will be removed. Other people’s percentages will not be increased.": "Les contributions liées seront supprimées. Les pourcentages des autres personnes ne seront pas augmentés.",
  "Choose up to 50 personal budgets for the allocation.": "Choisissez jusqu’à 50 budgets personnels pour la répartition.",
  "Choose a personal budget and its percentage.": "Choisissez un budget personnel et son pourcentage.",
  "Percentages allow at most 2 decimal places.": "Les pourcentages acceptent au maximum 2 décimales.",
  "Only shared budgets can have an allocation.": "Seuls les budgets communs peuvent avoir une répartition.",
  "Contributions must go to an existing personal budget.": "Les contributions doivent être ajoutées à un budget personnel existant.",
  "Each personal budget can appear only once in an allocation.": "Chaque budget personnel ne peut apparaître qu’une fois dans une répartition.",
  "Shared and personal budgets must use the same currency.": "Les budgets communs et personnels doivent utiliser la même devise.",
  "Automatic contributions are managed in the shared budget.": "Les contributions automatiques se gèrent dans le budget commun.",
  "Percentage must be between 0 and 100.": "Le pourcentage doit être compris entre 0 et 100.",
  "Budget ID must contain 1–100 characters.": "L’identifiant du budget doit contenir entre 1 et 100 caractères.",

  "Home Assistant entity": "Entité Home Assistant", "Reserve entity": "Entité de réserve", "Entity ID": "Identifiant de l’entité", "Add to a dashboard": "Ajouter à un tableau de bord", "Open entity": "Ouvrir l’entité",
  "This sensor tracks the total projected reserve for this budget, in its currency. It updates after edits and at local midnight.": "Ce capteur suit la réserve prévisionnelle totale de ce budget, dans sa devise. Il est actualisé après les modifications et à minuit, heure locale.",
  "The reserve entity is unavailable. In Settings → Devices & services → Autonomous Budget, open this budget and enable its Projected reserve sensor if disabled. Restart Home Assistant after updating the integration.": "L’entité de réserve est indisponible. Dans Paramètres → Appareils et services → Autonomous Budget, ouvrez ce budget et activez son capteur Réserve prévisionnelle s’il est désactivé. Redémarrez Home Assistant après la mise à jour de l’intégration.",
  "To categorize": "À catégoriser", "Choose a category": "Choisissez une catégorie",
  "Per pay period": "Par période de paie",
  "Due dates": "Échéances",
  "Calculation view": "Mode de calcul",
  "Income per pay period": "Revenus par période de paie",
  "Expenses per pay period": "Dépenses par période de paie",
  "Recurring income on the same time scale": "Revenus récurrents ramenés à la même période",
  "A regular share of your commitments": "Une part régulière de vos engagements",
  "Original amount": "Montant d’origine",
  "Recurring amounts are normalized to your pay period.": "Les montants récurrents sont ramenés à votre période de paie.",
  "Projected reserves": "Réserves prévisionnelles",
  "Reserve progress": "Progression de la réserve",
  "per reserve installment": "par versement de réserve",
  "Add a recurring expense to see its projected reserve.": "Ajoutez une dépense récurrente pour voir sa réserve prévisionnelle.",
  "Available after reserves": "Disponible après réserves",
  "Add an account balance in Edit budget to see this estimate.": "Renseignez un solde dans Modifier le budget pour voir cette estimation.",
  "Account balance": "Solde du compte",
  "Credit owed": "Crédit à rembourser",
  "Estimated amounts, assuming earlier installments were saved and due bills were paid. Update manual balances as needed.": "Montants estimés, en supposant que les versements précédents ont été épargnés et les factures échues payées. Actualisez les soldes manuels au besoin.",
  "Assumes earlier installments were saved and due bills were paid.": "Suppose que les versements précédents ont été épargnés et les factures échues payées.",
  "Account balance (optional)": "Solde du compte (facultatif)",
  "Credit owed (optional)": "Crédit à rembourser (facultatif)",
  "Enter balances manually in the budget currency. Available after reserves = account balance − credit owed + projected reserves (negative). Leave account balance blank to hide this estimate.": "Saisissez les soldes manuellement dans la devise du budget. Disponible après réserves = solde du compte − crédit à rembourser + réserves prévisionnelles (négatives). Laissez le solde vide pour masquer cette estimation.",
  "Switch between a regular plan per pay period and payments on their actual due dates. Reserves estimate what should already be set aside for recurring expenses; they do not track transfers or cleared payments.": "Passez du budget régulier par période de paie aux paiements à leurs dates réelles. Les réserves estiment le montant à avoir mis de côté pour les dépenses récurrentes ; elles ne suivent pas les virements ni les paiements effectués.",
  "Eleven native sensors are also available under Settings → Devices & services → Autonomous Budget.": "Onze capteurs sont aussi disponibles dans Paramètres → Appareils et services → Autonomous Budget.",
  "Show projected reserves": "Afficher les réserves prévisionnelles",
  "Enter a valid balance in the budget currency. Credit owed cannot be negative.": "Saisissez un solde valide dans la devise du budget. Le crédit à rembourser ne peut pas être négatif.",

  "Use default": "Utiliser le réglage par défaut",
  "Daily": "Tous les jours", "Weekly": "Toutes les semaines", "Every two weeks": "Toutes les deux semaines",
  "Monthly": "Tous les mois", "Quarterly": "Tous les trois mois", "Yearly": "Tous les ans", "One time": "Une seule fois",
  "Investment": "Investissement", "Mandatory": "Obligatoire", "Optional": "Facultatif", "Income": "Revenus", "Expense": "Dépense", "Expenses": "Dépenses",
  "Export": "Exporter", "Export budgets": "Exporter les budgets", "Settings": "Paramètres", "View only": "Lecture seule",
  "Open Home Assistant menu": "Ouvrir le menu Home Assistant", "A little clarity, every payday": "Un peu de clarté à chaque paie",
  "Your money, in view.": "Votre argent, en un regard.", "Make room for what matters. Plan the rest.": "Gardez une place pour l’essentiel. Planifiez le reste.",
  "New budget": "Nouveau budget", "Budgets": "Budgets", "A fresh start for your finances": "Un nouveau départ pour vos finances",
  "Create your first budget, then add your income, everyday bills, and future plans.": "Créez votre premier budget, puis ajoutez vos revenus, vos factures et vos projets.",
  "Create your first budget": "Créer votre premier budget", "Ask a Home Assistant administrator to create a budget.": "Demandez à un administrateur Home Assistant de créer un budget.",
  "Local to your home. In sync with your life.": "Chez vous, au rythme de votre vie.", "Current period": "Période actuelle", "Past period projection": "Prévision d’une période passée",
  "Upcoming period projection": "Prévision d’une période à venir", "Scheduled cash flow": "Mouvements d’argent prévus", "Previous period": "Période précédente",
  "Next period": "Période suivante", "Today": "Aujourd’hui", "Period totals": "Totaux de la période", "Left after expenses": "Reste après les dépenses",
  "Planned expenses exceed income this period": "Les dépenses prévues dépassent les revenus de la période", "Income minus everything you have planned": "Les revenus, moins toutes les dépenses prévues",
  "Expected income": "Revenus prévus", "Planned expenses": "Dépenses prévues", "All payments due this period": "Tous les paiements prévus dans la période",
  "All your income and commitments": "Tous vos revenus et engagements", "Add budget to a dashboard": "Ajouter le budget à un tableau de bord", "Dashboard card": "Carte de tableau de bord",
  "Edit budget": "Modifier le budget", "Add entry": "Ajouter une entrée", "Filter entries": "Filtrer les entrées", "All entries": "Toutes les entrées",
  "Entry": "Entrée", "Amount": "Montant", "Next due": "Prochaine échéance", "This period": "Cette période", "Edit": "Modifier", "Paused": "En pause",
  "No entries in this view": "Aucune entrée dans cette vue", "Give your money a plan": "Donnez une direction à votre argent",
  "Try another filter or add a new entry.": "Essayez un autre filtre ou ajoutez une entrée.", "Start with a paycheck, a subscription, or a bill. Every entry has its own schedule.": "Commencez par une paie, un abonnement ou une facture. Chaque entrée a son propre calendrier.",
  "Add an entry": "Ajouter une entrée", "Where your money goes": "Où va votre argent", "Expenses by category": "Dépenses par catégorie",
  "Coming up": "À venir", "Totals count payments due in the selected period.": "Les totaux comptent les échéances de la période sélectionnée.",
  "Nothing else is due in this period.": "Aucune autre échéance dans cette période.", "Nothing else is due this period.": "Aucune autre échéance dans cette période.",
  "Your plan follows actual due dates. Monthly bills appear in the pay period when they renew. These are projections, not cleared bank transactions.": "Votre budget suit les dates d’échéance. Les factures mensuelles figurent dans la période de leur renouvellement. Ces montants sont des prévisions, pas des transactions bancaires confirmées.",
  "Close dialog": "Fermer la fenêtre", "Save changes": "Enregistrer", "Cancel": "Annuler", "Budget settings": "Paramètres des budgets",
  "These defaults apply when a budget has no pay schedule of its own. Each budget can optionally override the period and reference date. The currency below is the default for new budgets.": "Ces réglages s’appliquent aux budgets sans calendrier de paie personnalisé. Chaque budget peut définir sa période et sa date de référence. La devise ci-dessous est utilisée par défaut pour les nouveaux budgets.",
  "Default currency": "Devise par défaut", "Budget period": "Période budgétaire", "Default reference date": "Date de référence par défaut",
  "Create a budget": "Créer un budget", "Budget name": "Nom du budget", "Currency": "Devise", "Pay period (optional)": "Période de paie (facultative)",
  "Payday / reference date (optional)": "Date de paie ou de référence (facultative)", "Create budget": "Créer le budget", "Delete budget": "Supprimer le budget",
  "e.g. Everyday life": "Ex. : Vie quotidienne", "Entry name": "Nom de l’entrée", "e.g. Netflix, rent, or paycheck": "Ex. : Netflix, loyer ou paie",
  "Money flow": "Sens du mouvement", "Expense category": "Catégorie de dépense", "Repeats": "Répétition", "First due / renewal date": "Première échéance ou renouvellement",
  "End date (optional, inclusive)": "Date de fin (facultative, incluse)", "Active entry": "Entrée active", "Pause to exclude all occurrences.": "Mettez en pause pour exclure toutes les échéances.",
  "Edit entry": "Modifier l’entrée", "Delete entry": "Supprimer l’entrée", "Delete entry?": "Supprimer cette entrée ?", "Delete budget?": "Supprimer ce budget ?",
  "Delete": "Supprimer", "and all its entries": "et toutes ses entrées", "? This cannot be undone.": "? Cette action est irréversible.",
  "Your budget, on any dashboard": "Votre budget sur tous vos tableaux de bord", "The card is already registered with Home Assistant.": "La carte est déjà enregistrée dans Home Assistant.",
  "Use the visual editor": "Utiliser l’éditeur visuel", "Edit a dashboard → Add card → search for": "Modifiez un tableau de bord → Ajouter une carte → recherchez",
  ", then select this budget.": ", puis sélectionnez ce budget.", "Or paste this YAML": "Ou collez ce YAML", "Done": "Terminé",
  "Deleted": "Suppression effectuée", "Budget saved": "Budget enregistré", "Could not save. Please try again.": "Enregistrement impossible. Réessayez.",
  "Loading your budgets…": "Chargement de vos budgets…", "Loading budgets…": "Chargement des budgets…", "Retry": "Réessayer",
  "Autonomous Budget is unavailable. Check the integration in Settings.": "Autonomous Budget est indisponible. Vérifiez l’intégration dans les paramètres.",
  "Could not load budgets. Check the integration and reload this page.": "Chargement impossible. Vérifiez l’intégration et rechargez la page.",
  "Autonomous Budget is not loaded.": "Autonomous Budget n’est pas chargé.", "This budget no longer exists. Choose another budget in the card editor.": "Ce budget n’existe plus. Choisissez un autre budget dans l’éditeur de carte.",
  "Create your first budget in the Autonomous Budget sidebar.": "Créez votre premier budget dans le menu Autonomous Budget.", "Scheduled for this period": "Prévu pour cette période",
  "Open Autonomous Budget": "Ouvrir Autonomous Budget", "Budget": "Budget", "First available budget": "Premier budget disponible",
  "Title (optional)": "Titre (facultatif)", "Show expense categories": "Afficher les catégories de dépenses", "Show upcoming payments": "Afficher les prochaines échéances",
  "Budgets changed in another session. Close this dialog and try again.": "Les budgets ont été modifiés dans une autre session. Fermez cette fenêtre et réessayez.",
  "Budget no longer exists.": "Ce budget n’existe plus.", "Entry no longer exists.": "Cette entrée n’existe plus.",
  "A budget with entries cannot change currency. Create a new budget instead.": "La devise d’un budget contenant des entrées ne peut pas être modifiée. Créez un nouveau budget.",
  "A maximum of 50 budgets is supported.": "Vous pouvez créer jusqu’à 50 budgets.", "A maximum of 500 entries per budget is supported.": "Vous pouvez créer jusqu’à 500 entrées par budget.",
  "Could not save budgets. Check available disk space and try again.": "Enregistrement impossible. Vérifiez l’espace disque disponible et réessayez.",
  "Use a date between 1900-01-01 and 2200-12-31.": "Choisissez une date entre le 01/01/1900 et le 31/12/2200.",
  "Exchange rate must be positive, with at most 8 decimal places.": "Le taux de change doit être positif et avoir au maximum 8 décimales.",
  "End date cannot precede the first due date.": "La date de fin ne peut pas précéder la première échéance.", "Active must be true or false.": "Le statut actif doit être vrai ou faux.",
};

export function translate(source, language) {
  if (!String(language).toLowerCase().startsWith("fr")) return source;
  const text = source.trim();
  let result = fr[text];
  if (result === undefined && text.includes(" · ")) result = text.split(" · ").map((part) => translate(part, language)).join(" · ");
  if (result === undefined) {
    const patterns = [
      [/^([\d.]+)% unallocated$/, (_, amount) => `${amount} % non réparti`],
      [/^([\d.]+)% allocated$/, (_, amount) => `${amount} % réparti`],
      [/^(\d+) expenses need a category\. Edit each expense to choose one\.$/, (_, count) => `${count} dépenses sont à catégoriser. Modifiez chaque dépense pour choisir sa catégorie.`],
      [/^(\d+)\/(\d+) pay periods$/, (_, count, total) => `${count}/${total} périodes de paie`],
      [/^(\d+) remaining$/, (_, count) => `${count} restante${count === "1" ? "" : "s"}`],
      [/^and all its entries\? This cannot be undone\.$/, () => "et toutes ses entrées ? Cette action est irréversible."],
      [/^(\d+) scheduled payments this period$/, (_, count) => `${count} paiement${count === "1" ? "" : "s"} prévu${count === "1" ? "" : "s"} cette période`],
      [/^(\d+) due$/, (_, count) => `${count} échéance${count === "1" ? "" : "s"}`],
      [/^(\d+)% of expenses$/, (_, count) => `${count} % des dépenses`],
      [/^(\d+) active entries$/, (_, count) => `${count} entrées actives`],
      [/^(\d+) active entries · Totals count payments due in the selected period\.$/, (_, count) => `${count} entrées actives · Les totaux comptent les échéances de la période sélectionnée.`],
      [/^Exchange rate to (\w+)$/, (_, currency) => `Taux de change vers ${currency}`],
      [/^1 unit of this entry's currency equals this many (\w+)\. Rates are set manually\.$/, (_, currency) => `1 unité de la devise de cette entrée vaut ce montant en ${currency}. Le taux est défini manuellement.`],
      [/^Leave these fields blank to use the defaults: (.+), aligned to (.+)\. A pay schedule is optional\.$/, (_, period, day) => `Laissez ces champs vides pour utiliser les réglages par défaut : ${translate(period, language)}, à partir du ${day}. Le calendrier de paie est facultatif.`],
      [/^Edit (.+)$/, (_, name) => `Modifier ${name}`],
      [/^(\w+) amounts allow (\d+) decimal places\.$/, (_, currency, count) => `Les montants en ${currency} acceptent ${count} décimales.`],
      [/^Choose a valid (.+)\.$/, (_, name) => `Choisissez une valeur valide pour ${translate(name[0].toUpperCase() + name.slice(1), language).toLowerCase()}.`],
      [/^(Amount|Exchange rate) must be between 0 and (.+)\.$/, (_, name, max) => `${name === "Amount" ? "Le montant" : "Le taux de change"} doit être compris entre 0 et ${max}.`],
      [/^(Budget name|Entry name) must contain 1–(\d+) characters\.$/, (_, name, max) => `${name === "Budget name" ? "Le nom du budget" : "Le nom de l’entrée"} doit contenir entre 1 et ${max} caractères.`],
    ];
    for (const [pattern, replace] of patterns) {
      if (pattern.test(text)) { result = text.replace(pattern, replace); break; }
    }
  }
  if (result === undefined) return source;
  return source.replace(text, result);
}

/** Translate only UI text. Never alter user names, input values, code, or styles. */
export function localize(root, language, originals) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement || node.parentElement.closest('style,script,pre,[translate="no"]')) continue;
    if (!originals.has(node)) originals.set(node, node.textContent);
    node.textContent = translate(originals.get(node), language);
  }
  for (const element of root.querySelectorAll('[aria-label],[title],[placeholder]')) {
    if (element.closest('[translate="no"]')) continue;
    if (!originals.has(element)) originals.set(element, Object.fromEntries(["aria-label", "title", "placeholder"].filter((key) => element.hasAttribute(key)).map((key) => [key, element.getAttribute(key)])));
    for (const [key, value] of Object.entries(originals.get(element))) element.setAttribute(key, translate(value, language));
  }
}
