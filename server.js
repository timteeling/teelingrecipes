var express = require('express');
var login = require('./login');
var port = Number(process.env.PORT || 5000);

express()
  .set('view engine', 'ejs')
  .use(express.static('./public'))
  .use(login.routes)
  .use(require('./recipes'))
  .get('/register', function(req,res){
    res.render('register');
  })
  .get('*', login.required, function(req,res){
    res.render('main', {
      user: login.safe(req.user)
    });
  })
  .listen(port, function() {
    console.log('Node app is running on port', port);
  });
