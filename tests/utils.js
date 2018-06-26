import { deflateValue, joinSelectors } from 'utils';

test('deflate value with unsupported type', () => {
  expect(() => deflateValue([1,2,3])).toThrowError(/unsupported/i);
});

test.each([
  [[['selector']], '/selector'],
  [['selector'], 'selector'],
  [['/', 'selector'], '/selector']

])('joinSelector', (a, b) => {
  expect(joinSelectors(...a)).toEqual(b);
});
