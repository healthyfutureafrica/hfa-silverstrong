// Real voice and video consultations inside the existing call screens (#vc video, #voc voice).
// WebRTC connects the two devices directly and encrypted; the HFA server only relays the connection messages for
// the booked appointment (backend/calls.js). Audio first and low-resolution video (320×240, 15 fps, ~250 kbit/s)
// so calls hold up on 3G; if the camera is refused the call continues with audio.
// "Perfect negotiation": the patient is the polite side and the clinician makes the offers, so both can join in
// any order and reconnect after a network drop.
(function () {
  const FAST_POLL_MS = 1000, SLOW_POLL_MS = 3000, VIDEO_MAX_BITRATE = 250000;

  Object.assign(T.en, {
    call_connecting: 'Connecting…', call_waiting: 'Waiting for {name} to join', call_connected: 'Connected', call_reconnecting: 'Connection lost. Reconnecting…',
    call_left: '{name} has left the call', call_no_mic: 'Microphone access is needed for a consultation. Allow it in your browser and try again.',
    call_no_camera: 'Camera unavailable: continuing with audio only.', call_unsupported: 'This browser cannot make calls. Use a recent Chrome, Firefox, Safari or Edge.',
    call_not_allowed: 'You can join this call only during the booked appointment time.'
  });
  Object.assign(T.fr, {
    call_connecting: 'Connexion…', call_waiting: 'En attente de {name}', call_connected: 'Connecté', call_reconnecting: 'Connexion perdue. Reconnexion…',
    call_left: '{name} a quitté l’appel', call_no_mic: 'L’accès au micro est nécessaire pour une consultation. Autorisez-le dans votre navigateur et réessayez.',
    call_no_camera: 'Caméra indisponible : l’appel continue en audio.', call_unsupported: 'Ce navigateur ne peut pas passer d’appels. Utilisez un Chrome, Firefox, Safari ou Edge récent.',
    call_not_allowed: 'Vous pouvez rejoindre cet appel uniquement pendant l’heure du rendez-vous.'
  });

  let call = null;
  const fmt = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), t(key));

  // Real media elements inside the existing screens.
  function mount() {
    if (document.getElementById('vc-remote')) return;
    document.querySelector('#vc .vca')?.insertAdjacentHTML('afterbegin', '<video id="vc-remote" class="hid" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000"></video>');
    document.querySelector('#vc .vcs')?.insertAdjacentHTML('afterbegin', '<video id="vc-local" class="hid" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></video>');
    document.querySelector('#vc .vcr')?.insertAdjacentHTML('beforeend', '<div class="vct" id="vc-state" role="status" aria-live="polite"></div>');
    document.querySelector('#voc')?.insertAdjacentHTML('beforeend', '<audio id="vo-remote" autoplay></audio>');
    const vca = document.querySelector('#vc .vca'); if (vca && getComputedStyle(vca).position === 'static') vca.style.position = 'relative';
    const vcr = document.querySelector('#vc .vcr'); if (vcr) { vcr.style.position = 'relative'; vcr.style.zIndex = '1'; }
  }

  function status(key, values) {
    if (!call) return;
    const text = fmt(key, values);
    const video = document.getElementById('vc-state'), voice = document.getElementById('vo-status');
    if (call.mode === 'video' && video) video.textContent = text;
    if (call.mode === 'voice' && voice) voice.textContent = text;
  }

  const send = (type, data) => call && apiRequest(`/api/v1/calls/${encodeURIComponent(call.appointmentId)}/signals`, 'POST', { to: call.peerId, type, ...(data === undefined ? {} : { data }) }, 15000).catch(error => {
    if (error.status === 403 && call) { status('call_not_allowed'); stop(false); }
  });

  async function start(appointmentId, mode, peerId) {
    stop(false);
    mount();
    const peer = G(peerId);
    call = { appointmentId, mode, peerId, peerName: peer?.name || '', after: 0, polite: CU.role === 'patient', makingOffer: false, ignoreOffer: false, stopped: false, connected: false };
    status('call_connecting');
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) { status('call_unsupported'); return; }
    let iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
    try { iceServers = (await apiRequest('/api/v1/calls/ice')).data.iceServers; } catch (error) { /* keep the public STUN server */ }
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try {
      call.local = await navigator.mediaDevices.getUserMedia({ audio, video: mode === 'video' ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 }, facingMode: 'user' } : false });
    } catch (error) {
      if (mode !== 'video') { status('call_no_mic'); return; }
      try { call.local = await navigator.mediaDevices.getUserMedia({ audio }); status('call_no_camera'); }
      catch (audioError) { status('call_no_mic'); return; }
    }
    if (!call || call.stopped) { call?.local?.getTracks().forEach(track => track.stop()); return; }
    const localVideo = document.getElementById('vc-local');
    if (localVideo && call.local.getVideoTracks().length) { localVideo.srcObject = call.local; localVideo.classList.remove('hid'); }

    const pc = call.pc = new RTCPeerConnection({ iceServers });
    call.local.getTracks().forEach(track => pc.addTrack(track, call.local));
    pc.ontrack = event => {
      const stream = event.streams[0];
      if (call.mode === 'video') { const remote = document.getElementById('vc-remote'); remote.srcObject = stream; if (stream.getVideoTracks().length) remote.classList.remove('hid'); }
      const audioOut = document.getElementById('vo-remote'); if (call.mode === 'voice' && audioOut) audioOut.srcObject = stream;
    };
    pc.onicecandidate = event => { if (event.candidate) send('candidate', event.candidate.toJSON()); };
    pc.onconnectionstatechange = async () => {
      if (!call || call.pc !== pc) return;
      if (pc.connectionState === 'connected') {
        call.connected = true; status('call_connected');
        for (const sender of pc.getSenders()) if (sender.track?.kind === 'video') {
          const parameters = sender.getParameters(); parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
          parameters.encodings[0].maxBitrate = VIDEO_MAX_BITRATE; sender.setParameters(parameters).catch(() => {});
        }
      } else if (['disconnected', 'failed'].includes(pc.connectionState)) {
        status('call_reconnecting');
        if (!call.polite && pc.connectionState === 'failed') { pc.restartIce?.(); await offer(true); }
      }
    };
    pc.onnegotiationneeded = () => { if (!call.polite) offer(false); };
    await send('hello');
    if (!call.connected) status('call_waiting', { name: call.peerName });
    poll();
  }

  async function offer(restart) {
    const pc = call?.pc; if (!pc) return;
    try {
      call.makingOffer = true;
      await pc.setLocalDescription(restart ? await pc.createOffer({ iceRestart: true }) : undefined);
      await send('offer', pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp });
    } catch (error) { /* a later hello or state change will try again */ }
    finally { if (call) call.makingOffer = false; }
  }

  async function handle(signal) {
    const pc = call?.pc; if (!pc) return;
    if (signal.type === 'hello') { if (!call.polite) await offer(call.connected || pc.signalingState !== 'stable'); return; }
    if (signal.type === 'bye') { status('call_left', { name: call.peerName }); call.connected = false; return; }
    if (signal.type === 'candidate') { try { await pc.addIceCandidate(signal.data); } catch (error) { if (!call.ignoreOffer) { /* stale candidate */ } } return; }
    if (signal.type === 'offer' || signal.type === 'answer') {
      const collision = signal.type === 'offer' && (call.makingOffer || pc.signalingState !== 'stable');
      call.ignoreOffer = !call.polite && collision;
      if (call.ignoreOffer) return;
      try {
        await pc.setRemoteDescription(signal.data);
        if (signal.type === 'offer') { await pc.setLocalDescription(); await send('answer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); }
      } catch (error) { /* the next offer recovers */ }
    }
  }

  async function poll() {
    const current = call;
    while (current === call && !current.stopped) {
      try {
        const { signals } = (await apiRequest(`/api/v1/calls/${encodeURIComponent(current.appointmentId)}/signals?after=${current.after}`)).data;
        for (const signal of signals) { current.after = Math.max(current.after, signal.seq); if (signal.from === current.peerId) await handle(signal); }
      } catch (error) { if (error.status === 403) { status('call_not_allowed'); stop(false); return; } }
      await new Promise(resolve => setTimeout(resolve, current.connected ? SLOW_POLL_MS : FAST_POLL_MS));
    }
  }

  function stop(sayBye = true) {
    if (!call) return;
    const ending = call;
    ending.stopped = true;
    if (sayBye) send('bye');
    ending.pc?.close();
    ending.local?.getTracks().forEach(track => track.stop());
    for (const id of ['vc-remote', 'vc-local']) { const element = document.getElementById(id); if (element) { element.srcObject = null; element.classList.add('hid'); } }
    const audioOut = document.getElementById('vo-remote'); if (audioOut) audioOut.srcObject = null;
    const state = document.getElementById('vc-state'); if (state) state.textContent = '';
    call = null;
  }

  const setMic = on => call?.local?.getAudioTracks().forEach(track => { track.enabled = on; });
  const setCamera = on => call?.local?.getVideoTracks().forEach(track => { track.enabled = on; });
  const setSpeaker = on => { const audioOut = document.getElementById('vo-remote'); if (audioOut) audioOut.muted = !on; const remote = document.getElementById('vc-remote'); if (remote) remote.muted = !on; };

  // Connect the existing screens to real media: the screens keep their look, the buttons now act on the call.
  const wrap = (name, after) => { const original = window[name]; if (typeof original === 'function') window[name] = (...args) => { const result = original(...args); after(...args); return result; }; };
  wrap('startVC', (contactId, appointmentId) => { if (!document.getElementById('vc')?.classList.contains('hid')) start(appointmentId, 'video', contactId); });
  wrap('startVoiceCall', (contactId, appointmentId) => { if (!document.getElementById('voc')?.classList.contains('hid')) start(appointmentId, 'voice', contactId); });
  wrap('endCall', () => stop(true));
  wrap('endVoiceCall', () => stop(true));
  wrap('togMute', () => setMic(!MUT));
  wrap('togVid', () => setCamera(!VIDOFF));
  wrap('togVoiceMute', () => setMic(!VOICE_MUT));
  wrap('togSpeaker', () => setSpeaker(VOICE_SPK));
  window.addEventListener('pagehide', () => stop(true));

  window.HFACall = { start, stop, active: () => !!call };
})();
