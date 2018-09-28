const express = require('express')
const path = require('path');
const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcrypt')
const hat = require('hat')
const cookieparser = require('cookie-parser')
const bodyparser = require('body-parser')

let db = new sqlite3.Database('./highscores.db', (err) => {
  if (err) return console.error(err.message);
  db.run('CREATE TABLE IF NOT EXISTS highscores(name NAME, score SCORE)')
  db.run('CREATE TABLE IF NOT EXISTS users(username USERNAME, password PASSWORD)')
  db.run('CREATE TABLE IF NOT EXISTS tokens(username USERNAME, apikey APIKEY)')
});

let app = express()
app.use(cookieparser())
app.use(bodyparser.json()); // support json encoded bodies
app.use(bodyparser.urlencoded({ extended: true })); // support encoded bodies

function Score(name, score){
  this.name = name
  this.score = score
}

app.listen(3000, function(){

  console.log('server running on port 3000')

})

app.get('/game', function(req, res){

  let success = false
  let newapi = hat()

  db.each(`SELECT * FROM tokens`, (err, row) => {
       if (err) throw err;
       if(req.cookies.api == row.apikey){

         let sql = `UPDATE tokens
                    SET apikey = ?
                    WHERE username = ?`;

        let data = [newapi, row.username]

         db.run(sql, data, function(err) {
           if (err) return console.log(err.message);
         })
         success = true;
       }
    }, function(err, numRows){
      if(!success){
        res.redirect("/")
      }
      else{
        res.cookie("api", newapi)
        res.sendFile(path.resolve("website.htm"));
      }
    });
});

app.get('/', function(req, res){

  res.clearCookie("api")
  res.sendFile(path.resolve("home.htm"));

});


app.get('/registration', function(req, res){

  res.clearCookie("api")
  res.sendFile(path.resolve("register.htm"));

});

app.post('/register', function(req, res){

  let error = false;
  let code = 200;

  db.each(`SELECT * FROM users`, (err, row) => {
    if(req.body.username == row.username){
      error = true;
      code = 405;
    }
  }, function(err, numRows){
    if(error){
      res.cookie('error', code)
      res.redirect("/registration")
    }
    else{
      bcrypt.hash(req.body.password, 4, function(err, hash) {
        db.run(`INSERT INTO users (username, password) VALUES('${req.body.username}', '${hash}')`, function(err) {
          if (err) console.log(err.message);
          res.redirect("/")
        })
      })
    }
  })
});


app.post('/login', function(req, res){

  let authorized = false;
  let api = hat();
  let inTokenDatabase = false;

  res.status(200)

  db.each(`SELECT * FROM users`, (err, row) => {
    if (err) throw err;

    if(req.body.username == row.username) {
      if(bcrypt.compareSync(req.body.password, row.password)){

        db.each(`SELECT * FROM tokens`, (err, row) => {
          if(req.body.username == row.username){
            inTokenDatabase = true;
          }
        }, function(err, numRows){

            if(inTokenDatabase){
              let sql = `UPDATE tokens
                        SET apikey = ?
                        WHERE username = ?`;

              let data = [api, row.username]

               db.run(sql, data, function(err) {
                 if (err) return console.log(err.message);
               })
            }
            else{
              db.run(`INSERT INTO tokens (username, apikey) VALUES('${req.body.username}', '${api}')`, function(err) {
                if (err) console.log(err.message);
              })
            }
        })

        authorized = true;
      }
    }
  },
  function(err, numRows) {
    if (authorized){
      res.cookie("api", api)
      res.redirect("/game")
    }
    else{
      res.redirect("/?error=true")
    }
  });
});


app.post('/submitscore', function(req, res){

  if(!(isNaN(req.body.score))){

    let success = false
    let newapi = hat()

    db.each(`SELECT * FROM tokens`, (err, row) => {
         if (err) throw err;
         if(req.cookies.api == row.apikey){

           db.run(`INSERT INTO highscores (name, score) VALUES('${row.username}', '${req.body.score}')`, function(err) {
             if (err) return console.log(err.message);
           })

          let sql = `UPDATE tokens
                    SET apikey = ?
                    WHERE username = ?`;

          let data = [newapi, row.username]

           db.run(sql, data, function(err) {
             if (err) return console.log(err.message);
           })
           success = true;
         }
      }, function(err, numRows){
        if(!success){
          res.redirect("/")
        }
        else{
          res.cookie("api", newapi)
          res.end()
        }
      });
    }
})


app.get('/high_scores', function(req, res){

  res.header('Content-Type','application/json');
  res.status(200);
  let highscores = []
  db.each(`SELECT * FROM highscores`, (err, row) => {
       if (err) throw err;
       highscores.push(new Score(row.name, row.score))
    },
    function(err, numRows) {
      res.send(highscores.sort((a, b) => b.score - a.score).slice(0, 10))
    });
  });

app.get('/highscores', function(req, res){

  res.status(200);
  res.sendFile(path.resolve("highscores.htm"), function(err) {
    if( err ) throw err
  });

})
