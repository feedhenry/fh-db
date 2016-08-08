var csvtojson = require("csvtojson"),
jcsv = require('jcsv');

exports.importer = function(csvString, cb){
  if (csvString instanceof Buffer){
    csvString = csvString.toString();
  }
  var Converter = csvtojson.core.Converter;
  // use " char as the char that may surround columns
  // see CSV spec : https://tools.ietf.org/html/rfc4180
  var csvConverter = new Converter({constructResult:true, quote: '"'});
  var parserMgr = csvtojson.core.parserMgr;
  parserMgr.addParser("typeTransformer",/./,function (params){

     var value = params.item,
     floatRegex = /^[-+]?[0-9]*\.?[0-9]+$/;
     stringRegex = /^".+"$/;
     if (value === 'true' || value === 'false'){
       params.resultRow[params.head] = value === 'true';
       return;
     }
     if (floatRegex.test(value) && !isNaN(parseFloat(value, 10))){
       params.resultRow[params.head] = parseFloat(value);
       return;
     }
     if (stringRegex.test(value)){
       params.resultRow[params.head] = value.substring(1, value.length-1);
       return;
     }
     if (value === ''){
       // JSON equiv of undefined..
       delete params.resultRow[params.head];
       return;
     }
     params.resultRow[params.head]= params.item;
  });

  // let's add the event handler before starting the conversion
  csvConverter.on("end_parsed", function(jsonObj) {
    if (!jsonObj) {
      return cb("Error parsing CSV");
    }
    if (!jsonObj instanceof Array || jsonObj.length === 0) {
      return cb("No CSV rows found");
    }
    return cb(null, jsonObj);
  });

  csvConverter.fromString(csvString);
};

exports.exporter = function(jsonArray, cb){
  jcsv(jsonArray, { separator : ',', newline : "\r\n", headers : true }, function(err, csv){
    if (err){
      return cb(err);
    }
    return cb(null, csv);
  });
};
