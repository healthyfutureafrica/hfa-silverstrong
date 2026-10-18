import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DANGER_SIGNS, SYMPTOMS, ageInMonths, buildPayload, emptyConsultation, triage, validateConsultation } from './consultationTemplate';

const COLORS = { navy: '#0e2240', emerald: '#0a6b50', emeraldLight: '#eaf6f2', gold: '#c4902a', danger: '#c0392b', warning: '#d68910', border: '#dde4ed', text: '#3d5068', muted: '#8a9bb0' };
const TRIAGE_STYLE = { emergency: { color: COLORS.danger, label: 'EMERGENCY - refer or call a doctor now' }, urgent: { color: COLORS.warning, label: 'URGENT - a doctor should see this patient today' }, routine: { color: COLORS.emerald, label: 'Routine' } };

// Structured field consultation for Community Health Workers. Saving always works offline: the
// record is encrypted on the phone and the sync service sends it when a connection returns.
export default function ConsultationForm({ queue, sync, api, chwId, onCallDoctorNumber }) {
  const [form, setForm] = useState(emptyConsultation());
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ pending: 0, needsReview: 0, synced: 0 });
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => triage(form), [form]);
  const isChild = ageInMonths(form.patient) < 60;

  useEffect(() => sync.onChange(setStatus), [sync]);
  useEffect(() => sync.subscribeConnectivity?.(setOnline), [sync]);

  const update = (section, field) => value => setForm(current => (field ? { ...current, [section]: { ...current[section], [field]: value } } : { ...current, [section]: value }));
  const toggle = (section, id) => value => setForm(current => ({ ...current, [section]: { ...current[section], [id]: value } }));

  async function save(escalationRequested = form.escalationRequested) {
    const check = validateConsultation(form);
    setErrors(check.errors);
    if (!check.valid) { Alert.alert('Please complete the form', Object.values(check.errors)[0]); return null; }
    setBusy(true);
    try {
      const payload = buildPayload({ ...form, escalationRequested }, { chwId });
      const saved = await queue.save(payload);
      setForm(emptyConsultation());
      sync.syncNow().catch(() => {});
      Alert.alert('Saved', online ? 'Consultation saved and sending now.' : 'Saved on this phone. It will be sent automatically when you are back online.');
      return { saved, payload };
    } catch (error) {
      Alert.alert('Could not save', error.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Live escalation to the on-call doctor when online; otherwise a phone call and a priority record.
  async function escalate() {
    const draft = buildPayload({ ...form, escalationRequested: true }, { chwId });
    if (online) {
      const response = await api.escalate({ patient: draft.patient, vitals: draft.vitals, dangerSigns: draft.dangerSigns, triage: draft.triage, notes: draft.notes });
      if (response.ok) {
        Alert.alert('Doctor notified', 'An on-call doctor has been alerted and will contact you shortly.');
        await save(true);
        return;
      }
    }
    Alert.alert('No connection to the doctor queue', 'Call the on-call doctor now. The record will be sent first when you are back online.', [
      { text: 'Call doctor', onPress: () => Linking.openURL(`tel:${onCallDoctorNumber}`) },
      { text: 'Save only', style: 'cancel' }
    ]);
    await save(true);
  }

  // Reads/writes either a nested field (section.field) or a top-level one (section).
  const valueOf = (section, field) => (field ? form[section][field] : form[section]);
  const setterFor = (section, field) => (field ? update(section, field) : update(section));
  const fieldProps = (section, field) => ({ value: valueOf(section, field), onChange: setterFor(section, field), error: errors[field ? `${section}.${field}` : section] });

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.banner, { backgroundColor: online ? COLORS.emeraldLight : '#fdf6e3' }]}>
        <Text style={styles.bannerText}>{online ? 'Online' : 'Offline - saving on this phone'} · {status.pending} waiting to send{status.needsReview ? ` · ${status.needsReview} need review` : ''}</Text>
        <Pressable onPress={() => sync.syncNow()} accessibilityRole="button"><Text style={styles.link}>Sync now</Text></Pressable>
      </View>

      <Text style={styles.section}>Patient</Text>
      <FormField label="Full name" {...fieldProps('patient', 'fullName')} />
      <View style={styles.row}>
        <View style={styles.half}><FormField label="Age (years)" {...fieldProps('patient', 'ageYears')} keyboardType="number-pad" /></View>
        <View style={styles.half}><FormField label="Months (under 5)" {...fieldProps('patient', 'ageMonths')} keyboardType="number-pad" /></View>
      </View>
      <View style={styles.row}>
        {['female', 'male'].map(sex => (
          <Pressable key={sex} onPress={() => update('patient', 'sex')(sex)} style={[styles.chip, form.patient.sex === sex && styles.chipActive]} accessibilityRole="radio" accessibilityState={{ selected: form.patient.sex === sex }}>
            <Text style={[styles.chipText, form.patient.sex === sex && styles.chipTextActive]}>{sex === 'female' ? 'Female' : 'Male'}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Village / quarter" {...fieldProps('patient', 'village')} />
      <FormField label="Health district code" {...fieldProps('patient', 'districtCode')} placeholder="e.g. DLA-BONASSAMA" />
      <FormField label="Phone (optional)" {...fieldProps('patient', 'phone')} keyboardType="phone-pad" />

      <Text style={styles.section}>Danger signs</Text>
      {DANGER_SIGNS[isChild ? 'child' : 'adult'].map(sign => <FormToggle key={sign.id} label={sign.label} value={Boolean(form.dangerSigns[sign.id])} onChange={toggle('dangerSigns', sign.id)} />)}

      <Text style={styles.section}>Vital signs</Text>
      <View style={styles.row}>
        <View style={styles.half}><FormField label="Temperature (°C)" {...fieldProps('vitals', 'temperatureC')} keyboardType="decimal-pad" /></View>
        <View style={styles.half}><FormField label="Pulse (/min)" {...fieldProps('vitals', 'pulse')} keyboardType="number-pad" /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}><FormField label="Breathing (/min)" {...fieldProps('vitals', 'respiratoryRate')} keyboardType="number-pad" /></View>
        <View style={styles.half}><FormField label="SpO2 (%)" {...fieldProps('vitals', 'spo2')} keyboardType="number-pad" /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}><FormField label="BP systolic" {...fieldProps('vitals', 'systolic')} keyboardType="number-pad" /></View>
        <View style={styles.half}><FormField label="BP diastolic" {...fieldProps('vitals', 'diastolic')} keyboardType="number-pad" /></View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}><FormField label="Weight (kg)" {...fieldProps('vitals', 'weightKg')} keyboardType="decimal-pad" /></View>
        {isChild ? <View style={styles.half}><FormField label="MUAC (mm)" {...fieldProps('vitals', 'muacMm')} keyboardType="number-pad" /></View> : null}
      </View>

      <Text style={styles.section}>Symptoms</Text>
      {SYMPTOMS.map(symptom => <FormToggle key={symptom.id} label={symptom.label} value={Boolean(form.symptoms[symptom.id])} onChange={toggle('symptoms', symptom.id)} />)}
      <FormField label="Ill for how many days?" {...fieldProps('durationDays')} keyboardType="number-pad" />
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.notes]} multiline value={form.notes} onChangeText={update('notes')} maxLength={2000} accessibilityLabel="Notes" />
      </View>

      <View style={[styles.triage, { borderColor: TRIAGE_STYLE[result.level].color }]} accessibilityLiveRegion="polite">
        <Text style={[styles.triageTitle, { color: TRIAGE_STYLE[result.level].color }]}>{TRIAGE_STYLE[result.level].label}</Text>
        {result.reasons.map(reason => <Text key={reason} style={styles.triageReason}>• {reason}</Text>)}
      </View>

      <FormToggle label="Patient (or caregiver) agrees to this consultation being recorded and shared with HFA doctors" value={form.consentGiven} onChange={update('consentGiven')} />
      {errors.consentGiven ? <Text style={styles.error}>{errors.consentGiven}</Text> : null}

      {result.level !== 'routine' ? (
        <Pressable style={[styles.button, { backgroundColor: COLORS.danger }]} onPress={escalate} disabled={busy} accessibilityRole="button">
          <Text style={styles.buttonText}>Escalate to doctor now</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => save()} disabled={busy} accessibilityRole="button">
        <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save consultation'}</Text>
      </Pressable>
    </ScrollView>
  );
}

