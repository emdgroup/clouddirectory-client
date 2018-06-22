const AWS = require('aws-sdk'),
  client = new AWS.CloudDirectory(),
  crypto = require('crypto');

let rand = crypto.randomBytes(6).toString('hex');

module.exports = async () => {
  let devSchemas = await client.listDevelopmentSchemaArns({ MaxResults: 30 }).promise();
  let pubSchemas = await client.listPublishedSchemaArns({ MaxResults: 30 }).promise();
  await Promise.all(devSchemas.SchemaArns.map(s => client.deleteSchema({ SchemaArn: s }).promise()));
  await Promise.all(pubSchemas.SchemaArns.map(s => client.deleteSchema({ SchemaArn: s }).promise()));
  let directories = await client.listDirectories({ MaxResults: 30, state: 'ENABLED' }).promise();
  await Promise.all(
    directories.Directories.map(
      d => client.disableDirectory({ DirectoryArn: d.DirectoryArn }).promise().then(() => client.deleteDirectory({ DirectoryArn: d.DirectoryArn }).promise())
    )
  );
  let devSchema = await client.createSchema({
    Name: 'test-cdclient-' + rand,
  }).promise().then(res => client.putSchemaFromJson({
    SchemaArn: res.SchemaArn,
    Document: JSON.stringify(require('./schema.json')),
  }).promise());
  let schema = await client.publishSchema({
    DevelopmentSchemaArn: devSchema.Arn,
    Version: '1',
  }).promise();
  let directory = await client.createDirectory({
    Name: 'test-cdclient-' + rand,
    SchemaArn: schema.PublishedSchemaArn,
  }).promise();
  process.__DIRECTORY__ = {
    SchemaName: 'test-cdclient-' + rand,
    DirectoryArn: directory.DirectoryArn,
    AppliedSchemaArn: directory.AppliedSchemaArn,
    SchemaArn: schema.PublishedSchemaArn,
    DevSchemaArn: devSchema.Arn,
  };
};
