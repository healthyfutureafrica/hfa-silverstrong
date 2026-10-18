const { hashPassword } = require('./store');

// The test accounts shown in the static demo (index.html), created on a server only when
// DEMO_ACCOUNTS=true. Their passwords are public, so never enable this on a production server.
const DEMO_ACCOUNTS = [
  { role: 'doctor', name: 'Dr. Amara Nwosu', email: 'anwosu@hfa.org', password: 'Doctor@123', phone: '+237 677 123 456', profile: { specialty: 'General Medicine', licenseNo: 'CM-MED-2021-0041', hospital: 'HFA Central Hospital', consultationFee: 15 } },
  { role: 'doctor', name: 'Dr. Kwame Asante', email: 'kasante@hfa.org', password: 'Doctor@123', phone: '+237 655 987 321', profile: { specialty: 'Cardiology', licenseNo: 'CM-MED-2019-0078', hospital: 'HFA Heart Center', consultationFee: 20 } },
  { role: 'nurse', name: 'Nurse Fatima Diallo', email: 'fdiallo@hfa.org', password: 'Nurse@123', phone: '+237 699 234 567', profile: { department: 'Emergency Care', specialty: 'Critical Care Nursing', nurseId: 'CM-NUR-2020-0015', hospital: 'HFA Central Hospital' } },
  { role: 'nurse', name: 'Nurse Bola Osei', email: 'bosei@hfa.org', password: 'Nurse@123', phone: '+237 688 345 678', profile: { department: 'Pediatrics', specialty: 'Pediatric Nursing', nurseId: 'CM-NUR-2022-0031', hospital: 'HFA Children Ward' } },
  { role: 'labtech', name: 'Grace Laboratory Tech', email: 'lab@hfa.org', password: 'Lab@123', phone: '+237 677 800 101', profile: { laboratory: 'HFA Diagnostic Laboratory', labRegion: 'littoral', labTown: 'Douala' } },
  { role: 'pharmacist', name: 'Pharm. Brenda Ngum', email: 'pharmacy@hfa.org', password: 'Pharmacist@123', phone: '+237 677 300 202', profile: { pharmacyName: 'HFA Community Pharmacy', pharmacyAddress: 'Rue Joss, Bonanjo', pharmacyLocation: 'Douala, Littoral, Cameroon', pharmacyLicense: 'CM-PHA-2021-0107', businessRegistration: 'RC/DLA/2021/B/0456', minsanteAuthorization: 'MINSANTE/DPML/2021/0219', ownerName: 'Brenda Ngum', ownerIdType: 'national_id', ownerIdNumber: 'CM-CNI-114502387', pharmacyValidatedBy: 'demo-seed', pharmacyValidatedAt: '2024-02-14T10:00:00.000Z' } },
  { role: 'patient', name: 'Emmanuel Tabe', email: 'etabe@gmail.com', password: 'Patient@123', phone: '+237 677 456 789', doctor: 'anwosu@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1985-06-14', gender: 'Male', bloodType: 'O+', allergies: 'Penicillin', address: 'Douala, Cameroon' } },
  { role: 'patient', name: 'Carine Mbeki', email: 'cmbeki@yahoo.com', password: 'Patient@123', phone: '+237 655 789 012', doctor: 'anwosu@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1992-11-22', gender: 'Female', bloodType: 'A+', allergies: 'None', address: 'Yaoundé, Cameroon' } },
  { role: 'patient', name: 'Joseph Fon', email: 'jfon@gmail.com', password: 'Patient@123', phone: '+237 699 123 456', doctor: 'kasante@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1970-03-08', gender: 'Male', bloodType: 'B+', allergies: 'Aspirin', address: 'Bamenda, Cameroon' } }
];

// Creates missing demo accounts and reactivates any that were suspended, rejected or deleted.
async function seedDemoAccounts(store) {
  const idOf = email => store.credentials(email)?.id;
  for (const account of DEMO_ACCOUNTS) {
    const existing = idOf(account.email);
    if (existing) {
      if (store.user(existing).status !== 'active') store.updateUser(existing, { status: 'active' });
      // Demo lab created before labs had a location: give it Douala and re-issue its placeholder number.
      if (account.role === 'labtech' && !store.user(existing).labRegion) {
        store.updateUser(existing, { profile: { labRegion: account.profile.labRegion, labTown: account.profile.labTown } });
        if (/-XX-XXX-/.test(store.user(existing).hfaId)) { store.db.prepare('UPDATE users SET hfa_number=NULL WHERE id=?').run(existing); store.assignNumber(existing); }
      }
      continue;
    }
    // Demo patients are registered under their doctor's hospital.
    const facilityId = account.doctor ? store.user(idOf(account.doctor))?.facilityId : undefined;
    store.createUser({ name: account.name, email: account.email, role: account.role, phone: account.phone, profile: account.profile, facilityId }, await hashPassword(account.password), 'active');
  }
  for (const account of DEMO_ACCOUNTS.filter(entry => entry.role === 'patient')) {
    const patient = store.user(idOf(account.email));
    if (!patient.assignedDoctor && !patient.assignedNurse) store.updateUser(patient.id, { assignedDoctor: idOf(account.doctor), assignedNurse: idOf(account.nurse) });
  }
}

module.exports = { DEMO_ACCOUNTS, seedDemoAccounts };
