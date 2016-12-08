module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    unit: [
      'expresso -I lib -q -c -b',
      'env DB_PER_APP=false mocha ./test/mocha/mocha_tst_mongo_compat_api.js',
      'env DB_PER_APP=true mocha ./test/mocha/mocha_tst_mongo_compat_api.js'
    ]
  });

  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh:default']);
};
