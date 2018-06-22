const CloudDirectoryClient = require('directory').default,
  IterableResultSet = require('resultset').default;

let client, obj = {}, now = new Date(), DIRECTORY = process.__DIRECTORY__;

beforeAll(() => client = new CloudDirectoryClient({
  DirectoryArn: DIRECTORY.DirectoryArn,
  AppliedSchemaArn: DIRECTORY.AppliedSchemaArn,
  ConsistencyLevel: 'SERIALIZABLE',
}));

test('create index', () => client.createIndex({
  IndexName: 'sensors',
  ParentPath: '/',
  IndexedAttributes: [{
    sensor: 'sensor_id',
  }],
}).then(res => expect(res).toMatchObject({
  IndexPath: '/sensors',
})));

test('create root floor with no attributes', () => client.createObject({
  Attributes: { node: null },
  Parents: [{ ParentSelector: '/', LinkName: 'floors' }],
}).then(res => (obj.floors = res.ObjectIdentifier) && expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('create ground floor with attributes', () => client.createObject({
  Attributes: { location: { location_name: 'Ground Floor' } },
  Parents: [{ ParentSelector: '/floors', LinkName: 'ground_floor' }],
}).then(res => expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('attach sensor to floor and index', () => client.createObject({
  Parents: [{ ParentSelector: '/floors/ground_floor', LinkName: 'mysensor' }],
  Indexes: ['/sensors'],
  Attributes: {
    sensor: { sensor_id: '1234' },
  }
}).then(res => (obj.mysensor = res.ObjectIdentifier) && expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('attach typed link to object', () => expect(client.attachTypedLink(
  '/floors/ground_floor/mysensor', '/floors', {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  },
)).resolves.toBeNull());

test('list incoming links to to floor', async () => {
  let links = await client.listIncomingTypedLinks(
    '/floors', { sensor_floor_association: null },
  );
  expect(links).toBeInstanceOf(IterableResultSet);
  return expect(links.all()).resolves.toMatchObject([{
    SourceObjectSelector: `$${obj.mysensor}`,
    TargetObjectSelector: `$${obj.floors}`,
    LinkAttributes: { sensor_type: 'water', maintenance_date: now },
  }]);
});

test('detach typed link to object', async () => expect(client.detachTypedLink(
  '/floors/ground_floor/mysensor', '/floors', {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  }
)).resolves.toBeNull());
