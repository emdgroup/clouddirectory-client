import { CloudDirectoryClient, IterableResultSet, buildClient } from './inc/lib';

let client;

beforeAll(() => client = buildClient());

test('create policy', () => expect(client.createObject({
  Parents: [{ Selector: '/', LinkName: 'policy1' }],
  Attributes: {
    policy: {
      policy_type: 'default',
      policy_document: Buffer.from(JSON.stringify({ Allow: '*' })),
    },
  },
})).resolves.toMatchObject({
  ObjectIdentifier: expect.stringMatching(/\w+/),
}));

test('attach/detach policy', () => client.createObject({
  Parents: [{ LinkName: 'sensor' }],
  Attributes: { sensor: { sensor_id: 'water' } },
}).then(async ({ ObjectIdentifier }) => {
    await expect(client.attachPolicy('/policy1', `$${ObjectIdentifier}`)).resolves.toBeNull();
    await expect(client.detachPolicy('/policy1', `$${ObjectIdentifier}`)).resolves.toBeNull();
    return ObjectIdentifier;
}))
