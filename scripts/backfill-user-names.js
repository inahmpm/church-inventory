// One-off migration: backfills a `name` field onto any existing users/{uid}
// docs created before the Name field was added. Since Firestore has no
// record of a person's real name, this fills in a placeholder derived from
// their email's local-part (e.g. "jane.doe@example.com" -> "jane.doe") so
// the admin UI doesn't show a blank name. Admins should follow up by editing
// each user's Name to their real name via Admin > Users > Edit.
//
// This is run locally by a developer with a Firebase service account key —
// it is NOT deployed anywhere, so it does not require the Blaze billing plan.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/backfill-user-names.js

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const BATCH_LIMIT = 500;

function placeholderNameFor(email) {
  return email.split('@')[0] || email;
}

async function main() {
  const snap = await db.collection('users').get();
  const docsNeedingBackfill = snap.docs.filter((d) => !d.data().name);

  if (docsNeedingBackfill.length === 0) {
    console.log('users: nothing to backfill.');
    return;
  }

  for (let i = 0; i < docsNeedingBackfill.length; i += BATCH_LIMIT) {
    const chunk = docsNeedingBackfill.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { name: placeholderNameFor(doc.data().email) });
    }
    await batch.commit();
  }
  console.log(`users: backfilled ${docsNeedingBackfill.length} document(s) with a placeholder name.`);
  console.log('Follow up in Admin > Users to set each person\'s real name.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
