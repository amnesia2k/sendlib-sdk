import { Sendlib } from '@sendlib/node-sdk';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

// This explicit opt-in prevents an accidental real send when the file is run.
if (process.env.SENDLIB_RUN_EXAMPLE !== 'true') {
  throw new Error('Set SENDLIB_RUN_EXAMPLE=true only when you intend to send a real email.');
}

const sendlib = new Sendlib({
  // The SDK never reads environment variables itself; your application passes the key.
  apiKey: requiredEnvironment('SENDLIB_API_KEY'),
});

const response = await sendlib.emails.send({
  // Omit `from` only when SendLib can safely select your sole connected account.
  ...(process.env.SENDLIB_EXAMPLE_SENDER === undefined
    ? {}
    : { from: process.env.SENDLIB_EXAMPLE_SENDER }),
  to: requiredEnvironment('SENDLIB_EXAMPLE_RECIPIENT'),
  subject: 'Quick update regarding your account',
  html: '<p>Your requested account update is ready.</p>',
  text: 'Your requested account update is ready.',
});

console.log('SendLib accepted the email. Debug issue count:', response.debug?.issues?.length ?? 0);
