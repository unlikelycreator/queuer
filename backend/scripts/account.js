// Account recovery from the command line (uses the same backend/.env as the API).
//
//   npm run account -- list                          users in the connected database
//   npm run account -- show <email>                  status of one account
//   npm run account -- unlock <email>                clear failed-login lockout
//   npm run account -- disable-2fa <email>           turn off two-step verification
//   npm run account -- set-password <email> <pass>   set a new password
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
require('../src/models/Company');

const [cmd, emailArg, newPassword] = process.argv.slice(2);
const email = emailArg && emailArg.toLowerCase().trim();

const describe = (u) =>
  `${u.email}  role=${u.role}  company=${u.company?.name || '?'}  active=${u.isActive}  ` +
  `2fa=${u.twoFactor?.enabled ? 'on' : 'off'}  login=${u.password ? 'password' : 'google-only'}` +
  `${u.lockUntil && u.lockUntil > Date.now() ? '  LOCKED' : ''}`;

async function findUser() {
  if (!email) throw new Error('Please give an email address.');
  const u = await User.findOne({ email })
    .select('+password +lockUntil +failedLoginAttempts +twoFactor.secretEncrypted +twoFactor.backupCodes')
    .populate('company', 'name');
  if (!u) throw new Error(`No account with email "${email}" in database "${mongoose.connection.name}". Run "list" to see who is there.`);
  return u;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in backend/.env');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to ${mongoose.connection.host} / database "${mongoose.connection.name}"\n`);

  switch (cmd) {
    case 'list': {
      const users = await User.find().select('+password +lockUntil').populate('company', 'name').sort('email');
      if (!users.length) console.log('No users in this database. Is MONGODB_URI pointing at the right one?');
      users.forEach((u) => console.log(describe(u)));
      break;
    }
    case 'show':
      console.log(describe(await findUser()));
      break;
    case 'unlock': {
      const u = await findUser();
      u.failedLoginAttempts = 0;
      u.lockUntil = undefined;
      await u.save();
      console.log(`Unlocked: ${describe(u)}`);
      break;
    }
    case 'disable-2fa': {
      const u = await findUser();
      u.twoFactor = { enabled: false };
      await u.save();
      console.log(`Two-step verification turned off: ${describe(u)}`);
      break;
    }
    case 'set-password': {
      if (!newPassword || newPassword.length < 8) throw new Error('Give a new password of at least 8 characters.');
      const u = await findUser();
      u.password = newPassword; // hashed by the model's pre-save hook
      u.failedLoginAttempts = 0;
      u.lockUntil = undefined;
      await u.save();
      console.log(`Password updated (other sessions are signed out): ${describe(u)}`);
      break;
    }
    default:
      console.log('Usage: npm run account -- <list | show <email> | unlock <email> | disable-2fa <email> | set-password <email> <new-password>>');
  }
}

main()
  .catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
