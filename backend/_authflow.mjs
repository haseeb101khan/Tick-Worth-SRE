import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = 'http://localhost:5001/api';
const J = { 'content-type': 'application/json' };
const email = 'haseeb.khanasghar100+test@gmail.com'; // Gmail routes +tag to the same inbox
const password = 'Test@1234';

// clean any prior run
await prisma.user.deleteMany({ where: { email } });

// 1) register
let r = await fetch(`${API}/auth/register`, { method: 'POST', headers: J, body: JSON.stringify({ name: 'Verify Test', email, password }) });
console.log('1) register ->', r.status, JSON.stringify(await r.json()));

// 2) login before verifying -> should be blocked
r = await fetch(`${API}/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) });
console.log('2) login (unverified) -> expect 401:', r.status, (await r.json()).error ?? '');

// 3) grab the token the email contained
const u = await prisma.user.findUnique({ where: { email }, select: { verifyToken: true, emailVerified: true } });
console.log('3) emailVerified now:', u.emailVerified, '| has token:', !!u.verifyToken);

// 4) verify via the token (what the email link does)
r = await fetch(`${API}/auth/verify`, { method: 'POST', headers: J, body: JSON.stringify({ token: u.verifyToken }) });
const vj = await r.json();
console.log('4) verify -> expect 200:', r.status, '| signed in as:', vj.user?.email, '| token:', vj.token ? 'yes' : 'no');

// 5) login after verifying -> should work
r = await fetch(`${API}/auth/login`, { method: 'POST', headers: J, body: JSON.stringify({ email, password }) });
console.log('5) login (verified) -> expect 200:', r.status);

// 6) cleanup
await prisma.user.deleteMany({ where: { email } });
console.log('6) cleaned up test user');
await prisma.$disconnect();
