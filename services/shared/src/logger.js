// Structured JSON logs (one line per event) so CloudWatch Logs Insights can query them.
// Rule for the whole team: pass only identifiers and metadata — never names, phone numbers,
// diagnoses, prescription contents or request bodies.

function createLogger(service, sink = console) {
  const write = (level, event, fields = {}) => {
    if (process.env.LOG_SILENT === 'true') return;
    const line = JSON.stringify({ level, service, event, time: new Date().toISOString(), ...fields });
    (level === 'error' ? sink.error : sink.log).call(sink, line);
  };
  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields)
  };
}

module.exports = { createLogger };
