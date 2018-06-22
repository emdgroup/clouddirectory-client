const CloudDirectoryClient = require('directory').default,
  IterableResultSet = require('resultset').default;

let client, DIRECTORY = process.__DIRECTORY__;

beforeAll(() => client = new CloudDirectoryClient({
  DirectoryArn: DIRECTORY.DirectoryArn,
  AppliedSchemaArn: DIRECTORY.AppliedSchemaArn,
  ConsistencyLevel: 'SERIALIZABLE',
}));

test('createIndex', () => client.createIndex({
  IndexName: 'sensors',
  ParentPath: '/',
  IndexedAttributes: [{
    sensor: 'sensor_id',
  }],
}).then(res => expect(res).toMatchObject({
  IndexPath: '/sensors',
  IndexIdentifier: expect.stringMatching(/\w+/),
})));

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

test('detach children and delete index', async () => {
  await client.detachAllFromIndex('/sensors');
  return expect(client.deleteIndex('/sensors')).resolves.toBeNull();
});
