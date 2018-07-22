import { IterableResultSet, buildClient, randomString } from './inc/lib';

let client, rand = randomString(), obj = {}, now = new Date();

beforeAll(() => client = buildClient());

test('create rand root object', () => client.createObject({
  Attributes: { node: null },
  Parents: [{ Selector: '/', LinkName: rand }],
}).then(res => obj.root = `/${rand}`));

test('create index', () => client.createIndex({
  IndexName: 'sensors',
  ParentSelector: obj.root,
  IndexedAttributes: [{
    sensor: 'sensor_id',
  }],
}).then(res => expect(res).toMatchObject({
  IndexIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('create root floor with no attributes', () => client.createObject({
  Attributes: { node: null },
  Parents: [{ Selector: obj.root, LinkName: 'floors' }],
}).then(res => (obj.floors = res.ObjectIdentifier) && expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

test('create ground floor with attributes', () => client.createObject({
  Attributes: { location: { location_name: 'Ground Floor' } },
  Parents: [{ Selector: `/${rand}/floors`, LinkName: 'ground_floor' }],
}).then(res => expect(res).toMatchObject({
  ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
})));

let mysensorAttributes = {
  sensor: {
    sensor_id: '1234',
    serial_number: 1,
    essential: false,
  },
  thing: {
    public_key: Buffer.from('rsa-ssh something'),
  },
};

test('attach sensor to floor and index', () => client.createObject({
  Parents: [{ Selector: `/${rand}/floors/ground_floor`, LinkName: 'mysensor' }],
  Indexes: [`/${rand}/sensors`],
  Attributes: mysensorAttributes,
}).then(async res => {
  obj.mysensor = res.ObjectIdentifier;
  await expect(res).toMatchObject({
    ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
  });
  await expect(client.getObjectInformation(`$${obj.mysensor}`)).resolves.toMatchObject({
    ObjectIdentifier: obj.mysensor,
    SchemaFacets: expect.arrayContaining([{
      FacetName: 'sensor',
      SchemaArn: expect.stringMatching(/^arn/),
    }, {
      FacetName: 'thing',
      SchemaArn: expect.stringMatching(/^arn/),
    }])
  });

  return expect(client.listAllObjectAttributes(`$${obj.mysensor}`)).resolves.toMatchObject(mysensorAttributes);
}));


test('list children', () => {
  let children = client.listObjectChildren(`/${rand}/floors/ground_floor`);
  expect(children).toBeInstanceOf(IterableResultSet);
  return expect(children.all()).resolves.toMatchObject([{
    ObjectIdentifier: obj.mysensor,
    LinkName: 'mysensor',
  }]);
});

test('list children with attributes', async () => {
  let children = client.listObjectChildrenWithAttributes(`/${rand}/floors/ground_floor`);
  expect(children).toBeInstanceOf(IterableResultSet);
  await expect(children.all()).resolves.toMatchObject([{
    Attributes: mysensorAttributes,
    ObjectIdentifier: obj.mysensor,
    LinkName: 'mysensor',
  }]);

  let things = client.listObjectChildrenWithAttributes(`/${rand}/floors/ground_floor`, 'thing');
  expect(things).toBeInstanceOf(IterableResultSet);
  await expect(things.all()).resolves.toMatchObject([{
    Attributes: { thing: mysensorAttributes.thing },
    ObjectIdentifier: obj.mysensor,
    LinkName: 'mysensor',
  }]);
});

test('attach typed link to object', () => expect(client.attachTypedLink(
  `/${rand}/floors/ground_floor/mysensor`, `/${rand}/floors`, {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  },
)).resolves.toBeNull());

test('list incoming links to floor', async () => {
  let links = await client.listIncomingTypedLinks(
    `/${rand}/floors`, { sensor_floor_association: null },
  );
  expect(links).toBeInstanceOf(IterableResultSet);
  await expect(links.all()).resolves.toMatchObject([{
    SourceObjectSelector: `$${obj.mysensor}`,
    TargetObjectSelector: `$${obj.floors}`,
    LinkAttributes: { sensor_type: 'water', maintenance_date: now },
  }]);

  let filtered = await client.listIncomingTypedLinks(
    `/${rand}/floors`, { sensor_floor_association: { sensor_type: 'oxygen' } },
  );
  expect(filtered).toBeInstanceOf(IterableResultSet);
  return expect(filtered.all()).resolves.toHaveLength(0);
});

test('list outgoing links from sensor', async () => {
  let links = await client.listOutgoingTypedLinks(
    `$${obj.mysensor}`, { sensor_floor_association: null },
  );
  expect(links).toBeInstanceOf(IterableResultSet);
  return expect(links.all()).resolves.toMatchObject([{
    SourceObjectSelector: `$${obj.mysensor}`,
    TargetObjectSelector: `$${obj.floors}`,
    LinkAttributes: { sensor_type: 'water', maintenance_date: now },
  }]);
});

test('detach typed link to object', () => expect(client.detachTypedLink(
  `/${rand}/floors/ground_floor/mysensor`, `/${rand}/floors`, {
    sensor_floor_association: {
      maintenance_date: now,
      sensor_type: 'water',
    }
  }
)).resolves.toBeNull());

test('create object with typed link without parents', async () => {
  await expect(client.createObject({
    Attributes: { thing: { public_key: Buffer.from('rsa-ssh something') } },
    OutgoingTypedLinks: [{
      Selector: `/${rand}/floors`, Attributes: {
        sensor_floor_association: { sensor_type: 'thing', maintenance_date: now },
      }
    }],
  })).resolves.toMatchObject({
    ObjectIdentifier: expect.stringMatching(/^[\w-_]+$/),
  });
  const links = await client.listIncomingTypedLinks(`/${rand}/floors`, { sensor_floor_association: null }).all();
  expect(links).toHaveLength(1);
  await client.detachTypedLink(links[0].SourceObjectSelector, `/${rand}/floors`, {
    sensor_floor_association: { sensor_type: 'thing', maintenance_date: now },
  });

  return expect(
    client.listIncomingTypedLinks(`/${rand}/floors`, { sensor_floor_association: null }).all()
  ).resolves.toHaveLength(0);

});
