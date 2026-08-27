// One-off audit: finds equipment docs that share the same Inventory Code
// within the same ministry. Duplicate codes are a real bug — QR scans
// (scanEquipmentIntoRequest, pull-out scanning) always resolve to the first
// matching doc, so a duplicate silently attaches the wrong item.
//
// With --apply, renames every duplicate AFTER the first occurrence (the
// first occurrence of each code is left untouched) to a fresh, unused code
// under the same ministry's prefix, and logs the rename to historyLogs.
//
// This is run locally by a developer with a Firebase service account key —
// it is NOT deployed anywhere.
//
// Usage (dry run first, always):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/find-duplicate-inventory-codes.js
//
// Then apply for real:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/find-duplicate-inventory-codes.js --apply
//
// Optional: MINISTRY_ID=<id> to scope to one ministry only.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const MINISTRY_ID = process.env.MINISTRY_ID || null;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function generateCode(prefix, taken) {
  let code;
  do {
    const random = Math.floor(Math.random() * 10_000).toString().padStart(4, '0');
    code = `${prefix}-${random}`;
  } while (taken.has(code));
  return code;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes — pass --apply to commit)'}`);
  if (MINISTRY_ID) console.log(`Scoped to ministryId: ${MINISTRY_ID}`);
  console.log('');

  const ministriesSnap = await db.collection('ministries').get();
  const prefixByMinistry = new Map(
    ministriesSnap.docs.map((d) => [d.id, d.data().inventoryCodePrefix || 'ITEM']),
  );

  let equipQuery = db.collection('equipment');
  if (MINISTRY_ID) equipQuery = equipQuery.where('ministryId', '==', MINISTRY_ID);
  const equipSnap = await equipQuery.get();
  const allEquipment = equipSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Group by ministryId + inventoryCode.
  const groups = new Map();
  for (const equip of allEquipment) {
    const key = `${equip.ministryId}::${equip.inventoryCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(equip);
  }

  // Track codes already in use per ministry, so replacement codes don't collide.
  const takenByMinistry = new Map();
  for (const equip of allEquipment) {
    if (!takenByMinistry.has(equip.ministryId)) takenByMinistry.set(equip.ministryId, new Set());
    takenByMinistry.get(equip.ministryId).add(equip.inventoryCode);
  }

  let dupGroupCount = 0;
  let dupItemCount = 0;

  for (const [key, items] of groups) {
    if (items.length <= 1) continue;
    const [ministryId, code] = key.split('::');
    dupGroupCount++;
    console.log(`DUPLICATE "${code}" in ministry ${ministryId} — ${items.length} items:`);
    // Sort by createdAt so the oldest keeps its code; later ones get renamed.
    const sorted = [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    sorted.forEach((item, idx) => {
      const keep = idx === 0;
      console.log(`  ${keep ? 'KEEP  ' : 'RENAME'} ${item.id}  "${item.item}"  (createdAt=${item.createdAt ?? 'unknown'})`);
    });

    for (let idx = 1; idx < sorted.length; idx++) {
      dupItemCount++;
      const item = sorted[idx];
      const taken = takenByMinistry.get(ministryId);
      const prefix = prefixByMinistry.get(ministryId) || 'ITEM';
      const newCode = generateCode(prefix, taken);
      taken.add(newCode);
      console.log(`    -> new code: ${newCode}`);
      if (APPLY) {
        await db.collection('equipment').doc(item.id).update({ inventoryCode: newCode, updatedAt: Date.now() });
        await db.collection('historyLogs').add({
          ministryId,
          equipmentId: item.id,
          inventoryCode: newCode,
          item: item.item,
          action: 'updated',
          details: `Inventory Code: ${code} → ${newCode} (deduplicated by admin script — was shared with another item)`,
          actor: 'admin-script',
          timestamp: Date.now(),
        });
      }
    }
    console.log('');
  }

  if (dupGroupCount === 0) {
    console.log('No duplicate inventory codes found.');
  } else {
    console.log(`Found ${dupGroupCount} duplicate code group(s), ${dupItemCount} item(s) needing a new code.`);
    console.log(APPLY ? 'Done — changes applied.' : 'Dry run complete — re-run with --apply to commit these changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
