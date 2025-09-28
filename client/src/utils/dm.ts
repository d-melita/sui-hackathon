// Note: deriveDmChannelId removed - now using real blockchain channels
// This file now only contains address validation utilities

export function isLikelySuiAddress(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  return v.startsWith("0x") && v.length >= 3; // super lenient PoC
}
