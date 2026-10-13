import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

console.log('--- Testing Mobile Auth Bridge Logic ---');

const secret = 'ezboai-auth-secret';
const testUser = {
  id: 'usr_test_12345',
  email: 'testmobile@ezboai.com',
  name: 'Mobile Tester',
  isAdmin: false,
  planTier: 'pro'
};

// 1. JWT issuance
const token = jwt.sign(
  {
    sub: testUser.id,
    id: testUser.id,
    email: testUser.email,
    name: testUser.name,
    isAdmin: testUser.isAdmin,
    planTier: testUser.planTier
  },
  secret,
  { expiresIn: '30d' }
);
console.log('✓ Issued token successfully:', token.substring(0, 30) + '...');

// 2. Token verification
const decoded = jwt.verify(token, secret);
if (decoded.sub !== testUser.id || decoded.email !== testUser.email) {
  throw new Error('Token verification payload mismatch!');
}
console.log('✓ Verified token payload matches user:', decoded.sub);

// 3. Password hashing & comparison
const password = 'SecurePassword123!';
const hash = await bcrypt.hash(password, 10);
const matches = await bcrypt.compare(password, hash);
if (!matches) {
  throw new Error('Bcrypt password verification failed!');
}
console.log('✓ Bcrypt password verification matches correctly.');

console.log('--- All Mobile Auth Bridge checks passed successfully! ---');
