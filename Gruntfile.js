module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    unit: 'expresso -I lib -q -c -b'
  });

  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh:default']);
};
