angular.module('RecipesApp', ['templates-main', 'ngRoute', 'ngResource', 'ngMessages', 'ngSanitize', 'angularFileUpload', 'checklist-model'])
  .config(function($routeProvider, $locationProvider){
    $routeProvider
      .when('/recipes', {
        controller: 'ListController',
        templateUrl: 'views/list.html'
      })
      .when('/recipes/new', {
        controller: 'NewController',
        templateUrl: 'views/new.html'
      })
      .when('/recipes/:id', {
        controller: 'SingleController',
        templateUrl: 'views/single.html'
      })
      .when('/recipes/:id/edit', {
        controller: 'EditController',
        templateUrl: 'views/edit.html'
      })
      .when('/account', {
        controller: 'AccountController',
        templateUrl: 'views/account.html'
      })
      .when('/admin', {
        controller: 'AdminController',
        templateUrl: 'views/admin.html'
      })
      .otherwise({
        redirectTo: '/recipes'
      });
    $locationProvider.html5Mode(true);
  });
