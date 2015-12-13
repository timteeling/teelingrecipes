angular.module('RecipesApp')
  .factory('Recipe', function ($resource) {
    return $resource('/api/recipes/:id', { id: '@id' }, {
      'update': { method: 'PUT' }
    });
  })
  .factory('User', function ($resource) {
    return $resource('/api/users/:id', { id: '@id' }, {
      'update': { method: 'PUT' }
    });
  });
