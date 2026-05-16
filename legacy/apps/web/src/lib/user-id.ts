const STORAGE_KEY = 'vcard-user-id';

export function getUserId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && isUuid(existing)) return existing;
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
