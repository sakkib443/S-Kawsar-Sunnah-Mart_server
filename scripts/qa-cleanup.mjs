// ─────────────────────────────────────────────────────────────────────
//  QA test-data cleanup — run once to remove the data created during the
//  2026-07-30 QA re-test, and restore product stock/totalSold.
//
//  RUN FROM THE SERVER FOLDER:
//     cd S-Kawsar-Sunnah-Mart_server
//     node scripts/qa-cleanup.mjs
//
//  PRESERVES: admin@gmail.com · all real products (stock restored) · all
//  categories · site content · shipping settings.
//  DELETES: every order, every non-admin user, all reviews, transactions,
//  notifications, return requests, newsletter subscribers, activity logs,
//  and leftover test coupons.
//
//  NOTE: This clone started with 0 orders / 0 reviews / 1 admin, so every
//  order, review, and non-admin user in the DB is QA test data.
// ─────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Run this from the S-Kawsar-Sunnah-Mart_server folder (where .env lives).');
  process.exit(1);
}

await mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection.db;
const log = [];

// ── 1. Restore stock + totalSold from every (test) order ─────────────
const orders = await db.collection('orders').find({}).project({ items: 1, status: 1 }).toArray();
const stockAdd = new Map();
const soldSub = new Map();
for (const o of orders) {
  for (const it of (o.items || [])) {
    const pid = String(it.product);
    const qty = it.quantity || 0;
    soldSub.set(pid, (soldSub.get(pid) || 0) + qty);            // totalSold always +qty at creation
    if (o.status !== 'cancelled') stockAdd.set(pid, (stockAdd.get(pid) || 0) + qty); // cancel() already restored stock
  }
}
const productIds = new Set([...stockAdd.keys(), ...soldSub.keys()]);
for (const pid of productIds) {
  await db.collection('products').updateOne(
    { _id: new mongoose.Types.ObjectId(pid) },
    { $inc: { stock: stockAdd.get(pid) || 0, totalSold: -(soldSub.get(pid) || 0) } }
  );
}
log.push(`Restored stock/totalSold on ${productIds.size} products (from ${orders.length} orders)`);

// ── 2. Reset ratings on products that had (test) reviews ─────────────
const reviewedProductIds = [...new Set((await db.collection('reviews').find({}).project({ product: 1 }).toArray()).map(r => String(r.product)))];
for (const pid of reviewedProductIds) {
  await db.collection('products').updateOne(
    { _id: new mongoose.Types.ObjectId(pid) },
    { $set: { rating: 0, reviewCount: 0, totalReviews: 0, numReviews: 0 } }
  );
}
log.push(`Reset rating/reviewCount on ${reviewedProductIds.length} product(s)`);

// ── 3. Delete test data ──────────────────────────────────────────────
for (const [coll, filter, label] of [
  ['orders', {}, 'orders'],
  ['users', { email: { $ne: 'admin@gmail.com' } }, 'non-admin users'],
  ['reviews', {}, 'reviews'],
  ['transactions', {}, 'transactions'],
  ['notifications', {}, 'notifications'],
  ['returnrequests', {}, 'return requests'],
  ['newslettersubscribers', {}, 'newsletter subscribers'],
  ['activitylogs', {}, 'activity logs'],
  ['coupons', { code: /_\d{13}$/ }, 'leftover test coupons'],
]) {
  const res = await db.collection(coll).deleteMany(filter).catch(() => ({ deletedCount: 'n/a' }));
  log.push(`Deleted ${label}: ${res.deletedCount}`);
}

// ── 4. Verify preserved data ─────────────────────────────────────────
const rem = {
  admin: await db.collection('users').countDocuments({ email: 'admin@gmail.com' }),
  users: await db.collection('users').countDocuments(),
  products: await db.collection('products').countDocuments({ isDeleted: { $ne: true } }),
  categories: await db.collection('categories').countDocuments({ isDeleted: { $ne: true } }),
  orders: await db.collection('orders').countDocuments(),
  reviews: await db.collection('reviews').countDocuments(),
};

console.log('\n=== ✅ CLEANUP DONE ===');
log.forEach(l => console.log('  •', l));
console.log('--- Preserved ---');
console.log('  admin@gmail.com present:', rem.admin === 1 ? 'yes ✅' : 'NO ❌');
console.log('  users:', rem.users, '| products:', rem.products, '| categories:', rem.categories);
console.log('  orders now:', rem.orders, '| reviews now:', rem.reviews);
await mongoose.disconnect();
console.log('\nDone. Refresh the admin dashboard — finance should read ৳0.');
