/* globals module, require */

module.exports = function(grunt) {

  "use strict";

  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    concat: {
      dist: {
        src: [
          'js/src/jquery.fitvids.js',
          'js/src/jquery.magnific-popup.min.js',
          'js/src/scripts.js'
        ],
        dest: 'js/main.js'
      }
    },

    jshint: {
      all: ['Gruntfile.js', 'js/src/scripts.js'],
      options: {
        jshintrc: '.jshintrc',
      }
    },

    uglify: {
      global: {
        files: {
          "js/main.min.js": ["js/main.js"]
        }
      }
    },

    sass: {
      global: {
        options: {
          outputStyle: "compressed"
        },
        files: {
          "public/css/main.css": "public/scss/main.scss"
        }
      }
    },

    shell: {
      nodeServer: {
        command: "node server.js"
      }
    },

    watch: {
      options: {
        livereload: true
      },
      //js: {
      //  files: ["js/*.js", "js/*/*.js"],
      //  tasks: ["jshint", "concat", "uglify", "shell:jekyllBuild"]
      //},
      css: {
        files: ["public/scss/*.scss", "public/scss/*/*.scss"],
        tasks: ["sass"]
      }
    }

  });

  require("load-grunt-tasks")(grunt);

  grunt.registerTask("serve", ["shell:nodeServer"]);
  grunt.registerTask("default", ["sass", "watch"]);

};
