import { CloudDirectoryClient, IterableResultSet, buildClient } from './inc/lib';

let client, policyId = null;

beforeAll(() => client = buildClient());

test('create policy', () => expect(client.createObject({
  Parents: [{ Selector: '/', LinkName: 'policy1' }],
  Attributes: {
    policy: {
      policy_type: 'default',
      policy_document: Buffer.from(JSON.stringify({ Allow: '*' })),
    },
  },
}).then(res => {
  policyId = res.ObjectIdentifier;
  return res;
})).resolves.toMatchObject({
  ObjectIdentifier: expect.stringMatching(/\w+/),
}));

test('attach/detach policy', () => client.createObject({
  Parents: [{ Selector: '/', LinkName: 'sensor' }],
  Attributes: { sensor: { sensor_id: 'water' } },
}).then(async ({ ObjectIdentifier }) => {
  client.MaxResults = 2;
  await expect(client.attachPolicy('/policy1', `$${ObjectIdentifier}`)).resolves.toBeNull();
  await expect(client.lookupPolicy(`$${ObjectIdentifier}`).all()).resolves.toMatchObject([{
    Path: '/sensor', Policies: expect.arrayContaining([{
      ObjectIdentifier,
      PolicyId: policyId,
      PolicyType: 'default',
    }]),
  }]);
  await expect(client.detachPolicy('/policy1', `$${ObjectIdentifier}`)).resolves.toBeNull();
  return ObjectIdentifier;
}));
