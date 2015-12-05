angular.module('RecipesApp')
  .factory('Recipe', function ($resource) {
    return $resource('/api/recipes/:id', { id: '@id' }, {
      'update': { method: 'PUT' }
    });
  });
