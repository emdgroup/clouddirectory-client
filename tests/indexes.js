import { CloudDirectoryClient, IterableResultSet, buildClient } from './inc/lib';

let client;

beforeAll(() => client = buildClient());

test('createIndex', () => expect(client.createIndex({
  IndexName: 'sensors',
  ParentPath: '/',
  IndexedAttributes: [{
    sensor: 'sensor_id',
  }],
})).resolves.toMatchObject({
  IndexIdentifier: expect.stringMatching(/\w+/),
}));

test('listIndex of empty index', async () => {
  let res = client.listIndex('/sensors');
  expect(res).toBeInstanceOf(IterableResultSet);
  let all = await res.all();
  expect(all).toHaveLength(0);
});

test('attach object to index', () => client.createObject({
  Parents: [{ ParentSelector: '/', LinkName: 'mysensor' }],
  Indexes: ['/sensors'],
  Attributes: {
    sensor: { sensor_id: '1234' },
  }
}));

test('attach object to index', () => client.createObject({
  Parents: [{ ParentSelector: '/', LinkName: 'mysensor2' }],
  Indexes: ['/sensors'],
  Attributes: {
    sensor: { sensor_id: '1235' },
  }
}));

test('index has two objects', async () => {
  let res = client.listIndex('/sensors');
  expect(res).toBeInstanceOf(IterableResultSet);
  let all = await res.all();
  expect(all).toHaveLength(2);
});

test('delete index with attached children fails', async () => {
  return expect(client.deleteIndex('/sensors')).rejects.toThrowError(/detach a node entirely from the tree prior to removing the node/);
});

test('detach one object manually', async () => {
  await expect(client.detachFromIndex('/sensors', '/mysensor2')).resolves.toBeNull();
  return expect(client.listIndex('/sensors').all()).resolves.toHaveLength(1);
});

test('re-attach object, then delete object', async () => {
  await expect(client.attachToIndex('/sensors', '/mysensor2')).resolves.toBeNull();
  await expect(client.listIndex('/sensors').all()).resolves.toHaveLength(2);
  await expect(client.deleteObject(['mysensor2'])).resolves.toBeNull();
  return expect(client.listIndex('/sensors').all()).resolves.toHaveLength(1);
});

test('detach children and delete index', async () => {
  await client.detachAllFromIndex('/sensors');
  return expect(client.deleteIndex('/sensors')).resolves.toBeNull();
});
