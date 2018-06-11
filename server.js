const port = 3102
var fs = require('fs'),
path = require('path');
var server = require("http").createServer(function(request, response) {
  setup(request, response)
}).listen(port);
const io = require('socket.io').listen(server)
console.log('Server running at http://127.0.0.1:3102/')

/*Connection to MongoDb*/
const MongoClient = require('mongodb').MongoClient
const dbURL = "mongodb://127.0.0.1:27017"
const dbName = "wNews"

const models = require('./db/models')

MongoClient.connect(dbURL, function (err, client) {
  if (err) console.log("Connection error: " + err);
  console.log("Successfully connected to Mongo server")
  const wNewsDb = client.db(dbName)

  io.on('connection', function (connection) {
    console.log('Client connected');

    connection.on('user login', (data) => {
      wNewsDb.collection('login', function (err, collection) {
        collection.find({
          userName: data.userName,
          userPass: data.userPass
        }).toArray(function (err, entries) {

          if (entries.length > 0) {
            const user = entries[0]
            const uID = user["_id"] + ""
            console.log('USER: ' + user.userName + ' SUCCESSFULLY LOGGED IN');

            connection.emit('logged in', user);

            wNewsDb.collection('categories').find({userID: uID}).toArray(function (err, categs) {
                if (categs.length > 0) {
                  connection.emit('saved categories', categs);
                } else {
                  connection.emit('request categories', '')
                }
              });
          } else {
            connection.emit('user not found');
          }
        });
      });
    });

    connection.on('sign up', (user) => {
      wNewsDb.collection('login', function (err, collection) {
        collection.save(user, {w: 1}, function (err, records) {
          if (err != null) {
            connection.emit('userName already exists', err);
          } else {
            connection.emit('account created', 'ok');
          }
        });

      });
    });

    connection.on('parse categories', (categoriesString) => {
      let items = JSON.parse(categoriesString).data.children
      const categories = items.map( item => {
        const data = item.data
        return models.createCategory(data['display_name'], data['public_description'], data['url'], data['banner_img'], data['icon_img'])
      })
      connection.emit('all categories', categories)
    })

    connection.on('save selected categories', (data) => {
      wNewsDb.collection('categories', function(err, collection) {
        for (var i = 0; i < data.length; i++) {
          console.log('LALA: ', data[i])
          collection.save(data[i], {w: 1}, function(err, records){});
        }
      })
      console.log('SAVED')
      connection.emit('successfully saved', '')
    })

    connection.on('parse articles', (articlesString) => {
      let items = JSON.parse(articlesString).data.children
      const articles = items.map( item => {
        const data = item.data
        console.log('ARTICLE', data.thumbnail)
        return models.createArticle(data['title'], data['score'], data['num_comments'], data['url'], data['thumbnail'])
      })
        connection.emit('selected articles', articles)
    })

    connection.on('disconnect', function () {
      console.log('Client disconnected ');
    });

    // connection.close()
  });

});

function setup(request, response) {
  var filePath = '.' + request.url;
  if (filePath == './') {
    filePath = './index.html';
  }

  var extname = String(path.extname(filePath)).toLowerCase()
  var mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.svg': 'application/image/svg+xml'
  };

  var contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        fs.readFile('./404.html', function(error, content) {
          response.writeHead(200, { 'Content-Type': contentType });
          response.end(content, 'utf-8');
        });
      } else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
        response.end();
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
}
