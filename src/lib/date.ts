export function ymd(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}
export function monthKey(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 7);
}
export function daysAgo(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
