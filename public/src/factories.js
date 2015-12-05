angular.module('RecipesApp')
  .factory('Recipes', function ($resource) {
    return $resource('/api/recipes/:id', { id: '@id' }, {
      'update': { method: 'PUT' }
    });
  });
