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

const api_link = "https://api.marketstack.com/v1/eod/latest";
const api_key = "391155620fff54fed932f06f3f574e81";
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
        const stock_list = "AAPL,NVDA,META,GOOG";
        const etf_list = "VOO,QQQ,SWIN,SPY"
        //const response = await fetch(`${api_link}${stock_list},${etf_list}`);
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
    //Call local api to fetch data from database
    await axios.get(`http://localhost:${PORT}/load_portfolio`)
        .then(res => {
            portfolio.length = 0;
            res.data.forEach((item, index) => {
                portfolio.push({
                    rowid: (index + 1),
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
    });
});

app.post("/add", async (req, res) => {
    //Form Validation 
    const errors = [];
    const stock = {};
    const qty = parseInt(req.body.qty);
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
        if (isNaN(qty)) {
            errors.push("The Quantity Must Be An Integer");
        }
        if (qty > 10 || qty < 0) {
            errors.push("The Quantity Must Be in Range From 1 to 10");
        }
    }
    //If errors > 0 will not run this
    if (!errors.length) {
        /*try {
            const response = await axios.get(api_link, {
                params: {
                    access_key: api_key,
                    symbols: req.body.ticker
                }
            })
            if (!response.data || Object.keys(response.data).length === 0) {
                errors.push("Symbol Not Found");
            }
            else {
                stock.symbol = response.data.symbol;
                stock.qty = qty;
                stock.price = parseFloat(response.data.high);
                stock.total_price = (parseFloat(response.data.high) * qty);
                stock.last_date = response.data.date;
            }
        }
        catch (err) {
            errors.push("Server Error Finding Symbol");
            console.log(err);
        }*/
        
        stock.symbol = req.body.ticker;
        stock.qty = qty;
        stock.price = 100;
        stock.total_price = parseFloat(100 * qty);
        stock.last_date = "2025-02-21T00:00:00+0000";

        if (stock.last_date) {
            await axios.get(`http://localhost:${PORT}/add_stock`, {
                params: {
                    symbol: stock.symbol,
                    qty: stock.qty,
                    price: stock.price,
                    total_price: stock.total_price,
                    last_date: stock.last_date
                }
            })
                .catch(error => {
                    console.log(error);
                });
        }
    }

    //Render portfolio page
    res.render("portfolio", {
        errors: errors,
        portfolio: portfolio
    });
});

app.post("/empty", () => {
    create_db();
    res.render("portfolio", {
        portfolio: portfolio
    });
});

//SQL API
app.get("/load_portfolio", async function (req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
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

app.get("/add_stock", async function (req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
    try {
        db.run("INSERT INTO stocks VALUES (?,?,?,?,?)", [req.query.symbol, req.query.qty, req.query.price, req.query.total_price, req.query.last_date]);
    } catch (err) {
        console.log(err);
    } finally {
        db.close();
    }
});

//Function 
function create_db() {
    const db = new sqlite3.Database("stockdatabase.db");
    try {
        db.serialize(function () {
            db.run("DROP TABLE IF EXISTS stocks");
            db.run(`CREATE TABLE IF NOT EXISTS stocks (
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

function test_sql() {
    const db = new sqlite3.Database("stockdatabase.db");
    db.run("INSERT INTO stocks VALUES ('VOO',1,150,150,'mar 1')")
}

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
