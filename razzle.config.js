const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const purgecss = require('@fullhuman/postcss-purgecss')({
  content: ['./src/**/*.html', './src/**/*.js'],

  defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
});

module.exports = {
  plugins: [
    WebpackPerformanceHintsRazzlePlugin({}),
    {
      name: 'scss',
      options: {
        postcss: {
          plugins: [
            tailwindcss(),
            autoprefixer(),
            ...(process.env.NODE_ENV === 'production' ? [purgecss] : []),
          ],
        },
      },
    },
  ],
};

function WebpackPerformanceHintsRazzlePlugin(pluginOptions) {
  return function WebpackPerformanceHintsRazzlePluginFunc(config) {
    return {
      ...config,
      performance: {
        ...config.performance,
        assetFilter: function(assetFilename) {
          return false;
        },
      },
    };
  };
}
