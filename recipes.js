var router = module.exports = require('express').Router();
var login = require('./login');

var db = new (require('locallydb'))('./.data');
var recipes = db.collection('recipes');

router.route('/api/recipes')
  .all(login.required)
  .get(function(req,res) {
    res.json(recipes.toArray());
  })
  .post(function(req,res){
    var recipe = req.body;
    recipe.userId = req.user.cid;

    // To be removed
    recipe.username = req.user.username;
    recipe.fullname = req.user.fullname;
    recipe.email = req.user.email;

    var id = recipes.insert(recipe);
    res.json(recipes.get(id));
  });

router
  .all(login.required)
  .param('id', function(req,res,next){
    req.dbQuery = parseInt(req.params.id, 10);
    next();
  })
  .route('/api/recipes/:id')
    .get(function(req,res){
      var single = recipes.get(req.dbQuery);
      res.json(single);
    })
    .put(function (req, res) {
      var recipe = req.body;
      delete recipe.$promise;
      delete recipe.$resolved;
      recipes.update(req.dbQuery, recipe, function (err, data) {
        res.json(data[0]);
      });
    })
    .delete(function(req,res){
      recipes.delete(req.dbQuery, function(){
        res.json(null);
      });
    });
