// Used as the log object in tests where no real output is desired
var logFn = function () {};

module.exports = {
  silly: logFn,
  trace: logFn,
  debug: logFn,
  info: logFn,
  warn: logFn,
  error: logFn
};