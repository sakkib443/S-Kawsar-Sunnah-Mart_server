// Production entry point.
// Render (and `npm start`) run `node index.js`. This thin root file simply
// loads the compiled server from dist/ (produced by `npm run build`), so the
// default `node index.js` start command works without extra configuration.
require('./dist/src/server.js');
