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
    var recipes = req.body;
    recipes.userId = req.user.cid;

    // To be removed
    recipes.fullname = req.user.fullname;
    recipes.email = req.user.email;

    var id = recipes.insert(recipes);
    res.json(recipes.get(id));
  });
