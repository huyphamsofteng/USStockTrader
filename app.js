const express = require("express");
const app = express();
const PORT = 3000;

const mustacheExpress = require('mustache-express');
app.engine('mustache', mustacheExpress(__dirname + '/views' + '/partials', '.mustache'));
app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

const axios = require('axios');
const sqlite3 = require("sqlite3").verbose();

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
        const stocks = [];
        const response = await axios(api_link, {
            params: {
                access_key: api_key,
                symbols: "AAPL,NVDA,META,GOOG,VOO,QQQ,VTI,SPY"
            }
        });
        response.data.data.forEach(item => {
            stocks.push({
                symbol: item.symbol,
                price: item.open,
                high: item.high,
                low: item.low
            })
        })
        res.render("index", {
            stocks: stocks.slice(0, -4),
            etfs: stocks.slice(4)
        });
    } catch (err) {
        res.render("error",
            {error: "External Server Error / Cannot Get Price From API"}
        );
        console.log(err);
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
        .catch(err => {
            res.render("error",
                {error: "External Server Error / Cannot Get Price From API"}
            );
            console.log(err);
        })
    if (portfolio.length > 0) {
        let search_symbols = portfolio[0].symbol;
        portfolio.forEach(async (item, index) => {
            if (index != 0) search_symbols = search_symbols.concat(",", item.symbol);
        });
        const response = await axios.get(api_link, {
            params: {
                access_key: api_key,
                symbols: search_symbols
            }
        })
        if (!response.data || Object.keys(response.data).length === 0) {
            res.render("error",
                {error: "External Server Error / Cannot Get Price From API"}
            );
        }
        else {
            for (let i = 0; i < response.data.data.length; i++) {
                portfolio[i].gain = (parseFloat(response.data.data[i].high) * portfolio[i].qty - portfolio[i].total_price).toFixed(2);
                portfolio[i].class_gain = (portfolio[i].gain > 0) ? "alert-success" : "alert-danger";
            }
        }
        for (let i = 0; i < portfolio.length; i++) {
            portfolio[i].gain = ((portfolio[i].total_price - parseFloat(response.data.data[i].high) * portfolio[i].qty)).toFixed(2);
            portfolio[i].class_gain = (portfolio[i].gain > 0) ? "alert-success" : "alert-danger";
        }
    }
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
        if (!Number.isInteger(qty)) {
            errors.push("The Quantity Must Be An Integer");
        }
        if (qty > 5 || qty < 0) {
            errors.push("The Quantity Must Be in Range From 1 to 5");
        }
    }
    //If errors > 0 will not run this
    if (!errors.length) {
        try {
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
                stock.symbol = response.data.data[0].symbol;
                stock.qty = qty;
                stock.price = (parseFloat(response.data.data[0].high).toFixed(2));
                stock.total_price = (parseFloat(response.data.data[0].high) * qty).toFixed(2);
                stock.last_date = response.data.data[0].date;
            }
        }
        catch (err) {
            res.render("error",
                {error: "External Server Error / Cannot Get Price From API"}
            );
            console.log(err);
        }
        if (stock.symbol) {
            await axios.post(`http://localhost:${PORT}/add_stock`, {
                params: {
                    symbol: stock.symbol,
                    qty: stock.qty,
                    price: stock.price,
                    total_price: stock.total_price,
                    last_date: stock.last_date
                }
            })
                .catch(err => {
                    res.render("error",
                        {error: "SQL Server Error"}
                    );
                    console.log(err);
                });
        }
    }
    //Render portfolio page
    res.render("portfolio", {
        errors: errors,
        portfolio: portfolio
    });
});

//SQL API
app.get("/load_portfolio", async function (req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
    db.all("SELECT * FROM stocks", [], (err, rows) => {
        if (err) {
            res.render("error",
                {error: "SQL Server Error"}
            );
            console.log(err);
        } else {
            res.json(rows);
            db.close();
        }
    });
});

app.post("/add_stock", async function (req, res) {
    const db = new sqlite3.Database("stockdatabase.db");
    try {
        db.serialize( () => {
            db.run("INSERT INTO stocks (symbol, qty, one_price, total_price, last_date) VALUES (?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET qty = qty + excluded.qty, one_price = excluded.one_price, total_price = total_price + excluded.total_price", [req.body.params.symbol, req.body.params.qty, req.body.params.price, req.body.params.total_price, req.body.params.last_date]);
            db.run("INSERT INTO transactions (symbol, qty, one_price, total_price, last_date) VALUES (?,?,?,?,?)", [req.body.params.symbol, req.body.params.qty, req.body.params.price, req.body.params.total_price, req.body.params.last_date]);
        })
        res.redirect("/portfolio");
    } catch (err) {
        res.render("error",
            {error: "SQL Server Error"}
        );
        console.log(err);
    } finally {
        db.close();
    }
});

app.post("/delete_stock/:symbol", async (req, res) => {
    const db = new sqlite3.Database("stockdatabase.db");
    db.all("DELETE FROM stocks WHERE symbol = (?)", [req.params.symbol], (err) => {
        if (err) {
            res.render("error",
                {error: "SQL Server Error"}
            );
            console.log(err);
        } else {
            db.close();
        }
    });
    res.redirect("/portfolio");
});

app.post("/empty_stock", async (req, res) => {
    const db = new sqlite3.Database("stockdatabase.db");
    try {
        db.serialize(function () {
            db.run("DROP TABLE IF EXISTS stocks");
            db.run("DROP TABLE IF EXISTS transactions");
            db.run(`CREATE TABLE IF NOT EXISTS stocks (
                symbol TEXT PRIMARY KEY,
                qty INTEGER NOT NULL,
                one_price REAL NOT NULL,
                total_price REAL NOT NULL,
                last_date TEXT NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                    symbol TEXT NOT NULL,
                    qty INTEGER NOT NULL,
                    one_price REAL NOT NULL,
                    total_price REAL NOT NULL,
                    last_date TEXT NOT NULL)`);
        });
        console.log("All clear");
        res.redirect("/portfolio");
    } catch (err) {
        res.render("error",
            {error: "SQL Server Error"}
        );
        console.log(err);
    } finally {
        db.close();
    }
});

app.get("/history", async (req, res) => {
    const db = new sqlite3.Database("stockdatabase.db");
    try {
        db.all("SELECT * FROM transactions", (err,rows) => {
            res.render("history", {
                transactions: rows
            });
        });
    }
    catch  (err) {
        res.render("error",
            {error: "SQL Server Error"}
        );
        console.log(err);
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
