const { EventEmitter } = require('node:events');
const { consultationCompletedEvent, anonymise } = require('./anonymise');

const WINDOWS = ['hour', 'day', 'week'];

// Turns consultation events into anonymised counts. Safe to call more than once for the same
// event (duplicates are ignored) and from several workers at once.
function createAggregator({ sequelize, config, logger }) {
  const updates = new EventEmitter();
  updates.setMaxListeners(1000);

  async function processEvent(raw) {
    const parsed = consultationCompletedEvent.safeParse(raw);
    if (!parsed.success) {
      return { status: 'invalid', issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) };
    }
    const record = anonymise(parsed.data);
    const outcome = await sequelize.transaction(async transaction => {
      const [inserted] = await sequelize.query(
        'INSERT INTO surveillance_processed_events (event_id) VALUES (:eventId) ON CONFLICT DO NOTHING RETURNING event_id',
        { replacements: { eventId: record.eventId }, transaction }
      );
      if (!inserted.length) return 'duplicate';
      for (const category of record.categories) {
        for (const windowSize of WINDOWS) {
          // Windows follow Cameroon local time, so "a day" means a Douala calendar day.
          await sequelize.query(`
            INSERT INTO surveillance_counts (window_size, window_start, region_code, district_code, icd10_category, age_band, sex, case_count)
            VALUES (:windowSize, date_trunc(:windowSize, CAST(:completedAt AS timestamptz) AT TIME ZONE :timezone) AT TIME ZONE :timezone,
                    :regionCode, :districtCode, :category, :ageBand, :sex, 1)
            ON CONFLICT (window_size, window_start, region_code, district_code, icd10_category, age_band, sex)
            DO UPDATE SET case_count = surveillance_counts.case_count + 1, updated_at = now()`,
          { replacements: { windowSize, category, timezone: config.timezone, completedAt: record.completedAt.toISOString(), regionCode: record.regionCode, districtCode: record.districtCode, ageBand: record.ageBand, sex: record.sex }, transaction });
        }
      }
      return 'counted';
    });
    if (outcome === 'counted') updates.emit('update');
    return { status: outcome };
  }

  // Removes de-duplication records older than the queue could ever redeliver.
  async function pruneProcessedEvents(days = 30) {
    await sequelize.query("DELETE FROM surveillance_processed_events WHERE processed_at < now() - make_interval(days => :days)", { replacements: { days } });
  }

  return { processEvent, pruneProcessedEvents, updates, logger };
}

module.exports = { createAggregator, WINDOWS };
