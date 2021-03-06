angular.module('RecipesApp')
  .controller('NavController', function($scope, $rootScope, $location){
    $scope.toggle = false;

    $scope.closeNav = function(newUrl){
      $scope.toggle = false;
      $location.url(newUrl);
    };
  })
  .controller('AdminController', function($scope, $http, User, $rootScope, $location){
    $scope.users = User.query();
    $rootScope.user = USER;

    $scope.delete = function(cid){
      $http.delete('/api/users/' + cid);
      $location.url('/recipes');
    };
  })
  .controller('AccountController', function($scope, $http, $rootScope, $location){
    $rootScope.PAGE = 'account';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;
    $scope.user.password = '';
    $scope.nameUpdate = false;
    $scope.passwordUpdate = false;
    $scope.passwordFail = false;

    $scope.updateInfo = function(cid){
      $http.put('/api/users/' + $scope.user.cid, {'cid': $scope.user.cid, 'firstname': $scope.user.firstname, 'lastname': $scope.user.lastname });
      $scope.nameUpdate = true;
      $scope.passwordUpdate = false;
      $scope.passwordFail = false;
    };

    $scope.updatePassword = function(cid){
      if($scope.user.password.length > 0) {
        $http.put('/api/users/' + $scope.user.cid, $scope.user);
        $scope.passwordUpdate = true;
        $scope.passwordFail = false;
        $scope.nameUpdate = false;
      } else {
        $scope.passwordFail = true;
        $scope.passwordUpdate = false;
        $scope.nameUpdate = false;
      }
    };
  })
  .controller('ListController', function($scope, $rootScope, Recipe, $location){
    $rootScope.PAGE = 'all';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;

    $scope.recipes = Recipe.query();
    $scope.fields = ['title', 'description'];

    $scope.filters = [];

    $scope.categories = [
      'breakfast',
      'drinks',
      'appetizers',
      'dinner',
      'sauces',
      'sides',
      'desserts'
    ];

    $scope.sort = function(field){
      $scope.sort.field = field;
      $scope.sort.order = !$scope.sort.order;
    };

    $scope.sort.field = '$updated';
    $scope.sort.order = true;

    $scope.show = function(id){
      $location.url('/recipes/' + id);
    };
  })
  .controller('NewController', function($scope, $rootScope, Recipe, $location, FileUploader){
    $rootScope.PAGE = 'new';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;
    $scope.imageUploaded = false;

    $scope.categories = [
      'breakfast',
      'drinks',
      'appetizers',
      'dinner',
      'sauces',
      'sides',
      'desserts'
    ];

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
      ],
      categories: []

    });

    var uploader = $scope.uploader = new FileUploader({
      url: '/api/upload',
      autoUpload: true,
      alias: 'recipe'
    });

    $scope.removePhoto = function(){
      $scope.recipe.image = '';
      $scope.imageUploaded = false;
    };

    // CALLBACKS
    uploader.onErrorItem = function(fileItem, response, status, headers) {
      console.info('onErrorItem', fileItem, response, status, headers);
    };
    uploader.onCompleteItem = function(fileItem, response, status, headers) {
      $scope.recipe.image = response.filename;
      $scope.imageUploaded = true;
    };

    $scope.addIngredient = function(){
      $scope.recipe.ingredients.push(['', 'text']);
    };

    $scope.removeIngredient = function(item){
      var index = $scope.recipe.ingredients.indexOf(item);
      $scope.recipe.ingredients.splice(index, 1);
    };

    $scope.addStep = function(){
      $scope.recipe.steps.push(['', 'text']);
    };

    $scope.removeStep = function(item){
      var index = $scope.recipe.steps.indexOf(item);
      $scope.recipe.steps.splice(index, 1);
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
  .controller('EditController', function($scope, $rootScope, $location, $timeout, $http, Recipe, FileUploader, $routeParams){
    $rootScope.PAGE = 'edit';
    $rootScope.user = USER;
    $scope.user = $rootScope.user;
    $scope.modal = false;

    $scope.categories = [
      'breakfast',
      'drinks',
      'appetizers',
      'dinner',
      'sauces',
      'sides',
      'desserts'
    ];

    $scope.recipe = Recipe.get({ id: parseInt($routeParams.id, 10) });

    if(!$scope.recipe.image) {
      $scope.imageUploaded = false;
    } else {
      $scope.imageUploaded = true;
    }

    var uploader = $scope.uploader = new FileUploader({
      url: '/api/upload',
      autoUpload: true,
      alias: 'recipe'
    });

    $scope.removePhoto = function(){
      $scope.recipe.image = '';
      $scope.imageUploaded = false;
    };

    // CALLBACKS
    uploader.onErrorItem = function(fileItem, response, status, headers) {
      console.info('onErrorItem', fileItem, response, status, headers);
    };
    uploader.onCompleteItem = function(fileItem, response, status, headers) {
      $scope.recipe.image = response.filename;
      $scope.imageUploaded = true;
    };

    $scope.addIngredient = function(){
      $scope.recipe.ingredients.push(['', 'text']);
    };

    $scope.removeIngredient = function(item){
      var index = $scope.recipe.ingredients.indexOf(item);
      $scope.recipe.ingredients.splice(index, 1);
    };

    $scope.addStep = function(){
      $scope.recipe.steps.push(['', 'text']);
    };

    $scope.removeStep = function(item){
      var index = $scope.recipe.steps.indexOf(item);
      $scope.recipe.steps.splice(index, 1);
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
      window.scrollTo(0, 0);
      $scope.modal = true;
    };

    $scope.confirmDelete = function(){
      $http.delete('/api/recipes/' + parseInt($routeParams.id, 10));
      $location.url('/recipes');
    };

    $scope.dismissDelete = function(){
      $scope.modal = false;
    };
  });
