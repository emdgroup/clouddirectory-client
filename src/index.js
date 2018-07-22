// @flow

import CloudDirectory from 'aws-sdk/clients/clouddirectory';

import { joinSelectors, flattenObjectAttributes, flattenLinkAttributes, inflateLinkAttributes, deflateValue, buildAttributeFilter } from './utils';

import IterableResultSet from './resultset';

type Selector = string | Array<string>;

type AttributeValues = {
  [facetName: string]: {
    [attributeName: string]: string | Date | boolean | Buffer,
  }
};
type Parent = { Selector: Selector, LinkName: string };

export default class CloudDirectoryClient {
  Arn: string;
  SchemaArn: string;
  cd: CloudDirectory;
  MaxResults: number;
  ConsistencyLevel: 'EVENTUAL' | 'SERIALIZABLE';

  constructor({
    DirectoryArn,
    Schema,
    AppliedSchemaArn,
    Client = new CloudDirectory(),
    CamelCase = false,
    MaxResults = 10,
    ConsistencyLevel = 'EVENTUAL',
  }: Object) {
    this.Arn = DirectoryArn;
    this.SchemaArn = AppliedSchemaArn || `${DirectoryArn}/schema/${Schema}`;
    this.cd = Client;
    Object.assign(this, { MaxResults, ConsistencyLevel });
  }

  resultSetFactory(args: {}) {
    return new IterableResultSet(Object.assign({
      client: this,
    }, args));
  }

  listObjectChildrenWithAttributes(selector: Selector, facetName: String) {
    let resultset = this.listObjectChildren(selector);
    resultset.addTransformation(({ LinkName, ObjectIdentifier }) => this.listAllObjectAttributes(`$${ObjectIdentifier}`, facetName).then(res => ({
      ObjectIdentifier,
      LinkName: LinkName,
      Attributes: res,
    })));
    return resultset;
  }

  listObjectParentsWithAttributes(selector: Selector, facetName: String) {
    let resultset = this.listObjectParents(selector);
    resultset.addTransformation(({ LinkName, ObjectIdentifier }) => this.listAllObjectAttributes(`$${ObjectIdentifier}`, facetName).then(res => ({
      ObjectIdentifier,
      LinkName: LinkName,
      Attributes: res,
    })));
    return resultset;
  }

  async createObject({
    Parents = [],
    Attributes = {},
    Indexes = [],
    OutgoingTypedLinks = [],
    IncomingTypedLinks = [],
  }: {
      Parents: Array<Parent>,
      Attributes: AttributeValues,
      Indexes: Array<string>,
      OutgoingTypedLinks: Array<AttributeValues>,
      IncomingTypedLinks: Array<AttributeValues>,
    }) {
    let objAttrs = [].concat.apply([], Object.keys(Attributes)
      .filter(facet => !!Attributes[facet])
      .map(facet => Object.keys(Attributes[facet])
        .map(a => ({
          Key: {
            FacetName: facet,
            SchemaArn: this.SchemaArn,
            Name: a,
          },
          Value: deflateValue(Attributes[facet][a]),
        })))
    );
    return this.cd.batchWrite({
      DirectoryArn: this.Arn,
      Operations: [{
        CreateObject: {
          BatchReferenceName: 'CreateObject',
          SchemaFacet: Object.keys(Attributes).map(facet => ({
            FacetName: facet,
            SchemaArn: this.SchemaArn,
          })),
          ObjectAttributeList: objAttrs.length ? objAttrs : [],
        }
      }].concat(Parents.map(({ Selector = '/', LinkName }) => ({
        AttachObject: {
          ParentReference: {
            Selector: joinSelectors(Selector),
          },
          LinkName: LinkName,
          ChildReference: {
            Selector: '#CreateObject',
          }
        }
      }))).concat(Indexes.map(index => ({
        AttachToIndex: {
          IndexReference: {
            Selector: joinSelectors(index),
          },
          TargetReference: {
            Selector: '#CreateObject',
          }
        }
      }))).concat(OutgoingTypedLinks.map(({ Selector, Attributes }) => {
        const attrs = inflateLinkAttributes(Attributes);
        return {
          AttachTypedLink: {
            SourceObjectReference: { Selector: '#CreateObject' },
            TargetObjectReference: { Selector: joinSelectors(Selector) },
            TypedLinkFacet: {
              SchemaArn: this.SchemaArn,
              TypedLinkName: Object.keys(Attributes)[0],
            },
            Attributes: attrs.length ? attrs : [],
          }
        };
      })).concat(IncomingTypedLinks.map(({ Selector, Attributes }) => {
        const attrs = inflateLinkAttributes(Attributes);
        return {
          AttachTypedLink: {
            SourceObjectReference: { Selector: joinSelectors(Selector) },
            TargetObjectReference: { Selector: '#CreateObject' },
            TypedLinkFacet: {
              SchemaArn: this.SchemaArn,
              TypedLinkName: Object.keys(Attributes)[0],
            },
            Attributes: attrs.length ? attrs : [],
          }
        };
      })),
    }).promise().then(({ Responses }) => ({
      ObjectIdentifier: Responses[0].CreateObject.ObjectIdentifier,
    }));
  }

