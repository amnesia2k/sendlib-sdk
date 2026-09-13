import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { Sendlib } from '@sendlib/node-sdk';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

if (process.env.SENDLIB_RUN_EXAMPLE !== 'true') {
  throw new Error('Set SENDLIB_RUN_EXAMPLE=true only when you intend to send a real email.');
}

const attachmentPath = requiredEnvironment('SENDLIB_EXAMPLE_ATTACHMENT_PATH');
const attachment = await readFile(attachmentPath);
const sendlib = new Sendlib({ apiKey: requiredEnvironment('SENDLIB_API_KEY') });

const response = await sendlib.emails.send({
  to: requiredEnvironment('SENDLIB_EXAMPLE_RECIPIENT'),
  subject: 'Your requested document',
  html: '<p>Your requested document is attached.</p>',
  text: 'Your requested document is attached.',
  attachments: [
    {
      filename: basename(attachmentPath),
      // SendLib expects raw base64, not a `data:` URL. The SDK does not transform it.
      content: attachment.toString('base64'),
      type: process.env.SENDLIB_EXAMPLE_ATTACHMENT_TYPE ?? 'application/octet-stream',
    },
  ],
});

console.log(
  'SendLib accepted the email with its attachment. Debug issue count:',
  response.debug?.issues?.length ?? 0,
);
