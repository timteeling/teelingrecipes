angular.module('RecipesApp')
  .controller('ListController', function($scope, $rootScope, Recipe, $location, options){
    $rootScope.PAGE = 'all';
    $scope.recipes = Recipe.query();
    $scope.fields = ['firstName', 'lastName'];

    $scope.sort = function(field){
      $scope.sort.field = field;
      $scope.sort.order = !$scope.sort.order;
    };

    $scope.sort.field = 'firstName';
    $scope.sort.order = false;

    $scope.show = function(id){
      $location.url('/recipes/' + id);
    };
  })
  .controller('NewController', function($scope, $rootScope, Recipe, $location){
    $rootScope.PAGE = 'new';
    $scope.recipe = new Recipe({
      firstName: ['', 'text'],
      lastName: ['', 'text'],
      email: ['', 'email'],
      homePhone: ['', 'tel'],
      cellPhone: ['', 'tel'],
      birthday: ['', 'date'],
      website: ['', 'url'],
      address: ['', 'text']
    });

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
    $scope.recipe = Recipe.get({ id: parseInt($routeParams.id, 10) });
    $scope.delete = function(){
      $scope.recipe.$delete();
      $location.url('/recipes');
    }
  })
  .controller('EditController', function($scope, $rootScope, $location, Recipe, $routeParams){
    $rootScope.PAGE = 'edit';
    $scope.recipe = Recipe.get({ id: parseInt($routeParams.id, 10) });
    $scope.delete = function(){
      $scope.recipe.$delete();
      $location.url('/recipes');
    }
  });