  async getObjectInformation(selector: Selector) {
    return this.cd.getObjectInformation({
      DirectoryArn: this.Arn,
      ObjectReference: {
        Selector: joinSelectors(selector),
      },
      ConsistencyLevel: this.ConsistencyLevel,
    }).promise();
  }

  async deleteIndex(selector: Selector) {
    return this._deleteObject('index', selector);
  }

  async deleteObject(selector: Selector) {
    return this._deleteObject('object', selector);
  }

  async _deleteObject(type: string, selector: Selector) {
    let [parents, indices] = await Promise.all([
      this.listObjectParents(selector).all(),
      type === 'object' ? this.listAttachedIndices(selector).all() : [],
    ]);
    return this.cd.batchWrite({
      DirectoryArn: this.Arn,
      Operations: [].concat(parents.map((p, idx) => ({
        DetachObject: {
          BatchReferenceName: 'DetachObject' + idx,
          LinkName: p.LinkName,
          ParentReference: {
            Selector: `$${p.ObjectIdentifier}`,
          },
        },
      }))).concat(indices.map(i => ({
        DetachFromIndex: {
          IndexReference: {
            Selector: `$${i.ObjectIdentifier}`,
          },
          TargetReference: {
            Selector: '#DetachObject0',
          },
        }
      }))).concat([{
        DeleteObject: {
          ObjectReference: {
            Selector: '#DetachObject0',
          },
        },
      }])
    }).promise().then(() => null);
  }

  async attachTypedLink(sourceSelector: Selector, targetSelector: Selector, facets: AttributeValues) {
    let attributes = inflateLinkAttributes(facets);
    return this.cd.attachTypedLink({
      DirectoryArn: this.Arn,
      SourceObjectReference: { Selector: joinSelectors(sourceSelector) },
      TargetObjectReference: { Selector: joinSelectors(targetSelector) },
      TypedLinkFacet: {
        SchemaArn: this.SchemaArn,
        TypedLinkName: Object.keys(facets)[0],
      },
      Attributes: attributes.length ? attributes : [],
    }).promise().then(() => null);
  }

  async detachFromIndex(indexSelector: Selector, targetSelector: Selector) {
    return this.cd.detachFromIndex({
      DirectoryArn: this.Arn,
      IndexReference: {
        Selector: joinSelectors(indexSelector),
      },
      TargetReference: {
        Selector: joinSelectors(targetSelector),
      },
    }).promise().then(() => null);
  }


  async attachToIndex(indexSelector: Selector, targetSelector: Selector) {
    return this.cd.attachToIndex({
      DirectoryArn: this.Arn,
      IndexReference: {
        Selector: joinSelectors(indexSelector),
      },
      TargetReference: {
        Selector: joinSelectors(targetSelector),
      },
    }).promise().then(() => null);
  }

