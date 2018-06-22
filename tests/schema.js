const CloudDirectoryClient = require('directory').default,
  IterableResultSet = require('resultset').default;

let client, DIRECTORY = process.__DIRECTORY__;

beforeAll(() => client = new CloudDirectoryClient({
  DirectoryArn: DIRECTORY.DirectoryArn,
  AppliedSchemaArn: DIRECTORY.AppliedSchemaArn,
  ConsistencyLevel: 'SERIALIZABLE',
}));

test('get schema as json', () => client.getSchemaAsJson().then(res => expect(res).toMatchObject({
  Document: expect.stringMatching(/sourceSchemaArn/),
})));
