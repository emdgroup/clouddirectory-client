const AWS = require('aws-sdk'),
  client = new AWS.CloudDirectory(),
  crypto = require('crypto');

let schemaSuffix = crypto.randomBytes(6).toString('hex');

module.exports = () => {
  // let devSchemas = await client.listDevelopmentSchemaArns({ MaxResults: 30 }).promise();
  // let pubSchemas = await client.listPublishedSchemaArns({ MaxResults: 30 }).promise();
  // await Promise.all(devSchemas.SchemaArns.map(s => client.deleteSchema({ SchemaArn: s }).promise()));
  // await Promise.all(pubSchemas.SchemaArns.map(s => client.deleteSchema({ SchemaArn: s }).promise()));
  // let directories = await client.listDirectories({ MaxResults: 30, state: 'ENABLED' }).promise();
  // await Promise.all(
  //   directories.Directories.map(
  //     d => client.disableDirectory({ DirectoryArn: d.DirectoryArn }).promise().then(() => client.deleteDirectory({ DirectoryArn: d.DirectoryArn }).promise())
  //   )
  // );
  return client.createSchema({
    Name: 'test-cdclient-' + schemaSuffix,
  }).promise().then(devSchema => client.putSchemaFromJson({
    SchemaArn: devSchema.SchemaArn,
    Document: JSON.stringify(require('./schema.json')),
  }).promise().then(res => client.publishSchema({
    DevelopmentSchemaArn: devSchema.SchemaArn,
    Version: '1',
  }).promise()).then(schema => client.createDirectory({
    Name: 'test-cdclient-' + schemaSuffix,
    SchemaArn: schema.PublishedSchemaArn,
  }).promise().then(directory => {
    process.__DIRECTORY__ = {
      SchemaName: 'test-cdclient-' + schemaSuffix,
      DirectoryArn: directory.DirectoryArn,
      AppliedSchemaArn: directory.AppliedSchemaArn,
      SchemaArn: schema.PublishedSchemaArn,
      DevSchemaArn: devSchema.SchemaArn,
    };
  })));
};
