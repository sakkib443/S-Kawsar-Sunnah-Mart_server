/**
 * Hide / unhide the seeded demo products.
 *
 * The demo catalogue that shipped with the project (Ajwa Dates … Al-Quran) still
 * carries generated placeholder art at `/products/<slug>.svg` instead of real
 * photos. This script flips those products' `visibility` to 'hidden' so the
 * storefront only shows real products — nothing is deleted, and the admin
 * dashboard still lists them.
 *
 *   node scripts/hide-demo-products.js                 # dry run — just report
 *   node scripts/hide-demo-products.js --apply         # hide them
 *   node scripts/hide-demo-products.js --unhide --apply# bring them back
 *
 * Run from the backend folder (it reads backend/.env for DATABASE_URL).
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const UNHIDE = process.argv.includes('--unhide');

/** Placeholder art the seed script generated: /products/<slug>.svg */
const PLACEHOLDER = /^\/products\/.*\.svg$/;

(async () => {
    await mongoose.connect(process.env.DATABASE_URL);
    const col = mongoose.connection.db.collection('products');

    const filter = UNHIDE
        ? { thumbnail: { $regex: PLACEHOLDER }, visibility: 'hidden' }
        : { thumbnail: { $regex: PLACEHOLDER }, visibility: { $ne: 'hidden' } };

    const docs = await col.find(filter).project({ name: 1, visibility: 1 }).toArray();
    docs.forEach((d, i) => console.log(`${i + 1}. ${d.name}  [${d.visibility || 'unset'}]`));
    console.log(`\n${docs.length} product(s) matched — ${UNHIDE ? 'unhide' : 'hide'}`);

    if (!APPLY) {
        console.log('Dry run. Re-run with --apply to write.');
    } else if (docs.length > 0) {
        const res = await col.updateMany(
            { _id: { $in: docs.map((d) => d._id) } },
            { $set: { visibility: UNHIDE ? 'visible' : 'hidden' } }
        );
        console.log(`Updated ${res.modifiedCount} product(s).`);
    }

    const left = await col.countDocuments({ isDeleted: { $ne: true }, visibility: { $ne: 'hidden' } });
    console.log(`Visible on the storefront now: ${left}`);
    await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
