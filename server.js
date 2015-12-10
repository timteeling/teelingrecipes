var express = require('express');
var login = require('./login');
var port = Number(process.env.PORT || 5000);
var multer = require('multer');
var path = require('path');

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/img/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

var upload = multer({
  storage: storage
});

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
  .post('/api/upload', upload.single('recipe'), function(req,res,next){
    console.log(req.file);
    res.json({'filename': req.file.filename });
  })
  .listen(port, function() {
    console.log('Node app is running on port', port);
  });
