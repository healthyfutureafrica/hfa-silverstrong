const { badRequest } = require('@hfa/shared');

// Grouping options map to fixed column names (never to user input) so queries stay safe.
const GROUP_COLUMNS = { region: 'region_code', district: 'district_code', icd10: 'icd10_category', ageBand: 'age_band', sex: 'sex' };
const OUTPUT_NAMES = { region_code: 'regionCode', district_code: 'districtCode', icd10_category: 'icd10Category', age_band: 'ageBand', sex: 'sex' };
const MAX_RANGE_DAYS = { hour: 7, day: 366, week: 1100 };

function createReporting({ sequelize, config }) {
  // Small-cell suppression: counts from 1 to (threshold - 1) are withheld so that individuals in
  // small districts or rare categories cannot be singled out. The threshold is configurable.
  const suppress = rows => rows.map(row => {
    const suppressed = row.caseCount > 0 && row.caseCount < config.smallCellThreshold;
    return { ...row, caseCount: suppressed ? null : row.caseCount, suppressed };
  });

  async function aggregates(query) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!(from < to)) throw badRequest('"from" must be before "to"');
    if ((to - from) / 86400000 > MAX_RANGE_DAYS[query.window]) throw badRequest(`For ${query.window} windows the range can be at most ${MAX_RANGE_DAYS[query.window]} days`);
    const columns = query.groupBy.map(name => GROUP_COLUMNS[name]);
    const filters = ['window_size = :window', 'window_start >= :from', 'window_start < :to'];
    if (query.regionCode) filters.push('region_code = :regionCode');
    if (query.districtCode) filters.push('district_code = :districtCode');
    if (query.icd10) filters.push('icd10_category = :icd10');
    const select = ['window_start', ...columns].join(', ');
    const rows = await sequelize.query(
      `SELECT ${select}, SUM(case_count)::int AS case_count FROM surveillance_counts WHERE ${filters.join(' AND ')} GROUP BY ${select} ORDER BY ${select}`,
      { replacements: { window: query.window, from, to, regionCode: query.regionCode, districtCode: query.districtCode, icd10: query.icd10 }, type: sequelize.QueryTypes.SELECT }
    );
    const shaped = rows.map(row => ({
      windowStart: new Date(row.window_start).toISOString(),
      ...Object.fromEntries(columns.map(column => [OUTPUT_NAMES[column], row[column]])),
      caseCount: row.case_count
    }));
    const result = suppress(shaped);
    return {
      window: query.window, from: from.toISOString(), to: to.toISOString(), groupBy: query.groupBy, timezone: config.timezone,
      suppressionThreshold: config.smallCellThreshold, suppressedRows: result.filter(row => row.suppressed).length, rows: result
    };
  }

  // Most frequent diagnosis categories per region over the last N hours (from hourly windows).
  async function summary(hours) {
    const rows = await sequelize.query(`
      SELECT region_code, icd10_category, SUM(case_count)::int AS case_count
      FROM surveillance_counts
      WHERE window_size = 'hour' AND window_start >= now() - make_interval(hours => :hours)
      GROUP BY region_code, icd10_category
      ORDER BY case_count DESC, region_code, icd10_category
      LIMIT 50`, { replacements: { hours }, type: sequelize.QueryTypes.SELECT });
    return {
      hours, suppressionThreshold: config.smallCellThreshold,
      rows: suppress(rows.map(row => ({ regionCode: row.region_code, icd10Category: row.icd10_category, caseCount: row.case_count })))
    };
  }

  return { aggregates, summary };
}

module.exports = { createReporting, GROUP_COLUMNS };
