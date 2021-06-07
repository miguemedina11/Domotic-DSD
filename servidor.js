var http = require("http");
var url = require("url");
var fs = require("fs");
var path = require("path");
var socketio = require("socket.io");
var request = require('request')

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').Server;
const { emit } = require("process");
const { UPDATE } = require("mongodb/lib/bulk/common");
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash"};

////////////////////////////////////////////////////////////////////////////////////////////////
var httpServer = http.createServer(
	function(request, response) {
		var uri = url.parse(request.url).pathname;
		if (uri=="/") uri = "/usuario.html";
		var fname = path.join(process.cwd(), uri);
		fs.exists(fname, function(exists) {
			if (exists) {
				fs.readFile(fname, function(err, data){
					if (!err) {
						var extension = path.extname(fname).split(".")[1];
						var mimeType = mimeTypes[extension];
						response.writeHead(200, mimeType);
						response.write(data);
						response.end();
					}
					else {
						response.writeHead(200, {"Content-Type": "text/plain"});
						response.write('Error de lectura en el fichero: '+uri);
						response.end();
					}
				});
			}
			else{
				console.log("Peticion invalida: "+uri);
				response.writeHead(200, {"Content-Type": "text/plain"});
				response.write('404 Not Found\n');
				response.end();
			}
		});
	}
);

////////////////////////////////////////////////////////////////////////////////////////////////

var temperatura = 20;
var temperaturaMax = 60;
var temperaturaMin = 0;
var luminosidad = 50;
var luminosidadMax = 80;
var luminosidadMin = 20;
var aire = 0;
var persiana = 1;

////////////////////////////////////////////////////////////////////////////////////////////////

MongoClient.connect("mongodb://localhost:27017/", { useUnifiedTopology: true }, function(err, db) {
	httpServer.listen(8080);
	var io = socketio(httpServer);

	var dbo = db.db("sensoresBD");
	dbo.collection("sensores", function(err, collection){
    	io.sockets.on('connection',
		function(client) {


            collection.find().toArray(function(err, results){
                var d = new Date();
                if(results.length == 0){
                    collection.insertOne({time:d, temp:temperatura, lumi:luminosidad, ac:aire, pers:persiana}, {safe:true}, function(err, result) {});
                    collection.insertOne({time:d, temp:temperatura, lumi:luminosidad, ac:aire, pers:persiana}, {safe:true}, function(err, result) {});
                }else if(results.length == 1){
                    collection.insertOne({time:d, temp:temperatura, lumi:luminosidad, ac:aire, pers:persiana}, {safe:true}, function(err, result) {});
                }
            });

			client.emit('conexion', {});

			client.on('poner', function (data) {
                update(data);
                if (agente()){
                    collection.insertOne(data, {safe:true}, function(err, result) {});
                    tweet(data);
                }
				
			});

			client.on('obtener', function (data) {
				collection.find().toArray(function(err, results){
                    client.emit('obtener', results);
				});
			});

            client.on('getTemperaturaGranada', function (data) {
                var url = 'http://api.openweathermap.org/data/2.5/weather?q=Granada,es&APPID=bc1d8a6611b1a3a35f4c8b898ec7eb19';
                request(url,function(err,response,body){
                    if(err){
                        console.log('error:', error);
                      } else {
                        var api = JSON.parse(body);
                        var temperatura = parseInt(api.main.temp) - 273.15;
                        temperatura = temperatura.toFixed(2);
                        client.emit('getTemperaturaGranada',temperatura);
                      }
                });
			});

            function update(data){
                persiana = data.pers;
                aireAcondicionado = data.ac;
                temperatura = data.temp;
                luminosidad = data.lumi;
            }

            function agente(){
                var result = true;
                var alerta = '';

                if ((luminosidad > luminosidadMax) && persiana == 1){
                    persiana = 0;
                    result = false;
                    alerta+= "\nLuminosidad muy Alta! Subiendo Persiana";
                }
                if ((luminosidad <= luminosidadMin) && persiana == 0){
                    persiana = 1;
                    result = false;
                    alerta+= "\nLuminosidad muy Baja! Bajando Persiana";
                }

                if ((temperatura > temperaturaMax) && aireAcondicionado==0){
                    aireAcondicionado = 1;
                    result = false;
                    alerta+= "\nTemperatura muy alta! Encendiendo el Aire";
                }
                if ((temperatura < temperaturaMin) && aireAcondicionado==1){
                    aireAcondicionado = 0;
                    result = false;
                    alerta+= "\nTemperatura muy baja! Apagando el Aire";
                }

                if (result == false){
                    var d = new Date();
                    collection.insertOne({time:d, temp:temperatura, lumi:luminosidad, ac:aireAcondicionado, pers:persiana}, {safe:true}, function(err, result) {});
                    tweet({time:d, temp:temperatura, lumi:luminosidad, ac:aireAcondicionado, pers:persiana});
                    io.sockets.emit('alerta', alerta);
                }

                return result;
            }

            function tweet(data){

                
            }


		});
    });
});

console.log("Servicio MongoDB iniciado");

////////////////////////////////////////////////////////////////////////////////////////////////

