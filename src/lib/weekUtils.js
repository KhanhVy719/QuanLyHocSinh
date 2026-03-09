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

/**
 * Get date range for a month (4-week period) relative to current month.
 * Month = 4 weeks from first Monday of the month period.
 * @param {number} offset - 0 = current month block, -1 = last month block
 * @returns {{ start: string, end: string, label: string }}
 */
export function getMonthRange(offset = 0) {
  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(targetMonth);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  const label = `Tháng ${targetMonth.getMonth() + 1}/${targetMonth.getFullYear()}`;
  return { start: start.toISOString(), end: end.toISOString(), label };
}

/**
 * Get available months for a semester
 * @param {number} semester - 1 or 2
 * @param {string|null} semester2StartStr
 * @returns {Array<{ offset: number, label: string, start: string, end: string }>}
 */
export function getAvailableMonths(semester = null, semester2StartStr = null) {
  const months = [];
  for (let i = 0; i >= -11; i--) {
    const range = getMonthRange(i);
    const monthStart = new Date(range.start);
    const monthEnd = new Date(range.end);

    if (semester) {
      const ranges = getSemesterRanges(semester2StartStr);
      const semRange = semester === 1 ? ranges.hk1 : ranges.hk2;
      if (monthEnd >= semRange.start && monthStart <= semRange.end) {
        months.push({ offset: i, ...range });
      }
      if (monthEnd < semRange.start) break;
    } else {
      months.push({ offset: i, ...range });
      if (months.length >= 6) break;
    }
  }
  return months;
}

/**
 * Get date range based on view mode.
 * @param {'week'|'month'|'semester'|'year'} viewMode
 * @param {number} offset - offset for week/month
 * @param {number} semester - 1 or 2
 * @param {string|null} semester2StartStr
 * @returns {{ start: string, end: string, label: string }}
 */
export function getDateRangeForView(viewMode, offset = 0, semester = 1, semester2StartStr = null) {
  if (viewMode === 'week') {
    return getWeekRange(offset);
  }
  if (viewMode === 'month') {
    return getMonthRange(offset);
  }
  const ranges = getSemesterRanges(semester2StartStr);
  if (viewMode === 'semester') {
    const sem = semester === 1 ? ranges.hk1 : ranges.hk2;
    return {
      start: sem.start.toISOString(),
      end: sem.end.toISOString(),
      label: `Học kỳ ${semester}`,
    };
  }
  // year
  return {
    start: ranges.hk1.start.toISOString(),
    end: ranges.hk2.end.toISOString(),
    label: `Cả năm ${ranges.academicYear}`,
  };
}
