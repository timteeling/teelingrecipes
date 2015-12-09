angular.module('RecipesApp')
  .controller('NavController', function($scope, $rootScope, $location){
    $scope.toggle = false;

    $scope.closeNav = function(newUrl){
      $scope.toggle = false;
      $location.url(newUrl);
    };
  })
  .controller('AccountController', function($scope, $http, $rootScope, $location){
    $rootScope.PAGE = 'account';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;
    $scope.user.password = '';

    $scope.updateInfo = function(cid){
      $http.put('/reset/' + $scope.user.cid, {'cid': $scope.user.cid, 'firstname': $scope.user.firstname, 'lastname': $scope.user.lastname });
      $location.url('/recipes');
    };

    $scope.updatePassword = function(cid){
      if($scope.user.password.length > 0) {
        $http.put('/reset/' + $scope.user.cid, $scope.user);
        $location.url('/recipes');
      } else {
        alert('Need to fill in password');
      }
    };
  })
  .controller('ListController', function($scope, $rootScope, Recipe, $location){
    $rootScope.PAGE = 'all';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;

    $scope.recipes = Recipe.query();
    $scope.fields = ['title', 'description'];

    $scope.sort = function(field){
      $scope.sort.field = field;
      $scope.sort.order = !$scope.sort.order;
    };

    $scope.sort.field = 'title';
    $scope.sort.order = false;

    $scope.show = function(id){
      $location.url('/recipes/' + id);
    };
  })
  .controller('NewController', function($scope, $rootScope, Recipe, $location){
    $rootScope.PAGE = 'new';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;

    $scope.recipe = new Recipe({
      title: ['', 'text'],
      description: ['', 'textarea'],
      time: ['', 'text'],
      source: [
        ['', 'text'],
        ['', 'text']
      ],
      servings: ['', 'text'],
      ingredients: [
        ['', 'text'],
        ['', 'text']
      ],
      steps: [
        ['', 'textarea']
      ]

    });

    $scope.addIngredient = function(){
      $scope.recipe['ingredients'].push(['', 'text']);
    };

    $scope.removeIngredient = function(item){
      var index = $scope.recipe['ingredients'].indexOf(item);
      $scope.recipe['ingredients'].splice(index, 1);
    };

    $scope.addStep = function(){
      $scope.recipe['steps'].push(['', 'text']);
    };

    $scope.removeStep = function(item){
      var index = $scope.recipe['steps'].indexOf(item);
      $scope.recipe['steps'].splice(index, 1);
    };

    $scope.save = function(){
      if($scope.newRecipe.$invalid){
        $scope.$broadcast('record:invalid');
      } else {
        $scope.recipe.$save();
        $location.url('/recipes');
      }
    };
  })
  .controller('SingleController', function($scope, $rootScope, $location, Recipe, $routeParams){
    $rootScope.PAGE = 'single';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;

    $scope.recipe = Recipe.get({ id: parseInt($routeParams.id, 10) });
  })
  .controller('EditController', function($scope, $rootScope, $location, $timeout, $http, Recipe, $routeParams){
    $rootScope.PAGE = 'edit';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;

    $scope.recipe = Recipe.get({ id: parseInt($routeParams.id, 10) });

    $scope.addIngredient = function(){
      $scope.recipe['ingredients'].push(['', 'text']);
    };

    $scope.removeIngredient = function(item){
      var index = $scope.recipe['ingredients'].indexOf(item);
      $scope.recipe['ingredients'].splice(index, 1);
    };

    $scope.addStep = function(){
      $scope.recipe['steps'].push(['', 'text']);
    };

    $scope.removeStep = function(item){
      var index = $scope.recipe['steps'].indexOf(item);
      $scope.recipe['steps'].splice(index, 1);
    };

    $scope.blurUpdate = function() {
      $http.put('/api/recipes/' + parseInt($routeParams.id, 10), $scope.recipe);
    };

    var saveTimeout;
    $scope.update = function() {
      $timeout.cancel(saveTimeout);
      saveTimeout = $timeout($scope.blurUpdate, 1000);
    };

    $scope.updateAll = function(){
      $http.put('/api/recipes/' + parseInt($routeParams.id, 10), $scope.recipe);
      $location.url('/recipes/' + parseInt($routeParams.id, 10));
    };

    $scope.delete = function(){
      $http.delete('/api/recipes/' + parseInt($routeParams.id, 10));
      $location.url('/recipes');
    };
  });
