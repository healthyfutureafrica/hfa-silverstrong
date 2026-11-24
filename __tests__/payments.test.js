const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const content = read('index.html');

function loadMobileMoney(ApiState) {
  const context = { T: { en: {}, fr: {} }, LANG: 'en', ApiState, window: { hfaEscape: value => String(value), hfaFormat: key => key } };
  vm.createContext(context);
  vm.runInContext(read('mobile-money.js'), context);
  return context.window.HFAMobileMoney;
}

describe('payments', () => {
  test('there is no simulated payment anywhere: nothing is marked paid without MTN', () => {
    for (const text of ['MockPaymentProvider', "provider: 'mock'", 'MOCK-', 'mock_payment_notice', "t('card_payment')", "t('bank_transfer')"]) expect(content).not.toContain(text);
    expect(content).toContain("request.status = result.success ? 'completed' : result.due ? 'due' : 'failed';");
    expect(content).toContain("async charge() { return { success: false, due: true");
  });

  test('a paid plan is never activated in the browser: the server activates it after MTN confirms', () => {
    const upgrade = content.match(/^async function upgradeSubscription\([^]*?^}/m)[0];
    expect(upgrade).toContain("if (receipt.status==='due') { alert(t('subscription_payment_unavailable')); return; }");
    expect(upgrade).toContain('await refreshOwnAccount()');
    expect(content).toContain("subscription_tier_essential:'Essential (XAF 1,000/month)'");
    expect(content).toContain("subscription_tier_standard:'Care (XAF 3,000/month)'");
    expect(content).toContain("subscription_tier_premium:'Premium (XAF 10,000/month)'");
    // A new patient pays first, then completes the profile.
    const setup = content.match(/^function requiredSetupPage\(\) \{[^]*?^}/m)[0];
    expect(setup.indexOf("CU.role==='patient' && !hasPaidPatientSubscription(CU)")).toBeLessThan(setup.indexOf('CU.onboardingRequired'));
    expect(upgrade).toContain("navigate(requiredSetupPage() || 'dashboard')");
    expect(content).not.toContain("'/api/v1/subscription/free'");
  });

  test('mobile money is offered only when the server says MTN is configured, and the browser never sends an amount', () => {
    expect(loadMobileMoney({ enabled: true, authenticated: true, offline: false, paymentsAvailable: false }).available()).toBe(false);
    expect(loadMobileMoney({ enabled: false }).available()).toBe(false);
    const money = loadMobileMoney({ enabled: true, authenticated: true, offline: false, paymentsAvailable: true });
    expect(money.available()).toBe(true);
    const body = money.apiBody({ id: 'pay1730000000000', purpose: 'consultation_fee', payeeId: 'doc-1', amount: 15, metadata: {} }, '677000000');
    expect(body).toEqual({ purpose: 'consultation_fee', msisdn: '677000000', idempotencyKey: 'pay1730000000000', targetId: 'doc-1' });
    expect(money.apiBody({ id: 'pay1', purpose: 'subscription', metadata: { tier: 'premium' } }, '677').tier).toBe('premium');
    expect(money.apiBody({ id: 'pay2', purpose: 'appointment_reschedule', metadata: { appointmentId: 'apt-9' } }, '677').details).toEqual({ appointmentId: 'apt-9' });
  });
});
