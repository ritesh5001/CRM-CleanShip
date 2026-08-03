/** Throwaway: pre-load the TeleCMI settings so they're ready once the API deploys. */
import { connectDB, disconnectDB } from '../config/db.js';
import { Integration } from '../models/Integration.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  await connectDB();

  // Confirm this is the same DB production uses before writing anything.
  const twilio = (await Integration.findOne({ key: 'twilio' }).lean()) as Record<string, any> | null;
  console.log('twilio.publicServerUrl :', JSON.stringify(twilio?.publicServerUrl));
  console.log('twilio.accountSid      :', twilio?.accountSid);

  const existing = (await Integration.findOne({ key: 'telecmi' }).lean()) as Record<string, any> | null;
  console.log('existing telecmi doc   :', existing ? JSON.stringify({ appId: existing.appId, apiTokenSet: Boolean(existing.apiToken) }) : 'none');

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)');
    await disconnectDB();
    return;
  }

  const doc = (await Integration.findOne({ key: 'telecmi' })) ?? new Integration({ key: 'telecmi' });
  doc.set('enabled', true);
  doc.set('recordCalls', true);
  doc.set('appId', '33335325');
  doc.set('sbcUri', 'sbcind.telecmi.com');
  doc.set('publicServerUrl', 'https://crm-cleanship.onrender.com');
  // apiToken deliberately NOT set — it's a secret only the admin can supply.
  await doc.save();

  const saved = (await Integration.findOne({ key: 'telecmi' }).lean()) as Record<string, any>;
  console.log('\nsaved:', JSON.stringify({
    enabled: saved.enabled,
    appId: saved.appId,
    sbcUri: saved.sbcUri,
    recordCalls: saved.recordCalls,
    publicServerUrl: saved.publicServerUrl,
    defaultCountryCode: saved.defaultCountryCode,
    apiTokenSet: Boolean(saved.apiToken),
  }));
  await disconnectDB();
}
main().catch((e) => { console.error(e); process.exit(1); });
