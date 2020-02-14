var express = require("express");
var app = express();

app.get("/", function(req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.use(express.static(__dirname));
app.listen(3000);
console.log("Application running on port 3000");

exports = module.exports = app;

