/**
 * Week & Semester utility functions for score management
 * Week = Monday 00:00 → Sunday 23:59
 * HK1 = Sep 5 → semester2Start
 * HK2 = semester2Start → end of school year
 */

/**
 * Get semester date ranges for the current academic year.
 * @param {string|null} semester2StartStr - ISO date string for HK2 start (from DB), null = default Jan 13
 * @returns {{ hk1: { start: Date, end: Date }, hk2: { start: Date, end: Date }, academicYear: string }}
 */
export function getSemesterRanges(semester2StartStr = null) {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  const startYear = month >= 7 ? year : year - 1; // Academic year starts Aug/Sep

  const hk1Start = new Date(startYear, 8, 5); // Sep 5
  hk1Start.setHours(0, 0, 0, 0);

  const hk2Start = semester2StartStr
    ? new Date(semester2StartStr)
    : new Date(startYear + 1, 0, 13); // Default: Jan 13
  hk2Start.setHours(0, 0, 0, 0);

  const hk2End = new Date(startYear + 1, 5, 30); // Jun 30
  hk2End.setHours(23, 59, 59, 999);

  const hk1End = new Date(hk2Start);
  hk1End.setDate(hk1End.getDate() - 1);
  hk1End.setHours(23, 59, 59, 999);

  return {
    hk1: { start: hk1Start, end: hk1End },
    hk2: { start: hk2Start, end: hk2End },
    academicYear: `${startYear} - ${startYear + 1}`,
  };
}

/**
 * Get the date range for a week relative to current week.
 * @param {number} offset - 0 = current week, -1 = last week, etc.
 * @returns {{ start: string, end: string, label: string, isCurrent: boolean }}
 */
export function getWeekRange(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) + offset * 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const label = `${fmt(monday)} - ${fmt(sunday)}`;

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
    label,
    isCurrent: offset === 0,
  };
}

/**
 * Get available weeks filtered by a semester's date range.
 * @param {number} semester - 1 or 2
 * @param {string|null} semester2StartStr - ISO date for HK2 start
 * @returns {Array<{ offset: number, start: string, end: string, label: string, isCurrent: boolean }>}
 */
export function getAvailableWeeks(semester = null, semester2StartStr = null) {
  if (!semester) {
    // No semester filter: return last 8 weeks
    const weeks = [];
    for (let i = 0; i >= -7; i--) {
      const range = getWeekRange(i);
      weeks.push({ offset: i, ...range });
    }
    return weeks;
  }

  const ranges = getSemesterRanges(semester2StartStr);
  const semRange = semester === 1 ? ranges.hk1 : ranges.hk2;
  const weeks = [];

  // Generate all weeks from current week going back
  for (let i = 0; i >= -52; i--) {
    const range = getWeekRange(i);
    const weekStart = new Date(range.start);
    const weekEnd = new Date(range.end);

    // Check if this week overlaps with the semester range
    if (weekEnd >= semRange.start && weekStart <= semRange.end) {
      weeks.push({ offset: i, ...range });
    }
    // Stop if we've gone past the semester start
    if (weekEnd < semRange.start) break;
  }

  return weeks;
}
