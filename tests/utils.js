import { deflateValue, joinSelectors } from 'utils';

test('deflate value with unsupported type', () => {
  expect(() => deflateValue([1,2,3])).toThrowError(/unsupported/i);
});

test.each([
  [[['selector']], '/selector'],
  [['selector'], 'selector'],
  [['/', 'selector'], '/selector'],
  [['$AQH8uiqsxntJxZjGq6c4'], '$AQH8uiqsxntJxZjGq6c4']

])('joinSelector', (a, b) => {
  expect(joinSelectors(...a)).toEqual(b);
});
