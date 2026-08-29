export function hasTemporaryUnlimitedGeneration(
  userEmail: string | null | undefined,
  allowedEmail: string | null | undefined,
  allowedDate: string | null | undefined,
  now = new Date(),
) {
  if (!userEmail || !allowedEmail || !allowedDate) return false;
  const todayInJapan = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return userEmail.trim().toLowerCase() === allowedEmail.trim().toLowerCase()
    && todayInJapan === allowedDate.trim();
}
