// One-off cleanup: releases the equipment lock on every item that is
// "scheduled for pull-out" (or already pulled out) EXCEPT items attached to
// a pull-out request whose purpose matches "COG Anniversary" — those are
// left locked/untouched.
//
// This also sweeps for *orphaned* locks: equipment docs with pulloutStatus
// set even though no live pull-out request references them anymore (e.g.
// left behind by a deleted request or a past bug). The equipment collection
// is the source of truth for the "on hold" badge in Inventory, so this is
// swept directly rather than only walking pulloutRequests.
//
// This is run locally by a developer with a Firebase service account key —
// it is NOT deployed anywhere.
//
// Usage (dry run first, always):
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/release-non-anniversary-pullouts.js
//
// Then apply for real:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/release-non-anniversary-pullouts.js --apply
//
// Optional: MINISTRY_ID=<id> to scope to one ministry only.
// Optional: RETAIN_MATCH="cog anniversary" to change the retain-phrase match
// (case-insensitive substring match against the request's `purpose` field).

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const MINISTRY_ID = process.env.MINISTRY_ID || null;
const RETAIN_MATCH = (process.env.RETAIN_MATCH || 'cog anniversary').toLowerCase();

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes — pass --apply to commit)'}`);
  console.log(`Retaining requests whose purpose contains: "${RETAIN_MATCH}"`);
  if (MINISTRY_ID) console.log(`Scoped to ministryId: ${MINISTRY_ID}`);
  console.log('');

  // 1. Load all pull-out requests (optionally scoped to one ministry).
  let reqQuery = db.collection('pulloutRequests');
  if (MINISTRY_ID) reqQuery = reqQuery.where('ministryId', '==', MINISTRY_ID);
  const reqSnap = await reqQuery.get();

  const retainEquipmentIds = new Set();
  const nonRetainedRequests = [];

  for (const reqDoc of reqSnap.docs) {
    const req = { id: reqDoc.id, ...reqDoc.data() };
    const isRetained = (req.purpose || '').toLowerCase().includes(RETAIN_MATCH);
    const itemsSnap = await reqDoc.ref.collection('items').get();
    const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (isRetained) {
      console.log(`RETAIN request "${req.purpose}" (${req.id}, status=${req.status}) — ${items.length} item(s) left locked`);
      for (const item of items) retainEquipmentIds.add(item.equipmentId);
    } else {
      nonRetainedRequests.push({ req, items });
    }
  }

  // 2. For non-retained requests, release any item still awaiting pull-out
  //    (itemStatus === 'for_pullout'). Already pulled-out/returned/missing
  //    items are left alone — they're not "scheduled" anymore.
  console.log('');
  for (const { req, items } of nonRetainedRequests) {
    const pending = items.filter((it) => it.itemStatus === 'for_pullout');
    if (pending.length === 0) continue;
    console.log(`RELEASE ${pending.length} pending item(s) from request "${req.purpose}" (${req.id}, status=${req.status})`);
    for (const item of pending) {
      console.log(`  - ${item.inventoryCode} ${item.item}`);
      if (APPLY) {
        await reqDoc_itemRef(req.id, item.id).delete();
        await db.collection('equipment').doc(item.equipmentId).update({
          pulloutStatus: null,
          activePulloutRequestId: null,
          updatedAt: Date.now(),
        });
        await logHistory(req.ministryId, item, `Released in bulk cleanup (request ${req.id})`);
      }
    }
    if (APPLY) {
      const remaining = items.length - pending.length;
      await db.collection('pulloutRequests').doc(req.id).update({
        itemCount: remaining,
        status: remaining === 0 ? 'draft' : undefined,
        updatedAt: Date.now(),
      });
    }
  }

  // 3. Sweep equipment collection directly for orphaned locks: pulloutStatus
  //    set but the equipment isn't in the retain set built above.
  console.log('');
  let equipQuery = db.collection('equipment').where('pulloutStatus', '!=', null);
  if (MINISTRY_ID) equipQuery = equipQuery.where('ministryId', '==', MINISTRY_ID);
  const equipSnap = await equipQuery.get();

  let orphanCount = 0;
  for (const equipDoc of equipSnap.docs) {
    const equip = { id: equipDoc.id, ...equipDoc.data() };
    if (retainEquipmentIds.has(equip.id)) continue;
    orphanCount++;
    console.log(`RELEASE orphaned lock: ${equip.inventoryCode} ${equip.item} (pulloutStatus=${equip.pulloutStatus}, activePulloutRequestId=${equip.activePulloutRequestId})`);
    if (APPLY) {
      await equipDoc.ref.update({ pulloutStatus: null, activePulloutRequestId: null, updatedAt: Date.now() });
      await logHistory(equip.ministryId, {
        equipmentId: equip.id,
        inventoryCode: equip.inventoryCode,
        item: equip.item,
      }, 'Released stale pull-out lock in bulk cleanup');
    }
  }
  if (orphanCount === 0) console.log('No orphaned locks found.');

  console.log('');
  console.log(APPLY ? 'Done — changes applied.' : 'Dry run complete — re-run with --apply to commit these changes.');
}

function reqDoc_itemRef(requestId, itemId) {
  return db.collection('pulloutRequests').doc(requestId).collection('items').doc(itemId);
}

async function logHistory(ministryId, item, details) {
  await db.collection('historyLogs').add({
    ministryId,
    equipmentId: item.equipmentId,
    inventoryCode: item.inventoryCode,
    item: item.item,
    action: 'pullout_removed',
    details,
    actor: 'admin-script',
    timestamp: Date.now(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
