var passport = require('passport');
var LocalStrategy = require('passport-local');
var flash = require('connect-flash');
var LocallyDB = require('locallydb');
var db = new LocallyDB('./.data');
var users = db.collection('users');

var crypto = require('crypto');

function hash (password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}

passport.use('local', new LocalStrategy({
  passReqToCallback: true
},
function(req, username, password, done){
  var user = users.where({ username: username, passwordHash: hash(password) }).items[0];

  if(user) {
    done(null, user);
  } else {
    done(null, false, req.flash('loginMessage', 'Incorrect Login'));
  }
}));

passport.serializeUser(function(user, done){
  done(null, user.cid);
});

passport.deserializeUser(function(cid, done){
  done(null, users.get(cid));
});

var router = require('express').Router();
var bodyParser = require('body-parser');

router.use(bodyParser.urlencoded({ extended: true })); // Login page
router.use(bodyParser.json()); // API
router.use(require('cookie-parser')());
router.use(require('express-session')({
  secret: 'woiwjfeapoiwe87asdoas7',
  resave: false,
  saveUninitialized: true
}));
router.use(passport.initialize());
router.use(passport.session());
router.use(flash());
router.get('/login', function(req, res){
  res.render('login', {message: req.flash('loginMessage')});
});

router.post('/register', function(req,res, next){
  if(users.where({ username: req.body.username }).items.length === 0) {
    var user = {
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      username: req.body.username,
      passwordHash: hash(req.body.password),
    };

    var userId = users.insert(user);

    req.login(users.get(userId), function(err){
      if(err) return next(err);
      res.redirect('/main');
    });

  } else {
    res.render('register', {message: 'Email already taken'});
  }
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/',
  failureFlash: true
}));

router.get('/logout', function(req,res){
  req.logout();
  res.redirect('/');
});

router
  .param('id', function(req,res,next){
    req.dbQuery = parseInt(req.params.id, 10);
    next();
  })
  .route('/api/users/:id')
    .all(loginRequired)
    .put(function (req, res) {
      firstname = req.body.firstname;
      lastname = req.body.lastname;
      var updateUser = {};

      if(req.body.password){
        passwordHash = hash(req.body.password);
        updateUser = {'firstname': firstname, 'lastname': lastname, 'passwordHash': passwordHash};
      } else {
        updateUser = {'firstname': firstname, 'lastname': lastname};
      }

      users.update(req.body.cid, updateUser, function(err,data){
        res.json(data[0]);
      });
    })
    .delete(function(req,res){
      users.remove(req.dbQuery);
      res.json(null);
    });

router.route('/api/users')
  .all(loginRequired)
  .get(function(req,res){
    var usersArr = users.toArray();
    var safeArr = [];

    for (i = 0; i < usersArr.length; i++) {
      safeArr.push({
        username: usersArr[i].username,
        firstname: usersArr[i].firstname,
        lastname: usersArr[i].lastname,
        cid: usersArr[i].cid
      });
    }
    res.json(safeArr);
  });

function loginRequired (req,res,next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.render('login', {message: req.flash('loginMessage')});
  }
}

function makeUserSafe (user) {
  var safeUser = {};
  var safeKeys = ['cid', 'firstname', 'lastname', 'username'];

  safeKeys.forEach(function(key){
    safeUser[key] = user[key];
  });
  return safeUser;
}

exports.routes = router;
exports.required = loginRequired;
exports.safe = makeUserSafe;