  async detachAllFromIndex(indexSelector: Selector) {
    let children = await this.listIndex(indexSelector).all();
    return this.cd.batchWrite({
      DirectoryArn: this.Arn,
      Operations: children.map(c => ({
        DetachFromIndex: {
          IndexReference: {
            Selector: joinSelectors(indexSelector),
          },
          TargetReference: {
            Selector: `$${c.ObjectIdentifier}`,
          },
        }
      })),
    }).promise().then(() => null);
  }

  async detachObject(parentSelector: Selector, linkName: string) {
    return this.cd.detachObject({
      DirectoryArn: this.Arn,
      LinkName: linkName,
      ParentReference: { Selector: joinSelectors(parentSelector) },
    }).promise().then(() => null);
  }

  async attachObject(parentSelector: Selector, childSelector: Selector, linkName: string) {
    return this.cd.attachObject({
      DirectoryArn: this.Arn,
      LinkName: linkName,
      ParentReference: { Selector: joinSelectors(parentSelector) },
      ChildReference: { Selector: joinSelectors(childSelector) },
    }).promise().then(() => null);
  }

  async detachPolicy(policySelector: Selector, objectSelector: Selector) {
    return this.cd.detachPolicy({
      DirectoryArn: this.Arn,
      ObjectReference: { Selector: objectSelector },
      PolicyReference: { Selector: policySelector },
    }).promise().then(() => null);
  }

  async attachPolicy(policySelector: Selector, objectSelector: Selector) {
    return this.cd.attachPolicy({
      DirectoryArn: this.Arn,
      ObjectReference: { Selector: objectSelector },
      PolicyReference: { Selector: policySelector },
    }).promise().then(() => null);
  }

  async detachTypedLink(sourceSelector: Selector, targetSelector: Selector, facets: AttributeValues) {
    let attributes = inflateLinkAttributes(facets);
    return this.cd.detachTypedLink({
      DirectoryArn: this.Arn,
      TypedLinkSpecifier: {
        SourceObjectReference: { Selector: joinSelectors(sourceSelector) },
        TargetObjectReference: { Selector: joinSelectors(targetSelector) },
        TypedLinkFacet: {
          SchemaArn: this.SchemaArn,
          TypedLinkName: Object.keys(facets)[0],
        },
        IdentityAttributeValues: attributes.length ? attributes : [],
      },
    }).promise().then(() => null);
  }

  listIncomingTypedLinks(selector: Selector, facet: AttributeValues) {
    return this._listTypedLinks('listIncomingTypedLinks', selector, facet);
  }

  listOutgoingTypedLinks(selector: Selector, facet: AttributeValues) {
    return this._listTypedLinks('listOutgoingTypedLinks', selector, facet);
  }

  _listTypedLinks(type: string, selector: Selector, facet: AttributeValues) {
    let facetName = Object.keys(facet)[0];
    let attributes = facet[facetName] ? Object.keys(facet[facetName]).map(attr => buildAttributeFilter(attr, facet[facetName][attr])) : undefined;

    let resultset = this[`_${type}`](selector, {
      FilterTypedLink: {
        SchemaArn: this.SchemaArn,
        TypedLinkName: facetName,
      },
      FilterAttributeRanges: attributes,
    });
    resultset.addTransformation(({ SourceObjectReference, TargetObjectReference, IdentityAttributeValues }) => ({
      SourceObjectSelector: SourceObjectReference.Selector,
      TargetObjectSelector: TargetObjectReference.Selector,
      LinkAttributes: flattenLinkAttributes(IdentityAttributeValues),
    }));
    return resultset;
  }

  async createIndex({ IsUnique = true, IndexedAttributes = [], IndexName, ParentSelector }: {
    IsUnique: boolean,
    IndexedAttributes: Array<{ [string]: { [string]: string } }>,
    IndexName: string,
    ParentSelector: Selector,
  }) {
    return this.cd.createIndex({
      DirectoryArn: this.Arn,
      IsUnique: IsUnique,
      OrderedIndexedAttributeList: [].concat.apply([], IndexedAttributes.map(index => Object.keys(index).map(facet => ({
        FacetName: facet,
        SchemaArn: this.SchemaArn,
        Name: index[facet],
      })))),
      LinkName: IndexName,
      ParentReference: {
        Selector: joinSelectors(ParentSelector || '/'),
      }
    }).promise().then(({ ObjectIdentifier }) => ({
      IndexIdentifier: ObjectIdentifier,
    }));
  }

