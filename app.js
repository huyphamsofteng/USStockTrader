const express = require("express");
const app = express();
const PORT = 3000;

const mustacheExpress = require('mustache-express');
app.engine('mustache', mustacheExpress(__dirname + '/views' + '/partials', '.mustache'));
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

const axios = require('axios');
const sqlite3 = require("sqlite3").verbose();
const data = require("./latest.json");

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const stock_list = "AAPL,NVDA,META,GOOG";
const etf_list = "VOO,QQQ,SWIN,SPY"
const api_link = `http://api.marketstack.com/v1/eod/latest?access_key=391155620fff54fed932f06f3f574e81&symbols=${stock_list},${etf_list}`;
const portfolio = [];

app.get("/resources/bg_cover", async (req, res) => {
    const img_path = __dirname + "/resources/bg-cover.jpg";
    res.sendFile(img_path);
});

app.get("/resources/favicon", async (req, res) => {
    const icon_path = __dirname + "/resources/favicon.ico";
    res.sendFile(icon_path);
});

app.get("/", async (req, res) => {
    try {
        //const response = await fetch(api_link);
        //const data = await response.json();
        const stocks = [];
        const etfs = [];
        data.data.forEach((item) => {
            if (stock_list.includes(item.symbol)) {
                stocks.push({
                    symbol: item.symbol,
                    price: item.open,
                    high: item.high,
                    low: item.low
                })
            }
            else if (etf_list.includes(item.symbol)) {
                etfs.push({
                    symbol: item.symbol,
                    price: item.open,
                    high: item.high,
                    low: item.low
                })
            }
        })
        res.render("index", {
            stocks: stocks,
            etfs: etfs
        });
    } catch (error) {
        console.error("Error fetching API:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/portfolio", async (req, res) => {
    axios.get(`http://localhost:${PORT}/load_portfolio`)
        .then(res => {
            res.data.forEach((item) => {
                portfolio.push({
                    symbol: item.symbol,
                    qty: item.qty,
                    one_price: item.one_price,
                    total_price: item.total_price,
                    last_date: item.last_date
                })
            })
        })
        .catch(error => {
            console.error("Error fetching API:", error);
            res.status(500).send("Internal Server Error");
        })
    res.render("portfolio", {
        portfolio: portfolio
    })
    portfolio.length = 0;
});

app.post("/add", async (req, res) => {
    const errors = [];
    const symbol = {};
    if (!req.body.ticker) {
        errors.push("The Symbol Must Not Be Empty");
    }
    else {
        if (req.body.ticker.length > 5 || req.body.ticker.length < 1) {
            errors.push("The Symbol Must Have 1 to 5 Letters");
        }
    }
    if (!req.body.qty) {
        errors.push("The Quantity Must Not Be Empty");
    }
    else {
        try {
            symbol.qty = parseInt(req.body.qty);
            if (req.body.qty.length > 10 || req.body.qty.length < 0) {
                errors.push("The Quantity Must Be in Range From 1 to 10");
            }
        }
        catch (err) {
            errors.push("The Quantity Must Be An Integer");
        }
    }
    res.render("portfolio", {
        portfolio: portfolio,
        errors: errors
    })
});

app.post("/empty", (req, res) => {
    create_db();
});

//SQL API
app.get("/load_portfolio", async function (req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
    console.log('Connected to the SQLite database.');
    db.all("SELECT * FROM stocks", [], (err, rows) => {
        if (err) {
            console.error("Error fetching API:", err);
            res.status(500).send("Internal Server Error");
        } else {
            res.json(rows);
            db.close();
        }
    });
});

//Function 
async function create_db(req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
    console.log('Connected to the SQLite database.');
    try {
        db.serialize(function () {
            db.run("DROP TABLE IF EXISTS stocks");
            db.run(`CREATE TABLE IF NOT EXISTS stocks (
                id INTEGER PRIMARY KEY,
                symbol TEXT NOT NULL,
                qty INTEGER NOT NULL,
                one_price REAL NOT NULL,
                total_price REAL NOT NULL,
                last_date TEXT NOT NULL)`);
        });
        console.log("All clear");
    } catch (err) {
        console.log(err);
    } finally {
        db.close();
    }
};

function test_sql (){
    const db = new sqlite3.Database("stockdatabase.db");
    db.run("INSERT INTO stocks VALUES (1,'VOO',1,150,150,'mar 1')")
}

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
