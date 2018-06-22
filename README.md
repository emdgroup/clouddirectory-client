[![Build Status](https://img.shields.io/travis/emdgroup/clouddirectory-client.svg?style=flat-square)](https://travis-ci.org/emdgroup/clouddirectory-client) ![Codecov](https://img.shields.io/codecov/c/github/emdgroup/clouddirectory-client.svg?style=flat-square)
[![GitHub license](https://img.shields.io/github/license/emdgroup/clouddirectory-client.svg?style=flat-square)](https://github.com/emdgroup/clouddirectory-client/blob/master/LICENSE) ![awesome](https://img.shields.io/badge/awesome-yes-ff55aa.svg?style=flat-square)



# AWS Cloud Directory Client

JavaScript convenience wrapper for the AWS Cloud Directory API.

## Example

```js
const CloudDirectoryClient = require('clouddirectory-client');

let client = new CloudDirectoryClient({
  DirectoryArn: '',
  SchemaArn: '',
});

let index = await client.createIndex({
  IndexName: 'sensors',
  IndexedAttributes: [{ sensor: 'sensor_id' }],
});

client.createObject({
  sensor: {
    sensor_id: 'abc123123',
  },
}, {
  Parents: [{
    ParentObjectSelector: '/floors/ground_floor/server_room',
    LinkName: 'abc123123',
  }],
  Indexes: ['/sensors'],
  TypedLinks: [{
    TargetObjectSelector: '/floors/ground_floor',
    TypedLinkName: 'sensor_floor_association',
    Attributes: {
      sensor_type: 'water',
      maintenance_date: '2015-04-03',
    },
  }],
});

let sensors = client.listIncomingTypedLinks('/floors/ground_floor', {
  FloorSensorAssociation: { sensor_type: 'water' }
});
for (let sensor of sensors) {
  console.log(await sensor);
}

```

## Constructor

```js
new CloudDirectoryClient(options = {}) : Object
```

**Options Hash (`options`):**

* **DirectoryArn** (String, **required**), the Amazon Resource Name (ARN) that is associated with the Directory where the object resides.
* **AppliedSchemaArn** (String, **required**), the Amazon Resource Name (ARN) that is associated with the schema.
* **Client** (String), instance of `AWS.CloudDirectory`. Defaults to `new AWS.CloudDirectory()`.
* **MaxResults** (Number), maximum number of items to be retrieved in a single call. Defaults to 10, max value is 30.
* **ConsistencyLevel** (String), represents the manner and timing in which the successful write or update of an object is reflected in a subsequent read operation of that same object. Possible values include: `SERIALIZABLE` and `EVENTUAL` (default).

## Arguments

### `selector`

The selector argument is ubiquitous and can take the following shape:

* **Path** `/path/to/my/object`
* **Object Identifier** `$AQFnK8iyN7pMTbkTyChgMF7N8WyQmgMnRLS4yPVJfYRDQA`
* **List of Paths** `['path', 'to', 'object']` (the leading slash is optional)

## Methods

### attachTypedLink

**Returns** `null`

```js
client.attachTypedLink(sourceSelector, targetSelector, {
  [facetName]: { [attributeName]: attributeValue },
});
```

### createIndex

### createObject

### deleteIndex

**Returns** `null`

```js
client.deleteIndex(selector);
```

`deleteIndex` will detach an index from all its parents before it is deleted. This method will **not** attempt to remove all links to any children (which would orphan the children unless they have other parents). If the deletion of the index fails due to attached children, the whole transaction is rolled back.

### deleteObject

**Returns** `null`

```js
client.deleteObject(selector);
```

`deleteObject` will detach an object from all its parents and indices before it is deleted. This method will **not** attempt to remove all links to any children (which would orphan the children unless they have other parents). If the deletion of the object fails due to attached children, the whole transaction is rolled back.

### detachAllFromIndex

**Returns** `null`

```js
client.detachAllFromIndex(indexSelector);
```

Detaches all objects from the specified index.

### detachFromIndex

**Returns** `null`

```js
client.detachFromIndex(indexSelector, objectSelector);
```

Detaches the specified object from the specified index.

### listAttachedIndices

**Returns** [IterableResultSet](#iterableresultset)

```js
client.listAttachedIndices(selector);
```

### listIncomingTypedLinks

**Returns** [IterableResultSet](#iterableresultset)

```js
client.listIncomingTypedLinks(selector, {
  [facetName]: {
    [attributeName]: 'STRING_VALUE',
  },
});
```

### listIndex

**Returns** [IterableResultSet](#iterableresultset)

```js
client.listIndex(selector, {
  [facetNameA]: {
    [attributeName]: 'STRING_VALUE',
  },
  [facetNameB]: {
    [attributeName]: 'STRING_VALUE',
  },
});
```

### listObjectAttributes

**Returns** [IterableResultSet](#iterableresultset)

```js
client.listIncomingTypedLinks(selector, facetName?);
```

### listObjectChildren

**Returns** [IterableResultSet](#iterableresultset)

### listObjectParentPaths

**Returns** [IterableResultSet](#iterableresultset)

### listObjectParents

**Returns** [IterableResultSet](#iterableresultset)

### listObjectPolicies

**Returns** [IterableResultSet](#iterableresultset)

### listOutgoingTypedLinks

**Returns** [IterableResultSet](#iterableresultset)

### listPolicyAttachments

**Returns** [IterableResultSet](#iterableresultset)

### lookupPolicy

**Returns** [IterableResultSet](#iterableresultset)


## IterableResultSet

`IterableResultSet` is returned by all `list*` and `lookup*` methods. It's a convenience wrapper for the paging API provided by AWS Cloud Directory. Instead of having to page through results this class provides a iterable result set.

```js
let users = client.listObjectChildren('/users');
for(let user of users) {
  console.log(await user);
}
```

### resultset.addTransformation

### resultset.all

### resultset.iterate

### resultset.request

## Paging and Scrolling

The `list*` operations return a generator that allows you to scroll through result sets efficiently. The Cloud Directory API implements paging through the `NextToken` parameters.

```js
let client = new CloudDirectoryClient({ MaxResults: 15 }); // defaults to 10, max. value is 30
let users = client.listObjectChildren('/users');
for(let user of users) {
  console.log(await user);
}
```

Let's assume we have 100 objects attached to `/users` that we want to scroll over. With `MaxResults` set at 15, there will be a total 7 requests made to retrieve all objects. The Cloud Directory API doesn't support skipping object when listing results.
