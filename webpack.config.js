var path = require('path');

module.exports = {
  context: path.resolve(__dirname, "src"),
  entry: path.resolve(__dirname, 'src', 'user.js'),
  output: {
    filename: 'bundle.[hash].js',
    path: path.resolve(__dirname, 'dist'),
  },
};
