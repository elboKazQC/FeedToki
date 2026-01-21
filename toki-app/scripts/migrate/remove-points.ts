/*
  Script: remove-points.ts
  Usage:
    DRY RUN (no writes):
      ts-node scripts/migrate/remove-points.ts --dry

    APPLY CHANGES:
      ts-node scripts/migrate/remove-points.ts --apply

  Requirements:
    - Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account with Firestore access
*/

import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const APPLY = args.includes('--apply');
if (!DRY && !APPLY) {
  console.log('Usage: node remove-points.js --dry | --apply');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

async function deleteCollectionDocs(path: string) {
  const ref = db.collection(path);
  const snapshot = await ref.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) return 0;
  let deleted = 0;
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  if (APPLY) await batch.commit();
  deleted += snapshot.size;
  return deleted;
}

async function processUser(userId: string) {
  console.log(`Processing user: ${userId}`);
  // 1) Delete points subcollection if exists
  const pointsPath = `users/${userId}/points`;
  let removedPointsDocs = 0;
  try {
    removedPointsDocs = await deleteCollectionDocs(pointsPath);
    console.log(`  - points docs removed: ${removedPointsDocs}`);
  } catch (err) {
    console.warn(`  - error deleting points for ${userId}:`, err);
  }

  // 2) Remove dailyPointsBudget from profile
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (userSnap.exists && (userSnap.data() as any).dailyPointsBudget !== undefined) {
    console.log('  - dailyPointsBudget found');
    if (APPLY) await userRef.update({ dailyPointsBudget: FieldValue.delete() });
    console.log('  - dailyPointsBudget removed');
  }

  // 3) Remove points field from customFoods subcollection
  const customFoodsSnap = await db.collection(`users/${userId}/customFoods`).get();
  let customFoodsUpdated = 0;
  for (const doc of customFoodsSnap.docs) {
    const data = doc.data();
    if (data.points !== undefined) {
      if (APPLY) await doc.ref.update({ points: FieldValue.delete() });
      customFoodsUpdated++;
    }
  }
  console.log(`  - customFoods updated: ${customFoodsUpdated}`);

  // 4) Remove points references inside meals' items
  const mealsSnap = await db.collection(`users/${userId}/meals`).get();
  let mealsUpdated = 0;
  for (const mealDoc of mealsSnap.docs) {
    const meal = mealDoc.data();
    let changed = false;
    if (meal && Array.isArray(meal.items)) {
      const newItems = meal.items.map((it: any) => {
        if ('points' in it) {
          changed = true;
          const { points, ...rest } = it;
          return rest;
        }
        return it;
      });
      if (changed) {
        if (APPLY) await mealDoc.ref.update({ items: newItems });
        mealsUpdated++;
      }
    }
  }
  console.log(`  - meals updated (items cleaned): ${mealsUpdated}`);

  return { removedPointsDocs, customFoodsUpdated, mealsUpdated };
}

async function processGlobalFoods() {
  console.log('Processing globalFoods collection');
  const snap = await db.collection('globalFoods').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.points !== undefined) {
      if (APPLY) await doc.ref.update({ points: FieldValue.delete() });
      updated++;
    }
  }
  console.log(`  - globalFoods updated: ${updated}`);
  return updated;
}

async function main() {
  console.log(`Starting migration (DRY=${DRY}, APPLY=${APPLY})`);
  const usersSnap = await db.collection('users').get();
  let total = { pointsDocs: 0, customFoods: 0, meals: 0 };
  for (const user of usersSnap.docs) {
    const res = await processUser(user.id);
    total.pointsDocs += res.removedPointsDocs;
    total.customFoods += res.customFoodsUpdated;
    total.meals += res.mealsUpdated;
  }

  const globalUpdated = await processGlobalFoods();

  console.log('Migration summary:');
  console.log(`  - points docs removed: ${total.pointsDocs}`);
  console.log(`  - customFoods updated: ${total.customFoods}`);
  console.log(`  - meals updated: ${total.meals}`);
  console.log(`  - globalFoods updated: ${globalUpdated}`);
  console.log('Done.');
}

main().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
