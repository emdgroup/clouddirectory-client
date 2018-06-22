const AWS = require('aws-sdk'),
  client = new AWS.CloudDirectory(),
  crypto = require('crypto');

let rand = crypto.randomBytes(6).toString('hex');

module.exports = async () => {
  let directory = process.__DIRECTORY__;
  await client.disableDirectory({
    DirectoryArn: directory.DirectoryArn,
  }).promise();
  return Promise.all([
    client.deleteDirectory({
      DirectoryArn: directory.DirectoryArn,
    }).promise(),
    client.deleteSchema({
      SchemaArn: directory.SchemaArn,
    }).promise(),
    client.deleteSchema({
      SchemaArn: directory.DevSchemaArn,
    }).promise(),
  ]);
};
