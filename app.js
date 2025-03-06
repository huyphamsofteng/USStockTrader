const express = require("express");

const app = express();
const PORT = 3000;



// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});