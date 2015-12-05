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
