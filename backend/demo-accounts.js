// The test accounts of the static demo (index.html), created on a server only when DEMO_ACCOUNTS=true.
// Only scrypt hashes of their passwords are kept here. Never enable demo accounts on a production server.
const DEMO_ACCOUNTS = [
  { role: 'doctor', name: 'Dr. Amara Nwosu', email: 'anwosu@hfa.org', passwordHash: '2358d496667018ea543d58907539536f:24baebde02f31ba571aa94f241f215bedf0eb14dc0b8b05066a6abd1bf68e9d890ae24f234218877b02eba4b2034cc6a6aa4a0f36096e1cb4dce98442f3ad7d3', phone: '+237 677 123 456', profile: { specialty: 'General Medicine', licenseNo: 'CM-MED-2021-0041', hospital: 'HFA Central Hospital', consultationFee: 15 } },
  { role: 'doctor', name: 'Dr. Kwame Asante', email: 'kasante@hfa.org', passwordHash: 'b99d1ec3840e59e2c099ce2037ac2dcf:e27f0bb4dcb1840a13c076b455da37dbb31e7c86947d8ebde29de4dff52b5eb780bd4cc696e813f873edb061ea4b53de91a64cd6562dce7e2543db4e519b16c9', phone: '+237 655 987 321', profile: { specialty: 'Cardiology', licenseNo: 'CM-MED-2019-0078', hospital: 'HFA Heart Center', consultationFee: 20 } },
  { role: 'nurse', name: 'Nurse Fatima Diallo', email: 'fdiallo@hfa.org', passwordHash: '34b7055e54ed01f66849ebc8b7102643:f114cf6c829acaac3d1d7fd0218bb23f8b4e3b85ba27c182b513de5bf382a32a9644e6f2e1a1a87b59802703d17341131a335fb7f8a78c5777e1e1000cfe87f4', phone: '+237 699 234 567', profile: { department: 'Emergency Care', specialty: 'Critical Care Nursing', nurseId: 'CM-NUR-2020-0015', hospital: 'HFA Central Hospital' } },
  { role: 'nurse', name: 'Nurse Bola Osei', email: 'bosei@hfa.org', passwordHash: 'b1c0dc54590682d6cc8edffee4ad412a:2a5e94214407084e8272cf0501e15535e4c0a37c0e35a2fd493654c05704ec84b679f54f2571112b8b08a71e6f6a7a05ce9a23e18c86c3cd51ae272e32bb405b', phone: '+237 688 345 678', profile: { department: 'Pediatrics', specialty: 'Pediatric Nursing', nurseId: 'CM-NUR-2022-0031', hospital: 'HFA Children Ward' } },
  { role: 'labtech', name: 'Grace Laboratory Tech', email: 'lab@hfa.org', passwordHash: '3af48b5524b5ab6a12533e23b51d4ea5:a12b6f0c84890d3f9f870d521898ad137d792587fd4c343ba4ea6a5ad94dd6ae85b332693b85dd180c07aabbd3c68d949e6d8dc3ce24514036ce7b1e6f7f3b0b', phone: '+237 677 800 101', profile: { laboratory: 'HFA Diagnostic Laboratory', labRegion: 'littoral', labTown: 'Douala' } },
  { role: 'pharmacist', name: 'Pharm. Brenda Ngum', email: 'pharmacy@hfa.org', passwordHash: 'e34538eb72f207fa1ae2dffe531dc54d:76bbf21121358a07efd9d5d2b6f857e87bc7bda16d2fc911edd2940b3fdb6d914cd8b54b33d2aef017514bf08d6d5070a6e8f7b2dc6762ab8c5080c2fd222485', phone: '+237 677 300 202', profile: { pharmacyName: 'HFA Community Pharmacy', pharmacyAddress: 'Rue Joss, Bonanjo', pharmacyLocation: 'Douala, Littoral, Cameroon', pharmacyLicense: 'CM-PHA-2021-0107', businessRegistration: 'RC/DLA/2021/B/0456', minsanteAuthorization: 'MINSANTE/DPML/2021/0219', ownerName: 'Brenda Ngum', ownerIdType: 'national_id', ownerIdNumber: 'CM-CNI-114502387', pharmacyValidatedBy: 'demo-seed', pharmacyValidatedAt: '2024-02-14T10:00:00.000Z' } },
  { role: 'patient', name: 'Emmanuel Tabe', email: 'etabe@gmail.com', passwordHash: '772d268d52a0b68d50ad85ef5a4c21fc:6c3da51d02b1461e9859552a4300158f49ee553c3068d818420638a58a86657b7e7ebffd33da5df773f639f8185390a8ca9db0f8b869262201efefd45e46b1ae', phone: '+237 677 456 789', doctor: 'anwosu@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1985-06-14', gender: 'Male', bloodType: 'O+', allergies: 'Penicillin', address: 'Douala, Cameroon' } },
  { role: 'patient', name: 'Carine Mbeki', email: 'cmbeki@yahoo.com', passwordHash: '8794f798529d12306379ac0a34161e77:392ee2fe78c56b687f7bc4da91079e02f99edc60c0f517fce43a66ac2d3ec5e8f5d23b715587114dbff23c5ea6ec648d119befdbed1728ffab62e8cce7b4e5a3', phone: '+237 655 789 012', doctor: 'anwosu@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1992-11-22', gender: 'Female', bloodType: 'A+', allergies: 'None', address: 'Yaoundé, Cameroon' } },
  { role: 'patient', name: 'Joseph Fon', email: 'jfon@gmail.com', passwordHash: '5f31d8053979070bf3433fe2e93b8f2b:3038a841235c4898e1852e9101e880f319b4d1790ee12bcb9c672d0d9e67a03452434661d208592aae87477a7285c8a899a743bbf3c29311d84fe197c4bb70fd', phone: '+237 699 123 456', doctor: 'kasante@hfa.org', nurse: 'fdiallo@hfa.org', profile: { dateOfBirth: '1970-03-08', gender: 'Male', bloodType: 'B+', allergies: 'Aspirin', address: 'Bamenda, Cameroon' } }
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
    store.createUser({ name: account.name, email: account.email, role: account.role, phone: account.phone, profile: account.profile, facilityId }, account.passwordHash, 'active');
  }
  for (const account of DEMO_ACCOUNTS.filter(entry => entry.role === 'patient')) {
    const patient = store.user(idOf(account.email));
    if (!patient.assignedDoctor && !patient.assignedNurse) store.updateUser(patient.id, { assignedDoctor: idOf(account.doctor), assignedNurse: idOf(account.nurse) });
  }
}

module.exports = { DEMO_ACCOUNTS, seedDemoAccounts };
