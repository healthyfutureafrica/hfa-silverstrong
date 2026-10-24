// Retires the test accounts that earlier versions created when DEMO_ACCOUNTS=true. HFA SilverStrong is for
// real people, so demo accounts no longer exist. An account is retired only when its email is a built-in demo
// address AND either
//  - its stored password hash is exactly the demo hash, or
//  - its name and role are exactly the demo ones and it was created before demo accounts were removed
//    (older versions hashed demo passwords with a fresh salt, so their hash differs).
// A real person who registers with one of these addresses (some look like ordinary Gmail and Yahoo addresses)
// is therefore never touched.
const DEMO_REMOVED_AT = '2026-10-25T00:00:00.000Z';
const DEMO_ACCOUNTS = [
  { email: 'anwosu@hfa.org', name: 'Dr. Amara Nwosu', role: 'doctor', hash: '2358d496667018ea543d58907539536f:24baebde02f31ba571aa94f241f215bedf0eb14dc0b8b05066a6abd1bf68e9d890ae24f234218877b02eba4b2034cc6a6aa4a0f36096e1cb4dce98442f3ad7d3' },
  { email: 'kasante@hfa.org', name: 'Dr. Kwame Asante', role: 'doctor', hash: 'b99d1ec3840e59e2c099ce2037ac2dcf:e27f0bb4dcb1840a13c076b455da37dbb31e7c86947d8ebde29de4dff52b5eb780bd4cc696e813f873edb061ea4b53de91a64cd6562dce7e2543db4e519b16c9' },
  { email: 'fdiallo@hfa.org', name: 'Nurse Fatima Diallo', role: 'nurse', hash: '34b7055e54ed01f66849ebc8b7102643:f114cf6c829acaac3d1d7fd0218bb23f8b4e3b85ba27c182b513de5bf382a32a9644e6f2e1a1a87b59802703d17341131a335fb7f8a78c5777e1e1000cfe87f4' },
  { email: 'bosei@hfa.org', name: 'Nurse Bola Osei', role: 'nurse', hash: 'b1c0dc54590682d6cc8edffee4ad412a:2a5e94214407084e8272cf0501e15535e4c0a37c0e35a2fd493654c05704ec84b679f54f2571112b8b08a71e6f6a7a05ce9a23e18c86c3cd51ae272e32bb405b' },
  { email: 'lab@hfa.org', name: 'Grace Laboratory Tech', role: 'labtech', hash: '3af48b5524b5ab6a12533e23b51d4ea5:a12b6f0c84890d3f9f870d521898ad137d792587fd4c343ba4ea6a5ad94dd6ae85b332693b85dd180c07aabbd3c68d949e6d8dc3ce24514036ce7b1e6f7f3b0b' },
  { email: 'pharmacy@hfa.org', name: 'Pharm. Brenda Ngum', role: 'pharmacist', hash: 'e34538eb72f207fa1ae2dffe531dc54d:76bbf21121358a07efd9d5d2b6f857e87bc7bda16d2fc911edd2940b3fdb6d914cd8b54b33d2aef017514bf08d6d5070a6e8f7b2dc6762ab8c5080c2fd222485' },
  { email: 'etabe@gmail.com', name: 'Emmanuel Tabe', role: 'patient', hash: '772d268d52a0b68d50ad85ef5a4c21fc:6c3da51d02b1461e9859552a4300158f49ee553c3068d818420638a58a86657b7e7ebffd33da5df773f639f8185390a8ca9db0f8b869262201efefd45e46b1ae' },
  { email: 'cmbeki@yahoo.com', name: 'Carine Mbeki', role: 'patient', hash: '8794f798529d12306379ac0a34161e77:392ee2fe78c56b687f7bc4da91079e02f99edc60c0f517fce43a66ac2d3ec5e8f5d23b715587114dbff23c5ea6ec648d119befdbed1728ffab62e8cce7b4e5a3' },
  { email: 'jfon@gmail.com', name: 'Joseph Fon', role: 'patient', hash: '5f31d8053979070bf3433fe2e93b8f2b:3038a841235c4898e1852e9101e880f319b4d1790ee12bcb9c672d0d9e67a03452434661d208592aae87477a7285c8a899a743bbf3c29311d84fe197c4bb70fd' },
];
const DEMO_FINGERPRINTS = new Map(DEMO_ACCOUNTS.map(account => [account.email, account.hash]));

function retireDemoAccounts(store) {
  let retired = 0;
  for (const account of DEMO_ACCOUNTS) {
    const row = store.db.prepare('SELECT id,name,role,status,password_hash,created_at FROM users WHERE email=?').get(account.email);
    if (!row || row.status === 'deleted') continue;
    const sameHash = row.password_hash === account.hash;
    const oldDemo = row.name === account.name && row.role === account.role && row.created_at < DEMO_REMOVED_AT;
    if (!sameHash && !oldDemo) continue;
    store.updateUser(row.id, { status: 'deleted' });
    store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.id);
    store.audit(row.id, 'DEMO_ACCOUNT_RETIRED', { targetId: row.id, details: { email: account.email } });
    retired++;
  }
  return retired;
}

module.exports = { retireDemoAccounts, DEMO_FINGERPRINTS, DEMO_ACCOUNTS, DEMO_REMOVED_AT };
