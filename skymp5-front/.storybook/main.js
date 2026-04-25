const path = require('path');

module.exports = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  "stories": [
    "../src/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-docs",
    "@storybook/addon-controls",
  ],
  typescript: {
    reactDocgen: false,
  },

  webpackFinal: async (config, { configType }) => {
    config.module.rules.push(
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
        include: path.resolve(__dirname, '../'),
      },
    );

    return config;
  },
}
