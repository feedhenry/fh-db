var _ = require('lodash');
var dateMetaFieldName = "$date";

function translateObjects(fields) {
    var ret = fields;
    if (fields) {
        _.forOwn(fields, function(val,key,obj) {
            if(val[dateMetaFieldName]) {
                var orig = val[dateMetaFieldName]
                var converted = new Date(val[dateMetaFieldName])
                try {
                    converted.toISOString() // ensure valid date
                    obj[key] = converted
                }
                catch (e){
                    // if invalid date use the value as passed 
                    obj[key] = orig
                }
            }
        });
    }
    return ret;
}

function translateDateObject(field) {
    var ret = field;
    if (field instanceof Date) {
        ret = {}
        ret[dateMetaFieldName] = field.toISOString();
    }
    return ret;
}

exports.translateDateObject = translateDateObject;
exports.translateObjects = translateObjects;