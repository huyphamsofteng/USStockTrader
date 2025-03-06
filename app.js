const express = require("express");
const app = express();
const PORT = 3000;

const mustacheExpress = require('mustache-express');
app.engine('mustache', mustacheExpress(__dirname + '/views' + '/partials', '.mustache'));
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.get("/resources/bg_cover", async (req, res) => {
    const img_path = __dirname + "/resources/bg-cover.jpg";
    res.sendFile(img_path);
});

app.get("/resources/favicon", async (req, res) => {
    const icon_path = __dirname + "/resources/favicon.ico";
    res.sendFile(icon_path);
});



// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});