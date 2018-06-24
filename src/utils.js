import 'babel-polyfill';

export let
  joinSelectors = (...selector) => {
    if (selector.length === 1) return selector[0];
    return '/' + selector.map(a => a.replace(/^\//g, '').replace(/\/$/g, '')).filter(a => a.length).join('/');
  },

  flattenObjectAttributes = res => {
    let attrs = {};
    res.forEach(attribute => {
      let facetName = attribute.Key.FacetName;
      if (!attrs[facetName]) attrs[facetName] = {};
      let value = inflateValue(attribute.Value);
      attrs[facetName][attribute.Key.Name] = value;
    });
    return attrs;
  },

  flattenLinkAttributes = res => {
    let attrs = {};
    res.forEach(attribute => {
      let name = attribute.AttributeName;
      let value = inflateValue(attribute.Value);
      attrs[name] = value;
    });
    return attrs;
  },

  inflateLinkAttributes = facets => {
    return Array.prototype.concat.apply([],
      Object.keys(facets).filter(facet => !!facets[facet]).map(facet => Object.keys(facets[facet]).map(a => ({
        AttributeName: a,
        Value: deflateValue(facets[facet][a]),
      })))
    );
  },

  deflateValue = value => {
    if (typeof value === 'string') return { StringValue: value };
    else if (value === true || value === false) return { BooleanValue: value };
    else if (value instanceof Date) return { DatetimeValue: value };
    else if (value instanceof Buffer) return { BinaryValue: value };
    else if (!Number.isNaN(value)) return { NumberValue: value };
    else throw 'Unknown type';
  },

  inflateValue = value => {
    return Object.values(value).find(v => v !== null);
  },

  camelCaseEncode = str => str.replace(/_\w/g, m => m[1].toUpperCase());
