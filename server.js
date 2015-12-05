var express = require('express');
var login = require('./login');

express()
  .set('view engine', 'html')
  .use(express.static('./public'))
  .use(login.routes)
  .use(require('./recipes'))
  .get('*', login.required, function(req,res){
    res.sendfile('public/main.html', {
      user: login.safe(req.user)
    });
  })
  .listen(3000);
