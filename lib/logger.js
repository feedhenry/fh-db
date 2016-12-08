// Dummy logger
// Should be replaced with a real logger if fh-db is beeing used in the
// future.

var logCfg = {
  error: true,
  warn: false,
  warning: false,
  info: false,
  debug: false
};

var logger = console;

var doLog = function(level, prefix, msg) {
  if( logCfg[level] ) {
    logger.log(prefix, msg);
  }
};

module.exports = {
  error: function (s) {doLog("error", "LOCALDB error", s);},
  warn: function (s) {doLog("warn", "LOCALDB warn", s);},
  warning: function (s) {doLog("warning", "LOCALDB warning", s);},
  info: function (s) {doLog("info", "LOCALDB info", s);},
  debug: function (s) {doLog("debug", "LOCALDB debug", s);}
};