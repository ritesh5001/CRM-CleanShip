import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Lead } from '../models/Lead.js';

async function seed() {
  await connectDB();

  // 1. Superadmin (idempotent).
  let admin = await User.findOne({ email: env.superadmin.email });
  if (!admin) {
    admin = new User({
      name: env.superadmin.name,
      email: env.superadmin.email,
      role: 'superadmin',
      dailyTarget: 0,
    });
    await admin.setPassword(env.superadmin.password);
    await admin.save();
    console.log(`✅ Superadmin created: ${env.superadmin.email} / ${env.superadmin.password}`);
  } else {
    console.log('ℹ️  Superadmin already exists, skipping.');
  }

  // 2. A demo telecaller.
  let tele = await User.findOne({ email: 'telecaller@cleanship.com' });
  if (!tele) {
    tele = new User({
      name: 'Demo Telecaller',
      email: 'telecaller@cleanship.com',
      phone: '9999999999',
      role: 'telecaller',
      dailyTarget: 50,
      createdBy: admin._id,
    });
    await tele.setPassword('Tele@12345');
    await tele.save();
    console.log('✅ Demo telecaller created: telecaller@cleanship.com / Tele@12345');
  }

  // 3. A few sample leads (only if none exist).
  const leadCount = await Lead.countDocuments();
  if (leadCount === 0) {
    await Lead.insertMany([
      { name: 'Ramesh Kumar', phone: '9876543210', city: 'Delhi', source: 'seed', createdBy: admin._id },
      { name: 'Priya Sharma', phone: '9876500011', city: 'Mumbai', source: 'seed', createdBy: admin._id },
      {
        name: 'Arjun Mehta',
        phone: '9811122233',
        city: 'Bengaluru',
        source: 'seed',
        status: 'assigned',
        assignedTo: tele._id,
        assignedAt: new Date(),
        createdBy: admin._id,
      },
    ]);
    console.log('✅ Sample leads created.');
  }

  await disconnectDB();
  console.log('🌱 Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
