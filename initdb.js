const sqlite3 = require("sqlite3").verbose();

const main = async () => {
    const db = new sqlite3.Database('stockdatabase.db');
    try {
        console.log('Connected to the SQLite database.');
        db.serialize(function () {
            db.run("DROP TABLE IF EXISTS stocks");
            db.run(`CREATE TABLE IF NOT EXISTS stocks (
                symbol TEXT PRIMARY KEY,
                qty INTEGER NOT NULL,
                one_price REAL NOT NULL,
                total_price REAL NOT NULL,
                last_date TEXT NOT NULL)`);
        });
        console.log("Created tablet stocks");
    } catch (err) {
        console.log(err);
    } finally {
        db.close();
    }
};

main();

