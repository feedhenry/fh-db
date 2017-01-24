module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    unit: [
      'env DB_PER_APP=false _mocha -u exports --recursive -t 10000 ./test',
      'env DB_PER_APP=true _mocha ./test/mocha/mocha_tst_mongo_compat_api.js'
    ]
  });

  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh:default']);
};
