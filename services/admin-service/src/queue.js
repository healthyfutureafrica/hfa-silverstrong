// Redis Streams transport for consultation events (ElastiCache Redis in AWS).
//   Producer (Consultation Service): publishConsultationCompleted(redis, event)
//   Consumer (this service): a consumer group, so several Admin Service tasks share the work and
//   a message is acknowledged (XACK) only after its counts are committed. Messages left pending by
//   a crashed worker are reclaimed with XAUTOCLAIM. Invalid events go to a dead-letter stream.
// To use AWS SQS instead, implement the same start()/stop() interface around ReceiveMessage /
// DeleteMessage with a redrive policy for the dead-letter queue.

const STREAM_MAX_LENGTH = 1000000;

async function publishConsultationCompleted(redis, stream, event) {
  return redis.xadd(stream, 'MAXLEN', '~', STREAM_MAX_LENGTH, '*', 'event', JSON.stringify(event));
}

class RedisStreamConsumer {
  constructor({ redis, stream, group, consumer, deadLetterStream, logger, batchSize = 50, blockMs = 5000, claimIdleMs = 60000 }) {
    Object.assign(this, { redis, stream, group, consumer, deadLetterStream, logger, batchSize, blockMs, claimIdleMs });
    this.running = false;
  }

  async ensureGroup() {
    try {
      // '0' so that events published before the group existed are also counted.
      await this.redis.xgroup('CREATE', this.stream, this.group, '0', 'MKSTREAM');
    } catch (error) {
      if (!String(error.message).includes('BUSYGROUP')) throw error;
    }
  }

  // Processes one batch; returns how many messages were handled.
  async runOnce(handler) {
    const [, reclaimed = []] = await this.redis.xautoclaim(this.stream, this.group, this.consumer, this.claimIdleMs, '0-0', 'COUNT', this.batchSize);
    const fresh = await this.redis.xreadgroup('GROUP', this.group, this.consumer, 'COUNT', this.batchSize, 'BLOCK', this.blockMs, 'STREAMS', this.stream, '>');
    const messages = [...reclaimed, ...(fresh ? fresh[0][1] : [])];
    for (const [id, fields] of messages) {
      const raw = fields[fields.indexOf('event') + 1];
      let event;
      try { event = JSON.parse(raw); } catch (error) { event = null; }
      try {
        const result = event ? await handler(event) : { status: 'invalid', issues: [{ path: '', message: 'Not JSON' }] };
        if (result.status === 'invalid') {
          await this.redis.xadd(this.deadLetterStream, '*', 'event', String(raw).slice(0, 10000), 'issues', JSON.stringify(result.issues), 'sourceId', id);
          this.logger.warn('surveillance_event_rejected', { messageId: id });
        }
        await this.redis.xack(this.stream, this.group, id);
      } catch (error) {
        // Database or other temporary failure: leave unacknowledged so it is retried later.
        this.logger.error('surveillance_event_failed', { messageId: id, message: error.message });
      }
    }
    return messages.length;
  }

  async start(handler) {
    await this.ensureGroup();
    this.running = true;
    while (this.running) {
      try {
        await this.runOnce(handler);
      } catch (error) {
        this.logger.error('surveillance_consumer_error', { message: error.message });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  stop() { this.running = false; }
}

module.exports = { RedisStreamConsumer, publishConsultationCompleted };
