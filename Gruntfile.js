/* globals module, require */

module.exports = function(grunt) {

  "use strict";

  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    html2js: {
      options: {
        // custom options, see below
      },
      main: {
        src: ['public/views/*.html'],
        dest: 'public/tmp/templates.js'
      },
    },

    concat: {
      dist: {
        src: [
          'public/lib/angular/angular.min.js',
          'public/lib/angular-route/angular-route.min.js',
          'public/lib/angular-resource/angular-resource.min.js',
          'public/lib/angular-messages/angular-messages.min.js',
          'public/src/app.js',
          'public/src/controllers.js',
          'public/src/factories.js',
          'public/src/filters.js',
          'public/src/directives.js',
          'public/tmp/templates.js'
        ],
        dest: 'public/js/main.js'
      }
    },

    uglify: {
      global: {
        files: {
          "public/js/main.min.js": ["public/js/main.js"]
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
      js: {
        files: ["public/lib/*/*.js", "public/src/*.js", "public/views/*.html", "public/js/*.js"],
        tasks: ["html2js", "concat", "uglify"]
      },
      css: {
        files: ["public/scss/*.scss", "public/scss/*/*.scss"],
        tasks: ["sass"]
      }
    }

  });

  require("load-grunt-tasks")(grunt);

  grunt.registerTask("serve", ["shell:nodeServer"]);
  grunt.registerTask("default", ["sass", "html2js", "concat", "uglify", "watch"]);

};