  async getSchemaAsJson() {
    return this.cd.getSchemaAsJson({
      SchemaArn: this.SchemaArn,
    }).promise();
  }

  listAttachedIndices(selector: Selector, overrides: any) : IterableResultSet {}
  _listIncomingTypedLinks(selector: Selector, overrides: any) : IterableResultSet {}
  _listIndex(selector: Selector, overrides: any) : IterableResultSet {}
  _listObjectAttributes(selector: Selector, overrides: any) : IterableResultSet {}
  listObjectChildren(selector: Selector, overrides: any) : IterableResultSet {}
  listObjectParentPaths(selector: Selector, overrides: any) : IterableResultSet {}
  listObjectParents(selector: Selector, overrides: any) : IterableResultSet {}
  listObjectPolicies(selector: Selector, overrides: any) : IterableResultSet {}
  _listOutgoingTypedLinks(selector: Selector, overrides: any) : IterableResultSet {}
  listPolicyAttachments(selector: Selector, overrides: any) : IterableResultSet {}
  lookupPolicy(selector: Selector, overrides: any) : IterableResultSet {}

  listIndex(selector: Selector, attributes: AttributeValues = {}) {
    let facets = Object.keys(attributes);
    let filter = facets.map(FacetName => Object.keys(attributes[FacetName]).map(attr => ({
      AttributeKey: {
        FacetName,
        Name: attr,
        SchemaArn: this.SchemaArn,
      },
      Range: {
        StartMode: 'INCLUSIVE',
        EndMode: 'INCLUSIVE',
        StartValue: deflateValue(attributes[FacetName][attr]),
        EndValue: deflateValue(attributes[FacetName][attr]),
      }
    })));
    return this._listIndex(selector, facets.length ? {
      RangesOnIndexedValues: [].concat.apply([], filter),
    } : {});
  }

  listObjectAttributes(Selector: Selector, FacetName: String) {
    return this._listObjectAttributes(Selector, FacetName ? {
      FacetFilter: {
        FacetName,
        SchemaArn: this.SchemaArn,
      },
    } : {});
  }

  listAllObjectAttributes(Selector: Selector, FacetName: String) {
    return this.listObjectAttributes(Selector, FacetName).all().then(flattenObjectAttributes);
  }
}

const scrollableListOperations = {
  listAttachedIndices: { childrenAttributeName: 'IndexAttachments', referenceKey: 'TargetReference' },
  listIncomingTypedLinks: { custom: true, childrenAttributeName: 'LinkSpecifiers' },
  listIndex: { custom: true, childrenAttributeName: 'IndexAttachments', referenceKey: 'IndexReference' },
  listObjectAttributes: { custom: true, childrenAttributeName: 'Attributes' },
  listObjectChildren: { childrenAttributeName: 'Children' },
  listObjectParentPaths: { childrenAttributeName: 'PathToObjectIdentifiersList' },
  listObjectParents: { childrenAttributeName: 'Parents', keyIsLinkName: false },
  listObjectPolicies: { childrenAttributeName: 'AttachedPolicyIds' },
  listOutgoingTypedLinks: { custom: true, childrenAttributeName: 'TypedLinkSpecifiers' },
  listPolicyAttachments: { childrenAttributeName: 'ObjectIdentifiers', referenceKey: 'PolicyReference' },
  lookupPolicy: { childrenAttributeName: 'PolicyToPathList' },
};

Object.keys(scrollableListOperations).forEach((fn: string) => {
  let { custom, referenceKey, childrenAttributeName, keyIsLinkName = true } = scrollableListOperations[fn];
  CloudDirectoryClient.prototype[custom ? `_${fn}` : fn] = function (selector: Selector, parametersOverride = {}) {
    return this.resultSetFactory({
      method: fn,
      parametersOverride: Object.assign({
        [referenceKey || 'ObjectReference']: {
          Selector: joinSelectors(selector),
        },
      }, parametersOverride), keyIsLinkName, childrenAttributeName
    });
  }
});
