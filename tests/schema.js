import { buildClient } from './inc/lib';

let client;

beforeAll(() => client = buildClient());

test('get schema as json', () => client.getSchemaAsJson().then(res => expect(res).toMatchObject({
  Document: expect.stringMatching(/sourceSchemaArn/),
})));
