var express = require('express');
var login = require('./login');
var port = Number(process.env.PORT || 5000);

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
  .listen(port, function() {
    console.log('Node app is running on port', port);
  });
