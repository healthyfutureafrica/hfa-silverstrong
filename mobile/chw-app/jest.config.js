// The offline storage, sync and triage logic is plain JavaScript with its dependencies passed in,
// so it is tested in Node without a phone or emulator.
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/test']
};
