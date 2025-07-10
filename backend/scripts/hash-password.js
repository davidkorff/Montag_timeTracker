const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.log('Usage: node hash-password.js <password>');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('Password hash:', hash);
console.log('');
console.log('Update the admin user with:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@42consulting.com';`);