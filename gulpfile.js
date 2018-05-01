'use strict';

var gulp     = require('gulp'),
    jshint   = require('gulp-jshint'),
    sass     = require('gulp-sass'),
    zip      = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js'
  ],
  sass: [
    'src/content/controls.scss'
  ],
  dist: [
    'src/**'
  ]
};

gulp.task('default', [ 'lint', 'sass', 'watch' ]);

gulp.task('watch', [ 'sass' ], function () {
  gulp.watch(sources.js, [ 'lint' ]);
  gulp.watch(sources.sass, [ 'sass' ]);
});

gulp.task('sass', function () {
  gulp.src(sources.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('src/content/'));
});

gulp.task('lint', function () {
  return gulp.src(sources.js)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('dist', [ 'lint', 'sass' ], function () {
  return gulp.src(sources.dist)
    .pipe(zip('alt-video-controls.xpi', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
});
