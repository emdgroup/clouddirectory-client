import { deflateValue } from 'utils';

test('deflate value with unsupported type', () => {
  expect(() => deflateValue([1,2,3])).toThrowError(/unsupported/i);
})
