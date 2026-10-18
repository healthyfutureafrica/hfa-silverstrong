import React, { useEffect, useMemo } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import ConsultationForm from './src/forms/ConsultationForm';
import { createServices } from './src/setup';
import { session } from './src/session';

const API_BASE_URL = 'https://www.healthyfutureafrica.org';
const ON_CALL_DOCTOR_NUMBER = '+237000000000'; // replace with the HFA on-call line before release

export default function App() {
  const services = useMemo(() => createServices({
    baseUrl: API_BASE_URL,
    getAccessToken: session.getAccessToken,
    refreshSession: session.refresh
  }), []);
  useEffect(() => services.stop, [services]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0e2240' }}>
      <StatusBar barStyle="light-content" />
      <ConsultationForm queue={services.queue} sync={services.sync} api={services.api} chwId={session.userId()} onCallDoctorNumber={ON_CALL_DOCTOR_NUMBER} />
    </SafeAreaView>
  );
}
