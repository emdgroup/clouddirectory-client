import { IterableResultSet, buildClient, randomString } from './inc/lib';

let client, rand = randomString(), obj = {}, now = new Date();

beforeAll(() => client = buildClient());

test('create rand root object', () => client.createObject({
  Attributes: { node: null },
  Parents: [{ ParentSelector: '/', LinkName: rand }],
}).then(res => obj.root = `/${rand}`));

test('create index', () => client.createIndex({
  IndexName: 'sensors',
  ParentSelector: obj.root,
  IndexedAttributes: [{
    sensor: 'sensor_id',
  }],
}).then(res => expect(res).toMatchObject({
  IndexPath: `/${rand}/sensors`,
  IndexIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('create root floor with no attributes', () => client.createObject({
  Attributes: { node: null },
  Parents: [{ ParentSelector: obj.root, LinkName: 'floors' }],
}).then(res => (obj.floors = res.ObjectIdentifier) && expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('create ground floor with attributes', () => client.createObject({
  Attributes: { location: { location_name: 'Ground Floor' } },
  Parents: [{ ParentSelector: `/${rand}/floors`, LinkName: 'ground_floor' }],
}).then(res => expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('attach sensor to floor and index', () => client.createObject({
  Parents: [{ ParentSelector: `/${rand}/floors/ground_floor`, LinkName: 'mysensor' }],
  Indexes: [`/${rand}/sensors`],
  Attributes: {
    sensor: { sensor_id: '1234' },
  }
}).then(res => (obj.mysensor = res.ObjectIdentifier) && expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('attach typed link to object', () => expect(client.attachTypedLink(
  `/${rand}/floors/ground_floor/mysensor`, `/${rand}/floors`, {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  },
)).resolves.toBeNull());

test('list incoming links to to floor', async () => {
  let links = await client.listIncomingTypedLinks(
    `/${rand}/floors`, { sensor_floor_association: null },
  );
  expect(links).toBeInstanceOf(IterableResultSet);
  return expect(links.all()).resolves.toMatchObject([{
    SourceObjectSelector: `$${obj.mysensor}`,
    TargetObjectSelector: `$${obj.floors}`,
    LinkAttributes: { sensor_type: 'water', maintenance_date: now },
  }]);
});

test('detach typed link to object', async () => expect(client.detachTypedLink(
  `/${rand}/floors/ground_floor/mysensor`, `/${rand}/floors`, {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  }
)).resolves.toBeNull());
