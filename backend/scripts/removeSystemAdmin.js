const path = require('path');
const dns = require('dns');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const setMongoDnsServers = () => {
  const servers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,8.8.4.4')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);

  if (servers.length) {
    dns.setServers(servers);
    console.log(`Using DNS servers for MongoDB SRV resolution: ${servers.join(', ')}`);
  }
};

setMongoDnsServers();

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://awais:awais123456@cluster0.slr4sml.mongodb.net/blood_donation?appName=Cluster0';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, family: 4 });

    const emailArg = process.argv[2]; // optional: provide an email to delete a specific admin

    let admins;
    if (emailArg) {
      admins = await User.find({ role: 'system_admin', email: emailArg.toLowerCase() }).lean();
    } else {
      admins = await User.find({ role: 'system_admin' }).lean();
    }

    if (!admins || admins.length === 0) {
      console.log('No system administrator user(s) found. Nothing to delete.');
      process.exit(0);
    }

    console.log(`Found ${admins.length} system administrator(s):`);
    admins.forEach((a, idx) => {
      console.log(`${idx + 1}. _id: ${a._id} | email: ${a.email} | name: ${a.firstName} ${a.lastName}`);
    });

    console.log('\nWARNING: Deleting a system administrator is irreversible.');
    console.log('If you want to proceed, type DELETE (uppercase) and press Enter.');

    rl.question('Type DELETE to confirm: ', async (answer) => {
      if (answer.trim() !== 'DELETE') {
        console.log('Aborted. No changes made.');
        rl.close();
        process.exit(0);
      }

      try {
        if (emailArg) {
          const res = await User.deleteMany({ role: 'system_admin', email: emailArg.toLowerCase() });
          console.log(`Deleted ${res.deletedCount} system administrator(s) with email ${emailArg}`);
        } else {
          const res = await User.deleteMany({ role: 'system_admin' });
          console.log(`Deleted ${res.deletedCount} system administrator(s)`);
        }
      } catch (delErr) {
        console.error('Error deleting system administrator(s):', delErr);
      } finally {
        rl.close();
        mongoose.connection.close();
        process.exit(0);
      }
    });

  } catch (err) {
    console.error('MongoDB connection error:', {
      message: err.message,
      code: err.code,
      hostname: err.hostname,
      syscall: err.syscall,
    });
    process.exit(1);
  }
}

main();
