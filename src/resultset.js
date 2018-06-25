export default class IterableResultSet {
  constructor({
    client,
    method,
    parametersOverride = {},
    keyIsLinkName = true,
    childrenAttributeName, transformer = i => i
  }) {
    let args = Object.assign({
      DirectoryArn: client.Arn,
      MaxResults: client.MaxResults,
      ConsistencyLevel: method === 'listObjectParentPaths' ? undefined : client.ConsistencyLevel,
    }, parametersOverride);
    Object.assign(this, { inFlight: null, client, method, args, keyIsLinkName, childrenAttributeName, transformer });
  }

  addTransformation(transformer) {
    let fn = this.transformer;
    this.transformer = i => transformer(fn(i));
  }

  async request(nextToken) {
    if (this.inFlight) return this.inFlight.then(res => ({ Children: [] }));
    this.inFlight = this.client.cd[this.method](Object.assign({
      NextToken: nextToken,
    }, this.args)).promise().then(res => {
      this.inFlight = null;
      res.Children = Array.isArray(res[this.childrenAttributeName])
        ? res[this.childrenAttributeName]
        : Object.keys(res[this.childrenAttributeName]).map(k => ({
          [this.keyIsLinkName ? 'LinkName' : 'ObjectIdentifier']: k,
          [this.keyIsLinkName ? 'ObjectIdentifier' : 'LinkName']: res[this.childrenAttributeName][k],
        }));
      return res;
    }, err => {
      this.inFlight = null;
      throw err;
    });
    return this.inFlight;
  }

  *scroll() {
    let cache = [], nextToken, { transformer } = this;
    while (true) {
      if (cache.length) {
        yield Promise.resolve(cache.shift());
      } else if (nextToken !== null) {
        yield this.request(nextToken).then(res => {
          nextToken = res.NextToken || null;
          cache.push.apply(cache, res.Children);
          return transformer ? transformer(cache.shift()) : cache.shift();
        });
      } else {
        break;
      }
    }
  }

  async all() {
    let tmp = [], results = [];
    for (let res of this.scroll()) {
      results.push(await res);
      // tmp.push(res);
      // if(tmp.length > this.args.MaxResults) {
      //   let resolved = await Promise.all(tmp);
      //   results.push.apply(results, resolved);
      //   tmp = [];
      // }
    }
    // results.push.apply(results, await Promise.all(tmp));
    return results.filter(r => r);
  }
}
