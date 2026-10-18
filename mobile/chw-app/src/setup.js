import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { getDeviceKey } from './crypto/deviceKey';
import { createPayloadCipher } from './crypto/payloadCipher';
import { createConsultationQueue } from './storage/consultationQueue';
import { createSyncService } from './sync/syncService';
import { createApiClient } from './api/client';

// Wires the pure logic modules to the real phone libraries.
export function createServices({ baseUrl, getAccessToken, refreshSession }) {
  const cipher = createPayloadCipher({ crypto, getKey: getDeviceKey, Buffer });
  const queue = createConsultationQueue({ storage: AsyncStorage, cipher, randomId: () => crypto.randomUUID() });
  const api = createApiClient({ baseUrl, getAccessToken, refreshSession });
  const sync = createSyncService({ queue, api, netInfo: NetInfo });
  // Lets the form show online/offline status.
  sync.subscribeConnectivity = listener => NetInfo.addEventListener(state => listener(sync.isOnline(state)));
  const stop = sync.start({ appState: AppState });
  return { queue, api, sync, stop };
}
