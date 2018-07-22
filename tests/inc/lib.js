import { randomBytes } from 'crypto';

export const CloudDirectoryClient = require('index'),
  IterableResultSet = require('resultset'),
  DIRECTORY = process.__DIRECTORY__;

export function buildClient() {
  return new CloudDirectoryClient({
    DirectoryArn: DIRECTORY.DirectoryArn,
    AppliedSchemaArn: DIRECTORY.AppliedSchemaArn,
    ConsistencyLevel: 'SERIALIZABLE',
  });
}

export function randomString() {
  return  randomBytes(6).toString('hex');
}
