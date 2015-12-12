var express = require('express');
var login = require('./login');
var port = Number(process.env.PORT || 5000);
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var gm = require('gm');

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

    var resizeFile = req.file.filename;
    gm('./public/img/uploads/' + resizeFile)
    .resize('1000>')
    .quality(75)
    .noProfile()
    .write('./public/img/recipes/' + resizeFile, function (err) {
      if (!err) res.json({'filename': req.file.filename });
    });

  })
  .listen(port, function() {
    console.log('Node app is running on port', port);
  });
