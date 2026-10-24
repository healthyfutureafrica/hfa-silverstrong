const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'calls.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

// A stand-in for the browser's WebRTC and media APIs.
function load({ role = 'patient', signals = [], camera = true } = {}) {
  const sent = [], stopped = [], elements = {};
  const element = id => (elements[id] = elements[id] || { id, srcObject: null, muted: false, textContent: '', classList: { remove() {}, add() {}, contains: () => false } });
  const track = kind => ({ kind, enabled: true, stop: () => stopped.push(kind) });
  class PeerConnection {
    constructor(config) { this.config = config; this.tracks = []; this.signalingState = 'stable'; this.connectionState = 'new'; PeerConnection.last = this; }
    addTrack(item) { this.tracks.push(item); }
    async setRemoteDescription(description) { this.remote = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async setLocalDescription(description) { this.localDescription = description || { type: this.signalingState === 'have-remote-offer' ? 'answer' : 'offer', sdp: 'v=0 local' }; this.signalingState = this.localDescription.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async createOffer() { return { type: 'offer', sdp: 'v=0 restart' }; }
    async addIceCandidate(candidate) { this.candidate = candidate; }
    getSenders() { return []; }
    close() { this.closed = true; }
  }
  const context = {
    T: { en: {}, fr: {} }, LANG: 'en', CU: { id: role === 'patient' ? 'pat-1' : 'doc-1', role }, MUT: false, VIDOFF: false, VOICE_MUT: false, VOICE_SPK: true,
    G: id => ({ id, name: id === 'doc-1' ? 'Dr Synthetic' : 'Synthetic Patient' }), t: key => key,
    window: { hfaEscape: String, RTCPeerConnection: PeerConnection, addEventListener() {} }, RTCPeerConnection: PeerConnection,
    navigator: { mediaDevices: { getUserMedia: async constraints => { if (constraints.video && !camera) throw new Error('denied'); return { getTracks: () => [track('audio'), ...(constraints.video ? [track('video')] : [])], getAudioTracks: () => [track('audio')], getVideoTracks: () => constraints.video ? [track('video')] : [] }; } } },
    document: { getElementById: element, querySelector: () => ({ insertAdjacentHTML() {}, style: {} }) }, getComputedStyle: () => ({ position: 'relative' }),
    setTimeout: (callback, ms) => { if (ms <= 3000) context.ticks.push(callback); return 1; }, ticks: [],
    apiRequest: async (url, method = 'GET', body) => {
      if (url === '/api/v1/calls/ice') return { data: { iceServers: [{ urls: ['stun:stun.example.invalid'] }] } };
      if (method === 'POST') { sent.push(body); return {}; }
      const pending = signals.splice(0); return { data: { signals: pending } };
    }
  };
  ['startVC', 'startVoiceCall', 'endCall', 'endVoiceCall', 'togMute', 'togVid', 'togVoiceMute', 'togSpeaker'].forEach(name => { context.window[name] = () => {}; });
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, sent, stopped, elements, PeerConnection };
}

describe('real voice and video calls', () => {
  test('a patient joins, says hello, answers the clinician’s offer and hangs up cleanly', async () => {
    const offer = { seq: 3, from: 'doc-1', type: 'offer', data: { type: 'offer', sdp: 'v=0 doctor' } };
    const { context, sent, stopped, PeerConnection } = load({ signals: [offer, { seq: 4, from: 'doc-1', type: 'candidate', data: { candidate: 'c1' } }] });
    await context.window.HFACall.start('apt-1', 'video', 'doc-1');
    await flush(); await flush();
    const pc = PeerConnection.last;
    expect(pc.config.iceServers[0].urls[0]).toBe('stun:stun.example.invalid');
    expect(pc.tracks.map(item => item.kind)).toEqual(['audio', 'video']);
    expect(sent[0]).toEqual({ to: 'doc-1', type: 'hello' });
    expect(pc.remote.sdp).toBe('v=0 doctor');
    expect(sent.find(item => item.type === 'answer').data.type).toBe('answer');
    expect(pc.candidate).toEqual({ candidate: 'c1' });
    context.window.HFACall.stop(true);
    await flush();
    expect(sent.at(-1).type).toBe('bye');
    expect(pc.closed).toBe(true);
    expect(stopped.sort()).toEqual(['audio', 'video'], 'camera and microphone are released');
  });

  test('the clinician makes the offer when the patient arrives, and a refused camera leaves an audio call', async () => {
    const { context, sent, PeerConnection } = load({ role: 'doctor', camera: false, signals: [{ seq: 1, from: 'pat-1', type: 'hello' }] });
    await context.window.HFACall.start('apt-1', 'video', 'pat-1');
    await flush(); await flush();
    expect(PeerConnection.last.tracks.map(item => item.kind)).toEqual(['audio']);
    expect(context.document.getElementById('vc-state').textContent).toBe('call_waiting');
    expect(sent.some(item => item.type === 'offer')).toBe(true);
  });

  test('the existing call buttons now act on the real call', async () => {
    const { context } = load({ signals: [] });
    await context.window.HFACall.start('apt-1', 'voice', 'doc-1');
    expect(context.window.HFACall.active()).toBe(true);
    context.window.endVoiceCall();
    expect(context.window.HFACall.active()).toBe(false);
  });
});
