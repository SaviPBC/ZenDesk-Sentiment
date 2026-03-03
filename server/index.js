const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/settings', require('./routes/settings'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/csat', require('./routes/csat'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/content-search', require('./routes/search'));

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