// Defined outside the form so React keeps the same TextInput between renders (defining them
// inside would remount the input on every keystroke and drop the keyboard focus).
function FormField({ label, value, onChange, error, keyboardType = 'default', placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, error && styles.inputError]} value={String(value ?? '')} onChangeText={onChange} keyboardType={keyboardType} placeholder={placeholder} accessibilityLabel={label} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function FormToggle({ label, value, onChange }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={Boolean(value)} onValueChange={onChange} trackColor={{ true: COLORS.emerald }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48, backgroundColor: '#f8fafb' },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 12 },
  bannerText: { color: COLORS.navy, flex: 1, marginRight: 8 },
  link: { color: COLORS.emerald, fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.navy, marginTop: 20, marginBottom: 8 },
  field: { marginBottom: 12 },
  label: { color: COLORS.text, marginBottom: 4, fontSize: 13 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', fontSize: 16, color: COLORS.navy },
  inputError: { borderColor: COLORS.danger },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  half: { flex: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', marginBottom: 12 },
  chipActive: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  chipText: { color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  toggleLabel: { color: COLORS.navy, flex: 1, marginRight: 12 },
  triage: { borderWidth: 2, borderRadius: 12, padding: 12, marginVertical: 16, backgroundColor: '#fff' },
  triageTitle: { fontWeight: '700', marginBottom: 4 },
  triageReason: { color: COLORS.text },
  button: { backgroundColor: COLORS.emerald, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
