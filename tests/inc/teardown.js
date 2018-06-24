const AWS = require('aws-sdk'),
  client = new AWS.CloudDirectory();

module.exports = () => {
  let directory = process.__DIRECTORY__;
  return client.disableDirectory({
    DirectoryArn: directory.DirectoryArn,
  }).promise().then(res => Promise.all([
    client.deleteDirectory({
      DirectoryArn: directory.DirectoryArn,
    }).promise(),
    client.deleteSchema({
      SchemaArn: directory.SchemaArn,
    }).promise(),
    client.deleteSchema({
      SchemaArn: directory.DevSchemaArn,
    }).promise(),
  ]));
};
