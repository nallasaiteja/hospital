/**
 * Date utility functions for local timezone handling in AURA HMS.
 * Prevents UTC off-by-one errors caused by new Date().toISOString().split('T')[0]
 * when operating across midnight in timezones like IST (+05:30).
 */

export const getLocalTodayDateString = (offsetDays: number = 0): string => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

