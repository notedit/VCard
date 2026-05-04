export function createCard(index, role, title, body) {
  return { id: crypto.randomUUID(), index, role, title, body };
}

export function proposeSuggestion(cardId, type, message, action) {
  return { id: crypto.randomUUID(), cardId, type, message, action };
}
