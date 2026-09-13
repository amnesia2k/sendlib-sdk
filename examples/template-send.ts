import { Sendlib } from '@sendlib/node-sdk';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

if (process.env.SENDLIB_RUN_EXAMPLE !== 'true') {
  throw new Error('Set SENDLIB_RUN_EXAMPLE=true only when you intend to send a real email.');
}

const sendlib = new Sendlib({ apiKey: requiredEnvironment('SENDLIB_API_KEY') });

// Convenience methods select an existing dashboard template; the SDK does not render it.
const response = await sendlib.templates.passwordReset({
  ...(process.env.SENDLIB_EXAMPLE_SENDER === undefined
    ? {}
    : { from: process.env.SENDLIB_EXAMPLE_SENDER }),
  to: requiredEnvironment('SENDLIB_EXAMPLE_RECIPIENT'),
  // Dashboard templates are editable, so these keys must match your current template.
  data: { name: 'Ada', code: '482921' },
});

console.log(
  'SendLib accepted the template email. Debug issue count:',
  response.debug?.issues?.length ?? 0,
);
